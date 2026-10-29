# Skills sob demanda
Não carregar todas as descrições detalhadas ou SKILL.md. As pastas preservadas não comprovam uso automático em uma sessão. Descoberta depende do agente/versão; fallback: abrir somente o arquivo indicado.

| Responsabilidade | Skill preservada/selecionada | Ativação |
|---|---|---|
| Coordenar contexto/evidência entre módulos | fiscalstudy-context-and-evidence (própria) | contratos, arquitetura, tarefa transversal |
| Implementar especificação | implement | nova implementação; referência a tdd é opcional e não há tdd local instalado |
| Revisar diff | code-review | escopo entre referência e HEAD; exige subagentes em sua implementação, usar somente com suporte/autorização |
| Simplificar código | code-simplification | refatoração de clareza solicitada |
| Investigar defeito | systematic-debugging | causa ainda desconhecida |
| Rever fronteira sensível | security-audit | foco no diff; workflow completo somente auditoria explicitamente pedida; respeitar sandbox exigido |
| Orquestrar subtarefas | subagent-driven-development | plano suficientemente complexo e delegação autorizada; scripts Bash exigem Bash/Git Bash no Windows |
| Comprovar conclusão | verification-before-completion | antes de afirmar sucesso |
| Testar interface | webapp-testing | navegador/Playwright disponível; não instalar por efeito de descoberta |
| Especificação arquitetural | openspec-propose/explore/apply-change/update-change/sync-specs/archive-change | só a operação necessária; CLI openspec não identificada no PATH local |
| Design visual | taste-skill | trabalho visual, fora desta manutenção |
| Resolver vocabulário/invariantes | domain-modeling | conceitos/ADR/glossário em discussão; não ativa em simples leitura |

Deduplicação por responsabilidade: implement e openspec-apply-change são entradas alternativas para trabalho comum vs. mudança especificada; code-review/security-audit têm profundidades distintas; coordenação não substitui nenhum deles. Nenhuma skill funcional foi apagada nem reinstalada.
A interface Bash(…) de OpenSpec não é ACL portátil: outros agentes usam suas permissões próprias. A ausência de CLI não autoriza inventar resultados.

## Adição mínima revisada
domain-modeling: mattpocock/skills, revisão a496f5513d4a4cf889bc48e189e579f4b0bdf6aa, pasta skills/engineering/domain-modeling.
SKILL.md e dois formatos Markdown lidos; árvore sem scripts executáveis; licença MIT copiada em LICENSE. Nenhuma dependência, acesso à rede ou instalador. Metadata de outro agente foi omitida. A instrução para pedir esclarecimento não supera autorização humana já dada para escolhas rotineiras.
Fonte: [revisão](https://github.com/mattpocock/skills/tree/a496f5513d4a4cf889bc48e189e579f4b0bdf6aa/skills/engineering/domain-modeling).
Teste controlado: conceitos científicos mantidos distintos no protocolo e recuperação de NOT_ESTABLISHED no benchmark. Teste de metadados/arquivos é determinístico; ativação nativa de cada agente externo continua não testada.

## Candidatas avaliadas e não instaladas
| Origem/revisão | Capacidade observada | Decisão |
|---|---|---|
| addyosmani/agent-skills eb07f19f52c2669f2364897aaa293e2aaddd7b1c | context-engineering SKILL.md | sobreposição com protocolo leve; não copiar contexto genérico extenso |
| trailofbits/skills 2be6433b39e009cd2b6fd3be1895f6b1faa5af9a | differential-review e sharp-edges SKILL.md | reutilizar revisão/auditoria existentes; relatórios completos por diff não são necessários aqui |
| trailofbits/skills-curated 6d05be4889017b06fb15069f371afd220daffb62 | catálogo de plugins de terceiros | sem lacuna que justifique pacote adicional |
| semgrep/skills 68177b8830f96cd9d10dacbb14dde2566360503d | code-security SKILL.md | ampla sobreposição com security-audit; sem instalar scanner dependente |
| anthropics/skills ca45fc496a3436251f191354091d557da31c15b5 | catálogo, webapp-testing já existente | preservar versão atual; não reinstalar pacote |
Revisão de licença/scripts completa é obrigatória antes de qualquer instalação futura; candidatas não selecionadas foram rejeitadas por sobreposição na triagem, sem alegar auditoria integral de seus executáveis.
