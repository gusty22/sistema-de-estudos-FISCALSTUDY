# Fixtures do gate contextual

Todos os registros são sintéticos. A configuração de autoridade simula o host em testes; não deve ser instalada na operação nem importada a partir de JSON. Não representa histórico pessoal nem validação de modelo operacional.

De `analytics-engine`, gere dois arquivos novos:

```sh
Rscript tests/fixtures/contextual_gate/reproduce.R /tmp/memory-one.json memory
Rscript tests/fixtures/contextual_gate/reproduce.R /tmp/memory-two.json memory
cmp /tmp/memory-one.json /tmp/memory-two.json
cmp /tmp/memory-one.json tests/fixtures/contextual_gate/expected-memory.json
```

O artefato versionado contém snapshot, fontes, candidatos, especialistas/configuração simulados, admissão, necessidades vinculadas, três escolhas, proposta contextual, regras executadas, rastro e limitações. A igualdade de bytes foi verificada também entre R 4.5.0 e R 4.6.1. Isso comprova reprodução deste exemplo, sem estabelecer portabilidade universal de dados/locale ou eficácia pedagógica.

| Cenário | Proposta contextual |
|---|---|
| `cold` | `curriculum`, com inventário autorizado e conhecimento pessoal desconhecido |
| `insufficient_inventory` | abstenção |
| `memory` | `memory`, com evento de memória e resultado due/risco confirmados |
| `gap` | `gap`, para investigação conceitual |
| `transfer` | `transfer`, para avaliar aplicação/transferência |
| `execution` | `execution`, sem alegar causa psicológica |
| `time` | abstenção por orçamento |
| `unknown` | `curriculum`, sem diagnóstico pessoal |

O teste `tests/test_contextual_integration.R` também modifica fonte, escopo, tipo, versão, validade, autorização, flags e identidade de execução. O teste da CLI usa CSV/JSON reais e verifica que autoridade autodeclarada é ignorada.

Limites e resultados: [relatório do gate](../../../docs/CONTEXTUAL_INTEGRATION_GATE.md).
