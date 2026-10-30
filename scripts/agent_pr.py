#!/usr/bin/env python3
"""Publica/atualiza PR de agente usando o GitHub CLI da conta do mantenedor.

Nao faz merge, automerge, force-push, checkout destrutivo ou push na main.
Requer git, gh autenticado como gusty22 e commits locais prontos.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = "gusty22/sistema-de-estudos-FISCALSTUDY"
OWNER = "gusty22"
BRANCH_PATTERN = re.compile(r"^(?:feature|feat|fix|chore|docs|test|experiment|lab|integration)/[A-Za-z0-9][A-Za-z0-9._/-]*$")


def command(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, text=True, capture_output=True, check=False)
    if check and result.returncode:
        raise RuntimeError(f"{' '.join(args)}: {result.stderr.strip() or result.stdout.strip()}")
    return result


def json_command(*args: str) -> dict:
    return json.loads(command(*args).stdout)


def ensure_account() -> None:
    account = json_command("gh", "api", "user").get("login")
    if account != OWNER:
        raise RuntimeError(f"gh autenticado como {account!r}; esperado {OWNER!r}. Nao publicar por outra conta.")
    actual_repo = json_command("gh", "repo", "view", "--json", "nameWithOwner").get("nameWithOwner")
    if actual_repo != REPO:
        raise RuntimeError(f"Repositorio gh atual e {actual_repo!r}, esperado {REPO!r}.")


def dependency_base(depends_on: int | None) -> str:
    if depends_on is None:
        return "main"
    parent = json_command("gh", "pr", "view", str(depends_on), "--repo", REPO,
                          "--json", "headRefName,state,mergedAt")
    if parent["state"] == "OPEN":
        parent_ref = parent["headRefName"]
        if not BRANCH_PATTERN.fullmatch(parent_ref):
            raise RuntimeError("Branch da PR dependente tem nome invalido.")
        return parent_ref
    if parent.get("mergedAt"):
        return "main"
    raise RuntimeError("PR dependente foi fechada sem merge. Replaneje a dependencia.")


def ensure_worktree() -> str:
    current = command("git", "branch", "--show-current").stdout.strip()
    if not BRANCH_PATTERN.fullmatch(current) or ".." in current or "//" in current:
        raise RuntimeError(f"Branch {current!r} nao esta no padrao; nunca publicar a main.")
    if command("git", "status", "--porcelain").stdout.strip():
        raise RuntimeError("Ha arquivos nao commitados. Revise e registre o diff antes de publicar.")
    return current


def ensure_rebased(base: str) -> None:
    # FETCH_HEAD aponta para a referencia atual; nao reescreve branches locais.
    command("git", "fetch", "--no-tags", "origin", base)
    if command("git", "merge-base", "--is-ancestor", "FETCH_HEAD", "HEAD", check=False).returncode:
        raise RuntimeError(f"A base origin/{base} nao e ancestral da branch. Reconcilie conflitos e reexecute.")
    if command("git", "rev-list", "--count", "FETCH_HEAD..HEAD").stdout.strip() == "0":
        raise RuntimeError("Sem commits exclusivos em relacao a base; nada a publicar.")


def pr_body(args: argparse.Namespace, base: str) -> str:
    dependency = f"#{args.depends_on}" if args.depends_on else "none"
    return (
        "## Rastreabilidade\n"
        f"Issue: #{args.issue}\n"
        f"Depends-on: {dependency}\n"
        f"Base validada: {base}\n\n"
        "## Entrega\n"
        f"{args.summary.strip()}\n\n"
        "## Validacoes e riscos\n"
        f"Testes: {args.tests.strip()}\n"
        f"Riscos: {args.risks.strip()}\n\n"
        "## Controles\n"
        "- [ ] CI aplicavel aprovado no HEAD atual\n"
        "- [ ] Diff e contratos revisados pelo mantenedor\n"
        "- [ ] Dependencias anteriores mescladas ou ainda empilhadas corretamente\n"
        "- [ ] Segredos, dados pessoais, FSRS e autoridade operacional preservados\n\n"
        "**O agente nao esta autorizado a fazer merge/automerge na main.**\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Publica branch e cria/atualiza PR draft pela conta do proprietario.")
    parser.add_argument("--issue", type=int, required=True, help="Issue de rastreabilidade ja aberta.")
    parser.add_argument("--title", required=True, help="Titulo do PR.")
    parser.add_argument("--summary", required=True, help="Resumo efetivo da entrega.")
    parser.add_argument("--tests", required=True, help="Testes executados e resultados, ou limitacao explicita.")
    parser.add_argument("--risks", required=True, help="Riscos, pendencias e impacto.")
    parser.add_argument("--depends-on", type=int, help="Numero da PR anterior, se o trabalho e empilhado.")
    args = parser.parse_args()

    try:
        if args.issue <= 0:
            raise RuntimeError("Issue deve ter numero positivo.")
        ensure_account()
        branch = ensure_worktree()
        base = dependency_base(args.depends_on)
        ensure_rebased(base)
        issue = json_command("gh", "issue", "view", str(args.issue), "--repo", REPO, "--json", "number,state")
        if issue["number"] != args.issue:
            raise RuntimeError("Issue vinculada nao confere.")
        body = pr_body(args, base)
        # Nenhum force push. Push nao altera a main e usa apenas o ref atual.
        command("git", "push", "-u", "origin", f"HEAD:refs/heads/{branch}")
        with tempfile.TemporaryDirectory(prefix="fiscalstudy-pr-") as td:
            file = Path(td) / "body.md"
            file.write_text(body, encoding="utf-8")
            found = command("gh", "pr", "view", branch, "--repo", REPO,
                            "--json", "number,state,baseRefName", check=False)
            if found.returncode == 0:
                prior = json.loads(found.stdout)
                if prior["state"] != "OPEN":
                    raise RuntimeError("PR anterior fechada; nao reabrir automaticamente.")
                number = str(prior["number"])
                command("gh", "pr", "edit", number, "--repo", REPO, "--base", base,
                        "--title", args.title, "--body-file", str(file))
                print(f"PR atualizada: https://github.com/{REPO}/pull/{number}")
            else:
                url = command("gh", "pr", "create", "--repo", REPO, "--head", branch,
                              "--base", base, "--draft", "--title", args.title,
                              "--body-file", str(file)).stdout.strip()
                print(f"PR draft criada: {url}")
        print(f"Branch: {branch} | Base: {base} | Depends-on: {args.depends_on or 'none'}")
        return 0
    except (RuntimeError, OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
