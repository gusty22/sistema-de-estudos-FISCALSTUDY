# Questões Arquiteturais em Aberto

1. **Implementação e Ecossistema do FSRS (Spaced Repetition)**
   - **Problema**: O projeto de referência para repetição espaçada é o `ts-fsrs`, escrito inteiramente em TypeScript. Nossa arquitetura requer processamento local offline ditado pelo backend Java (Spring Boot) e persistência em SQLite via Event Log.
   - **Questão**: Como o algoritmo FSRS deve ser implementado no FiscalStudy?
     - *Opção A*: Fazer um porte nativo (transcrição de lógica) do algoritmo FSRS (versão 6) direto para o código Java no backend, isolando-o como um serviço de domínio na Arquitetura Hexagonal.
     - *Opção B*: Utilizar o GraalVM dentro do ecossistema Spring Boot para hospedar e executar as funções do TS-FSRS dinamicamente.
     - *Opção C*: Implementá-lo em Python (já que usamos Python na ingestão) e deixá-lo acessível para análises pontuais.
   - **Direcionamento Atual**: Adoção Suspensa (ADOPT_LATER). Não precisamos resolver isso no escopo atual da ingestão (Fase 2). Apenas documentamos para evitar dívida técnica futura.

2. **Detecção e Classificação Autônoma de Imagens**
   - **Problema**: A extração de imagens de questões deve ser granular (apenas imagens importantes de fato). Modelos heurísticos com PyMuPDF podem capturar também cabeçalhos, rodapés ou artefatos inativos.
   - **Questão**: Como garantir o descarte seguro de "falsos positivos" de imagens extraídas sem inflar excessivamente a base de mídia nem sobrecarregar o usuário com uma longa Fila de Revisão Manual?
   - **Direcionamento Atual**: Confiaremos primeiramente em heurísticas baseadas no tamanho (dimensão da bounding box) e proximidade do bloco textual. Modelos complexos de visão ou classificação semântica ficarão restritos a uma eventual futura incorporação do Docling.
