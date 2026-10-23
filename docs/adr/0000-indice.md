# ADRs da plataforma política — índice

Registros de decisão de arquitetura (ADR) escritos na F0 (22/10/2026). Cada um traz duas alternativas reais, prós, contras e a
condição em que a decisão deve ser revista. As seis decisões do dono (parecer, seção 6) e os dois requisitos adicionais de 19/10
não se discutem de novo: aqui eles viram regra de código.

| # | Decisão | Estado |
|---|---|---|
| 0001 | Estrutura em módulos ES e dados fora do HTML | proposta (F0) → vale na F1 |
| 0002 | Repositório público de dados: snapshot = commit, `manifesto.json` | proposta |
| 0003 | Robôs no GitHub Actions: um job por família, cadência por família configurada no RootifyONE, idempotentes | proposta |
| 0004 | Registro semântico de indicadores (T18) e motor de compatibilidade (T20) em JS, revalidados em Python | proposta |
| 0005 | RootifyONE como editorial, conteúdo e interruptores | proposta |
| 0006 | Supabase só com login (editorial e papéis); leitura pública nunca bate no banco | proposta |
| 0007 | Rótulos públicos e política de checagens (decisão 5 e mitigação) | decidida pelo dono; aqui a mitigação |
| 0008 | Migração versionada e reversível dos dados locais da pessoa (T06) | proposta |
| 0009 | Redirecionamento do endereço antigo e aliases de todas as âncoras (T08) | proposta; emenda de 23/10: renomear o repositório em 26/10 |
| 0010 | Ciclo eleitoral: manual ou automático, controlado pelo RootifyONE; preparado para 2028 | proposta (requisitos 1 e 2 do dono) |

Formato de cada ADR: Contexto · Decisão · Alternativas (A, B, …) com prós e contras · Consequências · Condição de mudar · Como se prova.
