# Validação do modelo individual: rodada de 26/10/2026

## Origem e ambiente

A base de código foi materializada seletivamente do commit remoto `90c26af0c67e5745e84080792d687dad200b4f49`. O repositório local é um snapshot de trabalho, não um clone completo do histórico remoto. A sessão anterior Linux ficou indisponível; alterações não publicadas não foram consideradas entregues nem portadas. As correções desta rodada são reimplementadas e verificadas no Windows.

Runtime: R 4.5.1 existente, com bibliotecas previamente instaladas configuradas por `R_LIBS_USER`/`FISCALSTUDY_R_LIBS`. Nenhuma instalação de dependência de produto é requisito novo destas correções. Testes são isolados dos bancos, Anki e integrações externas.

## Linha de base executada

Comando a partir de `analytics-engine/`:

```powershell
$env:R_LIBS_USER = 'C:\Users\washi\AppData\Local\R\win-library\4.5'
$env:FISCALSTUDY_R_LIBS = $env:R_LIBS_USER
& 'C:\Program Files\R\R-4.5.1\bin\Rscript.exe' tests/test_runner.R
```

Resultado observado antes das correções: **342 verificações aprovadas, zero falhas**, exit 0, 2.623 segundos. Log local: `C:/workspace/r-evidence-baseline.log`.

Esse resultado mostra que a base executava seus testes; não demonstra ausência de problemas. Parte dos testes antigos aceitava comportamentos que estão sendo corrigidos, incluindo inferências sem dados suficientes.

## Validações da alteração

Validação final desta rodada: R 4.5.1, suíte executada em 26/10/2026, **487 verificações aprovadas, 0 falhas**, exit 0, 10.425 segundos. Log local: `C:/workspace/r-evidence-full-final2.log`. Revisão QA independente após o último ajuste: 487/0, exit 0, 11.735 s; log `C:/workspace/r-qa-delta-final.log`. A linha de base anterior de 342 verificações não deve ser atribuída às novas alterações.

| Área | Critério verificável | Evidência final |
| --- | --- | --- |
| Perfil | Exclusão de resultados não avaliáveis; origem pessoal consistente; vazio não é zero; novidade não comprova transferência | Suíte completa: asserções de perfil e contratos integrados; inclui anuladas, resultados sem avaliação, origem mista e limites de transferência. |
| Histórico e memória | Cardinalidade; tópicos homônimos; ajuste insuficiente/falho explícito; invariância ao nome da disciplina; sem previsão/redistribuição fabricadas | Suíte completa: ajuste exploratório sem coeficientes sintéticos, estimativa não agendável e pesos não aplicáveis. |
| Adaptador e pipeline | Preservar identidade/datas/origem; validar qualidade temporal; cold start e proveniência na saída | Testes E2E incluídos: identidade/data/origem, fixture não produção, checksum inválido, origens mistas, cold start sem artefato antigo e manifesto configurado ausente. |
| Executor e integração | Arquivo de teste ausente/erro não gera falso sucesso; cenários entre módulos e serialização JSON | 487 aprovações na suíte; os testes específicos do executor cobrem arquivo obrigatório ausente e erro de execução como falhas. Harness fail-closed isolado: `C:/workspace/r-runner-harness-missing.log` e `C:/workspace/r-runner-harness-error.log`, exit 1. |

## Limites e recuperação

Nenhum banco original ou evento append-only foi alterado. Sem implantação, merge na main ou sincronização externa por este trabalho documental. As alterações de código continuam rastreáveis por diff e commits da área após revisão do orquestrador. Testes R não executam Java/Bridge nem homologam a aplicação integrada.

Não se declara homologação visual, integração Java executada, curva individual calibrada, eficácia pedagógica ou resolução de todas as lacunas do modelo do estudante. Os critérios de evolução estão em [LEARNER_MODEL_EXECUTION_PLAN.md](LEARNER_MODEL_EXECUTION_PLAN.md).
