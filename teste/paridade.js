/* ============================================================================
   paridade.js — harness de PARIDADE dos infográficos (F0 da plataforma política)
   ----------------------------------------------------------------------------
   Pergunta que ele responde: "a partir do MESMO snapshot de dados, a saída nova
   mostra os MESMOS números que a saída antiga, em cada um dos 43 infográficos?"

   O que ele captura, para cada bloco do índice de infográficos (IG.graficos):
     1. o CSV que o próprio bloco exporta pelo botão "Dados em CSV" (as linhas
        serie;categoria;ano;valor;unidade;…): é o "contrato de saída" do bloco;
     2. para blocos sem CSV (dossiê do STF, radar de pesos, radar dos marcos,
        listas de marcos), uma impressão digital: todos os números visíveis no
        texto do bloco, na ordem, mais os títulos.
   Mais os dois comparadores (g-sobrepor, g-marcos-comp), o total de entradas do
   índice e a identidade do snapshot (sha256 do bloco <script id="ig">).

   Uso (precisa do Playwright; o Chromium já vem no container de teste):
     node teste/paridade.js capturar <nome> [--raiz <pasta do site>] [--pagina index.html]
     node teste/paridade.js comparar <A> <B>
     node teste/paridade.js autoteste [--raiz <pasta do site>]
        → captura o site atual duas vezes e compara (tem de dar 0 diferenças);
          depois captura com UM valor da série "selic" alterado de propósito e
          compara (tem de acusar exatamente os blocos que usam a selic).
   Saída: teste/paridade/<nome>/resumo.json e um .csv (ou .txt) por bloco.
   Nada sai para a internet: todo endereço fora de localhost é bloqueado.
   Só valores de mentira no autoteste; nenhum dado da pessoa é lido.
   ============================================================================ */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('Playwright não encontrado. Rode: npm install -D playwright  (ou NODE_PATH=<pasta global do node_modules>)'); process.exit(2); }

const args = process.argv.slice(2);
const cmd = args[0];
function opt(nome, padrao) { const i = args.indexOf(nome); return i > -1 && args[i + 1] ? args[i + 1] : padrao; }
const RAIZ = path.resolve(opt('--raiz', path.join(__dirname, '..')));
const PAGINA = opt('--pagina', 'index.html');
const PORTA = +opt('--porta', 8123);
const SAIDA = path.join(__dirname, 'paridade');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf', '.css': 'text/css; charset=utf-8' };

/* mesma regra do slugG() do index.html: o id do bloco de cada gráfico sai do título */
function slugG(t) {
  return 'g-' + t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44);
}
function sha(txt) { return crypto.createHash('sha256').update(txt).digest('hex'); }
function blocoJSON(html, id) {
  const ini = '<script id="' + id + '" type="application/json">';
  const a = html.indexOf(ini); if (a < 0) throw new Error('bloco ' + id + ' não achado');
  const b = html.indexOf('</script>', a + ini.length);
  return html.slice(a + ini.length, b);
}

function servir(raiz, porta, transforma) {
  const s = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]); if (rel === '/') rel = '/index.html';
    const alvo = path.join(raiz, path.normalize(rel));
    if (!alvo.startsWith(raiz)) { res.writeHead(403); return res.end(); }
    fs.readFile(alvo, (e, d) => {
      if (e) { res.writeHead(404); return res.end('nao'); }
      if (transforma && /\.html$/.test(alvo)) d = Buffer.from(transforma(d.toString('utf8')), 'utf8');
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(d);
    });
  });
  return new Promise(ok => s.listen(porta, () => ok(s)));
}

/* --------------------------------------------------------------------------
   CAPTURAR: abre a aba Infográficos e lê o CSV de cada bloco
   -------------------------------------------------------------------------- */
async function capturar(nome, transforma) {
  const html = fs.readFileSync(path.join(RAIZ, PAGINA), 'utf8');
  const htmlServido = transforma ? transforma(html) : html;
  const ig = JSON.parse(blocoJSON(htmlServido, 'ig'));
  const dados = JSON.parse(blocoJSON(htmlServido, 'dados'));
  const snapshot = { ig_sha256: sha(blocoJSON(htmlServido, 'ig')), versao_app: dados.versao || '', pagina: PAGINA };
  const titulos = ig.graficos.map(g => g.titulo);
  const esperados = titulos.map(slugG);

  const servidor = await servir(RAIZ, PORTA, transforma);
  const base = 'http://localhost:' + PORTA;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1200, height: 900 }, locale: 'pt-BR', reducedMotion: 'reduce' });
  /* nada vai para a internet: o TSE, o RootifyONE e os provedores de voz ficam fora */
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  /* o AssistONE abre sozinho na primeira visita: entra como quem já o viu */
  await ctx.addInitScript(() => {
    try { const k = 'planos2026:prefs', o = JSON.parse(localStorage.getItem(k) || '{}'); if (!o.aoVisto) { o.aoVisto = true; localStorage.setItem(k, JSON.stringify(o)); } } catch (e) {}
    try { localStorage.setItem('planos2026:modo', JSON.stringify('planos')); } catch (e) {}
    /* o aviso "Novidade!" da Colinha abre 1,8 s depois da carga e travaria os cliques: entra como quem já o viu */
    try { localStorage.setItem('planos2026:novidade-colinha', JSON.stringify(true)); } catch (e) {}
  });
  /* o "Dados em CSV" cria um <a download href="blob:…"> e clica nele: aqui o clique é interceptado e o texto do CSV vai
     para window.__dl, sem download de verdade (mais rápido e sem depender de pasta de downloads) */
  await ctx.addInitScript(() => {
    window.__dl = [];
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && /^blob:/.test(this.href)) { const nome = this.download; fetch(this.href).then(r => r.text()).then(t => window.__dl.push({ nome, texto: t })); return; }
      return click.call(this);
    };
  });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(String(e && e.message || e)));
  await page.goto(base + '/' + PAGINA + '#infograficos', { waitUntil: 'load' });
  await page.waitForSelector('#v-infograficos .ig', { timeout: 30000 });
  /* todos os blocos já existem? (pinta() cria os 43 de uma vez) */
  await page.waitForFunction(n => document.querySelectorAll('#v-infograficos .ig').length >= n, esperados.length, { timeout: 30000 });

  const dir = path.join(SAIDA, nome); fs.mkdirSync(dir, { recursive: true });
  const blocos = [];
  for (let i = 0; i < esperados.length; i++) {
    const slug = esperados[i];
    const existe = await page.$('#' + slug);
    const reg = { n: i + 1, slug, titulo: titulos[i], forma: ig.graficos[i].forma, existe: !!existe, modo: null, sha256: null, linhas: 0, arquivo: null };
    if (!existe) { blocos.push(reg); continue; }
    /* o gráfico e a barra de botões do bloco só são desenhados quando ele entra na tela (renderização preguiçosa):
       rola até ele e espera a barra de ações; blocos sem barra (radares, dossiê) caem na impressão digital por texto */
    await page.$eval('#' + slug, el => el.scrollIntoView({ block: 'center' }));
    await page.waitForSelector('#' + slug + ' .ig-acoes', { timeout: 8000 }).catch(() => null);
    /* radares e listas terminam de se desenhar um pouco depois (pesos, contagens): espera o texto do bloco ficar parado */
    for (let k = 0, ant = null; k < 15; k++) {
      const agora = await page.$eval('#' + slug, el => (el.innerText || '').replace(/\s+/g, ' '));
      if (agora === ant) break;
      ant = agora; await page.waitForTimeout(400);
    }
    /* o botão "Dados em CSV" do próprio bloco (os de PNG e compartilhar também têm a classe btn-csv: escolhe pelo texto) */
    const bt = await page.$('#' + slug + ' .ig-acoes button:has-text("Dados em CSV")');
    let txt = null;
    if (bt) {
      /* qualquer janela comum aberta (aviso, novidade) intercepta o clique: fecha antes */
      if (await page.$('dialog[open].ej-fundo')) { await page.keyboard.press('Escape'); await page.waitForSelector('dialog[open].ej-fundo', { state: 'detached', timeout: 5000 }).catch(() => null); }
      const antes = await page.evaluate(() => window.__dl.length);
      await bt.click();
      await page.waitForFunction(n => window.__dl.length > n, antes, { timeout: 15000 });
      txt = (await page.evaluate(() => window.__dl[window.__dl.length - 1].texto)).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
      reg.modo = 'csv'; reg.arquivo = slug + '.csv';
    } else {
      /* sem CSV: impressão digital dos números e títulos visíveis no bloco */
      /* só o que carrega dado: títulos, células de tabela e textos do SVG (radar); botões, dobradiças e contadores de
         interface ficam de fora, porque mudam com o momento da captura e não com o dado */
      txt = await page.$eval('#' + slug, el => {
        const tit = [].map.call(el.querySelectorAll('h2,h3,h4,.ig-h,.ig-k'), x => x.textContent.trim()).filter(Boolean);
        const celulas = [].map.call(el.querySelectorAll('table td, table th, svg text, .leg-ig'), x => (x.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
        return 'titulos\n' + tit.join('\n') + '\ndados\n' + celulas.join('\n') + '\n';
      });
      reg.modo = 'texto'; reg.arquivo = slug + '.txt';
    }
    fs.writeFileSync(path.join(dir, reg.arquivo), txt, 'utf8');
    reg.sha256 = sha(txt); reg.linhas = txt.split('\n').filter(Boolean).length;
    blocos.push(reg);
  }
  /* comparadores e índice (fora das 43 entradas, mas precisam continuar existindo) */
  const extras = {};
  for (const id of ['g-sobrepor', 'g-marcos-comp', 'ig-indice']) {
    const el = await page.$('#' + id);
    extras[id] = el ? { existe: true, sha256: sha(await page.$eval('#' + id, e => (e.innerText || '').replace(/\s+/g, ' '))) } : { existe: false };
  }
  const totalIndice = await page.$$eval('#v-infograficos .ig', l => l.length);
  const resumo = { nome, capturado_em: new Date().toISOString(), url: base + '/' + PAGINA + '#infograficos', snapshot, total_graficos_no_ig: ig.graficos.length, blocos_na_pagina: totalIndice, extras, erros_js: erros, blocos };
  fs.writeFileSync(path.join(dir, 'resumo.json'), JSON.stringify(resumo, null, 1), 'utf8');
  await browser.close(); servidor.close();
  const comCsv = blocos.filter(b => b.modo === 'csv').length, comTxt = blocos.filter(b => b.modo === 'texto').length, faltam = blocos.filter(b => !b.existe).length;
  console.log(`✓ captura "${nome}": ${blocos.length} blocos (${comCsv} com CSV, ${comTxt} por texto, ${faltam} não achados), snapshot ig ${snapshot.ig_sha256.slice(0, 12)}, app ${snapshot.versao_app}${erros.length ? ', ' + erros.length + ' erro(s) de JS' : ''}`);
  return resumo;
}

/* --------------------------------------------------------------------------
   COMPARAR: bloco a bloco, linha a linha
   -------------------------------------------------------------------------- */
function lerCaptura(nome) {
  const dir = path.join(SAIDA, nome);
  const r = JSON.parse(fs.readFileSync(path.join(dir, 'resumo.json'), 'utf8'));
  r._dir = dir; return r;
}
/* chave de uma linha do CSV: serie|categoria|ano → valor; assim a diferença diz QUAL número mudou */
function mapaCSV(txt) {
  const m = new Map(); const L = txt.split('\n').filter(Boolean);
  for (let i = 1; i < L.length; i++) { const c = L[i].split(';'); m.set(c.slice(0, 3).join('|'), c.slice(3).join(';')); }
  return m;
}
function comparar(A, B, silencioso) {
  const a = lerCaptura(A), b = lerCaptura(B);
  const difs = [];
  if (a.snapshot.ig_sha256 !== b.snapshot.ig_sha256) difs.push({ onde: 'snapshot', detalhe: 'os dois lados NÃO partem do mesmo snapshot de dados (ig_sha256 diferente): a comparação só vale com o mesmo snapshot' });
  if (a.total_graficos_no_ig !== b.total_graficos_no_ig) difs.push({ onde: 'indice', detalhe: `total de entradas: ${a.total_graficos_no_ig} × ${b.total_graficos_no_ig}` });
  const porSlug = new Map(b.blocos.map(x => [x.slug, x]));
  for (const x of a.blocos) {
    const y = porSlug.get(x.slug);
    if (!y) { difs.push({ onde: x.slug, detalhe: 'bloco não existe em ' + B }); continue; }
    if (!x.existe || !y.existe) { if (x.existe !== y.existe) difs.push({ onde: x.slug, detalhe: `existe só em ${x.existe ? A : B}` }); continue; }
    if (x.sha256 === y.sha256) continue;
    const ta = fs.readFileSync(path.join(a._dir, x.arquivo), 'utf8'), tb = fs.readFileSync(path.join(b._dir, y.arquivo), 'utf8');
    if (x.modo === 'csv' && y.modo === 'csv') {
      const ma = mapaCSV(ta), mb = mapaCSV(tb), linhas = [];
      for (const [k, v] of ma) { if (!mb.has(k)) linhas.push(`só em ${A}: ${k}`); else if (mb.get(k) !== v) linhas.push(`${k}: ${v.split(';')[0]} → ${mb.get(k).split(';')[0]}`); }
      for (const k of mb.keys()) if (!ma.has(k)) linhas.push(`só em ${B}: ${k}`);
      difs.push({ onde: x.slug, detalhe: linhas.length + ' linha(s) diferente(s)', linhas: linhas.slice(0, 20) });
    } else difs.push({ onde: x.slug, detalhe: 'conteúdo diferente (' + x.modo + ' × ' + y.modo + ')' });
  }
  for (const y of b.blocos) if (!a.blocos.some(x => x.slug === y.slug)) difs.push({ onde: y.slug, detalhe: 'bloco só existe em ' + B });
  for (const id of Object.keys(a.extras)) { const ea = a.extras[id], eb = (b.extras || {})[id] || {}; if (ea.existe !== eb.existe) difs.push({ onde: id, detalhe: `existe só em ${ea.existe ? A : B}` }); }
  if (!silencioso) {
    console.log(`\n▶ paridade ${A} × ${B}: ${difs.length === 0 ? '✓ nenhuma diferença' : '✗ ' + difs.length + ' diferença(s)'}`);
    difs.forEach(d => { console.log('  ✗ ' + d.onde + ': ' + d.detalhe); (d.linhas || []).forEach(l => console.log('      ' + l)); });
  }
  const rel = { A, B, comparado_em: new Date().toISOString(), diferencas: difs };
  fs.writeFileSync(path.join(SAIDA, `comparacao-${A}-x-${B}.json`), JSON.stringify(rel, null, 1), 'utf8');
  return difs;
}

/* --------------------------------------------------------------------------
   AUTOTESTE: atual × atual = 0 diferenças; selic alterada = acusa os blocos certos
   -------------------------------------------------------------------------- */
async function autoteste() {
  let falhou = false;
  await capturar('atual-A'); await capturar('atual-B');
  const d1 = comparar('atual-A', 'atual-B');
  if (d1.length) { falhou = true; console.log('  ✗ atual × atual devia dar 0 diferenças'); } else console.log('  ✓ atual × atual: 0 diferenças');
  /* um valor de mentira: o primeiro ponto da série "selic" ganha +1; só os blocos que usam a selic podem mudar */
  const forca = html => {
    const ini = '<script id="ig" type="application/json">', a = html.indexOf(ini) + ini.length, b = html.indexOf('</script>', a);
    const ig = JSON.parse(html.slice(a, b));
    ig.series.selic.pontos[0].valor = +ig.series.selic.pontos[0].valor + 1;
    return html.slice(0, a) + JSON.stringify(ig) + html.slice(b);
  };
  await capturar('forcado-selic', forca);
  const d2 = comparar('atual-A', 'forcado-selic');
  const ig = JSON.parse(blocoJSON(fs.readFileSync(path.join(RAIZ, PAGINA), 'utf8'), 'ig'));
  const esperado = new Set(ig.graficos.filter(g => (g.ids || []).indexOf('selic') > -1).map(g => slugG(g.titulo)).concat(['snapshot']));
  const achado = new Set(d2.map(d => d.onde));
  const ok = [...esperado].every(s => achado.has(s)) && [...achado].every(s => esperado.has(s));
  if (ok) console.log(`  ✓ a diferença forçada foi acusada só onde devia: ${[...esperado].filter(s => s !== 'snapshot').join(', ')}`);
  else { falhou = true; console.log('  ✗ esperava diferenças em ' + [...esperado].join(', ') + ' e achou ' + [...achado].join(', ')); }
  console.log(falhou ? '\n✗ autoteste do harness FALHOU' : '\n✓ autoteste do harness passou: ele enxerga igualdade e enxerga diferença');
  process.exit(falhou ? 1 : 0);
}

(async () => {
  if (cmd === 'capturar' && args[1]) { await capturar(args[1]); }
  else if (cmd === 'comparar' && args[1] && args[2]) { process.exit(comparar(args[1], args[2]).length ? 1 : 0); }
  else if (cmd === 'autoteste') { await autoteste(); }
  else { console.log('uso: node teste/paridade.js capturar <nome> | comparar <A> <B> | autoteste   [--raiz <pasta do site>] [--pagina index.html] [--porta 8123]'); process.exit(2); }
})().catch(e => { console.error('✗ ' + (e && e.stack || e)); process.exit(1); });
