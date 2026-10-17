/* Peças comuns dos testes do Eleições 2026 (só valores de mentira).
   Os testes servem a pasta do app em http://localhost:PORTA e simulam os provedores de voz com page.route. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RAIZ = path.join(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf' };

function servir(porta) {
  const s = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]); if (rel === '/') rel = '/index.html';
    const alvo = path.join(RAIZ, path.normalize(rel));
    if (!alvo.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
    fs.readFile(alvo, (e, d) => {
      if (e) { res.writeHead(404); return res.end('nao'); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(d);
    });
  });
  return new Promise(ok => s.listen(porta, () => ok(s)));
}

/* áudio de mentira (PCM mudo em base64, > 500 caracteres) que os três provedores "devolvem" */
const PCM = Buffer.alloc(1200).toString('base64');
const RESP_GEMINI = JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: PCM } }] } }] });

async function novoContexto(browser, largura, pedidos) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: largura || 1100, height: 800 }, locale: 'pt-BR', reducedMotion: 'reduce' });
  /* nada sai para a internet de verdade; os provedores de voz são simulados e anotam o que receberam */
  await ctx.route(/^https?:\/\/(?!localhost)/, route => {
    const u = route.request().url(), h = route.request().headers();
    if (/generativelanguage\.googleapis\.com/.test(u)) { pedidos.push({ prov: 'gemini', chave: h['x-goog-api-key'] }); return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: RESP_GEMINI }); }
    if (/api\.openai\.com/.test(u)) { pedidos.push({ prov: 'openai', chave: (h['authorization'] || '').replace('Bearer ', '') }); return route.fulfill({ status: 200, contentType: 'audio/mpeg', headers: { 'access-control-allow-origin': '*' }, body: Buffer.alloc(900) }); }
    if (/api\.elevenlabs\.io/.test(u)) { pedidos.push({ prov: 'elevenlabs', chave: h['xi-api-key'] }); return route.fulfill({ status: 200, contentType: 'audio/mpeg', headers: { 'access-control-allow-origin': '*' }, body: Buffer.alloc(900) }); }
    return route.abort();
  });
  /* a voz do aparelho vira um gravador: anota o que foi "falado" e termina na hora */
  await ctx.addInitScript(() => {
    window.__fala = [];
    try {
      const ss = window.speechSynthesis;
      ss.getVoices = () => [];
      ss.speak = u => { window.__fala.push(u.text); setTimeout(() => { try { u.onend && u.onend({}); } catch (e) {} }, 10); };
      ss.cancel = () => {}; ss.pause = () => {}; ss.resume = () => {};
    } catch (e) {}
    /* sem som de verdade */
    HTMLMediaElement.prototype.play = function () { setTimeout(() => this.dispatchEvent(new Event('ended')), 10); return Promise.resolve(); };
  });
  return ctx;
}

/* guarda valores no localStorage ANTES de a página carregar (só uma vez por contexto) */
async function semear(ctx, itens) {
  await ctx.addInitScript(([it]) => {
    if (sessionStorage.getItem('__semeado')) return;
    sessionStorage.setItem('__semeado', '1');
    Object.keys(it).forEach(k => localStorage.setItem(k, JSON.stringify(it[k])));
  }, [itens]);
}

/* se a janela do cofre aparecer, cria o PIN (ou abre com ele) e segue */
async function passaPin(page, pin, espera) {
  const j = page.locator('#solver-cofre [role=dialog]');
  try { await j.waitFor({ state: 'visible', timeout: espera || 2500 }); } catch (e) { return false; }
  const campos = await page.$$('#solver-cofre input[type=password]');
  for (const c of campos) await c.fill(pin);
  await page.click('#solver-cofre button[type=submit]');
  await page.locator('#solver-cofre').waitFor({ state: 'detached', timeout: 15000 });
  return true;
}

const PAGINAS = [['index.html', 'pt'], ['index-en.html', 'en']];

function relatorio() {
  const falhas = [];
  return { falhas, conferir(ok, msg) { if (!ok) { falhas.push(msg); process.stdout.write('  ✗ ' + msg + '\n'); } else process.stdout.write('  ✓ ' + msg + '\n'); } };
}
module.exports = { chromium, servir, novoContexto, semear, passaPin, PAGINAS, relatorio };
