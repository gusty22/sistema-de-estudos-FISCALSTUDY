#!/usr/bin/env python3
"""Auditoria GitHub somente-leitura de branches sem PR aberto ou merge comprovado.

Candidatos nao sao declarados codigo ausente: squash, cherry-pick e reescrita
podem mudar a ancestralidade; a integracao final exige comparacao semantica.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote

REPO = "gusty22/sistema-de-estudos-FISCALSTUDY"
TOKEN = os.environ.get("GITHUB_TOKEN", "")


def get(path: str) -> object:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "FiscalStudy-Branch-Audit"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    with urlopen(Request("https://api.github.com" + path, headers=headers), timeout=20) as resp:
        return json.load(resp)


def pages(kind: str) -> list:
    items: list = []
    for page in range(1, 16):
        result = get(f"/repos/{REPO}/{kind}?per_page=100&page={page}")
        if not isinstance(result, list):
            raise ValueError(f"Resposta inesperada: {kind}")
        items.extend(result)
        if len(result) < 100:
            return items
    raise RuntimeError(f"Limite de paginacao atingido para {kind}; auditoria incompleta")


def audit(branches: list, prs: list, compare) -> list[dict]:
    out = []
    for branch in branches:
        name = branch["name"]
        if name == "main":
            continue
        matching = [p for p in prs if p.get("head", {}).get("ref") == name]
        if any(p.get("state") == "open" for p in matching):
            continue
        sha = branch["commit"]["sha"]
        if any(p.get("merged_at") and p.get("base", {}).get("ref") == "main"
               and p.get("head", {}).get("sha") == sha for p in matching):
            continue
        result = compare(name)
        if result.get("ahead_by", 0) <= 0:
            continue
        if any(p.get("merged_at") and p.get("base", {}).get("ref") != "main" for p in matching):
            reason = "PR integrada em outra branch; conferir propagacao ate main"
        elif any(p.get("merged_at") for p in matching):
            reason = "Historico mudou ou merge anterior nao cobre o HEAD atual"
        elif matching:
            reason = "PR anterior fechada sem merge"
        else:
            reason = "Nenhuma PR encontrada para esta branch"
        out.append({"branch": name, "ahead": result["ahead_by"], "reason": reason})
    return sorted(out, key=lambda x: x["branch"])


def main() -> None:
    branches = pages("branches")
    # Parametros da pagina adicionados em unico endereco para evitar query duplicada.
    prs = []
    for page in range(1, 16):
        batch = get(f"/repos/{REPO}/pulls?state=all&per_page=100&page={page}")
        prs.extend(batch)
        if len(batch) < 100:
            break
    else:
        raise RuntimeError("Paginacao de PRs incompleta")
    candidates = audit(
        branches, prs,
        lambda name: get(f"/repos/{REPO}/compare/main...{quote(name, safe='/')}"),
    )
    rows = [
        "# FiscalStudy — auditoria semanal de branches",
        f"Branches remotas: {len(branches)}; PRs consultadas: {len(prs)}; candidatos a revisao: {len(candidates)}.",
        "",
        "Candidatos nao significam codigo necessariamente ausente. Nao realizar merge automatico.",
        "",
        "| Branch | Commits a frente | Motivo para investigar |",
        "|---|---:|---|",
    ]
    rows.extend(f"| {x['branch']} | {x['ahead']} | {x['reason']} |" for x in candidates)
    if not candidates:
        rows.append("| — | 0 | Nenhuma candidata pelos criterios atuais |")
    report = "\n".join(rows) + "\n"
    print(report)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        Path(os.environ["GITHUB_STEP_SUMMARY"]).write_text(report, encoding="utf-8")
    for x in candidates:
        print(f"::warning::Revisar branch {x['branch']}: {x['reason']}")


if __name__ == "__main__":
    main()
