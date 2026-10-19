# Módulos Funcionais e Especificações Técnicas — FiscalStudy

Este documento consolida os detalhes operacionais e técnicos dos módulos da plataforma, servindo como documentação modular de referência para consultas pontuais.

---

## Módulo A: Configuração Inicial e Objetivos (T01 a T06)
- **T01 — Boas-Vindas e Estado Inicial (`BoasVindasT01.tsx`, `BoasVindasT01.css`)**:
  - Fluxo de entrada quando não há objetivos cadastrados ("Vamos organizar seus estudos.").
  - Proteção contra Falha de Banco: se o backend estiver indisponível, apresenta mensagem de reconexão sem fingir que é primeiro acesso.
- **T02 — Cadastro de Objetivo**:
  - Unidade de planejamento abrangente (`CONCURSO`, `VESTIBULAR`, `CERTIFICACAO`, `CURSO`, `LIVRE`).
  - Campos: Nome, Tipo, Instituição, Cargo/área, Banca, Data (`OFICIAL`, `ESTIMADA`, `DESCONHECIDA`), Fonte oficial e Prioridade.
- **T03 — Importação e Edição do Currículo**:
  - Árvore de profundidade variável (Objetivo ➔ Disciplina ➔ Unidade ➔ Tópico ➔ Subtópico) com nós indivisíveis.
  - Editor Split (árvore navegável + detalhes do nó). Importação via JSON estruturado com IDs estáveis.
- **T04 — Diagnóstico Inicial (`SELF_REPORTED`)**:
  - Autodeclaração de familiaridade registrada como `SELF_REPORTED`, substituída progressivamente por evidências de resolução de questões.
- **T05 — Rotina e Disponibilidade Semanal**:
  - Calendário semanal (Manhã, Tarde, Noite para SEG-DOM) com blocos flexíveis, folgas e duração de foco (30, 50, 90 min).
- **T06 — Confirmação do Planejamento Inicial**:
  - Auditoria da configuração antes da geração do planejamento inicial no `Dashboard`.

---

## Módulo B: Início e Planejamento (T07 a T12)
- **T07 — Início: O que estudar agora? (`Dashboard.tsx`, `Dashboard.css`)**:
  - Foco em 1 única tarefa prioritária por vez ("Começar Agora" com botão "Por que esta atividade?").
  - Ajustes adaptativos: "Tenho menos tempo hoje", "Quero trocar", "Sem material", "Preciso descansar".
- **T08 / T09 — Meus Objetivos e Detalhes (`MeusConcursos.tsx`)**:
  - Multi-objetivos com abas: Visão Geral, Currículo, Materiais, Desempenho e Configurações.
- **T10 — Mapa de Conteúdos (`MapaConteudos.tsx`)**:
  - Árvore curricular com distinção epistemológica: *Estudado* ≠ *Dominado*.
- **T11 — Planejamento Adaptativo (`PlanejamentoAdaptativo.tsx`)**:
  - Fila dinâmica de decisões com reordenação e modal de consequência cognitiva ao adiar.
- **T12 — Visão Semanal (`VisaoSemanal.tsx`)**:
  - Projeção semanal anti-frágil: tarefas não concluídas retornam ao recálculo do Gêmeo Digital sem bola de neve.

---

## Módulo C: Execução dos Estudos (T13 a T15)
- **T13 — Execução de Estudo (`SessaoEstudoAtiva.tsx`)**:
  - Foco imersivo em 6 tipos de atividade: Estudo, Questões, Correção, Recuperação, Revisão, Simulado.
  - Roteiro progressivo com material vinculado e controles de interrupção com motivos padronizados.
- **T14 — Encerramento da Sessão (`SessaoEstudoAtiva.tsx`)**:
  - Apuração automática de tempo líquido, questões e acertos, com gravação idempotente via `POST /api/v1/study-sessions/record`.
- **T15 — Histórico de Sessões (`HistoricoSessoes.tsx`)**:
  - Consulta com filtros e anotações auditadas estritamente append-only (`STUDY_SESSION_ANNOTATION_ADDED`).

---

## Módulo D: Biblioteca e Materiais (T16 e T17)
- **T16 — Biblioteca de Materiais (`BibliotecaMateriais.tsx`)**:
  - Referências locais seguras (PDF, LIVRO, VIDEO, LINK, LEI_SECA) via UUID e Hash SHA-256 sem duplicar arquivos pesados no banco.
  - Tratamento de arquivos ausentes com opção de relocalizar sem perder histórico de estudo.
- **T17 — Vinculação Material-Conteúdo (`VinculacaoMaterialConteudo.tsx`)**:
  - Editor Split vinculando tópicos a intervalos de páginas, com validação humana obrigatória para sugestões de IA.

---

## Módulo E: Banco de Questões e Avaliações (T18 a T23)
- **T18 — Banco de Questões (`BancoQuestoes.tsx`)**:
  - Filtros multifacetados. Gabarito oculto antes da resposta. Questões anuladas recebem tratamento de concurso.
- **T19 / T23 — Montagem de Cadernos e Simulados (`MontagemCadernoModal.tsx`, `GerenciadorCadernos.tsx`)**:
  - Cadernos fixos vs dinâmicos armazenados como referências a IDs na tabela `study_notebooks` (sem duplicação física).
- **T20 — Resolução de Questões (`QuestionViewer.tsx`)**:
  - Registro obrigatório de nível de confiança (1 a 5) **antes** da revelação do gabarito.
- **T21 — Correção e Diagnóstico Comportamental (`DiagnosticoComportamental.tsx`)**:
  - Matriz de erros (E1 a E6) e diagnóstico de falsa fluência ou chute educado.
- **T22 — Relatório da Sessão (`RelatorioSessaoQuestoes.tsx`)**:
  - Matriz 2x2 de Confiança x Acerto, Brier Score, e plano de recuperação.

---

## Módulo F: Revisões Adaptativas (T24 e T25)
- **T24 — Fila de Revisões (`CicloRevisoes.tsx`)**:
  - 4 estágios: Recuperação, Correção, Consolidação e Manutenção.
  - Governança de atraso: atraso não é esquecimento automático; evita bola de neve limitando a carga diária.
- **T25 — Execução de Revisão (`ExecucaoRevisao.tsx`)**:
  - Bloqueio estrito de gabarito antes da recuperação ativa (retrieval practice).
  - Integração com R (`digital_twin_engine.R`): R gera métricas e half-life; Spring Boot decide a agenda; R nunca escreve no SQLite.

---

## Módulo G: Desempenho e Inteligência (T26 a T28)
- **T26 — Painel de Desempenho (`PainelDesempenho.tsx`)**:
  - Precisão observada com denominador explícito (`X acertos em Y questões`) e alertas para amostras pequenas (< 15).
- **T27 — Análise por Conteúdo (`AnaliseConteudoModal.tsx`)**:
  - Linha do tempo da evolução da habilidade diferenciando ganho real vs questões fáceis da banca.
- **T28 — Calibração, Retenção e Modelo do Estudante (`CalibracaoRetencaoAbas.tsx`)**:
  - Curva de calibração metaconscienciosa e transparência algorítmica ("Por que o sistema concluiu isso?").

---

## Módulo H: Ingestão, Extração e Auditoria (T29 a T35)
- **Duas Áreas**: Isolamento estrito entre `db/staging.db` (preparação) e `db/fiscalstudy.db` (produção).
- **T29 / T30 — Assistente e Central de Processamento (`AssistenteImportacaoWizard.tsx`, `CentralProcessamento.tsx`)**:
  - Extração de PDFs e gabaritos com desambiguação multi-cargo. Reprocessamento preserva correções humanas.
- **T31 / T32 — Cockpit de Auditoria e Editor (`AuditCockpit.tsx`)**:
  - Splitter de 3 painéis (PDF Prova + PDF Gabarito + Questão). 7 estados visuais independentes de cor.
- **T34 / T35 — Publicação e Qualidade (`QualidadeBancoQuestoes.tsx`)**:
  - Publicação atômica para produção. Suspender questão retira de novos cadernos sem apagar histórico do `event_store`.

---

## Módulo I: Configurações e Administração (T36 a T40)
- **T36 — Configurações Gerais (`ConfiguracoesAdminView.tsx`)**:
  - Parâmetros com limites seguros e explicações didáticas.
- **T37 — Dados e Backups**:
  - `VACUUM INTO` transacional com `PRAGMA wal_checkpoint(TRUNCATE)` gerando safety backups antes de restaurações.
- **T38 — Resiliência Operacional**:
  - A falha de R, Python ou OCR nunca impede o aluno de estudar; sistema opera em fallback resiliente.
- **T39 / T40 — Diagnóstico e Busca Global (`BuscaGlobalModal.tsx`)**:
  - Sanitização de logs contra vazamentos e busca federada (`Ctrl+K`).

---

## Módulo J: Resumos Estratégicos (v3.23)
- **Componentes**: `ResumosEstrategicos.tsx` e `ResumosEstrategicos.css`.
- **Classificação de Relevância**: `ESSENCIAL`, `ALTA RELEVÂNCIA`, `MANUTENÇÃO`, `COMPLEMENTAR`.
- **6 Modalidades**: Resumo Estruturado, Fichas Rápidas, Mapa Mental, Quadros Comparativos, Flashcards e Pegadinhas da Banca.
- **Persistência**: Tabela `strategic_summaries` no SQLite via `/api/v1/summaries`.
