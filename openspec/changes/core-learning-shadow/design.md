# Context

Base `6489a1f`, contratos R existentes e processo Java limitado disponíveis. CLI anterior não autentica autoridade importada; bridge original tem efeitos sobre Robin Hood.

# Decisions

Serviço separado; snapshot transacional de repositórios e consultas de leitura; HMAC efêmero pelo ambiente do filho; entrada/saída limitadas; diretório privado; identidade por conteúdo estável. Reusar FSRS preview com cutoff explícito. Nenhum atributo R é prova de origem. Origem pessoal não estabelecida permanece bloqueada. Inventário mínimo: diagnóstico de questão confirmada e revisão de item FSRS devido.

# Risks

Não protege contra executável/conta local comprometidos. Estado curricular atual não reconstrói versões históricas. Timebox é configuração, não duração prevista. Windows precisa execução de validação própria; runner não homologa instalação pessoal.

# Validation

SQLite temporário sintético, Java → R real, comparação byte a byte do estado operacional, autenticação negativa, cutoff/escopo/versões, resposta inválida/timeout, replay e consumo no avaliador existente. Suítes pertinentes e comparação locale C com base.
