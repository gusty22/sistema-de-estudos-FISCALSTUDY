# INSPECTION - Técnico Fiscal (Araguari 2023 - IBGP)

## Observações de Layout
1. **Páginas e Colunas**: O PDF apresenta formatação em duas colunas. Felizmente, a extração de blocos do PyMuPDF (`page.get_text("blocks")`) já realiza a leitura em ordem de coluna (lendo toda a coluna esquerda antes de passar para a direita).
2. **Identificação de Questões**: As questões começam explicitamente com o padrão `QUESTÃO 1`, `QUESTÃO 2`, etc., frequentemente em caixa alta.
3. **Identificação de Alternativas**: As alternativas seguem o padrão `A)`, `B)`, `C)`, `D)`. (4 alternativas por questão).
4. **Ruídos**: Existem anotações e rabiscos da pessoa que digitalizou a prova (ex: `6 /b/`, `l i G]`), mas como estamos ancorando a extração em padrões determinísticos de Boundary-Stitching (Questão X, A), B)), os ruídos podem ser isolados se ocorrerem fora do fluxo esperado ou podem acabar caindo no final da questão/alternativa.
5. **Boundary-Stitching**: O texto de uma alternativa ou enunciado flui perfeitamente para o próximo bloco de texto, ignorando quebras visuais e de página, apenas concatenando os blocos até que o próximo marcador de limite (`QUESTÃO N` ou `A)`) seja encontrado.

## Golden Set Esperado (Questões 1 a 8)

| Questão | Enunciado (Início) | Opções Esperadas | Proveniência Esperada |
|---------|--------------------|------------------|-----------------------|
| 1 | É CORRETO afirmar que o texto aborda... | A, B, C, D | IBGP, Técnico Fiscal, 2023 |
| 2 | Considerando o cenário interno brasileiro... | A, B, C, D | IBGP, Técnico Fiscal, 2023 |
| 3 | É CORRETO afirmar que os tipos textuais... | A, B, C, D | IBGP, Técnico Fiscal, 2023 |
| 4 | Leia o período a seguir: ''No entanto... | A, B, C, D | IBGP, Técnico Fiscal, 2023 |
| 5 | Leia o trecho a seguir: "Os estudantes... | A, B, C, D | IBGP, Técnico Fiscal, 2023 |
| 6 | Ao final do texto, os autores apresentam... | A, B, C, D | IBGP, Técnico Fiscal, 2023 |
| 7 | Leia o trecho a seguir: "Estudantes cujos... | A, B, C, D | IBGP, Técnico Fiscal, 2023 |
| 8 | Leia o trecho a seguir: "É um grupo seleto... | A, B, C, D | IBGP, Técnico Fiscal, 2023 |

O JSON final no `import_payload.json` deverá refletir essas questões estruturadas.
