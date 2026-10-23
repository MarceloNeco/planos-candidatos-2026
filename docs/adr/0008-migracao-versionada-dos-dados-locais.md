# ADR 0008 — Migração versionada e reversível dos dados locais da pessoa (T06)

**Estado:** proposta (F0, 22/10/2026) · **Vale a partir da:** F1 (PR "migração local")

## Contexto

O app guarda tudo no aparelho, sem servidor. Chaves atuais do `localStorage` (prefixo `planos2026:` porque a origem é dividida
com os outros apps): `planos2026:prefs` (preferências, idioma, tela ciente, AssistONE visto), `planos2026:voz` (motor, voz,
velocidade; as chaves de API já estão no cofre comum), `planos2026:congresso` (prioridades, posições nos 9 eixos, favoritos,
comparação), `planos2026:colinha` (cola por turno), `planos2026:tse` (cópia do TSE), `planos2026:modo` (última parte usada),
`planos2026:novidade-colinha`; mais `dgo:eleicoes-2026:central:*` (cópia dos arquivos do RootifyONE) e o cofre (`cofre.js`,
por origem). Fato decisivo: **o endereço novo é a mesma origem** (`solverone.com.br/radar-one/` × `/planos-candidatos-2026/`), e o
`localStorage` é por origem, não por pasta. Logo os dados **já estão visíveis** para o site novo; não há perda por troca de
endereço (o cenário de "Guardar meus dados / Trazer os dados" da diretriz só vale quando a origem muda).

## Decisão

1. **Prefixo novo + versão de esquema.** O site novo guarda em `radar-one:<chave>` com um registro `radar-one:esquema = {versao: 1,
   migradoDe: 'planos2026', em: ISO}`. Na primeira abertura, `modulos/migracao.js` lê cada chave `planos2026:*`, converte para a
   forma nova (campo a campo, com `migracoes[1]`), grava nas chaves novas e **não apaga as antigas**.
2. **Reversível:** enquanto `planos2026:*` existir, "Voltar para a versão anterior" (nas Configurações → Opções deste aparelho)
   apaga só as chaves novas; o site antigo (arquivo e redirecionamento, ADR 0009) continua lendo as antigas.
3. **Duplo gravar por uma versão:** na F1 o módulo Eleições preservado continua a escrever em `planos2026:*` (não se mexe no código
   dele) **e** o shell copia para as chaves novas ao fechar/alternar tela; na F2, quando o módulo for adaptado, grava-se só nas
   novas e as antigas ficam congeladas por 90 dias, depois oferecidas para apagar ("Apagar cópia antiga", com a cópia protegida
   oferecida antes, regra da diretriz).
4. `dgo:<app>:central:*` muda de id (`eleicoes-2026` → `radar-one`) por `recursos.js` sozinho (ele usa `data-app`); nada a migrar,
   só reler. O cofre não muda (mesma origem).
5. Cada migração tem teste com valores de mentira (semeia `planos2026:*`, abre, confere as novas; desfaz; confere as antigas).

## Alternativas

| | A · Continuar usando `planos2026:*` para sempre | **B · Prefixo novo, migração versionada e reversível (escolhida)** | C · Exportar/importar arquivo (como na troca de origem) |
|---|---|---|---|
| Prós | zero migração; zero risco | nome coerente com o produto; versão de esquema para evoluções (painéis salvos, T41); reversível | serve para qualquer origem |
| Contras | "2026" no nome de um produto permanente; sem versão de esquema; colisão de prefixo se o repositório antigo continuar vivo com código diferente | duplo gravar durante a F1; um módulo a mais (pequeno, ~120 linhas) | pede ação da pessoa; perde quem não fizer |

## Consequências

- Painéis salvos (Salvos, T41) nascem já versionados (`radar-one:paineis`, `esquema.versao`), com `draft`/`applied` e snapshot fixado.
- O teste de regressão das 913 verificações continua semeando `planos2026:*` (o módulo Eleições preservado lê de lá).

## Condição de mudar

Se o endereço virar subdomínio (origem nova), a migração passa a ser o fluxo da diretriz (cópia protegida + importar); este ADR
não cobre esse caso de propósito.

## Como se prova

`teste/migracao.js`: semear cada chave antiga com valores de mentira → abrir → chaves novas iguais; "Voltar" → só as antigas;
abrir duas vezes não duplica nem reconverte.
