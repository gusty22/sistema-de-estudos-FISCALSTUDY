# Módulos F a J — Inteligência e Retenção

Visão geral dos módulos de avaliação psicométrica, governança de revisões e resumos:

### Módulo F — Revisões Adaptativas (T24 e T25)
- Governança de atraso: atraso não é esquecimento; o sistema limita a carga diária contra bola de neve.
- [[Ciclo em 4 Estágios]]: Recuperação, Correção, Consolidação e Manutenção.
- Retrieval practice: bloqueio estrito de gabarito antes da tentativa mental.
- Integração com R (`digital_twin_engine.R`): R gera métricas e half-life; Spring Boot decide a agenda SQLite.

### Módulo G — Desempenho e Inteligência (T26 a T28)
- Precisão com denominador explícito (`X acertos em Y questões`) e alertas para amostras pequenas (< 15).
- Curva de calibração metaconscienciosa (Matriz de Confiança x Acerto).
- Transparência algorítmica: botão "Ver por que o sistema concluiu isso".

### Módulo H — Ingestão, Extração e Auditoria (T29 a T35)
- Assistente de importação em 5 etapas e [[Isolamento Staging]].
- `AuditCockpit.tsx` com 7 estados visuais independentes de cor e edição manual auditada.

### Módulo I — Configurações e Administração (T36 a T40)
- Backup atômico SQLite via `VACUUM INTO` com safety backup prévio antes de restaurações.
- Fallback resiliente: falhas em R ou Python nunca travam o estudo do usuário.

### Módulo J — Resumos Estratégicos (v3.23)
- Classificação orientada ao edital: `ESSENCIAL`, `ALTA RELEVÂNCIA`, `MANUTENÇÃO`, `COMPLEMENTAR`.
- 6 modalidades: Resumo Estruturado, Fichas Rápidas, Mapas Mentais, Quadros Comparativos, Flashcards e Pegadinhas.
