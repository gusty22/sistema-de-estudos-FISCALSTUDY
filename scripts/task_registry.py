#!/usr/bin/env python3
"""
scripts/task_registry.py — Registro e ciclo de vida de tarefas para agentes do FiscalStudy.

Atende à FASE 4 da governança de memória:
- Estados permitidos: PLANNED, IN_PROGRESS, IMPLEMENTED, VALIDATED, BLOCKED, MERGED, CANCELLED.
- Invariantes estritas:
  * Não declarar VALIDATED sem evidência de teste.
  * Não declarar MERGED sem confirmação do GitHub (flag explícita).
  * Um único registro principal por tarefa, atualizado incrementalmente.
  * Sem geração de hashes fictícios ou notas redundantes.
"""

import os
import sys
import re
import json
import datetime
import subprocess
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
TASKS_DIR = ROOT / "knowledge" / "07 - Diário de Desenvolvimento"

ALLOWED_STATUSES = {
    "PLANNED",
    "IN_PROGRESS",
    "IMPLEMENTED",
    "VALIDATED",
    "BLOCKED",
    "MERGED",
    "CANCELLED",
}


def sanitize_filename(name: str) -> str:
    s = re.sub(r'[\\/*?:"<>|]', "", name)
    return s.strip().replace(" ", "_")


def get_task_path(task_id: str, tasks_dir: Path = TASKS_DIR) -> Path:
    tasks_dir.mkdir(parents=True, exist_ok=True)
    # Procura arquivo existente que comece com o ID
    for f in tasks_dir.glob("*.md"):
        if f.stem == task_id or f.stem.startswith(f"{task_id}_") or f.stem.startswith(f"{task_id}-"):
            return f
    # Padrão: task_id.md
    return tasks_dir / f"{sanitize_filename(task_id)}.md"


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(timespec="seconds")


def render_markdown(data: dict) -> str:
    """Gera conteúdo Markdown estruturado e compatível com Obsidian."""
    modules_str = ", ".join(f"`{m}`" for m in data.get("modules", [])) or "N/A"
    files_str = "\n".join(f"- `{f}`" for f in data.get("relevant_files", [])) or "- Nenhum arquivo registrado"
    commits_str = "\n".join(f"- `{c}`" for c in data.get("commits", [])) or "- Nenhum commit registrado"

    lines = [
        "---",
        f"id: \"{data['id']}\"",
        f"title: \"{data['title']}\"",
        f"status: \"{data['status']}\"",
        f"agent: \"{data.get('agent', 'N/A')}\"",
        f"branch: \"{data.get('branch', 'N/A')}\"",
        f"created_at: \"{data['created_at']}\"",
        f"updated_at: \"{data['updated_at']}\"",
        f"modules: {json.dumps(data.get('modules', []), ensure_ascii=False)}",
        "---",
        "",
        f"# {data['id']} — {data['title']}",
        "",
        "## Metadados",
        f"- **Estado**: `{data['status']}`",
        f"- **Agente**: `{data.get('agent', 'N/A')}`",
        f"- **Branch**: `{data.get('branch', 'N/A')}`",
        f"- **Abertura**: `{data['created_at']}`",
        f"- **Última Atualização**: `{data['updated_at']}`",
        f"- **Módulos Afetados**: {modules_str}",
        "",
        "## Objetivo",
        data.get("objective", "").strip() or "N/A",
        "",
        "## Arquivos Relevantes",
        files_str,
        "",
        "## Descobertas Importantes",
        data.get("discoveries", "").strip() or "Nenhuma descoberta duradoura registrada ainda.",
        "",
        "## Alterações Implementadas",
        data.get("changes", "").strip() or "Nenhuma alteração registrada.",
        "",
        "## Testes",
        data.get("tests", "").strip() or "Nenhum teste registrado.",
        "",
        "## Evidências de Validação",
        data.get("evidence", "").strip() or "Nenhuma evidência registrada.",
        "",
        "## Decisões Técnicas",
        data.get("decisions", "").strip() or "Nenhuma decisão técnica registrada.",
        "",
        "## Pendências e Bloqueios",
        data.get("pending", "").strip() or "Nenhuma pendência ativa.",
        "",
        "## Próxima Ação",
        data.get("next_action", "").strip() or "Definir próxima ação.",
        "",
        "## Rastreamento de Git e PR",
        f"- **PR**: {data.get('pr', 'N/A')}",
        "- **Commits Relacionados**:",
        commits_str,
        "",
    ]
    return "\n".join(lines)


def parse_markdown(text: str) -> dict:
    """Extrai campos do Markdown estruturado."""
    data = {
        "id": "",
        "title": "",
        "status": "PLANNED",
        "agent": "N/A",
        "branch": "N/A",
        "created_at": "",
        "updated_at": "",
        "modules": [],
        "objective": "",
        "relevant_files": [],
        "discoveries": "",
        "changes": "",
        "tests": "",
        "evidence": "",
        "decisions": "",
        "pending": "",
        "next_action": "",
        "pr": "N/A",
        "commits": [],
    }

    # Frontmatter YAML simples
    fm_match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.DOTALL)
    body = text
    if fm_match:
        fm_text, body = fm_match.groups()
        for line in fm_text.splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k == "modules":
                    try:
                        data["modules"] = json.loads(v)
                    except Exception:
                        data["modules"] = [m.strip() for m in v.strip("[]").split(",") if m.strip()]
                elif k in data:
                    data[k] = v

    # Seções Markdown
    sections = re.split(r"\n##\s+", "\n" + body)
    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue
        lines = sec.splitlines()
        header = lines[0].strip()
        content = "\n".join(lines[1:]).strip()

        if header == "Objetivo":
            data["objective"] = content
        elif header == "Arquivos Relevantes":
            files = []
            for l in lines[1:]:
                m = re.match(r"^\s*-\s*[`\"]?(.*?)[`\"]?$", l)
                if m and m.group(1) != "Nenhum arquivo registrado":
                    files.append(m.group(1))
            if files:
                data["relevant_files"] = files
        elif header == "Descobertas Importantes":
            data["discoveries"] = content
        elif header == "Alterações Implementadas":
            data["changes"] = content
        elif header == "Testes":
            data["tests"] = content
        elif header == "Evidências de Validação":
            data["evidence"] = content
        elif header == "Decisões Técnicas":
            data["decisions"] = content
        elif header == "Pendências e Bloqueios":
            data["pending"] = content
        elif header == "Próxima Ação":
            data["next_action"] = content
        elif header == "Rastreamento de Git e PR":
            for l in lines[1:]:
                l_str = l.strip()
                if l_str.startswith("- **PR**:"):
                    data["pr"] = l_str.split(":", 1)[1].strip()
                elif l_str.startswith("- **Commits Relacionados**:"):
                    continue
                elif re.match(r"^\s*-\s*[`\"]?(.*?)[`\"]?$", l_str):
                    cm = re.match(r"^\s*-\s*[`\"]?(.*?)[`\"]?$", l_str).group(1)
                    if cm and "Nenhum commit" not in cm and "Commits Relacionados" not in cm and not cm.startswith("**PR**"):
                        data["commits"].append(cm)

    return data


def create_task(
    task_id: str,
    title: str,
    objective: str,
    agent: str = "N/A",
    branch: str = "N/A",
    modules: list = None,
    relevant_files: list = None,
    tasks_dir: Path = TASKS_DIR,
) -> dict:
    """Cria uma nova tarefa no diário de desenvolvimento."""
    path = get_task_path(task_id, tasks_dir)
    if path.exists():
        raise ValueError(f"Tarefa {task_id} já existe em {path.name}")

    now = now_iso()
    task = {
        "id": task_id,
        "title": title,
        "status": "PLANNED",
        "agent": agent,
        "branch": branch,
        "created_at": now,
        "updated_at": now,
        "modules": modules or [],
        "objective": objective,
        "relevant_files": relevant_files or [],
        "discoveries": "",
        "changes": "",
        "tests": "",
        "evidence": "",
        "decisions": "",
        "pending": "",
        "next_action": "Iniciar implementação",
        "pr": "N/A",
        "commits": [],
    }

    content = render_markdown(task)
    path.write_text(content, encoding="utf-8")
    return task


def verify_remote_merge(
    pr: str,
    commits: list,
    target_branch: str = "origin/main",
    root: Path = ROOT,
    remote_verifier=None,
) -> tuple[bool, str]:
    """
    Verifica se a tarefa foi efetivamente mesclada no Git remoto (ex: origin/main).
    Não aceita apenas um booleano manual: exige confirmação rastreável.
    """
    if not pr or not pr.startswith("http") or "/pull/" not in pr:
        return False, "URL de Pull Request válida é obrigatória para o estado MERGED."

    if remote_verifier is not None:
        return remote_verifier(pr, commits, target_branch)

    clean_commits = [c.strip().strip("`") for c in (commits or []) if c and not c.startswith("**") and " " not in c.strip()]
    if not clean_commits:
        return False, "Nenhum commit rastreável registrado na tarefa para verificação remota."

    # 1. Verifica ancestralidade no git se o commit for acessível a partir do target_branch
    for commit in clean_commits:
        try:
            res = subprocess.run(
                ["git", "merge-base", "--is-ancestor", commit, target_branch],
                cwd=root,
                capture_output=True,
                timeout=10,
            )
            if res.returncode == 0:
                return True, f"Commit {commit} confirmado como ancestral de {target_branch}."
        except Exception:
            pass

    # 2. Verifica se commits estão listados nos ramos remotos contendo o target_branch
    for commit in clean_commits:
        try:
            res = subprocess.run(
                ["git", "branch", "-r", "--contains", commit],
                cwd=root,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=10,
            )
            if target_branch in res.stdout:
                return True, f"Commit {commit} confirmado como integrado em {target_branch}."
        except Exception:
            pass

    return False, f"Nenhum commit da tarefa ({', '.join(clean_commits)}) foi encontrado em {target_branch}. O merge no GitHub ainda não foi confirmado remotamente."


def update_task(
    task_id: str,
    status: str = None,
    agent: str = None,
    branch: str = None,
    modules: list = None,
    relevant_files: list = None,
    objective: str = None,
    discoveries: str = None,
    changes: str = None,
    tests: str = None,
    evidence: str = None,
    decisions: str = None,
    pending: str = None,
    next_action: str = None,
    pr: str = None,
    commits: list = None,
    pr_confirmed: bool = False,
    remote_verifier=None,
    tasks_dir: Path = TASKS_DIR,
) -> dict:
    """Atualiza incrementalmente um registro de tarefa existente."""
    path = get_task_path(task_id, tasks_dir)
    if not path.exists():
        raise FileNotFoundError(f"Tarefa {task_id} não encontrada em {tasks_dir}")

    task = parse_markdown(path.read_text(encoding="utf-8"))

    if status:
        status_upper = status.upper()
        if status_upper not in ALLOWED_STATUSES:
            raise ValueError(f"Estado '{status}' inválido. Permitidos: {', '.join(sorted(ALLOWED_STATUSES))}")

        # Invariante 1: Não declarar VALIDATED sem evidência de teste
        if status_upper == "VALIDATED":
            active_evidence = (evidence or task.get("evidence") or "").strip()
            active_tests = (tests or task.get("tests") or "").strip()
            if not active_evidence or active_evidence == "Nenhuma evidência registrada.":
                raise ValueError("Invariante violada: não é permitido transitar para VALIDATED sem evidências concretas de teste.")
            if not active_tests or active_tests == "Nenhum teste registrado.":
                raise ValueError("Invariante violada: não é permitido transitar para VALIDATED sem especificação dos testes executados.")

        # Invariante 2: Não declarar MERGED sem evidência confiável do estado remoto
        if status_upper == "MERGED":
            active_pr = (pr or task.get("pr") or "").strip()
            active_commits = (commits or task.get("commits") or [])
            repo_root = ROOT
            if tasks_dir != TASKS_DIR and tasks_dir.parent.exists():
                repo_root = tasks_dir.parents[1] if (tasks_dir.name == "07 - Diário de Desenvolvimento" and len(tasks_dir.parents) >= 2) else ROOT
            is_merged, reason = verify_remote_merge(
                pr=active_pr,
                commits=active_commits,
                root=repo_root,
                remote_verifier=remote_verifier,
            )
            if not is_merged:
                raise ValueError(f"Invariante violada: não é permitido declarar MERGED sem evidência confiável do estado remoto. {reason}")

        task["status"] = status_upper

    if agent:
        task["agent"] = agent
    if branch:
        task["branch"] = branch
    if modules is not None:
        task["modules"] = list(dict.fromkeys(task.get("modules", []) + modules))
    if relevant_files is not None:
        task["relevant_files"] = list(dict.fromkeys(task.get("relevant_files", []) + relevant_files))
    if objective:
        task["objective"] = objective
    if discoveries:
        task["discoveries"] = discoveries
    if changes:
        task["changes"] = changes
    if tests:
        task["tests"] = tests
    if evidence:
        task["evidence"] = evidence
    if decisions:
        task["decisions"] = decisions
    if pending:
        task["pending"] = pending
    if next_action:
        task["next_action"] = next_action
    if pr:
        task["pr"] = pr
    if commits:
        valid_commits = [c for c in commits if c and "Commits Relacionados" not in c and not c.startswith("**PR**")]
        task["commits"] = list(dict.fromkeys([c for c in task.get("commits", []) if "Commits Relacionados" not in c] + valid_commits))

    task["updated_at"] = now_iso()
    path.write_text(render_markdown(task), encoding="utf-8")
    return task


def list_tasks(status: str = None, tasks_dir: Path = TASKS_DIR) -> list:
    """Lista tarefas registradas no diretório."""
    tasks = []
    if not tasks_dir.exists():
        return tasks

    for f in sorted(tasks_dir.glob("*.md")):
        if f.name.startswith("README"):
            continue
        try:
            t = parse_markdown(f.read_text(encoding="utf-8"))
            if not t.get("id"):
                continue
            if status and t.get("status") != status.upper():
                continue
            tasks.append({
                "id": t["id"],
                "title": t["title"],
                "status": t["status"],
                "agent": t.get("agent"),
                "branch": t.get("branch"),
                "updated_at": t.get("updated_at"),
                "path": str(f.relative_to(ROOT)).replace("\\", "/") if f.is_relative_to(ROOT) else str(f),
            })
        except Exception:
            pass
    return tasks


def get_task(task_id: str, tasks_dir: Path = TASKS_DIR) -> dict:
    """Recupera os detalhes completos de uma tarefa."""
    path = get_task_path(task_id, tasks_dir)
    if not path.exists():
        raise FileNotFoundError(f"Tarefa {task_id} não encontrada")
    return parse_markdown(path.read_text(encoding="utf-8"))
