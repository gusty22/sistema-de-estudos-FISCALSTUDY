# Gate final de prontidão do piloto prospectivo

**Estado do piloto: NOT_STARTED. Ativação bloqueada.** Esta operação autoriza revisão e testes sintéticos; não autoriza coleta, sessão pessoal ou chave operacional. Main conferida antes da branch: `8724b3f` (PR #45 mesclada pelo mantenedor); as duas CIs do head `8c20fcd` estavam aprovadas. Não foi feito merge nesta operação.

A instalação acessível é Linux/cloud, não o computador pessoal Windows. Não se consultou banco pessoal, configuração secreta, chave operacional ou relatório privado. A homologação nativa descartável é executada pelo job `windows-synthetic-custody` da [CI prospectiva](../../.github/workflows/prospective-ledger.yml); seu log é a evidência Windows, e não os testes Linux. A aprovação desse runner não homologa automaticamente a instalação pessoal.

## Checklist verificável da instalação pessoal

| Critério | Estado | Evidência necessária / bloqueio |
|---|---|---|
| Instalação pessoal conferida | NOT_VERIFIED | Conferir commit instalado e versões Java/R/Python/OpenSSL no computador pessoal; nenhum acesso a esse computador nesta operação. |
| Origem e relógio confiáveis | NOT_VERIFIED | Conferir configuração efetiva da instância, isolamento de demos/testes, origem do event store e UTC/serviço de relógio. Ordem relativa é testada; assinatura não fornece relógio independente. |
| Custódia e permissões da chave | NOT_VERIFIED | Chave operacional não criada nem examinada. Após autorização futura, conferir proprietário, DACL NTFS restrita, diretório e fingerprint público por canal externo. Não confiar em chave fornecida pelo JSON. |
| Armazenamento privado dos relatórios | NOT_VERIFIED | Conferir volume/ACLs efetivos no computador, fora de Git/OneDrive/pastas compartilhadas. CLI agora exige DACL NTFS restrita antes de copiar dados; isso ainda não comprova o diretório pessoal não observado. |
| Cobertura dos fluxos de questões | FAIL | QuestionViewer cobre preparação/retry/retomada; ResolucaoQuestaoModal envia sem previsão e sem ajuda explícita. Exportador PowerShell legado usa CSV/checksum e não a cadeia assinada. Não usar essas rotas no piloto. |
| Exportação assinada e auditável | NOT_VERIFIED | Cadeia sintética testada; falta exportação da instalação pessoal verificada com raiz confiada externamente. Rótulo/hash isolados não valem como origem autenticada. |
| Denominadores e exclusões preservados | PASS | Gate de software: todas as previsões/respostas, pendências, ajudas, história não identificada e respostas sem previsão são contadas; testes Java→R e baselines de mesmo prefixo. Nenhum denominador pessoal foi observado. |
| Autorização explícita do usuário | FAIL | Não fornecida para iniciar coleta ou provisionar chave. Esta revisão não é autorização de início. |

A versão estruturada é [pilot_activation_gate_v1.json](results/pilot_activation_gate_v1.json). Não há endpoint/botão de ativação novo. Estados de instalação só podem ser promovidos com prova concreta posterior; nenhum teste sintético os promove automaticamente.

## Fronteira criptográfica revisada

- [ProspectiveExportAttestor.java](../../backend/src/main/java/com/fiscalstudy/backend/application/ProspectiveExportAttestor.java): chave RSA privada PKCS#8 DER somente por configuração do host; ausente mantém exportação unsigned, que o avaliador autenticado rejeita. Formato inválido/arquivo ausente falha; leitura agora limitada a 64 KiB, inclusive crescimento após verificação de tamanho. Testes usam apenas chave efêmera JCA em caminho Unicode; PEM textual não é DER e é rejeitado.
- [attested_prospective_evaluation.R](../lab/attested_prospective_evaluation.R): verifica assinatura RSA/SHA-256 com chave pública PEM e instalação fornecidas fora do JSON; confere hash exato do payload, estudante, cutoff, tipo de fonte e prefixo/ordem. Agora limita a leitura direta a 32 MiB e chave a 64 KiB, exige Boolean explícito para modo sintético e recusa mudança dos arquivos originais durante a execução. OpenSSL/chave ausentes, chave incorreta, origem incompatível, assinatura/hash alterados ou falha no prefixo não retornam resultado autenticado.
- [personal_pilot.py](../lab/personal_pilot.py): substituída leitura ilimitada após `stat()` por leitura realmente limitada. Congela bytes e confere tanto origem/chave externas quanto cópias após R. Só publica `metrics.json` depois de todas as verificações; relatório parcial fica `pending-metrics.json`, execução `FAILED`, sem selo de autenticação no manifesto. Diretórios existentes são recusados.
- No Windows, `chmod` não estabelece DACL: o CLI agora cria e audita ACL protegida para usuário atual, SYSTEM e Administrators, em NTFS, **antes** de copiar entrada. Falha de ACL/PowerShell/volume causa recusa. O temporário do R recebe a mesma proteção. Uso direto do R não substitui esse gate de armazenamento: a interface para futura avaliação pessoal é o CLI privado Python.
- R recusa espaços no próprio `R_TempDir`. Entradas/relatórios podem ter espaços e Unicode; o CLI usa temporário privado separado, sem espaços. Em Windows, tenta o caminho curto existente quando necessário; se indisponível, falha explicitamente e exige TEMP compatível. Não cria alias público para dados privados.

A assinatura atesta aquele snapshot sob confiança no servidor, chave e SQLite locais. Não protege contra administrador/host malicioso que reescreva o banco e reassine, nem comprova honestidade, identidade civil, ajuda externa invisível ou novidade do item. Sem raiz pública conferida externamente não há autenticação. Não se criou chave operacional nem nova autoridade para R.

## Cobertura dos chamadores reais

| Rota/componente existente | Resultado da inspeção |
|---|---|
| [QuestionViewer](../../frontend/src/components/QuestionViewer.tsx), efeitos de preparação e submissão | Usa [ProspectivePreparation](../../frontend/src/utils/prospectivePreparation.ts), trava controles até confirmação e envia o mesmo UUID. Retry com ack perdido, reload após preparação/resposta, reinício e troca rápida já têm testes unitários/browser. Recuperação consulta compromisso existente, não prevê retrospectivamente. PASS de software, não conferência de instalação pessoal. |
| [attemptJournal](../../frontend/src/utils/attemptJournal.ts) e [attemptSubmission](../../frontend/src/utils/attemptSubmission.ts) | Congelam identidade/payload e repetem submissão idempotente. O helper de submissão sozinho não exige previsão; não pode ser considerado prova de cobertura de qualquer chamador. |
| [QuestionSelectionService](../../backend/src/main/java/com/fiscalstudy/backend/application/QuestionSelectionService.java) / `/presented` | Recibo existente com debounce; envio pelo QuestionViewer pode falhar sem interromper estudo. Falta de recibo não prova ausência de contato. Não concede elegibilidade a novidade/retenção. |
| [ResolucaoQuestaoModal](../../frontend/src/components/questoes/ResolucaoQuestaoModal.tsx): usado por BancoQuestoes e SessaoEstudoAtiva | Cria `AttemptSubmission` diretamente, sem `ProspectivePreparation`/journal reservado e sem `usedHelp`. FAIL de cobertura prospectiva; não corrigido por frontend novo nem por backfill. Excluir explicitamente de futura coleta do piloto. |
| [QuestionController](../../backend/src/main/java/com/fiscalstudy/backend/infrastructure/in/web/QuestionController.java) / serviço de tentativa | Permite estudo normal sem previsão, deliberadamente. Se compromisso existe, associação/cronologia são conferidas; R exige tempo e ordem estritamente anteriores e conta respostas sem previsão. Não se mudou comportamento operacional para forçar experimento. |
| [ProspectivePredictionController](../../backend/src/main/java/com/fiscalstudy/backend/infrastructure/in/web/ProspectivePredictionController.java) / exportação | Snapshot do event store por endpoint loopback protegido por token, com assinatura opcional do servidor. CLI de avaliação não inicia sessão nem chama o endpoint. |
| [export_pilot_session.ps1](../../scripts/export_pilot_session.ps1) | Legado CSV+manifest/checksum e avaliação operacional antiga; mensagens de validação não comprovam previsão nem origem pessoal autenticada. Fora do procedimento prospectivo suportado. Não executar para este piloto. |

Nenhum componente de frontend, FSRS, calendário, schema/SQLite operacional ou política pedagógica foi alterado. Cobertura integral permanece FAIL. Uma eventual autorização para piloto **restrito ao QuestionViewer** precisa nomear esse escopo; não autoriza coleta por todas as telas.

## Evidência e reprodução

[Fixture/harness existente](../tests/fixtures/authentic_prospective/README.md) e [logs locais](validation/activation-readiness/). Java gera chave efêmera PKCS#8, questão real no repositório de teste e SQLite temporário. R verifica custódia, nega fonte sintética no modo operacional, confere baseline e mantém os seis novos alvos `NOT_ESTABLISHED`. Testes adicionais exercitam limite, substituição, chave/verificador ausentes, identidade e privacidade antes de copiar entrada.

Windows nativo descartável: `windows-2022`, Java 17, R 4.5.1, Python 3.13.7, OpenSSL nativo já instalado (incluindo o binário Git for Windows, quando necessário). Checkout, chave de teste, entrada, raiz pública e relatório usam espaços/Unicode. O harness audita independentemente ACLs de todos os arquivos do relatório e reprodução UTF-8/LF sem sobrescrita. O checkout Windows é restrito a backend/analytics-engine: a primeira tentativa de checkout completo falhou por caminhos longos de referências Docling sem relação com o piloto (log preservado). Isso não homologa um clone Windows completo nem oculta a limitação de caminhos. Nenhum banco pessoal é montado. Logs e versões do job devem acompanhar a decisão de PASS; CI pendente/falha não é homologação.

## Decisão de ativação futura

Continuar **NOT_STARTED**. Após decisão explícita posterior, conferir a instalação real com checklist, versões, relógio, custódia/fingerprint/ACL e armazenamento; selecionar somente fluxo coberto, manter pendências/exclusões e janela de observação pré-definida. Não fazer reteste pessoal como parte desta revisão. Não provisionar chave antes dessa autorização. Instruções de origem/assinatura e avaliação privada permanecem no [procedimento anterior](AUTHENTIC_PROSPECTIVE_EVIDENCE_V1.md), agora subordinadas a este gate.

O alvo continua acerto em questões normais sem ajuda declarada. Não há novo modelo, novidade/retencão/transferência demonstradas, efeito causal ou benefício pessoal estabelecido. `can_apply=false`, `can_schedule=false` em todas as saídas.
