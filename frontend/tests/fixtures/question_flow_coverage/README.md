# SYNTHETIC_ONLY — fluxos reais, captura padrão desligada

Não executar contra banco pessoal. Não há chave operacional nem coleta pessoal. A fixture recusa saída fora de RUNNER_TEMP e banco não vazio; constrói concursos/questões fictícios somente em SQLite temporário com source-kind SYNTHETIC_FIXTURE.

Requer Java17+/Maven, Node24/npm, R4.5.1+/jsonlite/digest e Playwright1.56.1/Chromium (dependência de teste já usada no repositório). Na raiz:

```sh
mvn -f backend/pom.xml package -DskipTests
cd frontend
npm ci --ignore-scripts
npm test
node --test --test-isolation=none tests/prospective-capture-gate.test.mjs
npm run build
cd ..
# RUNNER_TEMP aponta para diretório temporário descartável; escolher saída NOVA.
# FISCALSTUDY_PLAYWRIGHT_MODULE aponta para instalação Playwright de teste.
python3 frontend/tests/fixtures/question_flow_coverage/run.py --output "$RUNNER_TEMP/NEW-question-flow-coverage"
```

A CI configura essas dependências. Em Linux com Chromium do sistema, pode-se definir FISCALSTUDY_CHROMIUM_PATH; sem ele usa Chromium instalado pelo Playwright. O harness completo é Linux, com processos descartáveis. Windows executa Java/assinatura/R/NTFS, testes unitários frontend e build nativos na CI; não alegar browser Windows a partir do browser Linux.

Cada modo inicia backend e frontend próprios; padrão sem flags gera zero compromissos. Somente a fase enabled da fixture configura as três flags. Banco/modal e QuestionViewer usam rotas reais; active.html é entrada **só de teste**, excluída do build de produção e com guarda de conteúdo sintético, montando o pai real sem onOpenQuestions para testar o fallback. O App atual passa esse callback e encaminha ao viewer: são evidências diferentes, explicitamente identificadas.

Cobertura: preparação perdida após commit, retry do mesmo UUID, fechamento/reabertura/reload, clique concorrente, troca rápida, intento novo explícito preservando histórico, ajuda desconhecida/declarada, resposta sem previsão, tentativa de backfill 409 com captura habilitada, pendência, cronologia estrita e tipos distintos dos exportadores. R lê o snapshot Java e compara baselines no prefixo; replay byte a byte do mesmo arquivo. Logs/exports/prints são exclusivamente sintéticos e não perfil pessoal. Processos encerrados ao final; não altera FSRS, calendário ou SQLite operacional.
