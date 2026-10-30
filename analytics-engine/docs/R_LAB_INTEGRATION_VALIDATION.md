# Evidências históricas da composição cruzada do laboratório R

> Recuperação documental em 30/10/2026. Este documento registra **o estado da experiência de 27/10/2026**, não uma nova validação do código atual ou autorização operacional.

## Proveniência

- Branch original: `integration/r-laboratory-validation`.
- Commit de composição: `1ffb0e916ecdc320612cc52e6a357fc3c6954d8b`.
- Commit de documentação: `bccb65940e27d78a768c1bc3bf28a907780ced28`.
- Manifesto histórico: [INTEGRATION_SOURCES.json](INTEGRATION_SOURCES.json).
- Execução histórica: [GitHub Actions 40440103059](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40440103059).

## Evidência reportada na execução histórica

O relatório original registrou 30 testes Python/R do laboratório, 640 verificações R, cinco sementes reproduzidas e replay de artefatos de questões e memória, sem falhas nem skips naquela execução. Os resultados eram de dados sintéticos; **não** comprovam eficácia pedagógica, desempenho em pessoas, generalização ou prontidão para produção.

No cenário sintético de questões, a média histórica global registrou Brier 0,237096 e log loss 0,667704; baselines individuais não demonstraram vantagem. No cenário sintético de memória, FSRS padrão registrou Brier 0,275057 e log loss 0,870704, contra 0,217010 e 0,642642 para Beta(1,1). Essas comparações são específicas dos geradores usados, não avaliação clínica ou de estudantes reais.

## Contratos preservados

- Evidência observada, estimada e hipotética permanece distinguida.
- Experimentos não alteram agendamento, FSRS canônico, SQLite operacional ou Anki.
- `can_apply=false` e `can_schedule=false` continuam sendo os limites experimentais.
- Testes de software não substituem validação prospectiva de retenção, aprendizagem e transferência.
- Esta recuperação é somente documental. Os arquivos de implementação foram preservados em suas versões atuais da `main`.

## Lacunas e próxima verificação

Precisam de validação independente: comportamento em dados humanos consentidos, identificação de conhecimento versus familiaridade, política de intervenção, avaliação prospectiva e execução end-to-end do produto. Para CI atual, executar os workflows na branch atual, sem reutilizar o sucesso histórico como comprovação de código futuro.
