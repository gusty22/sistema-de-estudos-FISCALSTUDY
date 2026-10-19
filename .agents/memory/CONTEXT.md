# Contexto e Estado Arquitetural — FiscalStudy

## 1. Localização e Ambientes
- **Workspace Principal**: `C:\Users\washi\OneDrive\Área de Trabalho\fiscalstudy-platform\core-app`
- **Analytics Engine (R)**: `C:\Users\washi\OneDrive\Área de Trabalho\fiscalstudy-platform\analytics-engine\R`
- **Acervo de Provas**: `c:\Users\washi\Downloads\provas` (386 arquivos elegíveis processados; diretório `processados` estritamente isolado).

## 2. Decisões Técnicas Recentes
- **Separação Estrita de Campos e Extração Criteriosa (v3.0)**:
  - `UniversalExtractor`: Separação cirúrgica entre `statement` (enunciado), `justificativa` comentada/oficial, `gabarito`, e `texto_apoio` com título.
  - **Limpeza Rigorosa de Numeração de Linhas (`clean_support_text_line_numbers`)**:
    - Remove automaticamente todas as linhas contendo apenas numeração isolada (ex: `01\n02...`, `5\n10...`, `1\n4\n7...`).
    - Remove prefixos explícitos e marcadores de linha (`Linha 1:`, `linha 01 -`, `L. 1`, `l. 01`, `[linha 1]`, `(linha 1)`).
    - Remove marcadores de margem no início de linhas (`01  `, `1  `, `5   `, `1 - `, `01. `).
  - **Isolamento Prévio de Textos de Apoio (`SUPPORT_PATTERNS`)**:
    - Pré-extrai blocos de leitura longos (ex: Fundatec, IDCAP, Access, Cebraspe) e os apaga do fluxo de texto da prova ANTES do particionamento de questões.
    - Impede que numerações de linhas sejam confundidas com números de questões e impede que textos de 5.000 a 12.000 caracteres sejam engolidos pelo enunciado (`statement`).
    - Deduplicação protege questões reais com alternativas contra sobreescrita por blocos de texto acidentais.
  - **Supressão de Instruções Administrativas**: `is_administrative_cover()` e `is_instruction_item()` descartam capas e regras de prova (ex: "1 Ao receber este caderno...", "6 A desobediência...") impedindo colisão com itens de avaliação reais.
  - **Segmentação Robusta**: Regex atualizado para capturar assertivas iniciadas por verbos minúsculos (`17\nevitar...`, `18\nfazer...`) e propagação de enunciados-guia compartilhados (*stem*).
  - **Autonomia Total da Questão**: Textos de apoio limpos são incorporados diretamente na questão (`texto_apoio`) para sorteio aleatório autônomo.
- **Mecanismo de Fusão Multi-Segmentar de Gabaritos (v2.2)**:
  - `extract_targeted_answer_key`: funde automaticamente gabaritos de Conhecimentos Básicos compartilhados (`CARGOS 3 AO 7`) com Conhecimentos Específicos por cargo quando a chave inicia em questão superior a 1 (ex: CEBRASPE Mossoró Cargo 4: Q1..50 + Q51..120 = 120 itens).
  - Suporta cadernos complementares do mesmo cargo (ex: SEEC_DF Q1..80 + Q81..160 = 160 itens).
- **Desambiguação e Pareamento de Gabaritos Multi-Cargo**:
  - Desentrelaçamento de tabelas multicolunares e pontuação contextual estrita contra contaminações cruzadas (ex: FURB Florianópolis Auditoria Q1=C, Q21=C vs TI Q1=A, Q21=B; IBGP Porto Velho Q1..3=D).
- **Cockpit e Edição Interativa no Frontend**:
  - `AuditCockpit.tsx` e `ImportStudio.tsx`: Gaveta de inspeção com `<textarea>` para edição em tempo real de `statement`, `justificativa` e `textoApoio`, salvando no staging via PUT.

- **Redesign Visual Humanizado e Eliminação de Fadiga Cognitiva (v3.1)**:
  - **Paleta Relaxante & Fim do Dark Mode Agressivo**: Substituído o fundo preto de terminal (`#0b0e14`) por tons de ardósia suaves (`#0d131f` e `#151d2c`). Removidas todas as sombras e bordas neon radioativas (azul elétrico, verde fosforescente, roxo forte).
  - **Eliminação do Excesso de Caixas Aninhadas**: Desarmado o efeito "Russian Doll" de retângulos dentro de retângulos. A leitura da questão agora respira com tipografia confortável (1.05rem, line-height 1.65, sem caixas com bordas pesadas), cartões de alternativas planos e confortáveis com espaçamento generoso.
  - **Erradicação Total dos Jargões de Programador**:
    - "Inoculação de Estresse (Chaos Engineering)" ➔ "Simulação de Prova Real".
    - "R Bridge Analytics" / "Análise Psicométrica" ➔ "Diagnóstico Inteligente de Retenção".
    - "Fixação Adaptativa (Motor R / Robin Hood)" ➔ "Foco em Dificuldades (Revisão Inteligente)".
    - "Golden Set Oficial" ➔ "Caderno de Prova Modelo".
    - "Deliberação Sistema 2 (Galinsky & Mussweiler)" ➔ "Dica Antipegadinha: Pense no Contrário".
    - "Falsa Fluência (Overconfidence)" ➔ "Ponto de Atenção: Certeza no Erro".
    - "Sintetizar Parágrafo do PDF" ➔ "Criar Flashcard do Trecho".

- **Motor de Revisão Adaptativa Individualizada em 4 Estágios com Justificativa Pedagógica (v3.3)**:
  - **Fim da Inserção Cega de Blocos Temporais**: `RevisionCalendarService` agora agenda apenas o reforço estritamente necessário para o momento cognitivo do estudante, baseado na telemetria real (`isCorrect`, `confidenceLevel`, `causaErro`, `chuteEducado`, `friccaoCognitiva`, `tempoLeituraMs`).
  - **Ciclo Adaptativo em 4 Estágios**:
    1. *Intervenção Corretiva*: Ativada imediatamente em erros de alta confiança (falsa fluência) ou incompreensão de conceito (E1/E2). Prioridade alta (0.80 a 0.95).
    2. *Teste de Transferência*: Ativado para erros em regras específicas/exceções (E3) ou pegadinhas (E4) para testar a mesma regra em formulação inédita.
    3. *Recuperação Ativa*: Ativada após acertos com dúvida/chute ou alta hesitação de deliberação para validar conhecimento real sem pistas.
    4. *Manutenção Preventiva*: Agendada para tópicos consistentes e fluentes com intervalo dilatado progressivamente.
  - **Progressão e Recuo Baseados em Evidência**: Ao concluir a revisão (`completeRevision`), se `taxaAcerto >= 80%`, o estágio avança e o intervalo duplica; se `< 80%`, recua imediatamente para Intervenção Corretiva.
  - **Diagnóstico e Justificativa Explicada na UI**: Todos os cards no `Dashboard` e no `CicloRevisoes` exibem o badge do estágio cognitivo e a justificativa pedagógica gerada pela IA ("Por que revisar agora?").

- **Biblioteca de Materiais com Tecnologia Calma & Estrutura Verticalizada (v3.4)**:
  - **Design Tokens 'Tecnologia Calma'**: Suporte a temas `paper` (creme relaxante) e `night` (ardósia escuro suave), eliminando fadiga visual e contrastes agressivos. Card de privacidade e armazenamento inteligente (apenas caminhos e metadados, sem duplicar arquivos).
  - **Preservação de Todas as Funcionalidades Avançadas**:
    - Smart Upload com extração por IA de sumários para auto-vinculação imediata.
    - Botão de 'Auto-Vincular Tudo' (`/api/v1/materials/auto-link-all`).
    - Vinculação manual com intervalo de páginas a tópicos e subtópicos.
    - Tratamento de status `AVAILABLE` e `MISSING` (com modal para relocalizar arquivos movidos ou renomeados no Windows preservando histórico).
  - **Navegação em 3 Visões**:
    1. *Acervo Pessoal*: agrupado por Matéria/Disciplina com busca em tempo real, badges de formato, vínculos, último acesso e dropdown meatball.
    2. *Edital Verticalizado*: árvore hierárquica (Matéria › Tópico › Subtópico) com materiais vinculados, expansão e atalhos para praticar questões.
    3. *Matriz de Cobertura Teórica*: auditoria percentual de cobertura do edital para identificação de lacunas.

- **Dashboard / Home com Tecnologia Calma & Adaptação ao Dia (v3.5)**:
  - **Paleta Suave (Paper & Night)**: Totalmente alinhada ao design calmante (Paper creme `#f9f8f6` e Night ardósia `#0e0f11`).
  - **Hero Card "Sua Próxima Atividade"**: Foco em 1 única tarefa prioritária por vez (Disciplina, Assunto, Duração, Motivo, Botão "Começar Agora" com ícone de Play).
  - **Transparência Pedagógica (Sanfona)**: Botão "Por que esta atividade?" explicando claramente o motivo (erros recentes, estágio Robin Hood, prioridade no edital, estratégia pedagógica e material de apoio vinculado).
  - **Ajustes Rápidos**: Chips horizontais interativos ("Tenho menos tempo", "Tenho mais tempo", "Quero trocar de atividade", "Sem material agora", "Preciso descansar" com reforço cognitivo).
  - **Cards Secundários**: "Revisões Prioritárias" (foco em prevenir esquecimento iminente, contagem real e atalho para fila) e "Capacidade do Dia" (barra de progresso verde esmeralda de minutos estudados vs meta).
  - **Fila de Sugestões**: Próximas tarefas ranqueadas por prioridade cognitiva com tempo estimado e clique para início rápido.
  - **Acesso ao Raio-X & Histórico**: Link discreto no rodapé preservando acesso ao `QuestionHistoryModal`.

- **Rotina & Disponibilidade — Mapa da Semana com Tecnologia Calma (v3.6)**:
  - **Planejamento Macro sem Ansiedade**: Grade tátil com 7 dias da semana e 3 turnos (Manhã, Tarde, Noite), eliminando preenchimentos rígidos minuto a minuto.
  - **Dias de Descanso Sagrado (Folga)**: Seleção rápida de dias de descanso (ex: Domingo) que desabilitam automaticamente todos os blocos do dia.
  - **Ajustes de Capacidade**: Slider para volume médio por bloco (~1h a 4h) e pílulas para duração máxima de foco (30m, 50m, 90m) prevenindo fadiga mental.
  - **Exceções Temporárias**: Registro de viagens e compromissos com data e motivo, subtraindo a carga do dia automaticamente no planejamento.
  - **Diagnóstico em Tempo Real do Gêmeo Digital**: Análise da carga semanal total (Ritmo Leve com diluição automática de metas, Ritmo Balanceado ou Ritmo Intenso com risco de burnout).
  - **Persistência Completa & Sinergia**: Sincronização com o backend (`/api/v1/routine` e `/api/v1/routine/exceptions`) e calibração automática da "Capacidade do Dia" no Dashboard.

- **Curadoria para o Anki — Sintetizador Autônomo com Tecnologia Calma (v3.7)**:
  - **Fila de Curadoria Inteligente**: Flashcards atômicos gerados pelo Gêmeo Digital baseados em heurísticas reais (Erros recentes de confusão conceitual, Decaimento de retenção FSRS / Robin Hood, Prevenção de esquecimento).
  - **Edição Leve Lado a Lado**: Grid responsivo com Frente (gatilho de memória) e Verso (fechamento conceitual) com textareas limpos e divisor sutil.
  - **Copiloto AnkiConnect (porta 8765)**: Status da conexão local em tempo real, botão de injeção direta no deck `FiscalStudy::GêmeoDigital` e exportação instantânea em CSV UTF-8.
  - **Ações em Lote e Filtros**: Filtros por status (Pendentes, Prontos para Envio, Sincronizados) e por disciplina; botão "Aprovar Todos os Pendentes".
  - **Playground de Síntese de Trecho**: Gaveta para colar trecho de lei seca ou apostila e sintetizar cards atômicos com Cloze/Conceito Direto via IA (`/api/v1/anki/generate`).

- **Fila de Revisões & Ciclo de Recuperação Ativa com Tecnologia Calma (v3.8)**:
  - **Identidade Visual Calmante (Paper & Night)**: Tons suaves, ausência de vermelhos agressivos de alarme, foco na sustentabilidade cognitiva.
  - **Quatro Métricas Centrais**: Para Estabilizar Hoje, Esforço Estimado em minutos, Alvo de Retenção (85% de segurança) e Sequência Ativa.
  - **Hero Card "Revisão Prioritária"**: Assunto de maior urgência cognitiva com medidor de retenção real, justificativa pedagógica do Gêmeo Digital, método sugerido e tempo estimado.
  - **Revisões Programadas**: Distribuição ideal da semana com barras de retenção por cor e atalho rápido para resolução de questões.
  - **Governança contra Acúmulos**: Garantia algorítmica de que revisões atrasadas não viram uma bola de neve inatingível.
  - **Preservação de Todas as Capacidades**: Abas para Caderno de Erros (E1 a E5) e Histórico de Revisões Concluídas mantidas e integradas com a API do backend.

- **Meus Objetivos / Concursos — Planejamento Estratégico com Tecnologia Calma (v3.9)**:
  - **Identidade Visual Suave & Tema Duplo**: Integração com temas `paper` (creme relaxante `#f9f8f6`) e `night` (ardósia escuro suave `#0e0f11`), mantendo coerência com toda a plataforma.
  - **Banner de Aprendizagem Compartilhada**: Destaque conceitual claro mostrando que uma mesma questão ou conteúdo resolve e atualiza o Gêmeo Digital uma única vez, refletindo organicamente o progresso em todos os editais compatíveis.
  - **Dupla Visão Fluida**:
    - *Visão Lista (`LIST`)*: Grid de cards de concursos/objetivos com tags de status (`Ativo` ou `Pausado`), horizonte temporal, último acesso, barra de cobertura do edital (progresso %), botão "Abrir Painel" e botão tátil de pausar/retomar.
    - *Visão Detalhe (`DETAIL`)*: Cabeçalho com botão de retorno `← Voltar para Meus Objetivos`, título do concurso com status, data-alvo, botão de definir como ativo global, duplicação e 5 abas silenciosas:
      1. *Visão Geral (`OVERVIEW`)*: Métricas principais (Disciplinas, Materiais Vinculados, Cobertura Gêmeo Digital %, Status do Planejamento) e lista de pendências/próximos passos reais.
      2. *Currículo (`CURRICULUM`)*: Card de Preservação Histórica (atualizar tópicos não apaga evidências do Gêmeo Digital) e estrutura de disciplinas.
      3. *Materiais (`MATERIALS`)*: Recursos vinculados ao edital.
      4. *Desempenho (`PERFORMANCE`)*: Análise detalhada por peso e banca.
      5. *Configurações (`SETTINGS`)*: Parâmetros e customizações do objetivo.
- **Mapa de Conteúdos / Arquitetura Curricular com Tecnologia Calma (v3.10)**:
  - **Componentes Dedicados**: `MapaConteudos.tsx` e `MapaConteudos.css` com temas `paper` (creme relaxante `#f9f8f6`) e `night` (ardósia escuro suave `#0e0f11`).
  - **Árvore Curricular Hierárquica Dividida em 12 Colunas**:
    - *Coluna Esquerda (7 cols)*: Árvore com indentação visual, linhas guia verticais, pastas de expansão recursiva (`DISCIPLINE` ➔ `TOPIC` ➔ `SUBTOPIC`), busca em tempo real e chips de filtro por status (`Todos`, `Requer reforço`, `Retenção a verificar`, `Em estudo`, `Desempenho favorável`, `Não iniciado`). Botões de Expandir/Recolher tudo.
    - *Coluna Direita (5 cols)*: Painel de detalhes estático/adesivo (Raio-X do Tópico selecionado) contendo 4 métricas essenciais (Evidência de Domínio, Última Atividade, Material Vinculado, Base de Questões), pré-requisitos curriculares (DAG interativo) e ações focadas ("Iniciar Estudo Neste Tópico", "Consultar Material", "Ver Histórico").
  - **Aviso Epistêmico do Gêmeo Digital**: Alerta explícito de que *"um tópico pode estar marcado como 'Lido/Em estudo' sem estar 'Dominado', pois os indicadores dependem de retenção empírica via questões"*.
  - **Integração Real com Banco**: Carrega tópicos e subassuntos reais via `/api/v1/concursos/{id}/edital` com fallback instantâneo para a curadoria rica `DEFAULT_MAP`.
- **Planejamento Adaptativo — Motor de Decisão Pedagógica com Tecnologia Calma (v3.11)**:
  - **Componentes Dedicados**: `PlanejamentoAdaptativo.tsx` e `PlanejamentoAdaptativo.css` com temas `paper` (creme relaxante `#f9f8f6`) e `night` (ardósia escuro suave `#0e0f11`).
  - **Fila Dinâmica e Flexível (Adeus Cronograma Rígido)**:
    - *Região 1 (Situação Atual)*: 4 cards métricos (Tempo Estimado com capacidade do dia, Itens Críticos de alta prioridade, Revisões Injetadas para estabilização de memória e Status do Planejador "Adequado e balanceado").
    - *Região 2 (Fila de Atividades - 8 cols)*: Lista ordinal de tarefas com badges tipados (`REVISÃO` esmeralda, `PRÁTICA` índigo, `NOVO CONTEÚDO` stone), disciplina, tópico, motivo pedagógico, duração em minutos, botões de reordenação dinâmica (Up/Down) e botão Iniciar focado no primeiro item. Itens críticos destacados com borda âmbar.
    - *Modal de Consequência Cognitiva ao Adiar*: Quando o usuário tenta adiar uma atividade crítica, o modal calmo do Gêmeo Digital explica as consequências pedagógicas (aumento do intervalo e queda de retenção) e oferece confirmação consciente com replanejamento automático para amanhã.
    - *Região 3 (Lógica do Gêmeo Digital - 4 cols)*: Painel explicativo transparente e retrátil detalhando critérios em tempo real (Priorização por Decaimento, Ajuste de Foco e Restrição de Tempo) e ocorrências pedagógicas recentes.
- **Visão Semanal Adaptativa — Fluxo & Projeção com Linha do Tempo Alternada (v3.12)**:
  - **Componentes Dedicados**: `VisaoSemanal.tsx` e `VisaoSemanal.css` com temas `paper` (creme relaxante `#f9f8f6`) e `night` (ardósia escuro suave `#0e0f11`).
  - **Princípio da Anti-Fragilidade**: Alerta explícito destacando que *"atividades não concluídas hoje não viram bola de neve no dia seguinte, sendo devolvidas ao Gêmeo Digital para recálculo da rota ideal"*.
  - **Seletor de Dias Horizontal**: Barra fluida com os 7 dias da semana (SEG a DOM), indicador de hoje, barras de progresso proporcionais aos minutos utilizados vs disponíveis e status de exceções (`Car`).
  - **Linha do Tempo Central Alternada**:
    - Marcador circular central com ícone de estado (`CONCLUIDO` esmeralda, `EM_EXECUCAO` índigo, `ADIADO` âmbar, `SUBSTITUIDO` stone).
    - Cartões de atividade intercalados (esquerda / direita), com badges tipados, duração, título (com tachado suave se adiado/substituído) e notas explicativas do Gêmeo Digital (ex: *"Voltou para a fila de prioridades"*).
    - Estado de Exceção / Dia Bloqueado com mensagem tranquilizadora (*"Descanse sem culpa"*).
- **Sessão Ativa de Estudo — Imersão Profunda e Roteiro Progressivo com Tecnologia Calma (v3.13)**:
  - **Componentes Dedicados**: `SessaoEstudoAtiva.tsx` e `SessaoEstudoAtiva.css` com temas `paper` (creme relaxante `#f9f8f6`) e `night` (ardósia escuro suave `#0e0f11`).
  - **Fluxo Guiado sem Sobrecarga Cognitiva**:
    - *Header Focado*: Botão discreto "Suspender e Voltar", disciplina/tópico centralizados e cronômetro em tempo real (com animação suave de pulso âmbar quando pausado).
    - *Norte Pedagógico*: Cartão com objetivo claro e explícito (Target).
    - *Material Vinculado*: Card com título do PDF/apostila, intervalo de páginas e botão "Abrir Material".
    - *Roteiro da Sessão em 4 Etapas*: 1. Recuperação Prévia, 2. Estudo Focado, 3. Prática de Fixação (com atalho para resolução imediata de 5 questões), 4. Consolidação e Autoavaliação.
    - *Barra de Controle Flutuante Inferior*: Botões de Pausa/Interrupção (com modal para registrar motivos: pausa para água, cansaço mental, interrupção externa), Sinalização de Dificuldade ao Gêmeo Digital (`Flag`), e botão de avanço adaptativo ("Concluir Etapa", "Retomar Foco" ou "Concluir Sessão").
    - *Tela de Conclusão Calma*: Mensagem de foco ativo líquido atingido, registro do Princípio do Gêmeo Digital (validação contínua da retenção em vez de checklist vazio) e botão de retorno ao planejamento.
  - **Navegação & Roteamento**: Rota e aba dedicadas `activeTab === 'session'` acessíveis na Sidebar sob *ROTINA & EXECUÇÃO* (**🎯 Sessão Focada (Timer)**) e via ações de início nos cards de atividade.

- **Módulo A — Configuração Inicial e Objetivos (T01 a T06) com Tecnologia Calma (v3.14)**:
  - **T01 — Boas-Vindas e Estado Inicial (`BoasVindasT01.tsx`, `BoasVindasT01.css`)**:
    - Fluxo de entrada quando não há objetivos cadastrados ou no primeiro acesso ("Vamos organizar seus estudos.").
    - Ações principais: "Criar meu primeiro objetivo" e "Conhecer o funcionamento" (com modal explicativo calmo em 4 passos).
    - **Proteção contra Falha de Banco**: Se o backend estiver indisponível, NÃO simula primeiro acesso; apresenta o estado específico *"Não foi possível acessar seus dados. Nenhuma informação foi alterada."* com botão *"Tentar Reconectar"*.
  - **T02 — Cadastro de Objetivo**:
    - Unidade de planejamento independente abrangente (`CONCURSO`, `VESTIBULAR`, `CERTIFICACAO`, `CURSO`, `LIVRE`).
    - Campos: Nome do objetivo, Tipo, Instituição, Cargo/área, Banca, Data da avaliação (opcional: `OFICIAL`, `ESTIMADA`, `DESCONHECIDA`), Fonte oficial e Prioridade. Estados do objetivo suportados.
  - **T03 — Importação e Edição do Currículo**:
    - Árvore de profundidade variável (Objetivo ➔ Disciplina ➔ Unidade ➔ Tópico ➔ Subtópico) com nós indivisíveis.
    - Editor Split (árvore navegável à esquerda + detalhes do nó selecionado à direita: nome, peso, pré-requisitos, descrição, texto original).
    - Formas de entrada: Importação de JSON estruturado (`handleImportJsonFile`), modelo padrão sugerido e adição manual. Preservação de identificadores estáveis (`id: string`) e texto da fonte.
  - **T04 — Diagnóstico Inicial (`SELF_REPORTED`)**:
    - Autodeclaração de familiaridade por disciplina (*"Nunca estudei"*, *"Já tive contato"*, *"Consigo resolver algumas questões"*, *"Tenho bom domínio aparente"*, *"Prefiro não informar"*).
    - Princípio anti-falsa-certeza: autodeclaração registrada como `SELF_REPORTED` sem converter arbitrariamente em métrica de precisão, substituída gradualmente por evidências de resolução de questões.
  - **T05 — Rotina e Disponibilidade Semanal**:
    - Calendário semanal visual (Manhã, Tarde, Noite para SEG-DOM) com blocos flexíveis, dias de descanso (folga) e duração confortável de sessão (30, 50, 90 min) sem rigidez minuto a minuto.
  - **T06 — Confirmação do Planejamento Inicial**:
    - Resumo do objetivo, auditoria de qualidade da configuração (currículo confirmado, materiais, questões, diagnóstico), alerta inteligente do Gêmeo Digital e botão *"Gerar meu planejamento"* que persiste via API e transiciona suavemente para o Dashboard (T07).
  - **Integração Global (`App.tsx`, `MeusConcursos.tsx`)**:
    - Substituição do wizard anterior por `AssistenteObjetivoWizard`, integrando com a API `/api/v1/concursos` e renderização condicional de `BoasVindasT01` sob erro ou ausência de objetivos.

- **Módulo B — Início e Planejamento (T07 a T12) com Tecnologia Calma (v3.15)**:
  - **T07 — Início: O que estudar agora? (`Dashboard.tsx`, `Dashboard.css`)**:
    - Elimina a tomada contínua de decisão pelo estudante.
    - Cartão Principal Hero: Disciplina, Tópico, Motivo (*dificuldade recorrente + alta prioridade*), Duração estimada (35 min), botões *"Começar Agora"* e *"Por que esta atividade?"*.
    - Gaveta de Transparência Pedagógica com os textos canônicos (*"Este tópico foi priorizado porque apresentou erros recentes..."* e quando insuficiente: *"Prioridade baseada no currículo e no diagnóstico inicial..."*).
    - Blocos secundários: Revisões Prioritárias (quantidade, tempo, botão para fila sem poluir a home) e Capacidade do Dia (informado, estudado, restante sem obrigação punitiva de preenchimento).
    - Ajustes Rápidos Adaptativos: *"Tenho menos tempo hoje"*, *"Tenho apenas 20 min"* (recálculo adaptativo para 5 questões rápidas), *"Tenho mais tempo hoje"*, *"Quero trocar de atividade"*, *"Não tenho acesso ao material"* e *"Preciso descansar"*.
    - Proteção de Estados Especiais: ausência de objetivos/currículo direciona ao assistente/edital.
  - **T08 — Meus Objetivos (`MeusConcursos.tsx`)**:
    - Gerenciamento de múltiplos objetivos (Ativo, Pausado, Concluído, Arquivado) com horizonte de prova.
    - Ações completas: Criar (assistente T02-T06), Abrir, Pausar/Retomar, Arquivar e Duplicar Estrutura Curricular (`handleDuplicateGoal`).
    - Regra de Integração: Resoluções de questões existem como eventos de aprendizagem únicos, sem inflação artificial.
  - **T09 — Detalhes do Objetivo (`MeusConcursos.tsx`)**:
    - Abas especializadas: Visão Geral (métricas, cobertura, pendências), Currículo (acesso direto a T10 / Edital), Materiais, Desempenho e Configurações.
    - Preservação estrita: Atualização do currículo mantém rastreabilidade histórica.
  - **T10 — Mapa de Conteúdos (`MapaConteudos.tsx`)**:
    - Árvore hierárquica navegável com estados interpretáveis textuais (*Não iniciado*, *Em estudo*, *Evidência insuficiente*, *Desempenho favorável*, *Requer reforço*, *Retenção a verificar*).
    - Distinção epistemológica estrita: *"Estudado"* ≠ *"Dominado"*.
    - Ações por tópico: detalhes, iniciar estudo, resolver questões, consultar material, histórico.
  - **T11 — Planejamento Adaptativo (`PlanejamentoAdaptativo.tsx`)**:
    - Fila dinâmica de decisões (não lista rígida): 1. Situação atual, 2. Fila recomendada (ordenação Up/Down, Iniciar, Adiar com aviso de consequência cognitiva), 3. Explicação da estratégia.
  - **T12 — Visão Semanal (`VisaoSemanal.tsx`)**:
    - Projeção semanal anti-frágil (anti-bola-de-neve). Tarefas não concluídas retornam ao Gêmeo Digital para recálculo da rota ideal.

- **Módulo C — Execução dos Estudos (T13 a T15) com Tecnologia Calma (v3.16)**:
  - **T13 — Execução de Estudo (`SessaoEstudoAtiva.tsx`)**:
    - Tela de foco imersiva para condução de atividade concreta com cabeçalho limpo (`← Voltar`, Disciplina, cronômetro `Tempo: mm:ss`).
    - Estrutura de sessão unificada e reutilizável para os 6 tipos de atividade: 1. Estudo orientado, 2. Resolução de questões, 3. Correção de erros, 4. Recuperação ativa, 5. Revisão, 6. Simulado.
    - Objetivo pedagógico explícito visível durante toda a sessão.
    - Bloco de Material com botão `[ABRIR MATERIAL]` vinculado ao visualizador de materiais.
    - Roteiro de etapas progressivas com checkboxes e botão de avanço `[CONCLUIR ETAPA]`.
    - Controles de sessão: Pausar, Retomar, Encerrar, Informar Interrupção (com motivos padronizados), Registrar Dificuldade (com categorias cognitivas) e botão rápido `[ABRIR QUESTÃO ASSOCIADA]`.
    - Regra canônica implementada: *"Concluir uma leitura não significa dominar o assunto. A conclusão registra execução. O domínio depende de evidências adicionais."*
  - **T14 — Encerramento da Sessão (`SessaoEstudoAtiva.tsx`)**:
    - Encerramento fluido sem exigir relatórios manuais exaustivos.
    - Cards automáticos: Atividade realizada, Duração ativa líquida, Etapas concluídas, Questões respondidas, Resultados de acerto e Interrupções registradas.
    - Perguntas opcionais interativas de autoavaliação (*"Você conseguiu concluir a atividade?"* e *"O que dificultou?"*).
    - Ações finais: Finalizar e Gravar (idempotente com `sessionId` imutável via `POST /api/v1/study-sessions/record`), Continuar Estudando, Registrar Pendência e Ver Próxima Atividade.
    - Atualização automática da fila de estudos e disparo de eventos ao `event_store`.
  - **T15 — Histórico de Sessões (`HistoricoSessoes.tsx`, `HistoricoSessoes.css`)**:
    - Tela e aba dedicada para consulta de atividades realizadas.
    - Filtros por: Objetivo/Concurso, Disciplina, Tipo de Atividade, Período e Situação.
    - Cards informativos com: Data/Hora, Atividade, Duração, Resultados, Questões, Revisões Geradas e Interrupções.
    - Modal de Detalhes e Ações: Adicionar Observação e Corrigir Classificação de Interrupção.
    - Regra estrita de Imutabilidade e Append-Only: As correções não alteram ou deletam o registro original da sessão. Em vez disso, gravam um evento `STUDY_SESSION_ANNOTATION_ADDED` no `event_store` com timestamp, mantendo total auditoria histórica.
  - **Backend Support (`StudySessionService.java`, `StudySessionController.java`)**:
    - Endpoint `GET /api/v1/study-sessions` para listagem agregada com overlay de anotações auditadas.
    - Endpoint `POST /api/v1/study-sessions/{sessionId}/annotation` para persistência estritamente append-only no `event_store`.

- **Módulo D — Biblioteca e Materiais (T16 e T17) com Tecnologia Calma (v3.17)**:
  - **T16 — Biblioteca de Materiais (`BibliotecaMateriais.tsx`, `BibliotecaMateriais.css`)**:
    - Centralização de referências a materiais físicos e digitais que o estudante já possui, sem duplicar arquivos pesados no banco local SQLite.
    - Estrutura em Tabela Canônica: `Material | Tipo | Origem | Situação | Conteúdos | Ações`.
    - Metadados armazenados: Identificador (UUID), Caminho ou referência, Nome/Título, Tipo (PDF, LIVRO, VIDEO, LINK, LEI_SECA), Hash SHA-256, Tamanho (MB), Total de Páginas, Conteúdos Vinculados e Situação de Disponibilidade.
    - Ações completas: Adicionar arquivo (leitura local segura), Selecionar pasta autorizada (com consentimento prévio e sem varredura indiscriminada), Vincular link externo, Examinar metadados, Relacionar a conteúdos (T17), Abrir, Relocalizar arquivo e Remover referência.
    - Tratamento de Arquivos Ausentes: Detecção e alerta destacado (*"Material não encontrado no caminho registrado"*) com 3 opções (*Localizar novamente*, *Manter referência*, *Substituir arquivo, com verificação*).
    - Regra canônica de integridade: O sistema **NUNCA** exclui o histórico de estudo associado quando um material é movido, ausente ou removido.
    - Princípio de Privacidade: A leitura de pastas locais depende de autorização explícita do estudante. Não realiza varredura indiscriminada do computador.
  - **T17 — Vinculação Material-Conteúdo (`VinculacaoMaterialConteudo.tsx`, `VinculacaoMaterialConteudo.css`)**:
    - Editor dedicado de dois painéis:
      - Painel Esquerdo: Árvore curricular (Disciplinas › Tópicos › Subtópicos) com busca, badges de contagem e seleção instantânea.
      - Painel Direito: Documento e referências com seleção de material, intervalo de páginas (início - fim), amostra/preview de trecho das páginas confirmadas e instruções de leitura.
    - Quatro Estados Canônicos: `SUGERIDO_AUTO` (*Sugerido automaticamente*), `PENDENTE_CONFERENCIA` (*Pendente de conferência*), `CONFIRMADO` (*Confirmado pelo usuário*) e `INDISPONIVEL` (*Referência indisponível*).
    - Confiança da Vinculação: Nível explícito (*Alta*, *Média*, *Baixa* e score percentual).
    - Regra Canônica de IA: *"Uma sugestão de correspondência feita por IA não deve ser tratada automaticamente como validada."* Exibe badge e banner de atenção até que o usuário clique em `[Confirmar]`.
    - Ações no Vínculo: Confirmar correspondência, Corrigir intervalo de páginas/instruções, Reutilizar vínculo em outro objetivo (clonagem para outro concurso) e Remover vínculo.
    - Critério de Conclusão: O planejador recomenda materiais e abre referências corretas sem inventar páginas.

- **Módulo E — Banco de Questões e Avaliações (T18 a T23) com Tecnologia Calma (v3.18)**:
  - **T18 — Banco de Questões (`BancoQuestoes.tsx`, `BancoQuestoes.css`)**:
    - Layout com 2 colunas: Barra de filtros à esquerda (Objetivo, Disciplina, Tópico, Banca, Instituição, Ano, Cargo, Tipo, Dificuldade, Situação: *Nunca respondida, Respondida incorretamente, Acertada com baixa confiança, Erros recorrentes, Pendente de revisão, Favorita*) e lista de resultados à direita com paginação e contagem real.
    - Cada questão exibe: Identificação, Disciplina, Assunto, Banca/prova/ano, Tipo, Situação de validação e Histórico pessoal resumido.
    - **Regra canônica de gabarito oculto**: O gabarito nunca é exposto antes da resolução. Questões não publicadas ou sem integridade mínima são excluídas e questões anuladas recebem tratamento explícito de banner e pontuação de concurso.
    - Ações: Resolver, Adicionar ao caderno (T19), Favoritar (`/api/v1/bank/questions/{id}/favorite`) e Reportar problema (`/api/v1/bank/questions/{id}/report`).
  - **T19 — Montagem de Cadernos (`MontagemCadernoModal.tsx`, `MontagemCadernoModal.css`)**:
    - Modal interativo para criação de conjuntos de questões.
    - Campos: Nome, Objetivo, Filtros, Quantidade rápida (`5`, `10`, `30`, `50`, `Personalizada`), Modos (*Prática*, *Diagnóstico*, *Fixação*, *Simulado*), Tipo de caderno (*Fixo* vs *Dinâmico*) e Inclusão de respondidas.
    - Comportamento canônico: Exibe a quantidade real elegível (*"Encontramos 32 questões compatíveis com os filtros"*) e nunca completa com questões inexistentes ou duplicadas.
  - **T20 — Resolução de Questões (`QuestionViewer.tsx`)**:
    - Tela de foco com cronômetro de tempo ativo, enunciado formatado (preservando textos de apoio, imagens e fórmulas), alternativas validadas e registro obrigatório de confiança declarada (1 a 5) **antes do gabarito**.
    - Navegação com mapa de questões, atalhos de teclado e proteção de regras por modo (*Prática*: gabarito e diagnóstico imediato pós-confirmação; *Simulado*: alterações permitidas até a entrega final).
  - **T21 — Correção e Diagnóstico Comportamental (`DiagnosticoComportamental.tsx`, `DiagnosticoComportamental.css`)**:
    - Componente desacoplado e reutilizável em Prática, Relatório final, Histórico, Revisão e Auditoria.
    - Estrutura: Resultado (*Correta*, *Incorreta*, *Anulada*, *Sem correção automática*, *Gabarito pendente*), Sua resposta, Gabarito oficial de referência, Explicação detalhada e Diagnósticos comportamentais (*Erro com alta confiança*, *Acerto com baixa confiança*, *Tempo atípico*).
    - Classificação voluntária do erro com categorias canônicas E1 a E6 confirmadas no código. Regra estrita respeitada: O sistema nunca impõe conclusões automáticas precipitadas (*"Uma possibilidade é leitura precipitada. Confirme se isso aconteceu."*).
  - **T22 — Relatório da Sessão de Questões (`RelatorioSessaoQuestoes.tsx`, `RelatorioSessaoQuestoes.css`)**:
    - Relatório integrado em 6 seções canônicas:
      1. *Resultado Oficial*: Total, Acertos, Erros, Anuladas, Não respondidas e Pontuação conforme regras da banca.
      2. *Integridade da Evidência*: Inéditas, Repetidas, Itens de baixa confiabilidade e Interrupções.
      3. *Calibração*: Matriz 2x2 de Confiança x Acerto (Acertos convictos, Acertos inseguros, Erros convictos, Erros conscientes).
      4. *Desempenho por Conteúdo*: Tabela por Assunto com acertos, erros e evidência de domínio.
      5. *Gabarito Comentado*: Cada questão exibe resultado, gabarito, confiança, tempo e o componente T21 integrado.
      6. *Plano de Recuperação*: Prescrições práticas de revisão e resolução de questões inéditas.
    - Regra canônica: Separação estrita entre pontuação oficial e evidência de domínio pedagógico.
  - **T23 — Cadernos e Simulados (`GerenciadorCadernos.tsx`, `GerenciadorCadernos.css`)**:
    - Gestão de conjuntos reutilizáveis de questões em categorias: *Todos*, *Personalizados*, *Nunca respondidas*, *Questões erradas*, *Erros recorrentes*, *Acertos inseguros* e *Simulados*.
    - Distinção fundamental respeitada: Caderno fixo (preserva seleção determinada) vs Caderno dinâmico (recalcula conforme critérios).
    - **Armazenamento de referências sem duplicação física**: Tabela `study_notebooks` no SQLite armazena especificações e referências a IDs de questões sem clonar registros da tabela `questions`.

- **Módulo F — Revisões Adaptativas (T24 e T25) com Tecnologia Calma (v3.19)**:
  - **T24 — Fila de Revisões (`CicloRevisoes.tsx`, `CicloRevisoes.css`)**:
    - Estrutura hierárquica `REVISÕES` com seções `Prioritárias` (Direito Tributário — Suspensão do crédito; Português — Concordância verbal; Administração — Planejamento) e `Programadas` (Contabilidade — Patrimônio; Matemática — Porcentagem).
    - Exibição de 7 Informações Canônicas por item: Conteúdo (`disciplina — topico`), Motivo (`justificativa_pedagogica`), Última recuperação, Resultado anterior, Estimativa de duração, Evidência disponível e Tipo de revisão.
    - Quatro Tipos Canônicos de Revisão:
      1. *Recuperação*: Verificar se consegue lembrar e aplicar.
      2. *Correção*: Tratar erro ou concepção equivocada.
      3. *Consolidação*: Praticar conceito ainda instável.
      4. *Manutenção*: Verificar conhecimento anteriormente demonstrado.
    - 5 Ações Canônicas por card: *Revisar agora* (aciona T25), *Adiar* (modal com seleção de dias e justificativa registrada em evento append-only), *Ver motivo* (modal de transparência pedagógica do Gêmeo Digital), *Abrir histórico* e *Informar indisponibilidade*.
    - **Regra Canônica de Atraso**: *"Uma revisão atrasada não significa automaticamente conhecimento perdido. O atraso aumenta a necessidade de verificação, mas não comprova esquecimento."* (destacada em banner suave).
    - **Governança de Acúmulo de Revisões**: Algoritmo que limita a carga diária ativa e recomenda uma *"Sessão dedicada a revisões"* quando há excesso de pendências, impedindo efeito bola de neve e sobrecarga cognitiva.
  - **T25 — Execução de Revisão (`ExecucaoRevisao.tsx`, `ExecucaoRevisao.css`)**:
    - Fluxo de foco em 5 etapas canônicas: `CONTEÚDO A REVISAR -> TENTATIVA DE RECUPERAÇÃO -> RESPOSTA / EXPLICAÇÃO / QUESTÃO -> FEEDBACK -> ATUALIZAÇÃO DAS EVIDÊNCIAS -> PRÓXIMA REVISÃO`.
    - Princípio pedagógico de recuperação ativa: Bloqueio estrito de gabaritos ou teoria antes da tentativa genuína de recuperação mental (retrieval practice).
    - Tratamento de falha ou dúvida: Apresenta explicação conceitual curta, exemplo resolvido da banca examinadora, propõe nova tentativa com questão inédita de transferência e registra o resultado ponderado.
    - **Integração com R**:
      - A sessão registra os eventos no `event_store`.
      - O sistema principal solicita ou agenda análise ao motor em R (`digital_twin_engine.R`).
      - O motor em R devolve estimativas, métricas e parâmetros psicométricos/half-life.
      - O sistema principal em Spring Boot decide quando inserir a próxima revisão na fila SQLite.
      - **Regra fundamental**: O motor em R **NUNCA** edita diretamente a fila operacional ou o banco de dados SQLite.
  - **Endpoints Backend (`RevisionCalendarController.java`, `RevisionCalendarService.java`)**:
    - `GET /api/v1/revisoes/agenda`: Retorna árvore com `prioritarias`, `programadas`, `excessoPendencias` e avisos pedagógicos.
    - `POST /api/v1/revisoes/{id}/adiar`: Posterga revisão e grava `REVISION_POSTPONED` no `event_store`.
    - `GET /api/v1/revisoes/{id}/execucao`: Retorna contexto T25 com questão para validação e questão inédita de transferência.
    - `POST /api/v1/revisoes/{id}/tentativa`: Registra resultado da recuperação ativa, calculando estabilidade e gravando `RECOVERY_ATTEMPT_RECORDED`.

- **Módulo G — Desempenho e Inteligência (T26, T27 e T28) com Tecnologia Calma (v3.20)**:
  - **T26 — Painel de Desempenho (`PainelDesempenho.tsx`, `PainelDesempenho.css`)**:
    - **Resumo Longitudinal**: 5 métricas centrais: Questões respondidas (com avaliadas), Precisão observada com denominador obrigatório (`81% — 34 acertos em 42 questões`), Tempo efetivo de estudo, Conteúdos trabalhados (cobertura curricular) e Revisões executadas.
    - **Regra Canônica de Denominador e Amostra Preliminar**: Todo percentual apresenta seu denominador; quando a amostra é pequena (< 15 questões), exibe alerta explícito de que a conclusão é preliminar e sujeita a variação estatística.
    - **Evolução Temporal**: Gráfico de desempenho temporal com filtros de período (*Tudo*, *30 Dias*, *7 Dias*, *Hoje*) e denominadores por dia.
    - **Distribuição por Conteúdo**: Tabela de disciplinas e tópicos com acertos, erros, precisão com denominador, tempo médio por questão, badge de confiabilidade da amostra e botão para inspeção direta (T27).
    - **Alertas Pedagógicos & Metaconscienciosos**: Monitoramento contínuo de: *Erros recorrentes*, *Excesso de confiança (falsa fluência)*, *Retenção ainda não verificada* e *Conteúdos importantes com pouca evidência*.
  - **T27 — Análise por Conteúdo (`AnaliseConteudoModal.tsx`, `AnaliseConteudoModal.css`)**:
    - Gaveta/modal lateral de foco longitudinal para investigação detalhada de uma habilidade ou tópico específico.
    - Informações completas: Histórico de respostas, primeiras tentativas vs repetições, questões inéditas, taxa com denominador, confiança média e distribuição de erros (E1 a E5).
    - **Linha do Tempo Canônica**: Visualização cronológica da evolução da habilidade (*Estudo inicial teórico*, *Primeira bateria*, *Intervenção corretiva*, *Questões inéditas de transferência*, *Recuperação ativa posterior*).
    - **Diferenciação Metodológica de Dificuldade (Regra Canônica)**: Distingue formalmente se a melhoria decorre de ganho real de habilidade ou de facilitação artificial das questões, comparando desempenho em itens fáceis, médios e difíceis da banca.
    - **Materiais Vinculados & Ações**: Lista de capítulos de PDFs/apontamentos utilizados, com ações para *Revisar agora* (T25), *Resolver questões*, e *Ver evidências utilizadas* (registro do `event_store`).
  - **T28 — Calibração, Retenção e Modelo do Estudante (`CalibracaoRetencaoAbas.tsx`, `CalibracaoRetencaoAbas.css`)**:
    - **Aba A — Confiança**:
      - Matriz 2x2 canônica (Acertou vs Errou x Confiança alta vs Confiança baixa).
      - Indicadores centrais: Acertos inseguros (chutes/sorte), Erros com alta confiança (pontos cegos/falsa fluência), Brier score e evolução da calibração metaconscienciosa.
      - Curva estatística de calibração em 5 níveis (confiança declarada 20% a 100% vs precisão observada) e análise de calibração por disciplina.
    - **Aba B — Retenção**:
      - Monitoramento de conteúdos testados após intervalo, resultados de recuperação confirmados, conteúdos pendentes de teste e revisões realizadas.
      - **Regra Canônica de Transparência Metodológica**: Banner explícito destacando que curvas de retenção e taxas de esquecimento são projeções matemáticas e não certezas biológicas individuais.
    - **Aba C — Modelo do Estudante**:
      - Cards interpretáveis por disciplina/área: *Desempenho observado*, *Retenção*, *Confiança*, *Evidência* e *Próxima verificação*.
      - **Ação Canônica "Ver por que o sistema concluiu isso"**: Modal de total transparência algorítmica exibindo: Dados utilizados, Período avaliado, Quantidade de observações, Versão da análise psicométrica e Limitações metodológicas da conclusão.
  - **Backend de Suporte (`PerformanceIntelligenceService.java`, `AnalyticsController.java`)**:
- **Módulo H — Importação, Extração e Auditoria (T29 a T35) com Isolamento Staging (v3.21)**:
  - **Princípio Central de Arquitetura em Duas Áreas**:
    - Isolamento estrito entre a área temporária de preparação/auditoria (`db/staging.db`) e o banco oficial publicado dos estudantes (`db/fiscalstudy.db`).
    - Nenhuma extração é publicada automaticamente apenas porque o processamento terminou.
  - **T29 — Assistente de Importação de Provas (`AssistenteImportacaoWizard.tsx`, `AssistenteImportacaoWizard.css`)**:
    - Wizard em 5 etapas: 1. Selecionar Arquivos (individual ou lote, PDF prova, gabarito e complementares); 2. Identificar a Prova (concurso, instituição, banca, ano, cargo, tipo, versão, esperadas, origem); 3. Identificar o Gabarito (preliminar, definitivo, retificação, cargo, versão, fonte) com **regra crítica de desambiguação** (*"Encontramos mais de um gabarito potencialmente compatível. Selecione o documento correto ou mantenha a importação pendente"*); 4. Pré-processamento técnico (digital/digitalizado, páginas, texto extraível, OCR, colunas, imagens, tabelas, textos compartilhados); 5. Início de processamento com integridade estrita em staging.
  - **T30 — Central de Processamento (`CentralProcessamento.tsx`, `CentralProcessamento.css`)**:
    - Tabela de importações com 8 estados canônicos (*Aguardando*, *Processando*, *Extração concluída*, *Validação estrutural*, *Necessita revisão*, *Pronta para auditoria*, *Falha*, *Cancelada*).
    - Detalhes de processamento: arquivos, páginas, questões identificadas vs esperadas, lacunas, duplicações, gabaritos encontrados, correspondências ambíguas, falhas de OCR, imagens não associadas.
    - **Regra de Reprocessamento**: Reprocessar não apaga correções humanas. Distingue extração original, nova extração, edição humana e versão candidata.
  - **T31 — Auditoria de Questões (`AuditCockpit.tsx`, `AuditCockpit.css`)**:
    - Layout com 3 painéis (PDF da prova + PDF do gabarito + Questão extraída) com divisor ajustável (splitter).
    - 4 Modos canônicos: *Comparação completa*, *Foco na extração*, *Foco no gabarito*, *Pré-visualização*.
    - Faixa horizontal de navegação com os **7 estados visuais independentes de cor**:
      - `Não visitada`: Ainda não foi aberta (○)
      - `Visitada`: Foi aberta, mas não validada (👁️) — *Visitada nunca significa validada!*
      - `Incompleta`: Faltam informações (⚠️)
      - `Com alerta`: Existe inconsistência (⚡)
      - `Em revisão`: Correção humana em andamento (✏️)
      - `Validada`: Conferência humana concluída (✓)
      - `Publicada`: Disponível para estudo (★)
    - Diálogo de saída com alterações pendentes: *"Existem alterações pendentes. Deseja salvar, descartar ou continuar editando?"*
  - **T32 — Editor de Questão & Rastreabilidade de Gabarito**:
    - Modal de alteração manual de gabarito registrando: Valor anterior, Valor novo, Motivo obrigatório, Fonte comprobatória, Responsável técnico e Data.
    - **Regra**: Não permite que uma alteração manual seja apresentada como gabarito oficial da banca sem auditoria.
  - **T33 — Pré-Visualização de Questão (`QuestionPreviewModal.tsx`, `QuestionPreviewModal.css`)**:
    - Utiliza a mesma renderização do `QuestionViewer` (T20) com simulação responsiva (*Desktop 100%*, *Tablet 768px*, *Celular 380px*) e teste interativo de resolução pelo estudante.
  - **T34 — Validação e Publicação em Lote**:
    - Separação estrita entre Estado de qualidade (*Extraída*, *Estruturalmente válida*, *Necessita revisão*, *Conferida contra a fonte*, *Rejeitada*) e Estado de publicação (*Rascunho*, *Publicada*, *Suspensa*, *Arquivada*).
    - Resumo canônico de lote: `40 questões selecionadas. 34 elegíveis. 4 exigem revisão. 2 possuem inconsistências impeditivas.`
    - Publicação transacional para `fiscalstudy.db` via `/api/v1/ingestion/staging-publish/{id}` impedindo publicação silenciosa de itens inválidos.
  - **T35 — Qualidade do Banco de Questões (`QualidadeBancoQuestoes.tsx`, `QualidadeBancoQuestoes.css`)**:
    - 9 Indicadores centrais de confiabilidade do acervo oficial.
    - Ações de suspender publicação e revalidar.
    - **Regra de Preservação Histórica**: Suspender uma questão retira-a dos cadernos de novos estudos, mas **NUNCA** apaga respostas do `event_store`.
  - **Backend Integrado (`StagingDatabaseService.java`, `IngestionController.java`)**:
- **Módulo I — Configurações e Administração (T36 a T40) com Resiliência e Tecnologia Calma (v3.22)**:
  - **T36 — Configurações (`ConfiguracoesAdminView.tsx`, `ConfiguracoesAdminView.css`)**:
    - Abas organizadas: *Perfil de estudos* (duração 15 a 120 min, pausas 5 a 20 min, fonte ampliada, alto contraste, idioma), *Objetivos* (meta diária, prioridades, horizonte temporal), *Rotina* (volume semanal, proteção de folgas, ritmo), *Revisões* (limites de carga por dia 10 a 60 min, política de notificações) e *Privacidade* (armazenamento estritamente local-first em SQLite).
    - **Regra**: Parâmetros matemáticos internos de algoritmos não ficam expostos sem limites e possuem explicações didáticas claras.
  - **T37 — Dados, Backups e Recuperação**:
    - Dashboard de métricas: Tamanho do banco operacional principal (`db/fiscalstudy.db`), área de staging (`db/staging.db`), status de integridade (`PRAGMA integrity_check`) e data/hora do último backup.
    - **Backup Consistente SQLite com WAL**: Utiliza `PRAGMA wal_checkpoint(TRUNCATE)` seguido de comando `VACUUM INTO` em arquivo snapshot isolado com timestamp, sem risco de corrupção ou dependência de cópia crua de arquivos durante escritas concorrentes.
    - **Restauração Protegida**: Exige confirmação explícita em modal de segurança. **Regra Crítica**: Antes de restaurar qualquer arquivo, o FiscalStudy gera automaticamente uma cópia de segurança (`safety backup`) do banco atual para evitar qualquer risco de perda irreversível.
  - **T38 — Integrações e Motor Analítico**:
    - Cards de status para Motor Psicométrico R, Extrator de PDF Python, OCR Tesseract e AnkiConnect (127.0.0.1:8765).
    - **Regra Fundamental de Resiliência**: A indisponibilidade de serviços externos ou do motor em R **NUNCA** bloqueia abrir o sistema, estudar, resolver questões, consultar histórico ou executar revisões já programadas; o sistema opera transparentemente em modo resiliente (`EM_FALLBACK_RESILIENTE`).
  - **T39 — Diagnóstico Técnico e Auditoria**:
    - Resumo de infraestrutura: Versão da aplicação (3.22), motor SQLite, arquitetura APPEND-ONLY EVENT LOG, sanitização automática de logs para proteção contra vazamento de credenciais e tokens.
    - Auditoria de integridade do log de eventos: Contagens de tabelas operacionais, verificação de integridade e detecção de duplicatas no `event_store` (duplicações = 0).
    - Botão de exportação de relatório técnico estruturado em JSON para depuração sem acesso manual direto ao arquivo do banco.
  - **T40 — Busca Global Unificada (`BuscaGlobalModal.tsx`, `BuscaGlobalModal.css`)**:
    - Modal de busca federada acionado via teclado (`Ctrl+K` ou `Cmd+K`) ou botão na barra lateral.
    - Categorização canônica obrigatória: `CONTEÚDOS` (Edital e matérias), `QUESTÕES` (enunciados e IDs com atalho para resolução), `MATERIAIS` (livros e páginas vinculadas confirmadas), `ATIVIDADES` (revisões pendentes e simulados).
    - Redirecionamento instantâneo com clique, mantendo contexto de navegação e filtros.
  - **Backend de Suporte (`SystemSettingsService.java`, `SystemSettingsController.java`)**:
- **Módulo J — Resumos Estratégicos — Inteligência de Conteúdo Orientada à Prova (v3.23)**:
  - **Componentes Dedicados**: `ResumosEstrategicos.tsx` e `ResumosEstrategicos.css` com tokens de Tecnologia Calma (Paper creme `#f9f8f6` e Night ardósia `#0e0f11`), eliminando qualquer caixa escura solta no modo claro.
  - **Classificação de Relevância Orientada ao Edital**:
    - Cruza o peso oficial do edital (`edital_topicos`), histórico de cobrança e desempenho real do estudante (`event_store` com acertos/erros de questões).
    - Classificações: `⚡ ESSENCIAL PARA A PROVA`, `🔥 ALTA RELEVÂNCIA`, `🛡️ MANUTENÇÃO` e `📖 COMPLEMENTAR`.
    - **Princípio da Honestidade Epistêmica**: Quando a base empírica de questões do banco for reduzida (< 5 itens), exibe alerta explícito de limitação amostral em vez de inventar dados estatísticos.
  - **Seis Modalidades de Estudo Fluidas**:
    1. *Resumo Estruturado de Alta Densidade*: Definições canônicas, regras gerais, alertas de exceções críticas e relação com a banca examinadora.
    2. *Fichas Rápidas de Revisão*: Cards ágeis para revisão em 3 a 5 minutos com conceito, regra, exceções, palavras-chave e erros comuns.
    3. *Mapa Mental & Esquema Hierárquico*: Árvore visual com raiz, ramos coloridos e subcategorias conceituais.
    4. *Quadros Comparativos*: Tabelas lado a lado de distinções frequentemente cobradas pela banca (ex: Imunidade vs Isenção vs Não Incidência).
    5. *Flashcards Inteligentes*: Prática de recuperação ativa com rotação 3D Frente/Verso e botão de 1-clique para injeção na curadoria do Anki.
    6. *Pegadinhas da Banca & Reta Final*: Armadilhas clássicas da banca examinadora + resumo ultracompacto para véspera de prova.
  - **Painel Lateral de Rastreabilidade e Proveniência**: Exibe documento de origem, intervalo de páginas, tópico oficial do edital, banca examinadora, última revisão e métricas empíricas do estudante.
  - **Ações Reais Integradas**: *Praticar Questões do Tópico* (aciona o `QuestionViewer`), *Enviar Flashcards ao Anki* e *Marcar como Revisado* com gravação de evento `SUMMARY_REVIEWED` no `event_store`.
  - **Backend Support (`StrategicSummaryService.java`, `StrategicSummaryController.java`, `StrategicSummaryControllerTest.java`)**:
    - Endpoints REST `/api/v1/summaries`: `GET /`, `GET /{id}`, `POST /generate`, `POST /{id}/send-to-anki`, `POST /{id}/mark-reviewed`.
    - Tabela SQLite `strategic_summaries` persistindo resumos e artefatos JSON com integridade atômica.

## 3. Estado Atual dos Bancos de Dados
- **Staging (`db/staging.db`)**: 386 arquivos elegíveis processados. Vila Pavão corrigida; Porto Alegre e Domingos Martins reprocessados com escopos Q1..18 e Q1..10 sem numeração de linhas; SEEC_DF (160 itens) e Florianópolis (100 itens) 100% íntegros.
- **Produção (`db/fiscalstudy.db`)**: 13.241 questões ativas publicadas com segurança atômica (`--clean-slate`), 486 materiais de apoio limpos vinculados, tabelas `study_notebooks`, `favorite_questions`, `question_reports` criadas, backup físico íntegro e evento `IMPORT_RECEIVED` auditado no `event_store`.
- **Testes & Builds**: 100% verdes no backend (`mvnw.cmd test-compile` -> BUILD SUCCESS) e no frontend (`tsc -b && vite build` -> 0 erros, saída em dist/ gerada com sucesso).

