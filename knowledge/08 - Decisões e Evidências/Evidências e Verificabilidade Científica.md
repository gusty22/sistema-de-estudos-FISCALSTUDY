# Evidências e Verificabilidade Científica

Esta nota consolida as diretrizes epistemológicas e os contratos de evidência adotados no FiscalStudy para validação empírica de aprendizagem.

---

## 1. Postulados Epistemológicos Fundamentais

Conforme estabelecido na governança do projeto e na suite de pesquisa (`analytics-engine/docs/`):

1. **Fixtures Verificam Software, Não Aprendizagem Pessoal**:
   Testes unitários automatizados validam a lógica determinística do código, algoritmos de agendamento e transporte de dados, mas nunca devem ser declarados como "prova de retenção humana".

2. **Correlação Não Demonstra Causalidade**:
   A associação estatística entre tempo de estudo e notas em simulações não implica causalidade direta sem controle rigoroso de variáveis de confusão (baseline do estudante, dificuldade intrínseca dos itens).

3. **Acerto Imediato Não Demonstra Retenção**:
   O acerto de uma questão imediatamente após o estudo reflete memória de trabalho ou reconhecimento passivo, não transferência conceitual duradoura (princípio de Bjork sobre desvantagens desejáveis).

4. **Tratamento de Incerteza e Evidência Ausente**:
   Quando dados históricos de um estudante forem escassos (problema de *cold start*), os modelos devem explicitamente abster-se de emitir diagnósticos categóricos e acionar parâmetros a priori conservadores.

---

## 2. Contratos Científicos Canônicos

- `analytics-engine/docs/LEARNER_MODEL_VALIDATION.md`: Metodologia de validação prospectiva e prequencial sem vazamento temporal (*temporal data leakage*).
- `analytics-engine/docs/MEMORY_EVIDENCE_CONTRACT.md`: Contrato de representação de memória, estabilidade e dificuldade do algoritmo FSRS.
- `analytics-engine/docs/DATA_PROVENANCE_AUDIT.md`: Barreira de custódia de dados e rastreabilidade de eventos de estudo.

---

## Vínculos Relacionados
- [[Psicometria e Modelo R]]
- [[Ciclo em 4 Estágios]]
- [[Recuperação Ativa]]
