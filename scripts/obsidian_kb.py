#!/usr/bin/env python3
"""
obsidian_kb.py - Motor local e determinístico de busca e indexação para o cofre Obsidian.
Parte da arquitetura do Segundo Cérebro Técnico do FiscalStudy.

Recursos:
- Indexação e busca SQLite FTS5 com ranking híbrido (BM25 + Boost Estrutural + Normalização).
- Preservação de subtítulos/aliases Markdown (`# Título (Alias)`) no índice.
- Normalização de acentos (NFKD) e expansão morfológica leve (singular/plural).
- Boosts de relevância:
  * Correspondência de termo no título da nota (+5.0 por termo)
  * Correspondência na seção (+2.0 por termo)
  * Menções em Wikilinks bidirecionais (+1.5)
  * Correspondência exata da frase do título (+15.0)
- Decomposição por seções e títulos Markdown.
- Extração de tags (#tag), wikilinks ([[Nota]]) e metadados frontmatter.
- Formato de saída cirúrgico por trechos para economia máxima de tokens.
- Custo de API zero; bibliotecas locais padrão do Python.
"""

import os
import re
import sys
import json
import sqlite3
import argparse
import unicodedata
import hashlib
import fnmatch
from contextlib import closing
from pathlib import Path

# Suporte adequado a saída UTF-8 no Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_VAULT_PATH = os.environ.get("FISCALSTUDY_OBSIDIAN_VAULT")
DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "graphify-out" / "obsidian_fts.db"

STOPWORDS = {
    "a", "as", "o", "os", "um", "uma", "uns", "umas",
    "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
    "por", "para", "com", "sem", "sob", "sobre", "e", "ou", "que", "como",
    "se", "ao", "aos", "pelo", "pela", "pelos", "pelas"
}

def strip_accents(s: str) -> str:
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()

def expand_morphology(term: str):
    clean = strip_accents(term)
    if not clean:
        return []
    variants = {clean}
    # Variações plurais/singulares comuns em português
    if clean.endswith("oes"):
        variants.add(clean[:-3] + "ao")
    elif clean.endswith("ao"):
        variants.add(clean[:-2] + "oes")
    elif clean.endswith("ns"):
        variants.add(clean[:-2] + "m")
    elif clean.endswith("m") and len(clean) > 2:
        variants.add(clean[:-1] + "ns")
    elif clean.endswith("is") and len(clean) > 3:
        variants.add(clean[:-2] + "l")
    elif clean.endswith("l") and len(clean) > 2:
        variants.add(clean[:-1] + "is")
    elif clean.endswith("es") and len(clean) > 4:
        variants.add(clean[:-2])
    elif clean.endswith("s") and not clean.endswith("ss") and len(clean) > 3:
        variants.add(clean[:-1])
    else:
        if len(clean) > 3:
            variants.add(clean + "s")
    return list(variants)

def extract_frontmatter_and_content(text: str):
    frontmatter = {}
    content = text
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            raw_fm = parts[1].strip()
            content = parts[2].strip()
            for line in raw_fm.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    frontmatter[k.strip()] = v.strip()
    return frontmatter, content

def split_markdown_sections(file_rel_path: str, title: str, content: str):
    sections = []
    lines = content.splitlines()
    curr_heading = "Visão Geral"
    curr_lines = []
    
    # Extrair título H1 inicial como alias/subtítulo se houver
    h1_title = ""
    for line in lines:
        if line.startswith("# "):
            h1_title = line[2:].strip()
            break

    for line in lines:
        if line.startswith("#"):
            if curr_lines:
                chunk = "\n".join(curr_lines).strip()
                if chunk:
                    sections.append((curr_heading, chunk, h1_title))
                curr_lines = []
            curr_heading = line.lstrip("#").strip()
        else:
            curr_lines.append(line)
            
    if curr_lines:
        chunk = "\n".join(curr_lines).strip()
        if chunk:
            sections.append((curr_heading, chunk, h1_title))
            
    if not sections and content.strip():
        sections.append(("Geral", content.strip(), h1_title))
        
    return sections

def get_db(db_path: Path):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS notes_meta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rel_path TEXT UNIQUE,
            title TEXT,
            mtime REAL,
            frontmatter_json TEXT
        )
    """)
    conn.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
            title,
            section,
            content,
            rel_path UNINDEXED,
            wikilinks,
            tokenize = 'unicode61 remove_diacritics 2'
        )
    """)
    return conn

def sync_vault(vault_path: Path, db_path: Path, verbose: bool = False, excludes=()):
    if not vault_path.is_dir():
        if verbose:
            print(f"[ERRO] Vault não encontrado em: {vault_path}", file=sys.stderr)
        return False
        
    if db_path.resolve().is_relative_to(vault_path.resolve()):
        raise ValueError("O índice deve ficar fora da origem somente leitura")
    if db_path.name.casefold() in {"fiscalstudy.db", "staging.db"}:
        raise ValueError("Banco operacional não é um destino de índice")
    if db_path.exists():
        with closing(sqlite3.connect(db_path.resolve().as_uri() + "?mode=ro", uri=True)) as existing:
            tables = {row[0] for row in existing.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        allowed = {"notes_meta", "notes_fts", "fingerprints", "index_source", "sqlite_sequence"}
        if any(t not in allowed and not t.startswith("notes_fts_") for t in tables):
            raise ValueError("Destino contém tabelas de outro banco")
    conn = get_db(db_path)
    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS index_source (root TEXT NOT NULL)")
    source = cur.execute("SELECT root FROM index_source").fetchone()
    if source and source[0] != str(vault_path.resolve()):
        conn.close()
        raise ValueError("Índice pertence a outra origem; use outro --db")
    if not source:
        cur.execute("INSERT INTO index_source VALUES (?)", (str(vault_path.resolve()),))
    cur.execute("CREATE TABLE IF NOT EXISTS fingerprints (rel_path TEXT PRIMARY KEY, digest TEXT)")
    fingerprints = dict(cur.execute("SELECT rel_path, digest FROM fingerprints"))
    db_records = {row[0]: row[1] for row in cur.execute("SELECT rel_path, mtime FROM notes_meta").fetchall()}
    vault_files = {}
    
    indexed_count = 0
    updated_count = 0
    deleted_count = 0
    
    excluded_dirs = {".obsidian", ".trash", ".git", "private", ".private", "privado",
                     "pessoal", "personal", "node_modules", "__pycache__", ".venv", "venv"}
    for root, dirs, files in os.walk(vault_path, followlinks=False):
        dirs[:] = [d for d in dirs if d.casefold() not in excluded_dirs
                   and not d.startswith(".") and not (Path(root) / d).is_symlink()
                   and not (hasattr(Path, "is_junction") and (Path(root) / d).is_junction())
                   and not any(fnmatch.fnmatch((Path(root) / d).relative_to(vault_path).as_posix(), e) for e in excludes)]
        for f in files:
            full_p = Path(root) / f
            rel_p = full_p.relative_to(vault_path).as_posix()
            if (full_p.suffix.lower() == ".md" and not full_p.is_symlink()
                    and not f.startswith((".", "~")) and not f.endswith(".tmp.md")
                    and not any(fnmatch.fnmatch(rel_p, e) for e in excludes)):
                vault_files[rel_p] = full_p

    # Detectar remoções
    for rel_p in db_records:
        if rel_p not in vault_files:
            cur.execute("DELETE FROM notes_meta WHERE rel_path = ?", (rel_p,))
            cur.execute("DELETE FROM notes_fts WHERE rel_path = ?", (rel_p,))
            cur.execute("DELETE FROM fingerprints WHERE rel_path = ?", (rel_p,))
            deleted_count += 1
            
    # Indexar / Atualizar
    for rel_p, full_p in vault_files.items():
        mtime = full_p.stat().st_mtime
        digest = hashlib.sha256(full_p.read_bytes()).hexdigest()
        if fingerprints.get(rel_p) == digest:
            continue
            
        try:
            text = full_p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            try:
                text = full_p.read_text(encoding="latin1")
            except Exception:
                continue
                
        cur.execute("INSERT OR REPLACE INTO fingerprints VALUES (?, ?)", (rel_p, digest))
        fm, clean_content = extract_frontmatter_and_content(text)
        title = full_p.stem
        
        wikilinks = re.findall(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", text)
        wikilinks_str = " ".join(set(wikilinks))
        
        cur.execute("DELETE FROM notes_meta WHERE rel_path = ?", (rel_p,))
        cur.execute("DELETE FROM notes_fts WHERE rel_path = ?", (rel_p,))
        
        cur.execute(
            "INSERT INTO notes_meta (rel_path, title, mtime, frontmatter_json) VALUES (?, ?, ?, ?)",
            (rel_p, title, mtime, json.dumps(fm, ensure_ascii=False))
        )
        
        sections = split_markdown_sections(rel_p, title, clean_content)
        for sec_name, sec_text, h1_title in sections:
            # Se houver um título H1 mais descritivo/com alias (ex: 'Recuperação Ativa (Retrieval Practice)'),
            # enriquecemos a coluna title do índice para permitir buscas exatas
            indexed_title = f"{title} {h1_title}".strip() if h1_title and h1_title != title else title
            cur.execute(
                "INSERT INTO notes_fts (title, section, content, rel_path, wikilinks) VALUES (?, ?, ?, ?, ?)",
                (indexed_title, sec_name, sec_text, rel_p, wikilinks_str)
            )
            
        if rel_p in db_records:
            updated_count += 1
        else:
            indexed_count += 1
            
    conn.commit()
    conn.close()
    
    if verbose:
        print(f"[Sync] Vault sincronizado. Indexados: {indexed_count}, Atualizados: {updated_count}, Removidos: {deleted_count}")
    return True

def search_vault(query: str, db_path: Path, limit: int = 5, max_chars: int = 800):
    if not db_path.exists():
        return []
        
    conn = sqlite3.connect(db_path.resolve().as_uri() + "?mode=ro", uri=True)
    cur = conn.cursor()
    
    raw_tokens = re.findall(r"[A-Za-z0-9_Á-ú]+", query)
    meaningful_tokens = [t for t in raw_tokens if strip_accents(t) not in STOPWORDS]
    
    if not meaningful_tokens:
        meaningful_tokens = raw_tokens
    if not meaningful_tokens:
        conn.close()
        return []
        
    expanded_groups = []
    all_query_stems = set()
    for t in meaningful_tokens:
        variants = expand_morphology(t)
        expanded_groups.append(variants)
        for v in variants:
            all_query_stems.add(v)
            
    fts_or_clauses = []
    for g in expanded_groups:
        clause = " OR ".join([f'"{v}"' for v in g])
        fts_or_clauses.append(f"({clause})")
        
    clean_fts_query = " OR ".join(fts_or_clauses)
    
    # Pesos FTS5 BM25: title=10.0, section=5.0, content=1.0, wikilinks=2.0
    sql = """
        SELECT title, section, rel_path, wikilinks,
               snippet(notes_fts, 2, '[[HIGHLIGHT]]', '[[/HIGHLIGHT]]', '...', 35) as snip,
               content,
               bm25(notes_fts, 10.0, 5.0, 1.0, 0.0, 2.0) as rank
        FROM notes_fts
        WHERE notes_fts MATCH ?
        ORDER BY rank
        LIMIT 60
    """
    
    try:
        rows = cur.execute(sql, (clean_fts_query,)).fetchall()
    except sqlite3.OperationalError:
        escaped = " OR ".join([f'"{strip_accents(t)}"' for t in meaningful_tokens])
        rows = cur.execute(sql, (escaped,)).fetchall()
        
    scored_results = []
    norm_query = strip_accents(query)
    
    for r in rows:
        title, section, rel_path, wikilinks, snip, full_content, rank = r
        
        norm_title = strip_accents(title)
        norm_sec = strip_accents(section)
        norm_content = strip_accents(full_content)
        norm_wikilinks = strip_accents(wikilinks or "")
        
        # 1. Base BM25 convertida para positivo
        score = -rank
        
        # 2. Boost estrutural por título exato ou frase
        if norm_title in norm_query or norm_query in norm_title:
            score += 15.0
            
        # 3. Boost de tokens no título
        title_matches = 0
        for stem in all_query_stems:
            if stem in norm_title:
                title_matches += 1
                score += 4.0
                
        # Bônus adicional se o título contiver múltiplos termos-chave
        if title_matches >= 2:
            score += 6.0
            
        # 4. Boost de seção
        for stem in all_query_stems:
            if stem in norm_sec:
                score += 1.5
                
        # 5. Boost de wikilinks
        for stem in all_query_stems:
            if stem in norm_wikilinks:
                score += 1.0
                
        # Limitar tamanho do trecho para garantir economia de tokens
        snippet_clean = snip.replace("[[HIGHLIGHT]]", "**").replace("[[/HIGHLIGHT]]", "**")
        if len(full_content) <= max_chars:
            excerpt = full_content
        else:
            excerpt = snippet_clean
            
        links = [l.strip() for l in wikilinks.split() if l.strip()] if wikilinks else []
        
        # O nome do arquivo real pode ser obtido via rel_path
        file_title = Path(rel_path).stem
        
        scored_results.append({
            "title": file_title,
            "section": section,
            "rel_path": rel_path,
            "score": round(score, 3),
            "excerpt": excerpt[:max_chars],
            "related_wikilinks": links
        })
        
    conn.close()
    
    # Ordenar pelos scores ponderados mais altos
    scored_results.sort(key=lambda x: x["score"], reverse=True)
    return scored_results[:max(1, min(limit, 20))]

def main():
    parser = argparse.ArgumentParser(description="Motor de busca FTS5 / BM25 para o cofre Obsidian")
    parser.add_argument("--sync", action="store_true", help="Atualiza o índice a partir dos arquivos Markdown")
    parser.add_argument("--query", "-q", type=str, help="Termo ou pergunta em linguagem natural para pesquisar")
    parser.add_argument("--limit", "-n", type=int, default=4, help="Número máximo de trechos retornados")
    parser.add_argument("--vault", type=str, default=DEFAULT_VAULT_PATH, help="Caminho do vault Obsidian")
    parser.add_argument("--db", type=str, default=str(DEFAULT_DB_PATH), help="Caminho do arquivo SQLite FTS")
    parser.add_argument("--json", action="store_true", help="Exibe saída puramente em formato JSON")
    
    parser.add_argument("--exclude", action="append", default=[], help="Glob relativo adicional excluído da indexação")
    parser.add_argument("--max-chars", type=int, default=800)
    args = parser.parse_args()
    if not 1 <= args.limit <= 20 or not 1 <= args.max_chars <= 4000:
        parser.error("limit 1..20; max-chars 1..4000")
    vault_p = Path(args.vault) if args.vault else None
    db_p = Path(args.db)
    
    if args.sync:
        if vault_p is None:
            parser.error("--sync exige --vault ou FISCALSTUDY_OBSIDIAN_VAULT")
        if not sync_vault(vault_p, db_p, verbose=not args.json, excludes=args.exclude):
            parser.exit(2, "Origem indisponível; índice não atualizado\n")

    if args.query:
        if not db_p.exists():
            parser.exit(2, "Índice indisponível; execute --sync com origem autorizada\n")
        results = search_vault(args.query, db_p, limit=args.limit, max_chars=args.max_chars)
        
        if args.json:
            print(json.dumps(results, indent=2, ensure_ascii=False))
        else:
            if not results:
                print(f"\n[Obsidian KB] Nenhuma nota relevante encontrada para: '{args.query}'\n")
                return
                
            print(f"\n[Obsidian KB] {len(results)} trecho(s) relevante(s) encontrado(s) para: '{args.query}'")
            print("=" * 70)
            for i, r in enumerate(results, 1):
                print(f"[{i}] {r['title']} -> {r['section']} (Relevância: {r['score']})")
                print(f"    Arquivo: {r['rel_path']}")
                if r.get('related_wikilinks'):
                    print(f"    Links: {', '.join(r['related_wikilinks'][:5])}")
                print(f"    Trecho:")
                for l in r['excerpt'].splitlines()[:6]:
                    print(f"    {l}")
                print("-" * 70)

if __name__ == "__main__":
    main()
