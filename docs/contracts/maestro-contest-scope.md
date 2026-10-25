# Maestro: escopo do concurso e plano vazio

`generateDailyPlan` seleciona tópicos, revisões pendentes e cards vinculados ao concurso selecionado. Um edital vazio não permite buscar tópicos de outro concurso nem inserir um assunto demonstrativo como plano pessoal.

- ID ausente, vazio ou sentinelas legadas `null`/`undefined`: `passos=[]`, zero minutos planejados e `statusPlanejador=SELECIONE_CONCURSO`.
- Concurso sem tópicos: `passos=[]`, zero minutos planejados e `statusPlanejador=SEM_TOPICOS_EDITAL`.
- O campo de disponibilidade permanece disponível; disciplina e assunto principal são nulos no plano vazio. Consultar o plano não produz evento de aprendizagem.
- Revisões usam `concurso_id` e os critérios anteriores de pendência, data e prioridade.
- Cards usam as colunas canônicas `concurso_id` e `sync_status=PENDING_ANKI`. Essa contagem representa pendências de envio ao Anki, não uma previsão de memória nem revisões vencidas. O nome legado `cardsAtrasados` permanece no DTO para compatibilidade.

Não há migração ou alteração de eventos históricos. A recuperação ocorre por uma alteração adicional na branch; não é necessário restaurar bancos.

## Validação

Dez regressões SQLite em memória verificam isolamento entre concursos, estados vazios, seleção ausente, filtro das revisões e contrato Anki. O teste existente foi atualizado somente para a consulta parametrizada e a mensagem de pendência de envio. A validação centralizada executou `test-compile` e sete suítes de planejamento: 30 testes aprovados, zero falhas, erros ou ignorados, `BUILD SUCCESS` em 2 min 2 s. Inclui as dez novas regressões do Maestro e seus dois testes existentes; os casos não devem ser somados novamente como execuções independentes. Log local: `C:/workspace/planning-combined-tests.log`. A compilação e os testes ocorreram em cópia descartável com SQLite isolado, integrações externas desativadas e sem instalar dependências. Suíte backend completa e homologação visual não foram executadas nesta entrega.

## Limites conhecidos

Esta entrega não corrige a métrica legada de acertos chamada retenção, a seleção de tentativas elegíveis, o orçamento de tempo ou a calibração pedagógica. Materiais compartilhados só são selecionados por vínculo explícito com tópico do concurso; a busca direta exige concurso_id. O fallback de materiais ainda inventa nome/páginas quando não há fonte; isso exige uma correção própria de proveniência e não representa material consultado. Um concurso sem tópicos recebe plano vazio mesmo se houver revisões antigas, até que seu edital seja restaurado/revisado. Não houve homologação visual. Os critérios anteriores de duração/agendamento e as equações FSRS permanecem inalterados.
