# Homologação cruzada do laboratório R

## Composição revisável, sem merge

Branch temporária integration/r-laboratory-validation. Commit de código testado: 1ffb0e916ecdc320612cc52e6a357fc3c6954d8b. Fontes exatas em INTEGRATION_SOURCES.json. Nenhuma branch original ou main recebeu merge, force-push ou descarte de trabalho. A main verificada permaneceu em f77b3a4a3faa3a9beecbc231be2eedbdc2790196.

| Frente | PR | Branch | Validação individual recuperada |
|---|---|---|---|
| Baselines e integridade | #27 | experiment/learner-baseline-comparison | 23 testes + 600 verificações R; replay 50 arquivos |
| Memória FSRS oficial | #28 | experiment/fsrs-memory-lab | 30 testes + 600 verificações R; replay de memória 8 arquivos |
| Transporte UTF-8 | #29 | fix/analytics-utf8-transport | 23 testes + 614 verificações R; defeito original reproduzido antes da correção |
| Confiança ordinal | #30 | fix/r-ordinal-confidence-contract | 23 testes + 626 verificações R; denominadores e hipóteses explícitos |

Os PRs #28/#29/#30 são baseados em #27. A composição resolve explicitamente a coexistência da serialização UTF-8 e dos denominadores de confiança no exportador, preserva os dois conjuntos de testes e mantém os artefatos de memória. É ambiente de teste, não integração aprovada para produção.

## Execução cruzada real

[CI 40440103059](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40440103059): SUCESSO no commit 1ffb0e9.

- 30 testes Python/R do laboratório passaram, sem falhas ou skips.
- 640 verificações R passaram, zero falhas.
- Pipeline real em locale C preservou texto de métricas, disciplinas e tópicos.
- Contrato ordinal preservou denominador condicional real e ausência como NA.
- Experimento de questões com cinco seeds executado e auditado duas vezes: 50 arquivos idênticos.
- Experimento de memória com cinco seeds executado duas vezes: oito arquivos idênticos; escores R/Python concordantes.
- Banco operacional, Anki e inicialização Spring não foram utilizados.
- Artefato 12705668710, SHA-256 ada07bac0ba6916ef324bbca09a9cd22b99fb1f68b98dc8f2224c6c622333c10, expiração 2026-11-03T02:46:17Z.

Testes de software verificam contratos e determinismo; não são demonstração de domínio conceitual ou eficácia pedagógica. As contagens R são verificações do runner e dependem de fixtures/provedores disponíveis, não capacidades científicas independentes.

## Resultados científicos que limitam a adoção

No experimento de questões (2670 eventos, 1904 alvos futuros), a média histórica global obteve Brier 0,237096 e log loss 0,667704. Média por tópico e média móvel ficaram piores pelos critérios condicionais registrados. pyBKT teve duas indisponibilidades numéricas; não declarar superioridade com cobertura incompleta.

No experimento de recordação (1120 eventos, 160 cold starts, 960 alvos), FSRS oficial padrão obteve Brier 0,275057 e log loss 0,870704, versus 0,217010 / 0,642642 do histórico Beta(1,1). Viés previsto menos observado +0,270110. Isso é falta de calibração para o gerador escolhido, não evidência de falha em pessoas. Não mudar equações ou otimizar nos mesmos dados para obter um resultado favorável.

Nenhum desses resultados habilita pesos, intervenções, can_apply ou can_schedule. Não promover complexidade sem ganho demonstrado e validação apropriada.

## Matriz de experimentos e lacunas

| Experimento | Estado real | Evidência / lacuna |
|---|---|---|
| A — previsão | Executado, sintético | Baselines reais R e pyBKT; tempos estritamente anteriores |
| B — calibração | Executado, descritivo sintético | Brier/log loss, bins e bootstrap por seed; sem calibração humana |
| C — retenção individual | Parcial | Estados e previsões FSRS por item; sem estimador validado de parâmetros pessoais |
| D — conhecimento versus esquecimento | Não demonstrado | Gerador de memória fixa aquisição em 1; não identifica confusão conceitual |
| E — benefício das revisões | NOT_EXECUTED | Calendário fixo; datas calculadas FSRS não foram comparadas como políticas |
| F — adaptação pedagógica | NOT_EXECUTED | Nenhuma política causal ou intervenção pessoal avaliada |
| G — incerteza | Parcial | Cold start, históricos curtos, taxas ausentes e abstenção numérica; sem cobertura de parâmetros latentes |
| H — robustez | Parcial, tecnicamente testado | IDs, timestamps, hashes, falhas, UTF-8 e origem; não é cobertura de todas as condições reais |
| I — generalização | Parcial | Temporal dentro de cada estudante sintético; novos estudantes reais não avaliados |
| J — benefício adaptativo | NOT_EXECUTED | Sem ensaio de políticas R/Java nem demonstração causal |

## Pendências de dados e produto

1. Validar treino/seleção/teste separados em nova avaliação, sem otimizar para as seeds deste relatório.
2. Definir avaliações diagnósticas que distingam conhecimento, familiaridade e esquecimento; faltam evidências identificáveis para algumas dimensões.
3. Completar o transporte real de ajuda, variantes, causas anotadas, identidade de atividade e classificação histórica antes de análises causais. No CSV sintético legado, activity_id contém o tipo de atividade; não o usar como identidade única. Isso não foi reclassificado retroativamente.
4. Datasets públicos permanecem investigados documentalmente, sem validação retrospectiva: acesso/licenças de ASSISTments, MaiMemo e Junyi precisam ser concluídos; não baixar o EdNet inteiro sem uma amostra e protocolo.
5. Modelos complementares (IRT, GDINA, deep KT etc.) não foram executados; dados/identificabilidade e vantagem sobre baselines devem justificar cada inclusão.
6. Homologação Windows local, Java/Spring/SQLite, navegação visual e dashboard de memória não executados. O HTML do laboratório de questões é de dados efetivamente executados, sem promessa de interface de produção.
7. Autoridades cognitivas Java concorrentes e parsers temporais descritivos legados continuam exigindo revisão própria; não foram declarados resolvidos por esta composição.
8. Não houve validação prospectiva com histórico pessoal nem mensuração de eficácia pedagógica.

## Revisão e manutenção

Revisar e integrar #27 antes de retarget dos dependentes; preservar o escritor UTF-8 do #29 junto das mudanças estatísticas do #30 e os respectivos testes. Reproduzir pelo workflow versionado e comandos dos READMEs. A composição demonstra compatibilidade técnica; não concede autorização de merge.

Todas as mudanças são de código, testes e documentação, sem migração de dados. Recuperação por commits/branches preservados, sem regravar o histórico original. Arquivos individuais e resultados compactos estão versionados; artefatos completos são temporários e reproduzíveis pelos commits e dependências fixados.
