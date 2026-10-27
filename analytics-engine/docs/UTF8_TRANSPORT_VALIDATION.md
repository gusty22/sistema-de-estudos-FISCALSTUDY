# Transporte UTF-8 — reprodução e correção

PR #29, fix/analytics-utf8-transport, baseado no PR #27. Nenhuma alteração de banco, de eventos, de FSRS ou de parâmetros estatísticos. Não fazer merge automático.

## Defeito reproduzido

A CI anterior retornava sucesso do pipeline R sob locale C, mas registrava conversão inválida de caracteres. A regressão do commit 61def9256a9b7cec6618ead74370b79b2c6353a2 demonstrou o problema real:

[CI 40435204718](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40435204718): dois erros, incluindo aviso de conversão e falha ao ler o CSV com "more columns than column names". Um exit code zero não garantia transporte correto.

## Causas e implementação final

1. source(file, encoding="UTF-8") converte o arquivo para a codificação nativa. Sob C, isso podia truncar módulos e deixar funções ausentes. O bootstrap source_utf8 agora valida e analisa texto UTF-8 diretamente, avaliando módulos confiáveis nos mesmos escopos globais anteriores.
2. CSV de entrada é validado por linhas, com conexão de texto e encoding declarado, sem conversão para o locale nativo. BOM opcional é tratado na leitura; os bytes do arquivo original permanecem intactos para o checksum.
3. write.table formata strings marcadas passando por translateChar nativo. Sob C, mesmo fileEncoding="UTF-8" podia transformar acentos em escapes literais. A exportação usa uma cópia local de bytes UTF-8 validados, sem marca de conversão nativa, e conexão binária. Mantém o escritor CSV padrão para aspas, vírgulas, valores ausentes e números.
4. UTF-8 inválido falha explicitamente. Não há conversão heurística de Latin-1, correção automática de mojibake, mudança global de locale ou regravação de fontes.
5. Contexto de erros dos subprocessos é preservado nos testes. Setup do R é limitado a cinco minutos e instalação de dependências a dez, como limites do projeto para a CI.

A implementação do Base R foi consultada em wch/r-source, branch R-4-5-branch, arquivos base/R/source.R, utils/R/readtable.R e utils/src/io.c, para identificar conversão de locale e codificação do CSV. Nenhum código desses arquivos foi incorporado.

## Evidência final

[CI 40439080064](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/actions/runs/40439080064), commit 3a8d0745ee4d310e9a90fe6ea6da5194d8b7981b: SUCESSO.

- 23 testes do laboratório sem falhas.
- 614 verificações R, zero falhas.
- Pipeline real em subprocesso locale C: sem aviso de conversão; texto completo de limitações preservado.
- Disciplina e assunto com acentos preservados até o perfil JSON.
- UTF-8, BOM opcional, checksum original, limite de linhas, aspas, vírgulas e quebra de linha testados.
- Entrada com byte UTF-8 inválido rejeitada explicitamente.
- Experimento de cinco seeds e replay de 50 arquivos passaram.

As tentativas corretivas anteriores ficaram registradas na branch e falharam nos gates; não foram contadas como homologadas. A tentativa com source(..., encoding=...) revelou perda de funções em C; a tentativa seguinte revelou escapes textuais ainda incorretos. A solução final passou nas verificações independentes.

## Compatibilidade, limites e recuperação

Esquema de colunas e contrato JSON mantidos. UTF-8 válido continua aceito; entrada inválida agora gera erro em vez de análise parcial. O checksum continua cobrindo os bytes originais. Só a representação em memória trata o BOM.

Validação executada em Linux/R 4.5.1, incluindo locale C. Revalidação local Windows não foi executada depois da indisponibilidade do ambiente. Não declarar homologação Windows, visual ou Spring/SQLite por esses testes.

Não houve migração de dados. Recuperação por reversão do código, mantendo fontes originais inalteradas; reverter também restaura o defeito conhecido. Conflitos esperados com #30 são nos acréscimos dos testes e no módulo de exportação: preservar a serialização UTF-8 junto dos novos denominadores/metadados de confiança. O candidato temporário deve validar a composição antes de integração humana.
