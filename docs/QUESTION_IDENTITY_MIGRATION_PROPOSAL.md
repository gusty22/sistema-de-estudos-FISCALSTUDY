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

## 2. Padrão de Identificação Canônica Global (Refinado)

Formato canônico determinístico e hierárquico para identificação unívoca de questões:

```text
{banca_slug}-{ano}-{orgao_slug}-{cargo_slug}[-{qualificador_caderno_ou_turno}]-q{numero_ordinal}
```

### Justificativa da Refinação Estrutural:
1. **Diferenciação de Órgãos:** Provas da mesma banca e ano para cargos com nomes idênticos em municípios ou entes federativos diferentes (ex.: FCC 2023 Auditor Fiscal em SEFAZ vs Prefeitura) entram em colisão se o órgão for omitido.
2. **Diferenciação de Cadernos e Cores:** Concursos frequentemente utilizam cadernos com permutações de ordem de questões (Caderno Tipo 1 - Branca, Tipo 2 - Amarela, etc.) ou cadernos de conteúdos distintos.
3. **Turnos e Fases:** Concursos de Auditor frequentemente dividem a prova em Turno Manhã (P1 - Conhecimentos Gerais) e Turno Tarde (P2 - Conhecimentos Específicos), ambos numerados de 1 a N.
4. **Reaplicações:** Provas anuladas e reaplicadas sob o mesmo edital e ano exigem qualificador de aplicação (`reaplicacao-2023`).

### Exemplos do Padrão Refinado:
- Prova Técnico Fiscal Araguari 2023, Questão 14:
  `ibgp-2023-araguari-tecnico-fiscal-q14`
- Prova Auditor Fiscal Araguari 2023 (Tarde, Cargo 503), Questão 1:
  `ibgp-2023-araguari-auditor-fiscal-503-q1`
- Prova Auditor SEFAZ-MG 2024 (FGV, Caderno 1 - Manhã), Questão 5:
  `fgv-2024-sefaz-mg-auditor-fiscal-p1-cad1-q5`

### Propriedades do Padrão:
1. **Unicidade Global Inequívoca:** Diferencia banca, ano, órgão, cargo, caderno/turno e numeração ordinal.
2. **Preservação da Numeração Original:** O sufixo `-q{numero}` mantém visível e pesquisável a posição física no caderno fonte.
3. **Determinismo e Idempotência:** A reingestão do mesmo documento gera rigorosamente o mesmo identificador.
4. **Legibilidade e Rastreabilidade Direta:** Identifica a procedência de um registro sem depender de joins de metadados.

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

---

## 5. Resultados da Migração Experimental em Ambiente Isolado (2026-10-12)

A migração foi executada e validada em cópia isolada (`target/experimental_migration_fiscalstudy.db`) gerada a partir do banco operacional.

### Resultados Obtidos:
1. **Preservação de Identidade Original e Histórico:**
   - Adicionadas colunas `numero_original` (INTEGER) e `legacy_id` (TEXT) à tabela `questions`.
   - As 40 questões do Técnico Fiscal foram transacionadas para `ibgp-2023-tecnico-fiscal-q1` a `q40`.
   - A questão legada `q123` e seu histórico foram preservados integralmente.
2. **Integridade Referencial Comprovada:**
   - Eventos históricos vinculados à tabela `event_store` com `aggregate_type = 'QUESTION'` mantiveram correlação exata com `questions.id`.
   - Zero eventos órfãos detectados (`orphaned = 0`).
3. **Ausência de Duplicações:**
   - Verificação via `GROUP BY id HAVING COUNT(*) > 1` confirmou 0 colisões ou duplicatas.
4. **Capacidade de Rollback Comprovada:**
   - Script reverso executado restaurou perfeitamente os 41 registros aos identificadores originais (`1..40`, `q123`).
5. **Inviolabilidade do Banco Operacional:**
   - O banco de produção `db/fiscalstudy.db` permaneceu intocado: hash SHA256 `E61199F5C833D67A907FB99CBC4F3D209862F465D98B4675670C1160BF3F8948` verificado identicamente antes e depois da execução.

