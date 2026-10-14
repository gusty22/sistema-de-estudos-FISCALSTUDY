# FISCALSTUDY — ESPECIFICAÇÃO DE ENGENHARIA, AUDITORIA COMPARATIVA E PLANO ARQUITETURAL INCREMENTAL

> **Natureza:** Documento mestre de auditoria, análise comparativa do Track Concursos, mapeamento de lacunas, modelagem conceitual e planejamento incremental para evolução do FiscalStudy em plataforma inteligente de preparação para concursos.  
> **Diretrizes Mandatórias:** Estrita consonância com `docs/PROMPT_MESTRE.md`, `AGENTS.md` e `docs/PROJECT_CONTEXT.md`.  
> **Estado Operacional:** Nenhuma migração ou alteração no banco operacional `db/fiscalstudy.db` foi realizada nesta etapa, em respeito à integridade do histórico do estudante.

---

## 1. AUDITORIA FACTUAL DO ESTADO ATUAL DO FISCALSTUDY

Para evitar qualquer confusão entre compilação, testes isolados e funcionalidades realmente integradas, consolida-se a situação técnica do repositório:

| Componente | Stack | Estado Real Comprovado | Testes / Evidência |
| :--- | :--- | :--- | :--- |
| **Backend Monolítico** | Java 17, Spring Boot 3.3.4 | Monólito local modular com arquitetura CQRS estrita. | 86 testes unitários e de integração passando integralmente com `mvnw test` (0 falhas, 0 erros). |
| **Banco Operacional** | SQLite (`db/fiscalstudy.db`) | 7 tabelas ativas (`event_store`, `questions`, `concursos`, `editais`, `edital_topicos`, `support_materials`, `question_support_materials`). | 26 eventos históricos imutáveis na `event_store`; 77 questões oficiais persistidas. Zero deleções. |
| **Ingestão Documental** | Python 3.13, PyMuPDF | Pipeline assíncrono com `LayoutEngine`, inspeção de PDFs e extração estruturada. | Prova de Técnico Fiscal (Cargo 532) ingerida com 40 questões, textos-base compartilhados e Q15 com divergência matemática sinalizada. |
| **Frontend Web** | React 19, TypeScript, Vite | Interface web responsiva em execução na porta 5173. | Telas de Meus Concursos, Sessão Personalizada, Edital Verticalizado e Ingestão integradas via HTTP à porta 8080. |

### 1.1. O que está implementado e validado em nível de dados e API
1. **Append-Only Event Store:** Registrado em `backend/src/main/resources/schema.sql`. Proibição estrutural de `UPDATE` e `DELETE`. Eventos de início/fim de sessão, apresentação de questão (`QUESTION_PRESENTED`), submissão de tentativa (`ANSWER_SUBMITTED`), importação documental (`IMPORT_RECEIVED`) e auditoria de revisão (`QUESTION_REVIEWED`) persistidos.
2. **Isolamento de Concursos no Backend:** Tabela `concursos` gerenciando múltiplos alvos; resolução de filtros por concurso em `QuestionRepositoryImpl.java` buscando com precisão por `banca`, `ano` e `cargo`.
3. **Ingestão Documental Assíncrona:** Upload multipart seguro, inspeção estrutural de PDFs, extração via `LayoutEngine`, pareamento de gabaritos preliminares/definitivos e vinculação de textos-base compartilhados (`IngestionPipelineService.java`).
4. **Resolução com Métricas Pedagógicas Reais:** Ocultação rigorosa do gabarito até a submissão, medição de tempo ativo pausando em abas ocultas (Page Visibility API), nível de confiança (1..5) e registro da causa do erro com taxonomia causal **E1 a E6** (`QuestionViewer.tsx`).
5. **Simulação de Importação (Dry-Run Gatekeeper):** Proteção do banco operacional contra sobrescrita acidental por colisão de IDs de questões.

### 1.2. O que está incompleto ou operando como protótipo de interface
1. **Navegação Fragmentada:** A interface atual utiliza uma barra superior horizontal com 4 abas estáticas (`Meus Concursos`, `Sessão de Estudo`, `Edital Verticalizado`, `Importar Provas & Revisão`). Falta uma **Sidebar unificada** com visão contextual do concurso ativo.
2. **Ausência do Dashboard Individual do Concurso:** Ao selecionar um concurso em "Meus Concursos", o usuário é jogado diretamente na tela de seleção de sessão ou no edital, sem passar por um painel central de comando.
3. **Falta do Elemento Decisório ("O Que Estudar Agora?"):** O sistema transfere toda a carga cognitiva para o estudante, exigindo que ele decida manualmente qual disciplina, assunto e modo selecionar antes de iniciar.
4. **Edital Verticalizado Vazio de Conteúdo Programático:** A tela de Edital Verticalizado possui a estrutura visual, mas ainda depende de inserção manual ou de extração automática de disciplinas e tópicos a partir do PDF do edital.
5. **Inexistência de Cronograma e Cadernos:** Não há gerador de ciclos de estudo, planejamento semanal adaptativo ou agrupamento de questões em cadernos temáticos.

---

## 2. ANÁLISE DE REFERÊNCIA — TRACK CONCURSOS

Auditamos detalhadamente o projeto local clonado em:  
`references/track-concursos/track-concursos`

A análise baseou-se na leitura direta dos códigos-fonte (`README.md`, `data.js`, `cadastro_edital.html`, `dashboard.html`, `crono-cycle.js`) e na inspeção da imagem fornecida pelo usuário.

### 2.1. Diferenciação Epistemológica Rigorosa
- **[E1 - Observado Diretamente no Código/Interface]:** Telas HTML, estruturas de dados no `localStorage`, fluxo em `data.js`, wizards em `cadastro_edital.html` e layout do dashboard.
- **[E2 - Descrito na Documentação Pública]:** Recursos listados no `README.md` e `CHANGELOG.md` do Track Concursos (ex.: método do ciclo de Alexandre Meirelles, Edital Premium em JSON).
- **[E3 - Relatado por Usuários da Comunidade]:** Facilidade de uso da interface escura, sensação de controle pelo cronômetro e dependência de cursinhos externos para questões.
- **[E4 - Hipótese Ainda Não Verificada]:** Eficácia de retenção a longo prazo de usuários que utilizam apenas o cronômetro sem resolução integrada de itens.

### 2.2. Anatomia Funcional do Track Concursos
1. **Gestão de Concursos (`concursos.html` e `data.js`):**
   - Suporta status pré-edital (com contador de coberturas `coberto x0` e foguete) e pós-edital (com contagem regressiva em dias).
   - Registra dados da prova: instituição, banca, cargo, salário, vagas, link do edital e data.
2. **Cadastro Progressivo (`cadastro_edital.html`):**
   - Assistente em 4 etapas: (1) Informações gerais e logos; (2) Data da prova ou pré-edital; (3) Importação de edital estruturado em JSON ou manual; (4) Revisão de matérias e tópicos.
3. **Planejador ("Cronograma Inteligente" em `crono-cycle.js`):**
   - Oferece escolha entre **Ciclo de Estudos** (sequência contínua de blocos de estudo baseada no método de Alexandre Meirelles, calculando tempo com base no peso de cada matéria) e **Cronograma Semanal** (agenda fixa de Segunda a Domingo).
4. **Registro de Atividades:**
   - Possui cronômetro livre, regressivo e Pomodoro. **Contudo, o registro de questões é meramente numérico e manual** (o aluno digita em um input: "Fiz 15 questões e acertei 12"). Não há questões reais integradas.
5. **Revisões Espaçadas (`revisoes.html`):**
   - Sugestão de revisão por agendamento de dias (D+1, D+7, D+15, D+30) ou por alerta de tópicos com baixo percentual de acertos registrados.
6. **Simulados (`simulados.html`):**
   - Formulário para registrar notas manuais e ponderá-las pelo "Painel da Prova", comparando com notas anteriores.

### 2.3. O Diagnóstico Crítico: Pontos Fortes vs. Limitações Estruturais do Track
- **Ponto Forte Principal:** **UX moderna, limpa e com baixíssima fricção.** O usuário vê tudo o que precisa no Dashboard: suas matérias, quanto tempo dedicou, quantas questões registrou e o que o cronograma sugere para a semana.
- **Limitação Estrutural Crítica:** **O Track Concursos é um "tracker passivo".** Ele não sabe qual questão o aluno resolveu, não sabe o enunciado, não tem o texto-base, não sabe qual alternativa foi marcada, não mede o tempo por questão, não rastreia o motivo do erro (E1 a E6) e confunde fatalmente **atividade com aprendizagem** (basta o aluno clicar no checkbox do tópico para marcá-lo como "Concluído", dando uma falsa sensação de domínio).
- **Vantagem Competitiva Insuperável do FiscalStudy:** O FiscalStudy possui a **camada de dados ativa**: ingestão de provas reais, textos-base compartilhados, conferência de fidelidade documental, medição de tempo ativo por questão, calibração de confiança, taxonomia causal de erros e log imutável de eventos.

---

## 3. MATRIZ COMPARATIVA: TRACK CONCURSOS vs. FISCALSTUDY ATUAL

| FUNCIONALIDADE | TRACK CONCURSOS | FISCALSTUDY ATUAL | OPORTUNIDADE PARA O FISCALSTUDY | PRIORIDADE | EVIDÊNCIA |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Arquitetura & Persistência** | Electron/pywebview + `localStorage` mutável espelhado em JSON (`profiles/`). Sujeito a perdas. | Monólito Java 17 + SQLite com **Append-Only Event Log** imutável e projeções materializadas. | Unir a segurança transacional e integridade científica do FiscalStudy à interface rica e fluida. | **Alta (Base)** | `data.js:L61-68` vs `schema.sql:L3-14` |
| **Navegação & Layout** | **Sidebar vertical fixa** com menu claro, status de pré/pós-edital no rodapé e perfil. | Navbar horizontal simplificada de 4 abas estáticas no topo. | **Adotar Sidebar moderna** no FiscalStudy com alternador de concurso ativo, liberando espaço horizontal. | **P1 (Imediata)** | `dashboard.html` vs Telas atuais do FiscalStudy |
| **Cadastro de Concursos** | Wizard progressivo de 4 etapas em `cadastro_edital.html` com pré-visualização de card. | Modal simples com poucos campos textuais (nome, órgão, banca, ano, cargo). | **Criar fluxo progressivo em 5 etapas** (Geral, Datas Tipadas, Edital, Disponibilidade, Resumo). | **P1 (Imediata)** | `cadastro_edital.html:L1200` vs `ConcursoController.java` |
| **Dashboard do Concurso** | **Painel central completo** com 5 KPIs, tabela de matérias com progresso por tópicos e cronograma lateral. | Inexistente. Clicar no concurso leva à listagem ou sessão direta sem visão geral. | **Implementar Dashboard Individual por Concurso**, integrando o card decisório **"O Que Estudar Agora?"**. | **P2** | `dashboard.html` vs Código FiscalStudy atual |
| **"O Que Estudar Agora?"** | Sugestão genérica no cronograma semanal ou próximo bloco do ciclo de Meirelles. | Inexistente. Usuário precisa configurar filtros manualmente em toda sessão. | **Card inteligente central:** prescreve disciplina, assunto, atividade (ex: resolver 8 questões), tempo e o **motivo explícito**. | **P2** | `PROMPT_MESTRE.md:L29-33` |
| **Edital Verticalizado** | Estrutura hierárquica (Matéria > Tópico > Subtópico) com checkboxes de conclusão e links de materiais. | Tabela de tópicos com rastreabilidade documental (página/trecho), mas ainda sem árvore hierárquica interativa. | **Edital Verticalizado com Estados Pedagógicos Reais** (Não Iniciado, Em Estudo, Praticado, Em Revisão, Domínio). | **P3** | `aba_materia.html` vs `EditalTopico.java` |
| **Importação de Edital** | Depende de JSON pré-formatado ("Edital Premium") ou cola de texto com prompt para IA externa. | Staging documental com Python/PyMuPDF para provas; extração de edital documental programada. | **Pipeline de Ingestão de Editais em PDF**: extração automática de disciplinas, tópicos, pesos e critérios eliminatórios. | **P3** | `editais_premium.html` vs `IngestionPipelineService.java` |
| **Banco de Questões** | **Nenhum.** Apenas campos para o usuário digitar quantos acertos e erros teve em sites de terceiros. | **Banco Real de Questões:** itens completos, opções, gabaritos verificados, textos-base e fotos das páginas da prova. | **Consolidar Banco de Questões com Filtros Avançados**, deduplicação semântica e histórico compartilhado. | **P4** | `data.js:L124-126` vs `QuestionRepositoryImpl.java` |
| **Resolução de Questões** | Inexistente (feita fora do app). | **Sessão Ativa Integrada:** gabarito oculto, Page Visibility timer, nível de confiança (1..5) e causa de erro (E1..E6). | **Evoluir para Sessões Configuráveis** (por tempo, inéditas, erradas, misturadas) direto pelo Dashboard. | **P4** | `QuestionViewer.tsx:L234-265` |
| **Cronograma Inteligente** | Ciclo de Estudos contínuo de Alexandre Meirelles e Calendário Semanal fixo em `crono-cycle.js`. | Inexistente. | **Planejador Adaptativo MVT** (Mapa, Veículo, Traqueamento), considerando horas diárias, peso da banca e revisões vencidas. | **P5** | `crono-cycle.js:L1-120` vs `PROMPT_MESTRE.md:L80-120` |
| **Revisões Automáticas** | Agendamento rígido por dias (D+1, D+7, D+15) ou alerta de tópico com acerto < 60%. | Suporte conceitual e histórico de tentativas gravadas na `event_store`. | **Fila de Revisões Explicável:** priorização por tempo decorrido, erros frequentes, confiança excessiva e peso da matéria. | **P5** | `revisoes.html` vs `AnalyticsProjectionService.java` |
| **Simulados & Cadernos** | Lançamento manual de notas em `simulados.html`. Sem cadernos dinâmicos. | Modo "Simulado Oficial" existente na sessão, com tempo ativo geral e sem feedback imediato. | **Simulados Automáticos com Caderno de Prova Fiel** e **Cadernos Dinâmicos** (Erros da Semana, Tópicos Fracos). | **P6** | `simulados.html:L1-80` vs `QuestionViewer.tsx:L90-105` |

---

## 4. MAPEAMENTO DE LACUNAS REAIS NO FISCALSTUDY

A partir da auditoria das alegações e da inspeção do código, as lacunas não são de "algoritmos de IA", mas de **integração, fluxo de usuário e completude dos módulos operacionais**:

1. **Lacuna Decisória ("Decision Fatigue"):** Ao abrir o FiscalStudy hoje, o estudante não sabe qual é a próxima ação prioritária. Ele precisa escolher um concurso, abrir a tela de sessão, escolher uma matéria, escolher um tópico e clicar em iniciar. O Track Concursos resolve parte disso com o cronograma visual, e o FiscalStudy deve resolver com a recomendação prescritiva explicável.
2. **Lacuna Estrutural do Concurso:** O modelo de `concursos` atual guarda campos básicos (`nome`, `orgao`, `banca`, `ano`, `cargo`, `status`). Faltam os metadados exigidos para o planejamento sério:
   - Situação do concurso (Previsto, Autorizado, Comissão Formada, Banca Definida, Edital Publicado, Inscrições Abertas, Prova Agendada, etc.);
   - Datas com tipagem explícita (`OFICIAL`, `PREVISTA`, `INFORMADA_PELO_USUARIO`), fonte e timestamp de atualização;
   - Parâmetros de disponibilidade semanal (horas diárias, dias da semana, matérias conhecidas vs. não estudadas).
3. **Lacuna da Hierarquia do Conteúdo Programático:** A tabela `edital_topicos` guarda tópicos soltos. É imperativo adotar formalmente a hierarquia `DISCIPLINA > ASSUNTO > SUBASSUNTO`, permitindo navegação em acordeão idêntica à do Track Concursos, mas com os estados pedagógicos do FiscalStudy:
   `NÃO INICIADO` → `EM ESTUDO` → `PRATICADO` → `EM REVISÃO` → `DOMÍNIO COM EVIDÊNCIA`.

---

## 5. ARQUITETURA INCREMENTAL PROPOSTA

A arquitetura do FiscalStudy permanecerá estritamente ancorada em seus princípios fundamentais:
- **Local-First Monolith:** Java 17 + SQLite + React/Vite. Sem microserviços, sem dependências externas na nuvem.
- **Append-Only Event Store:** Nenhuma ação do estudante gera mutações diretas em tabelas de auditoria. Toda resolução gera evento imutável na `event_store`.
- **Projeções Materializadas Reconstruíveis:** O Dashboard, o progresso do edital e as métricas são derivados determinísticamente dos eventos históricos.
- **Arquitetura Pedagógica MVT:**
  - **MAPA:** Edital verticalizado com pesos e relevância por banca.
  - **VEÍCULO:** Intervenção indicada para a necessidade do momento (teoria/leitura vs. questões guiadas vs. simulado vs. revisão focada).
  - **TRAQUEAMENTO:** Evidências empíricas coletadas no tempo ativo, calibração de confiança e distribuição de erros causais E1..E6.

---

## 6. ESPECIFICAÇÃO DOS MÓDULOS DE EVOLUÇÃO

### 6.1. Cadastro Progressivo de Concurso (Módulo 2)
Substituir o modal simplificado atual por um assistente em 5 etapas com persistência transacional:
- **Etapa 1 — Informações Gerais:** Nome, Órgão, Cargo, Código do Cargo, Banca, Ano, Localidade, Escolaridade, Vagas (ou Desconhecido), Situação do Concurso (Previsto, Autorizado, Comissão Formada, Banca Definida, Edital Publicado, Inscrições Abertas, Prova Agendada, Prova Realizada, Encerrado).
- **Etapa 2 — Datas Importantes:** Edital Previsto, Publicação Oficial, Início Inscrições, Fim Inscrições, Data da Prova, Resultado. Tipos: OFICIAL, PREVISTA ou INFORMADA_PELO_USUARIO com fonte documental. Timer apenas para datas reais.
- **Etapa 3 — Edital:** Upload de PDF, cadastro manual ou uso de edital anterior como referência com sinalização explícita de "Não Vigente".
- **Etapa 4 — Disponibilidade:** Horas disponíveis/dia, dias da semana, sessões preferidas, data de início, disciplinas já conhecidas vs não estudadas.
- **Etapa 5 — Confirmação:** Resumo com distinção entre dados confirmados, estimados e ausentes antes de salvar.

### 6.2. Dashboard Individual por Concurso (Módulo 3)
Ao selecionar um concurso, o sistema renderiza seu painel exclusivo:
1. **Cabeçalho Contextual:** Nome do concurso, cargo-alvo, banca organizadora, badge de situação (ex.: `PRÉ-EDITAL` ou contagem regressiva `FALTAM 64 DIAS`), e botão para alternar concurso.
2. **Top KPIs Reais (sem métricas artificiais):**
   - **Horas Estudadas:** Somatório exato do tempo ativo registrado em sessões.
   - **Questões Resolvidas:** Total de tentativas registradas no concurso.
   - **Desempenho Observado:** Acurácia geral em questões válidas (desconsiderando anuladas). Se $< 30$ tentativas: *"Dados insuficientes para estimar desempenho"*.
   - **Cobertura do Edital:** Tópicos com prática confirmada sobre o total de tópicos do edital.
   - **Revisões Pendentes:** Quantidade de tópicos ou questões na fila de revisão.
3. **Card Central ("O QUE ESTUDAR AGORA?"):**
   - Disciplina, Assunto, Atividade Recomendada, Tempo Estimado e Motivo da Recomendação.
   - Ação Imediata: Botão `Iniciar Estudo Agora` que abre a resolução pré-configurada sem nenhuma navegação intermediária.
4. **Tabela de Matérias:** Colunas `MATÉRIA`, `REVISÃO PENDENTE`, `TEMPO ATIVO`, `ACERTOS PEDAGÓGICOS`, `COBERTURA (TÓPICOS/SUBTÓPICOS)`.

### 6.3. Edital Verticalizado e Estados Pedagógicos (Módulos 4 e 5)
Organização em árvore interativa: `DISCIPLINA > ASSUNTO > SUBASSUNTO`.
- Estados Pedagógicos: `NÃO INICIADO` → `EM ESTUDO` → `PRATICADO` → `EM REVISÃO` → `DOMÍNIO COM EVIDÊNCIA` ($\ge 15$ questões, acurácia sustentada $\ge 80\%$, sem erros E1/E2 recentes e retenção validada em intervalo $\ge 14$ dias).

### 6.4. Cronograma Inteligente Adaptativo (Módulo 6)
- Suporte Duplo: Ciclo Contínuo (Meirelles) e Calendário Semanal.
- 8 Regras Operacionais Inegociáveis (priorizar revisões vencidas, identificar reincidências E1/E2, respeitar peso da banca, respeitar pré-requisitos, limitar conteúdo novo, respeitar teto de horas, amortecer imprevistos e justificar toda recomendação).

### 6.5. Banco de Questões, Cadernos e Simulados (Módulos 7, 8, 10 e 11)
- Identificadores canônicos compostos (`{banca}-{ano}-{orgao}-{cargo}[-{caderno}]-q{num}`) para impedir sobreposição entre cadernos distintos.
- Cadernos automáticos gerados sob demanda (Erros da Semana, Baixa Acurácia, Banca Alvo, Revisão Espaçada).
- Simulados com pontuação oficial e acurácia pedagógica segregadas.

### 6.6. Inteligência Adaptativa sem Alucinação (Módulo 12)
Encadeamento causal determinístico:
$$\text{OBSERVAÇÃO} \longrightarrow \text{MÉTRICA} \longrightarrow \text{HIPÓTESE} \longrightarrow \text{INTERVENÇÃO} \longrightarrow \text{RESULTADO}$$
Zero chamadas a modelos de IA para lógica rotineira.

---

## 7. MATRIZ DE DEPENDÊNCIAS TÉCNICAS E CRITÉRIOS DE ACEITE

```
Fase 0 (Auditoria Concluída) 
  ↳ Fase 1: Cadastro Concursos Progressivo & Nova Sidebar
      ↳ Fase 2: Dashboard do Concurso & "O Que Estudar Agora?"
          ↳ Fase 3: Edital Verticalizado em Árvore & Estados Pedagógicos
              ↳ Fase 4: Cronograma Adaptativo (Ciclo / Semanal)
                  ↳ Fase 5: Banco Consolidado & Cadernos Dinâmicos
                      ↳ Fase 6: Fila de Revisões Espaçadas & Simulados
```

---

## 8. AVALIAÇÃO DE RISCOS DE MIGRAÇÃO E INTEGRIDADE DE DADOS

O banco operacional local (`db/fiscalstudy.db`) possui atualmente:
- `event_store`: 26 eventos históricos intocados.
- `questions`: 77 questões oficiais persistidas.
- Tabelas de suporte: `concursos`, `editais`, `edital_topicos`, `support_materials`, `question_support_materials`.

### Salvaguardas Mandatórias:
1. Proibido qualquer script contendo `DROP TABLE` ou `DELETE` no ambiente operacional.
2. Adições de colunas na tabela `concursos` executadas exclusivamente via comandos idempotentes:
   `ALTER TABLE concursos ADD COLUMN situacao TEXT DEFAULT 'PREVISTO';`
3. Antes de qualquer comando DDL operacional, gerar snapshot binário com hash SHA-256 verificado em `db/backups/`.

---

## 9. RECOMENDAÇÃO DA PRIMEIRA FASE DE IMPLEMENTAÇÃO (FASE 1)

Para entregar valor imediato, estabilizar a experiência do estudante e eliminar a fadiga de decisão sem gerar riscos ao banco de dados, recomenda-se iniciar pela **FASE 1**:
1. **Frontend — Nova Sidebar de Navegação:**
   - Implementar a Sidebar global fixa (inspirada na elegância do Track Concursos), contendo logotipo, seletor do concurso ativo com badge de situação, links de navegação e rodapé contextual.
2. **Frontend & Backend — Assistente de Cadastro Progressivo (5 Etapas):**
   - Construir o fluxo em 5 etapas no frontend com validação em tempo real.
   - Estender de forma retrocompatível o DTO e repositório de `concursos` para persistir situação do concurso, metadados de datas e disponibilidade semanal do estudante.
3. **Validação de Isolamento:**
   - Garantir que a alternância entre concursos na Sidebar atualize imediatamente o contexto de todas as telas com zero vazamento de dados.
