# Isolamento de Staging

## 1. O Problema da Ingestão de Provas
Provas de concursos fiscais em PDF possuem formatações complexas (tabelas de gabaritos multi-colunares, textos de apoio longos, questões anuladas e diagramas).
Publicar extrações diretamente no banco de produção pode corromper métricas, inflar o acervo com itens duplicados ou quebrar cadernos de estudo.

---

## 2. A Arquitetura em Duas Áreas

```text
PDFs de Provas / Gabaritos
          │
          ▼
    [ UniversalExtractor (Python) ]
          │
          ▼
   db/staging.db (Área Provisória)
          │
   [ Cockpit de Auditoria / Revisão Humana ]
          │
          ▼ (Publicação Aprovada)
   db/fiscalstudy.db (Base Oficial de Estudos)
```

- **`db/staging.db`**: Área de preparação e testes. Permite reprocessamento de algoritmos de extração e correção manual no `AuditCockpit.tsx` sem afetar os estudantes.
- **`db/fiscalstudy.db`**: Acervo limpo e oficial (13.241+ questões ativas). Somente itens conferidos e estruturalmente válidos são promovidos para esta base.
- **Suspensão Histórica**: Se uma questão de produção precisar ser suspensa, ela é retirada dos novos cadernos, mas suas respostas históricas permanecem íntegras no `event_store`.
