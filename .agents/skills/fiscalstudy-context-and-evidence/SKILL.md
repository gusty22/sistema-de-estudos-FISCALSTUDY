---
name: fiscalstudy-context-and-evidence
description: Coordena recuperação seletiva e evidências em tarefas do FiscalStudy que cruzam módulos, contratos ou decisões arquiteturais; não carrega o acervo inteiro.
---
Ao iniciar, confirme Git (status, HEAD, main remota e PRs pertinentes), escolha uma branch baseada na referência verificada e leia o índice executivo em .agents/memory/CONTEXT.md.
Identifique o módulo e leia apenas seu AGENTS.md e contrato pertinente.
Verifique o índice com python scripts/context.py status. Se atualizado, consulte Graphify com --budget 600 e o --graph retornado; confirme no fonte. Sem índice, use rg no módulo.
Para decisões históricas, consulte scripts/context.py decision "<termos>"; a busca FTS é somente leitura; sem índice, usa documentação versionada. Não leia nem sincronize vault pessoal sem escopo explícito. Documentação histórica pode estar superada.
Confira implementação, chamadores e testes antes de criar um serviço ou contrato.

Durante a tarefa, reutilize contratos existentes, restrinja o diff e carregue somente a skill especializada pertinente (rotas em docs/engineering/SKILLS.md).
Preserve FSRS, SQLite operacional, custódia de chaves e modelos científicos. Políticas experimentais continuam can_apply=false e can_schedule=false.
Separe observações, estimativas, hipóteses e conclusões. Fixtures não são evidência pessoal.

Ao concluir, rode testes pertinentes e inspecione diff e git diff --check.
Se fontes estruturais mudaram, execute python scripts/context.py update uma vez; registre erro ou indisponibilidade sem bloquear a entrega do produto.
Atualize conhecimento duradouro apenas por decisão, contrato, descoberta ou marco relevante, citando commit/PR, arquivo e teste. Não crie nota por commit.
Entregue escopo, versão, comandos/resultados e limitações. Não declare execução, economia de tokens ou benefício científico sem evidências. Não faça merge/automerge nem push para main.
