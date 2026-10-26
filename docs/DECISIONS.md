# Decisões de implementação

## D01 — Cópia editável e preservação
A origem fica fora das raízes de escrita. Implementação em <implementation-checkout>; snapshots SQLite consistentes em db/recovery; auditoria original preservada. Referências e grafo via junction de leitura; nunca editar. Não há autorização para commit ou push.

## D02 — Memória e pedagogia separadas
FSRS versão de referência explicitada estima memória por item. A probabilidade pré-resposta deve ser registrada antes de observar o resultado. Erro inesperado justifica investigação, não diagnóstico automático. Curvas por matéria são agregados com incerteza, não medição exata de memória sináptica.

## D03 — Perfil pessoal observável
Preferências declaradas e padrões empíricos contextualizam intervenções. Não usar tipologias fixas ou inferir personalidade cognitiva a partir de poucos acertos, velocidade ou cursor. Single-user local permanece como escopo.

## D04 — Uma autoridade de schema
A equipe persistence controla migrações SQLite e contratos de tabela. Demais agentes solicitam alterações e não criam DDLs concorrentes.

## D05 — Dependências existentes e ambiente explícito
R jsonlite2.0.0 e digest já existem na biblioteca local; requireNamespace de ambos foi validado com .libPaths explícito. Não foram instalados pacotes. O launcher py não representa disponibilidade: Python311 é pasta residual; Python313 possui executável, imports em verificação.

## D06 — Git preservado na cópia
Branch codex/fiscalstudy-integration-20261023 a partir de c26ee20352fc1b6ace0c58be4f24a41a1092fbf0. Referências/grafo read-only não são removidos. Auditoria e código base foram preservados, nenhum commit/push foi criado.

### Transparência da estimativa por tópico
O painel expõe desempenho observado, sem aplicar uma curva de esquecimento paralela. Estimativas de memória são por item no núcleo FSRS6; agregações por disciplina não representam curva individual calibrada. Concurso explícito sem catálogo retorna vazio, sem fallback global.

### Autoridade de inicialização SQLite
Desabilitada a execução automática schema.sql pelo Spring tanto na configuração principal quanto na de testes. SchemaMigration mantém baseline e migrações versionadas;JdbcTemplate depende desse bean. A verificação em banco vazio demonstra inicialização sem backup artificial de um schema criado previamente por outro inicializador. Não há alteração destrutiva de dados;reversão é configuração anterior, com snapshots preservados.

### Reagendamento após tentativa efetiva
Uma nova tentativa elegível substitui o vencimento do item FSRS,pois constitui nova evidência de recuperação. A regra de preservar urgência de tarefas ainda não executadas não deve congelar o vencimento de um item já praticado. Revisões manuais mantêm identidade separada e sinais pedagógicos anteriores continuam no histórico.

### Data local e instante de memória
O estado FSRS persiste instantes UTC. A data da fila resulta da conversão para fiscalstudy.zone validado na inicialização. Configurar FISCALSTUDY_ZONE não reinterpreta nem reescreve automaticamente datas já persistidas.


### Evidência transportada não equivale a autoridade de decisão (26/10/2026)

A inspeção revelou que o DTO legado descartava flags can_apply/is_validated enquanto consumidores podiam aplicar pesos. Em vez de confiar em campos sem critério de homologação, todo esse contrato permanece observacional. Bloqueamos serviço, leitura de arquivo, motor direto e sucesso HTTP enganoso. O ciclo por configuração continua coberto por regressões; payloads analíticos manuais legados deixam de alterar alocação. A habilitação futura exige revisão do contrato, não uma flag arbitrária. Separadamente, o Bridge reutiliza exportPackageToDirectory para CSV/manifesto coerentes; a validação de transporte não afirma validade científica.
