# Controles de segurança da operação
Escopo: ferramentas de desenvolvimento, sem mudanças em lógica de produto.
Gitleaks 8.30.1 MIT: revisados LICENSE, go.mod, main.go, cmd/git.go e cmd/root.go no upstream; binários Windows/Linux x64 fixados por SHA-256 da API oficial da release.
Download só em diretório explícito descartável. Extração seleciona um único executável; sem install scripts, sudo ou instalação global.
Dependências Go incluem parsers, regex, arquivos compactados e CLI; não é auditoria de toda a cadeia transitiva. Atualização de versão exige revisar hashes/código. Fonte: https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1
CI usa ranges base..head em PR/push e redige valores; relatório fica no runner, sem upload. Histórico completo só via dispatch history=true. fetch-depth=0 disponibiliza commits, mas não equivale a varrer o histórico a cada push.
CodeQL action v4 fixada em 793b778da9c9275a0f276522b27cb5fc14bba279; Java sem build, JS/TS e Python. Permissão security-events:write só nesse job; sem execução de produto ou banco. R NÃO é suportado. Configuração/estrutura pode ser validada localmente; resultados de análise exigem CI.
Dependabot nativo semanal: Maven, npm, Actions e requirements pip do laboratório. Limites 3/3/2/2 PRs; minor/patch agrupados onde pertinente. Sem automerge.
Semgrep e Trivy não adicionados: manter primeiro o gate CodeQL/dependências; não há container do produto novo que justifique outro scanner nesta rodada.

## ArchUnit
Dependência test-only 1.3.0 Apache-2.0, já presente no cache local; POM e licença examinados. Importa bytecode, não inicia Spring/SQLite.
Regras: domínio evita camadas externas; application não depende do pacote direto de controladores web. DTOs web continuam permitidos para serviços, como na base.
A primeira execução identificou 46 dependências do RobinHoodCycleEngine para RobinHoodWeightsDTO/nested classes, já presentes em main 091ccb89. Exceção limitada a esse par origem/destino; demais acoplamentos continuam proibidos.
Não foi imposta ausência global de ciclos: exige baseline específico e não pode ser inferida da divisão em pacotes. Sem refatoração ampla.

## Matriz enxuta — ASVS 5.0.0
Mapeamento inicial por capítulos do padrão, NÃO certificação nem conformidade integral. IDs granulares e cobertura completa permanecem revisão futura.
Fonte estável: https://github.com/OWASP/ASVS/tree/v5.0.0/5.0/en

| Tema/referência | Componente | Evidência rastreável | Estado |
|---|---|---|---|
| V6 autenticação / V8 autorização | LocalAccessFilter | LocalAccessFilterTest; verificar token/localidade na implementação | parcial; não reavaliado integralmente |
| V1 encoding / V2 validação | validação de exportação e contexto | ProspectiveExportSecurityTest; test_scan_secrets rejeita SHA malformado | testes focados, sem cobertura integral |
| V4 API | exportador prospectivo | ProspectiveExportSecurityTest | gate focado executado separadamente |
| V11 criptografia | ProspectiveExportAttestor e fronteira R | testes existentes da cadeia/PRs #45–#46, sem tocar na chave operacional | evidência anterior; não regenerada aqui |
| V13 configuração/segredos | Actions e provisão externa | Gitleaks + permissões mínimas + test_scan_secrets | configurado; consultar resultados reais do gate |
| V14 proteção de dados | SQLite isolado e busca local | test_context_tools, filtro de diretórios, read-only FTS | escopo de ferramentas verificado |
| V16 logs/erros | scanner e CLI | teste de redação; stdout só arquivo/regra/linha/commit | verificado no teste controlado |

Assinatura não é prova causal, de timestamp independente ou de ausência de ajuda. Manter can_apply=false/can_schedule=false.
