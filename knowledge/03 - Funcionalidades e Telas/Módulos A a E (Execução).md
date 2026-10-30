# Módulos A a E — Execução dos Estudos

Visão geral dos módulos voltados para rotina, organização e resolução prática:

### Módulo A — Configuração Inicial e Objetivos (T01 a T06)
- Cadastro de objetivos (Concursos Fiscais, vestibulares ou certificações).
- Árvore curricular com importação de JSON estruturado.
- Diagnóstico inicial `SELF_REPORTED` (sem inventar falsa precisão).

### Módulo B — Início e Planejamento (T07 a T12)
- **Dashboard**: Hero card com a atividade prioritária do momento e transparência pedagógica ("Por que estudar isso agora?").
- Ajustes adaptativos imediatos: "Tenho apenas 20 min", "Quero trocar", "Sem material".
- Projeção semanal anti-frágil: tarefas não feitas voltam para o recálculo do Gêmeo Digital sem efeito bola de neve.

### Módulo C — Execução dos Estudos (T13 a T15)
- Tela de imersão de foco com cronômetro em tempo real, roteiro progressivo e controle de interrupções padronizadas.
- Encerramento automático com tempo líquido estudado e persistência idempotente.

### Módulo D — Biblioteca e Materiais (T16 e T17)
- Referências a materiais locais (PDF, Livro, Lei Seca) via UUID e SHA-256 sem duplicar arquivos pesados no SQLite.
- Vinculação de tópicos a intervalos de páginas com conferência humana obrigatória.

### Módulo E — Banco de Questões e Avaliações (T18 a T23)
- Filtros multifacetados por banca, ano e disciplina. Gabarito oculto antes da resposta.
- Registro obrigatório de confiança declarada (1 a 5) **antes** da revelação do gabarito.
- Cadernos e simulados gerenciados como referências a IDs na tabela `study_notebooks` (sem duplicação física).
