# Psicometria e Modelo R

## 1. O Papel do Analytics Engine
O módulo `analytics-engine/R` funciona como um consultor analítico assíncrono para o FiscalStudy:
- Não roda como serviço de blocking na API principal.
- É alimentado via snapshots exportados de eventos.
- Processa curvas de retenção, estimativas de meia-vida (half-life) e calibração de Brier score.

---

## 2. Modelagem Psicométrica
O modelo distingue:
1. **Dificuldade Intrínseca da Questão**: Parâmetros históricos da banca (FGV, Cebraspe, FCC).
2. **Habilidade Latente do Estudante**: Domínio real demonstrado em questões inéditas.
3. **Poder Discriminativo**: Questões que separam quem realmente sabe de quem apenas memorizou a alternativa.

---

## 3. Regra Fundamental de Arquitetura
> **O motor em R NUNCA edita diretamente o banco SQLite ou a fila de estudos.**
> O script em R devolve parâmetros e métricas estatísticas; o backend Spring Boot toma a decisão pedagógica e persiste na agenda SQLite.
