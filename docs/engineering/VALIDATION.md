# Validação da operação
Base inicial: 091ccb89; rebase sem conflitos sobre main 6489a1f6455161aec4cb581aeae14b76e64c19a3 (PR #47). Execução Windows local; não houve acesso ao SQLite pessoal, FSRS ou provisão de chave.

| Comando | Resultado observado |
|---|---|
| python -m unittest discover -s scripts -p test_context_tools.py -v | 10 aprovados |
| python -m unittest discover -s scripts -p test_agent_protocol.py -v | 6 aprovados; arquivos/imports/fallback/IDs, sem inferência de modelo |
| python -m unittest discover -s .github/scripts -p test_scan_secrets.py -v | 3 aprovados |
| Maven 3.9.12/JDK17 offline test-compile | compilação efetiva dos testes durante gate Maven; classe ArchUnit gerada |
| mvn -o -B -ntp -Dtest=DevelopmentArchitectureTest,DiagnosticQuarantineArchitectureTest,ProspectiveExportSecurityTest test | 9 aprovados na base inicial; após rebase, mais ProspectivePredictionIntegrationTest: 19 aprovados, 0 falhas/erros/skips |
| Gitleaks 8.30.1 git --staged --redact=100 | 0 achados na rodada observada (119500 bytes); repetir no commit final |
| context.py update seguido de update | 427 fontes; 7 mudanças na rodada registrada; segundo comando fresh, 0 alterados; nenhum processo Graphify no no-op |
| context.py sync --vault docs/obsidian-sync --db graphify-out/repository-notes.db --exclude Estado-Atual.md | updated; corpus de notas versionadas, sem ler cofre pessoal |
| context.py decision "Contexto evidências" --db graphify-out/repository-notes.db | trecho Ambiente-Desenvolvimento, seção e fontes corretas; FTS5 somente leitura |
| benchmark_context.py | cinco caminhos e evidências recuperados; JSON versionado com bytes/I/O/estimativa |
| R policy constructors | conservative_decision_policy e conservative_learning_policy mantêm can_apply=FALSE e can_schedule=FALSE |
| Codex --version | 0.164.0-alpha.11.1; apenas Codex identificado no PATH |
| quick_validate.py das duas skills | bloqueado por ausência de PyYAML; metadados/recursos verificados pelos testes determinísticos |
| YAML/CodeQL remoto | configurações revisadas; validador YAML Python indisponível; execução real depende da CI da PR |

## Intermediários e limites
- Primeiras execuções no sandbox falharam por acesso aos temporários/rede; repetições autorizadas fora do sandbox usaram somente recursos de teste.
- Integração inicial dos fingerprints teve falha de edição CRLF; corrigida e suíte passou. Proteção de destino revelou conexão SQLite não fechada no Windows; corrigida, sem ignorar erro.
- A primeira regra ArchUnit encontrou 46 dependências legadas do motor de ciclo para DTO de pesos, presentes na base. A exceção final só permite o par específico e suas nested classes. Sem produção alterada.
- Smoke R inicial chamou helper inexistente (erro do comando de teste), substituído por construtores existentes após inspeção. As duas flags foram verificadas. Avisos locais de LC_*=C.UTF-8 no startup preservados.
- Não foi repetida a suíte científica completa por ausência de mudanças científicas. As quatro falhas de locale C continuam identificadas em analytics-engine/docs/validation/activation-readiness/inherited-locale-failures.json; não foram apresentadas como regressões nem suprimidas.
- Graphify: consulta PT irrelevante e explain homônimo; IDs completos e fontes são necessários. Sem tree-sitter-language-pack, os 34 R não produziram nós. Dois TSX parcialmente extraídos. Sem instalação automática.
- Os cinco casos de benchmark são recuperação determinística com oráculos fixos, não avaliação de modelos, uso real da API ou tarefa de implementação completa. Medidas de I/O interno podem superar a leitura do contexto antigo, pois frescor usa hashes de todos os fontes permitidos. Não há alegação de redução de processamento total.
- Agentes externos não foram executados. Matriz distingue configuração de runtime. Linux/Windows em CI ainda precisam de evidência do run correspondente.

Após rebase, o checkout esparso retirou .cursor da árvore local; git sparse-checkout add .cursor restaurou o arquivo já commitado e os seis testes de protocolo passaram. Não houve perda do adaptador.

## CI verificada antes do ajuste final de inclusão ArchUnit
Commit 328c40e: [Security controls](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40976806901) aprovado, incluindo Gitleaks e os 19 testes em Linux e Windows. [CodeQL](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40976806962) aprovado para as três linguagens; execução bem-sucedida não comprova ausência de todos os problemas.
O gate prospectivo usa lista explícita; DevelopmentArchitectureTest foi acrescentado para manter as duas invariantes na CI. Essa inclusão não modifica teste ou fonte operacional. O novo HEAD requer seu próprio resultado de CI.
