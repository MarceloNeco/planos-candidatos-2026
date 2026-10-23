# ADR 0009 — Redirecionamento do endereço antigo e aliases de todas as âncoras (T08)

**Estado:** proposta (F0, 22/10/2026), **emendada em 23/10/2026** · **Vale a partir da:** 26/10/2026 (renomeação) e F1 (aliases)

## Emenda de 23/10/2026 (decisão do dono)

Em vez de criar o `radar-one` como cópia e deixar o `planos-candidatos-2026` virar arquivo no fim da F1, o dono decidiu
**renomear** `planos-candidatos-2026` para `radar-one` em **26/10/2026, depois do 2º turno** (nada muda antes da votação de 25/10).
Motivos: um repositório só (sem código duplicado), nome certo desde o início, e tudo vai junto na renomeação (histórico, branches,
tag, PRs, robô diário e Pages). O endereço antigo (`solverone.com.br/planos-candidatos-2026/`) continua abrindo por um
repositório novo com o nome antigo, contendo só as duas páginas de `docs/redirecionamento/` (PT e EN, preservam `#` e `?`),
marcado como *Archived* no mesmo dia. Depois da renomeação: PR de 8 linhas trocando as 4 menções do endereço no `index.html`
(texto da Colinha no WhatsApp, rodapé das imagens e aviso); RootifyONE → Apps → endereço novo → Publicar; mestres
`rootify-catalogo.js` e `diretrizes.js` (lista do portal) e o link do Portal pela sessão mãe. A tabela de aliases (abaixo)
continua valendo para a F1.

## Contexto

Endereço no ar: `solverone.com.br/planos-candidatos-2026/` (e `index-en.html`). Rotas por `#`: telas `#inicio`, `#historico`,
`#infograficos`, `#macrotemas` (e `#macrotemas/<tema>`), `#score`, `#mandato`, `#documentos`, `#metodo`, `#glossario` (e
`#gl-<letra>`), `#hub`, `#colinha`, `#congresso`, `#congresso/afinidade`, `/favoritos`, `/comparar`, `/metodo`, `/mandato`,
`#congresso/ficha/<UF>/<id>`; infográficos `#g-<slug>` (43, slug = título normalizado, 44 caracteres; lista exata em
`docs/legacy_catalog.json`), `#g-sobrepor`, `#g-marcos-comp`, `#ig-indice`, `#ig-sumario`, `#ig-comp`. GitHub Pages não faz
redirecionamento no servidor; links já compartilhados (WhatsApp, imagem exportada com endereço) precisam continuar abrindo.

## Decisão

1. **Tabela de aliases** `dados/aliases.json` gerada do `legacy_catalog.json`: `{ "ancora_antiga": "rota_nova" }` para todas as
   rotas acima (43 gráficos + telas + Congresso + glossário + comparadores). O roteador do site novo aceita **as duas** formas:
   ao abrir com um `#` antigo, troca por `replaceState` para a rota nova e abre o bloco certo (sem entrada extra no histórico).
   Enquanto a rota nova for igual à antiga (F1 preserva os ids), o alias é identidade; a tabela existe para o dia em que mudar.
2. **Repositório antigo = arquivo + redirecionamento** (PR separado em `planos-candidatos-2026`, com "pode mesclar" próprio):
   `index.html` e `index-en.html` viram páginas mínimas com `<meta http-equiv="refresh">` de reserva e um script que leva para
   `/radar-one/` **preservando o `#`** (e `?lang=en` para o inglês); `<link rel="canonical">` apontando para o novo. Os PDFs dos
   planos, `congresso/`, `cola/` e `presidencia/` continuam servidos no endereço antigo até o repositório de dados assumir (links
   de documentos não quebram). Um aviso de uma linha explica a mudança de nome.
3. O README do repositório antigo e o `apps.json` do RootifyONE (catálogo) apontam para o novo; o app antigo fica `estado:
   "arquivo"` no catálogo.
4. Os apelidos públicos das 43 entradas são conteúdo do RootifyONE (ADR 0005): renomear um título não quebra o link, porque o
   slug antigo fica na tabela de aliases.

## Alternativas

| | A · Site antigo congelado no ar, sem redirecionar | **B · Redirecionamento preservando o `#` + aliases no roteador (escolhida)** | C · Apagar o antigo e mudar os links à mão |
|---|---|---|---|
| Prós | nada quebra; museu | links antigos abrem o conteúdo correspondente no produto novo (T08); um endereço só para indexação | limpeza |
| Contras | dois sites com dados divergentes; o calendário de 2026 congela a Colinha; confusão de nome | redirecionamento por JavaScript (Pages não tem servidor); exige o PR no repositório antigo | links já compartilhados quebram; contra T08 |

## Consequências

- Nada de endereço fixo no código: `SITE_BASE = location.origin + '/'` e o nome da pasta vindo do próprio caminho (diretriz "Domínio").
- O teste de aliases abre cada âncora antiga no site novo e confere que o bloco com aquele id está visível.

## Condição de mudar

Se o dono preferir manter o site antigo como museu (sem redirecionar), fica A **com** banner e `canonical` para o novo, e os
aliases continuam valendo no novo.

## Como se prova

`teste/aliases.js`: para cada entrada de `aliases.json`, abrir `/radar-one/#<antiga>` e conferir `location.hash` e o bloco visível;
abrir `/planos-candidatos-2026/#g-…` e chegar ao mesmo bloco no novo.
