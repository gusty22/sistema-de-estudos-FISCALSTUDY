## Rastreabilidade
Issue: #NUMERO
Depends-on: none

## Entrega
Descrever os arquivos, contratos, comportamento e evidências reais da mudança.

## Validações e riscos
Testes: comandos executados, resultados e limitações concretas.
Riscos: impacto em dados, segurança, FSRS, migrações, regressões e pendências.

## Controles para revisão
- [ ] A base e o HEAD estão atualizados e sem conflitos
- [ ] CI aplicável aprovado no commit atual, sem skips indevidos
- [ ] Nenhum dado pessoal, segredo ou chave foi versionado
- [ ] Event Store append-only, FSRS e autoridade do Motor R preservados
- [ ] Dependências anteriores estão corretamente rastreadas e integradas
- [ ] Mantenedor revisou o diff e autorizou o merge

**Agentes não podem realizar merge ou automerge na main.**
