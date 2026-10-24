# Reaproveitamento de referências

Referências são consulta, não dependências de execução. As junções references e graphify-out da cópia apontam para originais somente leitura: nunca atualizar ou limpar por esta implementação.

| Referência | Restrição conhecida na auditoria preservada | Decisão desta entrega |
|---|---|---|
| ts-fsrs | MIT | Algoritmo/vetores sob responsabilidade do módulo adaptativo; manter atribuição se copiar trechos. |
| Docling | MIT | Não adicionada dependência: PyMuPDF já disponível e suficiente para regressões. |
| NAG | MIT | Nenhum código incorporado nesta entrega. |
| OpenViking | AGPL-3.0 | Não incorporar sem análise de compatibilidade/licença do conjunto. |
| Track | Licença restritiva registrada na auditoria | Não copiar/adaptar sem autorização compatível. |
| Question_Extractor | Sem LICENSE verificada | Aproveitar apenas aprendizado de padrões; nenhum código copiado. |

Classificação revisável, confiança e fila de revisão são padrões implementados localmente; não foi importado código de repositórios de referência. Não remover referências/backups por tamanho. Alterações futuras devem registrar origem, versão/commit, licença, arquivos copiados, adaptação e testes de conformidade. Estas restrições não substituem a leitura da licença na versão exata no momento do reaproveitamento.
