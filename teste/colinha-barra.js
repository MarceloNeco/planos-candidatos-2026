/* Teste da barra de baixo da Colinha (.ck-bar, 2.5.2), nas DUAS páginas, em 390 e 320 px, com e sem html.ao-on (AssistONE ligado):
     - a barra tem no máximo 60 px de altura e os três botões ficam numa linha só, dentro da tela
     - os três botões são clicáveis (nada por cima deles) e, até 480 px, Texto e Imprimir são só o ícone (44×44, com nome completo)
     - a barra não cobre o texto "Fonte:" no fim da página
   Uso: node teste/colinha-barra.js */
const { chromium, servir, novoContexto, semear, PAGINAS, relatorio } = require('./comum');
const PORTA = process.env.PORTA || 8096, BASE = 'http://localhost:' + PORTA;
const { falhas, conferir } = relatorio();

(async () => {
  const srv = await servir(PORTA);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const erros = [];
  for (const [arq] of PAGINAS) for (const larg of [390, 320]) for (const ao of [false, true]) {
    const L = arq + ' ' + larg + 'px' + (ao ? ' com AssistONE' : '') + ': ';
    const ctx = await novoContexto(browser, larg, []);
    await ctx.clock.setFixedTime(new Date('2026-10-01T15:00:00Z'));
    await semear(ctx, { 'planos2026:prefs': { aoVisto: true, telaCiente: true }, 'planos2026:novidade-colinha': 1 });
    const p = await ctx.newPage(); p.on('pageerror', e => erros.push(arq + ': ' + e.message));
    await p.goto(BASE + '/' + arq + '#colinha'); await p.waitForSelector('#v-colinha .ck-bar', { state: 'attached' });
    if (ao) await p.evaluate(() => document.documentElement.classList.add('ao-on'));
    await p.waitForTimeout(500);
    const bar = p.locator('#v-colinha .ck-bar');
    await bar.scrollIntoViewIfNeeded();
    const m = await p.evaluate(() => {
      const b = document.querySelector('#v-colinha .ck-bar'), bs = [...b.querySelectorAll('button')], r = b.getBoundingClientRect();
      return {
        alt: r.height, n: bs.length, vw: innerWidth,
        topos: bs.map(x => Math.round(x.getBoundingClientRect().top)),
        caixas: bs.map(x => { const q = x.getBoundingClientRect(); return { l: q.left, r: q.right, w: q.width, h: q.height }; }),
        livres: bs.map(x => { const q = x.getBoundingClientRect(), e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return x === e || x.contains(e); }),
        nomes: bs.map(x => ({ aria: x.getAttribute('aria-label'), tit: x.title, txt: x.textContent.trim() })),
        vis: bs.map(x => [...x.querySelectorAll('.ck-t')].some(t => getComputedStyle(t).display !== 'none'))
      };
    });
    conferir(m.n === 3, L + 'três botões');
    conferir(m.alt <= 60, L + 'barra com até 60 px de altura (' + Math.round(m.alt) + ')');
    conferir(new Set(m.topos).size === 1, L + 'os três numa linha só');
    conferir(m.caixas.every(c => c.l >= 0 && c.r <= m.vw), L + 'todos dentro da tela');
    conferir(m.livres.every(Boolean), L + 'os três clicáveis (nada por cima)');
    conferir(m.caixas.every(c => c.h >= 44), L + 'cada botão com pelo menos 44 px de altura');
    conferir(m.caixas[1].w === 44 && m.caixas[2].w === 44 && m.caixas[1].h === 44 && m.caixas[2].h === 44, L + 'Texto e Imprimir viram ícone 44×44');
    conferir(m.nomes.slice(1).every(n => n.aria && n.aria === n.tit && n.aria.length >= 5) && !m.vis[1] && !m.vis[2], L + 'sem texto visível, com aria-label e title com o nome completo (' + m.nomes.slice(1).map(n => n.aria).join(' / ') + ')');
    for (const i of [0, 1, 2]) await p.locator('#v-colinha .ck-bar button').nth(i).click({ trial: true, timeout: 3000 }).then(() => {}, () => conferir(false, L + 'botão ' + (i + 1) + ' não passou no teste de clique'));
    /* fim da página: a barra não cobre o "Fonte:" */
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(300);
    const fim = await p.evaluate(() => { const b = document.querySelector('#v-colinha .ck-bar').getBoundingClientRect(), t = [...document.querySelectorAll('#v-colinha .ck-cont')].pop().getBoundingClientRect(); return { bBase: b.bottom, tTopo: t.top, tBase: t.bottom, txt: [...document.querySelectorAll('#v-colinha .ck-cont')].pop().textContent.slice(0, 6) }; });
    conferir(/^(Fonte|Source)/.test(fim.txt) && (fim.bBase <= fim.tTopo + 1 || fim.tBase <= 0), L + 'a barra não cobre o texto "' + fim.txt + '" no fim da página');
    await ctx.close();
  }
  await browser.close(); srv.close();
  if (erros.length) { erros.forEach(e => console.log('  ✗ erro de página: ' + e)); falhas.push('erros de página'); }
  console.log(falhas.length ? '\n✗ ' + falhas.length + ' falha(s)' : '\n✓ tudo certo');
  process.exit(falhas.length ? 1 : 0);
})();
