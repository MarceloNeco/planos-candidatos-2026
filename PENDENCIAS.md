# Pendências — RadarONE

Lista viva, numerada (números não mudam nem são reaproveitados). Situação: 🟡 aberta · 🔵 em andamento · ⏸ aguardando o dono · ✅ feita (com a versão).
As pendências do Eleições 2026 (2.5.3) continuam valendo e estão em `docs/PENDENCIAS-eleicoes-2.5.3.md`; as que afetam a F1 foram copiadas aqui.

| # | Pendência | Origem | Situação |
|---|---|---|---|
| 1 | Nome do produto: **RadarONE** (escolhido em 22/10/2026). Repositórios: ver #21 | F0, entrega 1 | ✅ nome; repositórios em 26/10 |
| 2 | `eleicao.fase` passa a existir fora de `eleicao.calendario.fase`; a de dentro fica como reserva. Decidir se, na F2, a de dentro é removida | ADR 0010 | ⏸ aguardando o dono |
| 3 | "Pré-campanha" = eleição ligada sem Colinha. Confirmar (ou pedir Colinha preliminar na pré-campanha) | ADR 0010 | ⏸ aguardando o dono |
| 4 | Parecer `ANALISE-plataforma-politica.md`, seção 3: `atualizacao.cadencia` deixa de ser um valor único e vira cadência por família; acrescentar `eleicao.modo` e `eleicao.fase` (requisitos 1 e 2 de 19/10) | ADR 0003 e 0010 | 🟡 aberta (chat Arquitetura atualiza o parecer) |
| 5 | RootifyONE precisa ganhar: estados de revisão por item de coleção; papel `revisor` com "autor não aprova"; versão por item; validação de `atualizacao.cadencia` por chave; aviso na Inbox quando um robô fica 60 dias sem gravar | ADR 0005 e 0003 | 🟡 aberta (sessão mãe, regra zero) |
| 6 | IBGE: `servicodados.ibge.gov.br/api/v3` derrubou a conexão deste container em 22/10; `apisidra` respondeu. O robô terá os dois caminhos; conferir no runner do Actions | medição F0 | 🟡 aberta |
| 7 | BCB SGS: janela de 10 anos devolve HTML com HTTP 200; janelas de 5 anos levam 13–27 s; usar janelas curtas e validar `Content-Type` | medição F0 | 🟡 aberta (entra no `robos/comum.py` da F2) |
| 8 | Calendário oficial do TSE para 2028 não pôde ser lido automaticamente (403). Datas pela Lei 9.504/1997: 01/10/2028 e 29/10/2028. Conferir à mão quando o TSE publicar | registro de fontes | ⏸ aguardando o dono (conferir) |
| 9 | Licenças das fontes: só a do TSE (CC-BY) foi lida. As demais ficam "a confirmar" até a homologação de cada fonte | registro de fontes | 🟡 aberta (uma a uma, na onda de cada fonte) |
| 10 | Colinha por município (prefeito e vereador em 2028): modelo do calendário aceita, mas a Colinha só tem dados por UF e o robô gera por UF. Fazer de forma genérica (ADR 0010 §4) | PENDENCIAS 2.5.3 + requisito 2 | 🟡 aberta (F3) |
| 11 | "2026" fixo fora do calendário: `DIA_ELEICAO` e `POSSE` no `congresso-sync.py`, código da eleição nas fotos do TSE, textos do Congresso com "2026" e o nome do site | PENDENCIAS 2.5.3 | 🟡 aberta (F1-PR6/F3) |
| 12 | `sw.js`, `manifest.json` e `versoes.json` não existem no app atual (decisão do dono em 17/10: PR próprio com regra zero) | PENDENCIAS 2.5.3 | 🟡 aberta (F1-PR8) |
| 13 | Content-Security-Policy ainda não declarada (o cofre assume página sem script de terceiros) | PENDENCIAS 2.5.3 | 🟡 aberta (F1-PR5) |
| 14 | `recursos.js` do app mais antigo que o mestre (falta a tela "Em manutenção" do id `app`); vem na varredura #118 do RootifyONE | PENDENCIAS 2.5.3 | 🟡 aberta |
| 15 | Campo `versao` do `recursos-do-app.json` do app no ar ainda diz 2.5.1 (informativo) | fila de ideias | 🟡 aberta (F1-PR7 substitui o arquivo) |
| 16 | Robô "Congresso - atualizar dados" falhou na `main` em 19/10 (agendado no chat "(Eleicoes) UX fix pra colinha" para conferir em 22/10); os commits de 20 e 21/10 na `main` indicam que voltou a gravar | fila de ideias | 🟡 aberta (conferir o run) |
| 17 | Supabase: a partir de 30/10/2026 objeto novo em `public` exige GRANT explícito; vale para as tabelas editoriais da F4 | fila de ideias, item 9 | 🟡 aberta (F4) |
| 18 | Parecer de advogado antes de qualquer veredito próprio no Mentirômetro | ADR 0007 | ⏸ aguardando o dono |
| 19 | O harness de paridade captura 41 blocos por CSV e 2 por impressão digital (pesos das dimensões e alcance dos marcos: células, textos do SVG e títulos). Na F2, dar CSV também a esses dois | harness F0 | 🟡 aberta |
| 20 | PR 2 do RootifyONE (aba Recursos e menu com os apps declarados, #116 e #117) é pré-requisito para o Controle dos apps mostrar os comportamentos novos com `opcoes` | fila de ideias | 🟡 aberta (sessão mãe) |
| 21 | Roteiro de 26/10/2026 (depois do 2º turno): renomear `planos-candidatos-2026` → `radar-one`; criar `radar-one-dados` (público, vazio) e subir README + manifesto; criar o repositório-placa `planos-candidatos-2026` com `docs/redirecionamento/`, ligar o Pages e arquivar; RootifyONE → Apps → endereço `solverone.com.br/radar-one/` → Publicar; sessão mãe ajusta `rootify-catalogo.js`, a lista do portal em `diretrizes.js` e o link do Portal | decisão do dono, 23/10 (ADR 0009, emenda) | ⏸ aguardando 26/10 |
| 22 | Trocar as 4 menções de `planos-candidatos-2026` no `index.html` (`SITE` do WhatsApp da Colinha, dois rodapés de imagem e o aviso "a partir da versão publicada em…") pelo endereço novo, em PR de 8 linhas logo depois da renomeação | ADR 0009, emenda | 🟡 aberta (26/10) |
