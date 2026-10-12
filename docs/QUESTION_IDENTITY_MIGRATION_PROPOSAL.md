# Proposta de Arquitetura e Migração: Identidade Única das Questões

> **Data:** 2026-10-12  
> **Status:** Proposta Formal / Documentação de Compatibilidade (Não Destrutiva)  
> **Escopo:** Modelo de Identificação Global e Prevenção de Colisões na Ingestão do FiscalStudy

---

## 1. Contexto e Diagnóstico do Problema

Na modelagem inicial (Fase 1), a tabela `questions` utilizava como identificador primário a numeração ordinal da questão na prova (`id = "1"`, `"2"`, etc.):

```sql
CREATE TABLE questions (
    id TEXT PRIMARY KEY,
    enunciado TEXT,
    options_json TEXT,
    correct_option TEXT,
    banca TEXT,
    ano INTEGER,
    orgao TEXT,
    cargo TEXT,
    disciplina TEXT,
    assunto TEXT,
    dificuldade TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Vulnerabilidades Identificadas:
1. **Colisão entre Provas Diferentes:** Uma nova prova (ex: *Auditor Fiscal* ou *SEFAZ-MG*) contendo questões de 1 a 40 colidiria diretamente com as questões existentes de *Técnico Fiscal* (também numeradas de 1 a 40).
2. **Sobrescrita Destrutiva Silenciosa:** O comando `INSERT ... ON CONFLICT(id) DO UPDATE` apagava/substituía os dados da questão anterior sem emitir aviso ou erro.
3. **Fragilidade da Rastreabilidade:** Referências no `event_store` (`aggregate_id = "1"`) tornam-se ambíguas caso o ID não qualifique de forma inequívoca a prova fonte.

---

## 2. Padrão de Identificação Canônica Global

Proposta de formato canônico determinístico para novas questões ingeridas:

```text
{banca_slug}-{ano}-{cargo_slug}-q{numero_ordinal}
```

### Exemplos:
- Prova Técnico Fiscal Araguari 2023, Questão 14:
  `ibgp-2023-tecnico-fiscal-q14`
- Prova Auditor Fiscal Araguari 2023, Questão 1:
  `ibgp-2023-auditor-fiscal-q1`
- Prova Auditor SEFAZ-MG 2024 (FGV), Questão 5:
  `fgv-2024-auditor-sefaz-mg-q5`

### Propriedades do Padrão:
1. **Unicidade Global:** Diferencia banca, ano, órgão, cargo e numeração original.
2. **Preservação da Numeração Original:** O sufixo `-q{numero}` mantém visível a posição física na prova original.
3. **Determinismo e Idempotência:** Repetir a ingestão do mesmo documento gera o mesmo ID, permitindo reprocessamento idempotente sem duplicação de registros.
4. **Humanamente Legível:** Dispensa chaves opacas quando a procedência documental é conhecida.

---

## 3. Estratégia de Retrocompatibilidade e Não-Destrutividade

De acordo com as regras de autonomia, **nenhuma migração destrutiva ou alteração irreversível dos identificadores históricos existentes é executada sem autorização expressa**.

### Estado Atual Preservado:
- As 40 questões existentes de Técnico Fiscal mantêm seus IDs legados (`"1"` a `"40"`).
- Os eventos persistidos na `event_store` continuam apontando validamente para esses IDs.

### Proteção Ativa em Tempo de Ingestão (`IngestionController`):
1. **Verificação de Procedência em Colisões:**
   - Antes de inserir ou atualizar, o sistema verifica se o `id` já existe.
   - Se já existe: compara a procedência (`banca`, `ano`, `cargo`).
     - **Mesma Procedência:** Trata como reimportação legítima e idempotente.
     - **Procedência Diferente:** Detecta colisão de provas! Bloqueia a sobrescrita destrutiva e qualifica automaticamente o ID para o padrão canônico (`{banca}-{ano}-{cargo}-q{num}`).
2. **Aceitação de IDs Qualificados:** O endpoint de ingestão suporta tanto IDs simples (qualificando-os quando necessário) quanto IDs canônicos completos vindos dos novos extratores.

---

## 4. Plano Futuro de Migração Estrutural (Para Aprovação Posterior do Usuário)

Caso o usuário opte por migrar os IDs legados (`"1"` a `"40"`) para IDs canônicos (`ibgp-2023-tecnico-fiscal-q1`..`q40`), o procedimento seguro será:

### Script de Migração Transacional:
```sql
BEGIN TRANSACTION;

-- 1. Atualizar aggregate_id na event_store para manter integridade referencial
UPDATE event_store 
SET aggregate_id = 'ibgp-2023-tecnico-fiscal-q' || aggregate_id 
WHERE aggregate_type = 'QUESTION' 
  AND aggregate_id IN ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
                       '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
                       '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
                       '31', '32', '33', '34', '35', '36', '37', '38', '39', '40');

-- 2. Atualizar chaves primárias na tabela questions
UPDATE questions 
SET id = 'ibgp-2023-tecnico-fiscal-q' || id 
WHERE id IN ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
             '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
             '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
             '31', '32', '33', '34', '35', '36', '37', '38', '39', '40');

COMMIT;
```

### Estratégia de Rollback:
- Backup completo de `fiscalstudy.db` realizado antes da execução.
- Script reverso de rollback testado em ambiente isolado antes de qualquer aplicação.
