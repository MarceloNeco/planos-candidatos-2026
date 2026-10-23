# Arquitetura — RadarONE (plataforma política permanente da SolverONE)

> Rascunho da F0 (22/10/2026). O nome entra quando o dono escolher. Este arquivo substitui o `ARQUITETURA.md` do Eleições 2026 no
> repositório novo; o texto antigo fica intacto em `docs/ARQUITETURA-eleicoes-2.5.3.md`, porque o módulo Eleições é o mesmo código.

## O que é

Produto permanente de acompanhamento político: pessoas, mandatos, instituições e indicadores o ano inteiro, com a eleição como
área contextual e arquivo histórico. Nasce do app Eleições 2026 (`planos-candidatos-2026`, versão 2.5.3, 913 verificações de
teste), que continua inteiro dentro dele como módulo. As duas especificações v2 (técnica e design/UX) e o parecer do chat Arquitetura ficam no repositório **privado** `rootify-one`
(`docs/reforma/especificacoes/` e `docs/reforma/ANALISE-plataforma-politica.md`); aqui, público, ficam só as decisões (`docs/adr/`).

## Estado em 22/10/2026 (F0)

| Camada | Hoje | Depois da F1 | Depois da F2/F3 |
|---|---|---|---|
| Site estático (GitHub Pages, sem build) | um `index.html` de 47.578 linhas com dados embutidos + `index-en.html` gerado | shell com 4 destinos + módulos ES + `dados/*.json` | igual, lendo também o repositório de dados |
| Dados | dentro do HTML (`dados`, `ig`, …) e `congresso/`, `cola/`, `presidencia/` gerados pelo robô | `dados/` no próprio site (acervo) | `radar-one-dados` (robôs) + `dados/` (acervo que não tem API) |
| Robôs (GitHub Actions, Python) | `congresso-sync.py`, 1 job diário | igual | um workflow por família, cadência configurada no RootifyONE |
| RootifyONE | interruptores `assistone`, `colinha`; comportamentos `assistone.dicas`, `cofre.proteger`, `eleicao.calendario` | + `eleicoes`, `indicadores`, `mandatos`, `promessas`, `checagens`, `imprensa`, `scores`; `eleicao.modo`, `eleicao.fase`, `atualizacao.cadencia`, `score.preset`, `cobertura.minima` | + conteúdo editorial (promessas, checagens agregadas, rubricas, apelidos) |
| Supabase | não usa | não usa | só editorial com login (F4) |

## Mapa do repositório (depois deste PR)

| Caminho | O que é | Mexer? |
|---|---|---|
| `index.html`, `index-en.html`, `sincroniza-en.py`, `*.pdf`, `banner.jpg`, `trilha.mp3`, `congresso/`, `cola/`, `presidencia/`, `congresso-sync.py`, `congresso-pautas.json`, `presidencia-compromissos.json`, `.github/workflows/congresso-sync.yml`, `teste/*.js` (exceto `paridade.js`) | **o app atual** (este repositório é renomeado de `planos-candidatos-2026` para `radar-one` em 26/10/2026, depois do 2º turno; ADR 0009, emenda); regras no `docs/ARQUITETURA-eleicoes-2.5.3.md` | só pelos PRs da F1 |
| `janela.js`, `cofre.js`, `recursos.js` | mestres da SolverONE (cópias exatas do `rootify-one`) | **nunca à mão** |
| `recursos-do-app.json` | o que o produto novo obedece do RootifyONE (ADR 0005 e 0010) | sim, ao ligar interruptor novo no código |
| `docs/adr/` | decisões de arquitetura, uma por arquivo (índice em `0000-indice.md`) | sim, por ADR novo ou "superado por" |
| `docs/legacy_catalog.json` e `.md` | manifesto das 43 entradas de infográficos (T01/T25), gerado por `robos/gera-legacy-catalog.py` | regenerar, não editar à mão |
| `docs/fontes/registro-de-fontes.json` e `.md` | registro de fontes (T23), gerado por `robos/gera-registro-fontes.py` | editar o script e regenerar |
| `docs/redirecionamento/` | as duas páginas (PT e EN) do repositório-placa que ficará com o nome antigo | copiar para lá em 26/10 |
| `docs/limites-planos-gratuitos.md`, `docs/medicao-conectores.md` | limites lidos nas páginas oficiais e medição das APIs (datas e links) | reconferir a cada fase |
| `docs/plano-F1.md` | os 10 PRs da F1, com prova e modelo | sim |
| `docs/ARQUITETURA-eleicoes-2.5.3.md`, `docs/PENDENCIAS-eleicoes-2.5.3.md` | os dois arquivos do app atual, intactos | só pelos PRs da F1 |
| `teste/paridade.js`, `teste/paridade/` | harness de paridade (captura o CSV de cada um dos 43 blocos e compara duas capturas) e os resumos do autoteste de 22/10/2026 | sim |
| `robos/prototipo-ibge-bcb.py` | protótipo da onda 1 (IBGE e BCB), conferido contra o acervo | vira `robos/indicadores.py` na F2 |
| `robos/gera-*.py` | geradores dos manifestos | sim |
| `docs/recursos-do-app.json` | o `recursos-do-app.json` do produto novo (entrega 6); o da raiz continua o do app atual até o F1-PR7 | sim |
| `PENDENCIAS.md` | lista viva, numerada | a cada entrega |

## Regras que não se quebram (herdadas e novas)

- Nenhuma preferência sai do navegador; nada é enviado a servidor; nenhum segredo em código, repositório ou chat.
- Nada de ranking, nota geral ou recomendação de voto como "verdade": descrição sempre; índice configurado só com preset
  explícito, cesta comum e coorte mínima; afinidade é simulação separada; integridade e veracidade em painéis independentes.
- Texto novo em PT **e** EN; instruções para o dono em português, passo a passo.
- Sem framework e sem build; módulos ES; Python só nos robôs.
- O público nunca consulta o Supabase; o site só lê arquivos publicados.
- O site não tem tela de administração: tudo é configurado no RootifyONE (requisito 1 do dono).
- Todo PR: 8 linhas, "pode mesclar" do chat Arquitetura, 913 verificações e paridade 0.

## Como rodar os testes

```
cd <repositório>
npm install -D playwright          # uma vez (o Chromium do container de teste já serve)
node teste/rodar.js                # as 913 verificações do app atual
node teste/paridade.js autoteste   # o harness: atual × atual = 0; selic alterada = acusa 2 blocos
python3 -I robos/prototipo-ibge-bcb.py --index index.html --saida robos/saida
```
