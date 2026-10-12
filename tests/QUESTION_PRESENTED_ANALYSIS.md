# Análise da Semântica de QUESTION_PRESENTED

Este documento apresenta a análise de fluxo e semântica do evento `QUESTION_PRESENTED` no FiscalStudy, identificando comportamentos anômalos no registro de histórico, especialmente em ambientes de desenvolvimento com React StrictMode.

## 1. Fluxo Atual

O mapeamento exato de como o evento é gerado atualmente:

1. **React**: O componente `QuestionViewer.tsx` é montado.
2. **useEffect**: Dispara a função `fetchNextQuestion()` logo após a montagem inicial (`useEffect(..., [])`).
3. **HTTP GET**: É feita a requisição para `GET /api/v1/questions/next?sessionId=...`.
4. **QuestionSelectionService**: O backend chama `questionRepository.findNextAvailableQuestion()`.
5. **QUESTION_PRESENTED**: Imediatamente, se uma questão for encontrada, o backend cria e persiste um evento `QUESTION_PRESENTED` no `eventStoreRepository`.
6. **HTTP response**: A questão é finalmente retornada ao cliente como resposta do GET.

### Respostas sobre o comportamento:

*   **Em que momento o evento é criado?** No backend, no exato momento da chamada ao serviço que busca a próxima questão, antes da questão sequer ser transmitida pela rede e renderizada.
*   **Qual identificador representa uma apresentação?** O evento é salvo na tabela `event_store`, não atrelado a um presentation_id único enviado pelo cliente, mas apenas registrado sequencialmente com o payload (questionId). O sessionId não previne duplicação do mesmo tipo.
*   **Existe alguma forma de idempotência?** Não há nenhuma trava. Qualquer chamada ao endpoint `GET /questions/next` que retorne a questão gravará um novo evento `QUESTION_PRESENTED`.
*   **O frontend pode pedir a mesma questão mais de uma vez?** Sim. Se a lógica de `findNextAvailableQuestion` retornar a mesma questão nas chamadas subsequentes, isso criará múltiplos eventos para a mesma questão.
*   **Refresh/reload pode gerar novo evento?** Sim. Um refresh recarrega o frontend, dispara o `useEffect` novamente, executando o GET e gerando mais um evento.
*   **Retry de rede pode gerar novo evento?** Sim. Se a rede oscilar e ocorrer um retry, o backend registrará o evento de novo.
*   **StrictMode gera duplicidade?** Sim. O React 18+ em ambiente de desenvolvimento intencionalmente monta, desmonta e remonta componentes para detectar side effects impuros. Isso faz o `useEffect` executar duas vezes de forma quase simultânea, engatilhando duas requisições GET e gerando dois registros `QUESTION_PRESENTED`.
*   **Produção teria comportamento diferente?** Sim, o StrictMode é inativo em produção. No entanto, o sistema ainda seria vulnerável a registros falsos por refresh manual, duplo cliques (se aplicável), retries de rede e navegação do browser (back/forward).

## 2. Significado Atual do Evento e Problema de Semântica

Precisamos diferenciar dois conceitos:
*   **QUESTION_REQUESTED**: O cliente solicitou ao backend material de estudo ("backend retornou uma questão").
*   **QUESTION_PRESENTED**: O material foi de fato renderizado e exibido na tela para leitura ("questão apresentada ao usuário").

**O problema:** 
O atual `GET /questions/next` não representa uma apresentação real. Ele reflete apenas que o backend separou e enviou os dados. 
*   Se a aba for fechada antes de a rede concluir o download;
*   Se a UI quebrar antes do render;
Em todos esses casos, o histórico imutável registrará uma falsa visualização. Como a arquitetura depende de um histórico confiável para análises estatísticas, um GET HTTP com efeito colateral distorce a precisão analítica e quebra as garantias arquiteturais REST.

## 3. Alternativas

### A) Manter como está
*   **Complexidade:** Nenhuma (zero alteração).
*   **Confiabilidade:** Baixa, poluição da base.
*   **Impacto no histórico:** Falsos positivos de apresentações inflacionarão a volumetria da sessão.
*   **Impacto na arquitetura:** Acoplamento indesejado entre Read e Write em um endpoint REST `GET`.
*   **Qtd. de requests:** 1.
*   **Comportamento Refresh / StrictMode:** Gera registros duplos/indevidos.
*   **Adequação V1:** Inadequada.

### B) Guard no frontend (ex: uso de refs ou cleanup)
*   **Complexidade:** Baixa.
*   **Confiabilidade:** Média. Resolve a duplicação imediata do StrictMode, mas falha em mitigar retries de rede ou refresh manual.
*   **Impacto no histórico:** O evento continua representando tecnicamente um *Request* e não *Presentation*.
*   **Impacto na arquitetura:** O side-effect no GET continua existindo.
*   **Qtd. de requests:** 1.
*   **Comportamento Refresh / StrictMode:** Mitigado em dev, falho em prod.
*   **Adequação V1:** Solução paliativa; não conserta o problema semântico.

### C) PresentationId / Idempotency Key
*   **Complexidade:** Média. O frontend gera um UUID de intention e manda no GET.
*   **Confiabilidade:** Alta contra double-fetch técnico.
*   **Impacto no histórico:** Ainda sofre da falha semântica de gravar antes do render.
*   **Impacto na arquitetura:** Adiciona complexidade de transação e idempotência desnecessária no GET.
*   **Qtd. de requests:** 1.
*   **Comportamento Refresh / StrictMode:** Um novo refresh gerará novo UUID e falhará novamente a semântica.
*   **Adequação V1:** Boa contra o StrictMode, ruim para a pureza do domínio.

### D) Endpoint explícito de apresentação (Separar GET e POST)
*   Fluxo: `GET /questions/next` -> React Renderiza -> Dispara `POST /questions/{id}/events/presented`.
*   **Complexidade:** Média.
*   **Confiabilidade:** Alta. O evento reflete o fato consumado da tela renderizada.
*   **Impacto no histórico:** Impecável. Fica alinhado à proposta de Event Sourcing simplificado.
*   **Impacto na arquitetura:** Purifica o GET (torna-o livre de side-effects).
*   **Qtd. de requests:** 2 requisições.
*   **Comportamento Refresh / StrictMode:** O StrictMode enviará GETs sem gravar estado. Somente após a montagem final é que fará 1 POST. Se der refresh, registra com correção de semântica (a tela realmente foi apresentada de novo).
*   **Adequação V1:** Ideal e recomendada.

### E) Postergar para o ANSWER_SUBMITTED
*   **Complexidade:** Baixa. Não registrar a apresentação, só a resposta.
*   **Confiabilidade:** Baixa para analytics.
*   **Impacto no histórico:** Perde-se a visibilidade dos abandonos. Se o usuário pulou ou desistiu da questão sem tentar, não saberemos que ela foi apresentada.
*   **Adequação V1:** Inadequada para um sistema adaptativo.

## 4. Recomendação

Recomenda-se adotar a **Alternativa D (Endpoint explícito de apresentação)**.

## 5. Justificativa

O princípio "Append-only Event Log + Materialized Projections" requer eventos confiáveis. Quando vinculamos um evento de domínio a um verbo HTTP intrinsecamente idempotente e de leitura (GET), não só quebramos uma convenção técnica, mas poluímos os dados comportamentais em caso de retries, pre-fetching e instabilidades do browser (como o StrictMode). 

Ao dissociar a obtenção da apresentação em duas etapas (Read / Write), garantimos:
1. Respeito ao CQRS.
2. Imunidade a requisições duplas indesejadas causadas por frameworks UI.
3. Coleta fiel de abandono e métricas reais de tempo de tela e visualização.

## 6. Impactos
*   **Backend:** Remover `appendEvent` do `QuestionSelectionService.getNextQuestion`. Criar novo endpoint `POST /api/v1/questions/{id}/presented` que aceita a gravação do evento.
*   **Frontend:** `QuestionViewer.tsx` deverá, logo após setar a questão do state (garantindo o render), realizar o fetch POST informando o sistema que a questão foi exposta ao usuário.
*   **Histórico:** Nenhuma perda, garantindo a solidez dos Analytics previstos para as próximas iterações.
