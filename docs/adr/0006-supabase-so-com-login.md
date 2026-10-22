# ADR 0006 — Supabase só com login (editorial e papéis); leitura pública nunca bate no banco

**Estado:** proposta (F0, 22/10/2026) · **Vale a partir da:** F4 (quando houver dois papéis editoriais) ou antes, se o RootifyONE migrar as coleções

## Contexto

A plataforma já tem o projeto Supabase `solverone-app` (São Paulo), o contrato v1 (`PLATAFORMA-DADOS.md`: tabelas por app com
prefixo e RLS, `sol_apps`, registro de acessos, LGPD por app) e o código `eleicoes-2026` cadastrado (prefixo `eleicoes_`). Plano
Free: 500 MB, 5 GB de egress, pausa após 7 dias sem uso (o pulso do RootifyONE evita). Aviso do Supabase (e-mail de 19/10): a
partir de 30/10/2026 objeto novo em `public` só entra na Data API com GRANT explícito (fila de ideias, item 9).

## Decisão

- O banco entra **só** para o que exige identidade e papéis: tabelas editoriais do RootifyONE (`<prefixo>_promessas`,
  `<prefixo>_checagens`, `<prefixo>_rubricas`, `<prefixo>_revisoes` com autor, revisor, estado, versão, trilha), RLS por papel
  (`apurador` escreve rascunho; `revisor` aprova, nunca o próprio), e a **contestação** (T44: protocolo, triagem, resposta), que
  precisa de fila e dono.
- **Leitura pública nunca consulta o Supabase.** Tudo o que o público vê vem de arquivo publicado (`solverone-dados` e
  `radar-one-dados`). Publicar = o RootifyONE (ou uma Edge Function com `service_role` só no servidor) grava o JSON no repositório.
- Prefixo das tabelas: muda de `eleicoes_` para o prefixo do nome novo (`sol_apps` ganha o código novo; o antigo fica `ativo = false`).
- Todo SQL: idempotente, `SECURITY DEFINER` + `search_path = ''`, GRANTs explícitos (regra de 30/10), conferência no fim; nenhum SQL
  roda sem revisão e sem "pode rodar" do dono (C10 do contrato).

## Alternativas

| | A · Tudo em arquivos no Git (sem banco) | **B · Supabase só com login, saída sempre em arquivo (escolhida)** | C · Supabase também para leitura pública (API direta) |
|---|---|---|---|
| Prós | zero infraestrutura; versão e trilha pelo Git | papéis reais, RLS, contestação com fila; custo dentro do Free porque o público não consulta | consulta dinâmica e filtros |
| Contras | sem papéis nem "autor não aprova"; contestação sem fila | mais uma peça (SQL, RLS, Edge Function) e a regra de GRANT explícito a partir de 30/10 | egress de 5 GB e pausa de 7 dias viram risco de indisponibilidade pública; chave publishable no site; contra o parecer |

## Consequências

- Até a F4 o banco não é tocado por este produto (as coleções do RootifyONE vivem no cofre local dele e publicam arquivo).
- O registro de acessos (C9) e `sol_registrar_uso` entram quando houver login no produto (Salvos na nuvem é opcional e futuro:
  "salvar e acompanhar são locais por padrão", UX44).

## Condição de mudar

Se aparecer necessidade de consulta pública dinâmica (busca por pessoa em milhares de mandatos), a resposta é índice estático
pré-calculado pelo robô (arquivos por letra/UF), não abrir o banco ao público.

## Como se prova

Teste da nuvem só num Supabase local com o SQL do app (diretriz: nunca contas de teste na produção); RLS: apurador não aprova o
próprio item; site funciona com o banco pausado (lê arquivos).
