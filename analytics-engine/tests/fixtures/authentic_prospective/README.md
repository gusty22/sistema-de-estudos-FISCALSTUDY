# Integração sintética Java → exportação assinada → R

Nenhum dado pessoal. Não executar contra banco operacional. Os testes Java criam SQLite e chave privada efêmera em `@TempDir`; somente exportação sintética e chave pública são emitidas em `backend/target` (ignorado pelo Git). Não publicar uma exportação operacional nesse diretório ou como fixture.

Na raiz, com Java 17+/Maven e R 4.5.1+/jsonlite/digest/OpenSSL disponíveis:

```sh
mvn -f backend/pom.xml -Dtest=ProspectivePredictionIntegrationTest,ProspectiveExportSecurityTest test
cd analytics-engine
Rscript tests/test_prospective_ledger.R
Rscript tests/test_attested_prospective.R
python tests/fixtures/authentic_prospective/replay.py
python lab/personal_pilot.py --input ../backend/target/prospective-attested-fixture.json --output /tmp/NEW-signed-synthetic-run --synthetic-test --trusted-public-key ../backend/target/prospective-fixture-public.pem --trusted-source-id SYNTHETIC-INTEGRATION-INSTALLATION
Rscript lab/attested_prospective_evaluation.R ../backend/target/prospective-attested-fixture.json /tmp/NEW-signed-replay.json ../backend/target/prospective-fixture-public.pem SYNTHETIC-INTEGRATION-INSTALLATION synthetic-test
cmp /tmp/NEW-signed-synthetic-run/metrics.json /tmp/NEW-signed-replay.json
```

Use caminhos de saída novos. PowerShell: substituir `/tmp` por diretório temporário e `cmp` pela comparação de SHA-256 com `Get-FileHash`. A nova geração Java usa relógio/IDs/chave efêmeros; **reprodução byte a byte refere-se ao replay do mesmo snapshot assinado**, não à identidade entre experimentos gerados novamente. O relatório R também é reproduzível em plataformas/versões compatíveis, preservando bytes do arquivo e chave.

O teste usa uma questão disponível no repositório Java real; 24 respostas elegíveis (mesmo item/sessão, deliberadamente dependentes), uma com ajuda, uma sem declaração, uma contraditória, uma pendente e uma resposta sem previsão. Há 28 forecasts, 28 respostas, 24 scores, 4 exclusões e 1 tentativa sem previsão. As primeiras 20 respostas certas e quatro erradas permitem verificar diferença aritmética da referência recente após o vigésimo prefixo; não demonstram superioridade de modelo.

R testa assinatura inválida/removida/chave errada/identidade de instalação errada, relabeling, checksum recalculado, duplicatas, divergência de estudante, matemática/prefixo futuro, cronologia igual ou invertida, ajuda desconhecida/contraditória, exposição conhecida, ausência de previsão, captura legada e replay determinista. O modo operacional rejeita a fixture mesmo com assinatura válida.

Os seis alvos novos continuam `NOT_ESTABLISHED`, perfil `NOT_CREATED`, `can_apply=false`, `can_schedule=false`. Ativação pessoal é procedimento separado, requer autorização futura explícita e custódia conferida na instalação real.

A portabilidade local foi exercitada entre R 4.6.1 e R 4.5.0 (checagem extra de compatibilidade; a versão mínima suportada continua 4.5.1) em Linux, inclusive caminhos com espaços, UTF-8/LF e recusa de sobrescrita. Windows nativo/ACLs e a instalação pessoal permanecem não homologados nesta operação.
