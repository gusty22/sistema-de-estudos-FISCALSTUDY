#!/usr/bin/env python3
"""Verifica contrato e dependencias de PR sem executar codigo da branch proponente.

Usado pelo workflow pull_request com checkout da base. Nao faz mutacoes.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

REPO = "gusty22/sistema-de-estudos-FISCALSTUDY"
OWNER = "gusty22"
BRANCH = re.compile(r"^(?:feat|feature|fix|chore|docs|test|experiment|lab|integration)/[A-Za-z0-9][A-Za-z0-9._/-]*$")


def api(path: str, token: str) -> dict:
    if not path.startswith(f"/repos/{REPO}/"):
        raise ValueError("API fora do repositorio autorizado")
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "FiscalStudy-PR-Contract"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(f"https://api.github.com{path}", headers=headers)
    with urlopen(req, timeout=15) as response:
        return json.load(response)


def value(body: str, key: str) -> str | None:
    match = re.search(rf"(?im)^\s*{re.escape(key)}:\s*(.*?)\s*$", body)
    return match.group(1).strip() if match else None


def validate(event: dict, get_pr, compare) -> list[str]:
    problems: list[str] = []
    pr = event["pull_request"]
    repo = event["repository"]["full_name"]
    head = pr["head"]["ref"]
    base = pr["base"]["ref"]
    actor = pr["user"]["login"]
    body = pr.get("body") or ""

    if repo != REPO or pr["head"]["repo"]["full_name"] != REPO:
        problems.append("Apenas PRs internos ao repositorio FiscalStudy sao aceitos.")
    if actor != OWNER:
        problems.append(f"Autor da PR precisa ser @{OWNER}; atual: @{actor}.")
    if not BRANCH.fullmatch(head) or ".." in head or "//" in head:
        problems.append("Nome de branch fora do padrao permitido.")
    if head == base:
        problems.append("Branch de origem igual a base.")
    if not re.fullmatch(r"#\d+", value(body, "Issue") or ""):
        problems.append("Issue: #N obrigatoria no corpo do PR.")
    for required in ("Testes", "Riscos"):
        if not value(body, required):
            problems.append(f"Campo {required}: obrigatorio e nao vazio.")

    dep = value(body, "Depends-on")
    if dep is None:
        problems.append("Campo Depends-on: none ou #N obrigatorio.")
    elif dep.lower() == "none":
        if base != "main":
            problems.append("PR sem dependencia deve apontar para a main.")
    elif re.fullmatch(r"#\d+", dep):
        number = int(dep[1:])
        if number == pr["number"]:
            problems.append("PR nao pode depender de si mesma.")
        else:
            try:
                parent = get_pr(number)
                if parent["state"] == "open":
                    if base != parent["head"]["ref"]:
                        problems.append("PR dependente aberta deve ter como base a branch head da PR mae.")
                elif parent.get("merged_at"):
                    if base != "main":
                        problems.append("Dependencia mesclada exige redirecionamento da base para main.")
                else:
                    problems.append("Dependencia fechada sem merge; requer replanejamento.")
            except (HTTPError, KeyError, ValueError) as exc:
                problems.append(f"Falha em verificar a PR dependente: {exc}")
    else:
        problems.append("Depends-on deve conter none ou #N.")

    if base and head and repo == REPO:
        try:
            result = compare(base, head)
            if result.get("behind_by", 0) != 0:
                problems.append("Branch desatualizada em relacao a base; reconciliar antes do merge.")
            if result.get("ahead_by", 0) == 0:
                problems.append("PR nao tem commits novos sobre a base.")
        except (HTTPError, KeyError, ValueError) as exc:
            problems.append(f"Comparacao GitHub nao disponivel: {exc}")
    return problems


def main() -> int:
    if len(sys.argv) != 2:
        print("Uso: check_pr_contract.py EVENT_PATH", file=sys.stderr)
        return 2
    event = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    token = os.environ.get("GITHUB_TOKEN", "")
    problems = validate(
        event,
        lambda n: api(f"/repos/{REPO}/pulls/{n}", token),
        lambda base, head: api(f"/repos/{REPO}/compare/{base}...{head}", token),
    )
    if problems:
        for problem in problems:
            print(f"ERROR: {problem}")
        return 1
    print("PASS: autoria, rastreabilidade, dependencia e base conferidas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
