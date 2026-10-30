# Impedimentos para piloto real no Windows

Escopo: piloto **operacional de estudos**, com captura prospectiva desligada. A homologação de runner descartável comprova software sob aquelas condições; não comprova a máquina ou os dados pessoais.

## Impedimentos operacionais confirmados ou ainda não validados

1. **As correções ainda estão em PRs draft, sem merge nem instalação pessoal.** PR #59 corrige atomicidade/retry das sessões; a PR de recuperação empilhada corrige a suíte e isola a exportação. É preciso revisar/integrar os incrementos e verificar o SHA efetivamente instalado. Nenhum merge foi feito por este trabalho.
2. **Clientes ainda podem criar outra operação no retry.** `frontend/src/components/timer/StudyTimerFab.tsx` gera `study-${Date.now()}` a cada clique. A API consegue deduplicar um ID estável; não consegue reconhecer identidades recriadas. O cliente precisa congelar ID e payload até confirmar, recuperando-os após falha/reload.
3. **Há caminhos de encerramento que não conferem HTTP antes de mostrar sucesso/fechar.** `QuestionViewer.confirmEndSessionWithHandoff` e `SessaoEstudoAtiva` fazem `await fetch` sem verificar `response.ok`. Um 409/500 pode ser tratado visualmente como sucesso. Devem preservar a operação pendente e só encerrar após confirmação. Esta manutenção de backend não alterou esses clientes.
4. **A instalação Windows pessoal não foi homologada.** Após corrigir os clientes, falta percurso sintético no aplicativo real: perda da resposta HTTP, bloqueio/erro SQLite, queda/reabertura e retry, conferindo evento/progresso únicos e feedback correto. Também faltam confirmação do diretório efetivo da base/exports, permissões do usuário, backup/restauração e proteção contra dois processos da instalação. Os testes de backend cobrem duas instâncias JDBC; isso não substitui o ciclo de vida do executável real.
5. **Se houver aproveitamento de uma base antiga, seu estado não foi auditado.** Não se leu base pessoal. A migration preserva o histórico, inclusive duplicações eventualmente anteriores; não as apaga nem corrige automaticamente. Para começar com base nova isolada este item não exige recuperar dados antigos; para migrar histórico, é necessário conferir uma cópia autorizada antes do piloto.

O gate nativo de sessões `642e2c8` passou em Windows Server 2022, Java 17.0.20, 35 testes sem skips; a suíte local completa passou com 422 testes, zero falhas/erros e quatro skips R. O resultado da nova suíte completa nativa com R precisa ser conferido separadamente, no commit da PR de recuperação. Não há alegação de teste de navegador Windows pessoal.

## Coleta científica prospectiva é um escopo adicional

O piloto operacional acima não exige criar chave, habilitar Anki/nuvem ou ativar captura científica. Se também se quiser avaliar previsões pessoais autenticadas, continuam aplicáveis os gates já existentes em `analytics-engine/docs/PILOT_ACTIVATION_GATE_V1.md` e na matriz de cobertura: autorização explícita de coleta/provisionamento, relógio/origem, chave/fingerprint confiados externamente, NTFS/armazenamento privado, exportação assinada verificada e delimitação de rotas homologadas. Cobertura global de especializados/simulados continua limitada. Esta solicitação de manutenção não iniciou esse piloto nem modificou suas flags.

R/FSRS e regras pedagógicas permaneceram independentes. Nenhum resultado de fixture ou de CI demonstra aprendizagem pessoal, retenção ou benefício pedagógico.
