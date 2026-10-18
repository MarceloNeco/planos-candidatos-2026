/* Teste do interruptor "colinha" do RootifyONE (Controle dos apps), nas DUAS páginas.
   O arquivo solverone-dados/recursos/eleicoes-2026.json é simulado por page.route.
     - ligado (padrão): a Colinha aparece no início, na barra, no menu de partes e abre em #colinha
     - desligado: some do início, da barra e do menu de partes; #colinha cai em #hub; o aviso "Novidade!" não abre
     - desligado com a página já aberta em #colinha: ao chegar o arquivo novo, volta para #hub
   Uso: node teste/colinha-interruptor.js */
const { chromium, servir, novoContexto, semear, PAGINAS, relatorio } = require('./comum');
const PORTA = process.env.PORTA || 8095, BASE = 'http://localhost:' + PORTA;
const { falhas, conferir } = relatorio();

async function abrir(browser, arq, estado, hash, erros) {
  const ctx = await novoContexto(browser, 1100, []);
  /* a Colinha também some no pós-eleição (calendário): dia fixo no 1º turno, para testar só o interruptor */
  await ctx.clock.setFixedTime(new Date('2026-10-01T15:00:00Z'));
  await semear(ctx, {});   /* sem "novidade-colinha" guardado: o aviso pode abrir */
  const resp = { ligado: estado };
  await ctx.route(BASE + '/solverone-dados/recursos/*.json', r => {
    if (!/eleicoes-2026\.json$/.test(r.request().url()) || resp.ligado === null) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recursos: { colinha: { ligado: resp.ligado } } }) });
  });
  const p = await ctx.newPage(); p.on('pageerror', e => erros.push(arq + ': ' + e.message));
  await p.goto(BASE + '/' + arq + (hash || '')); await p.waitForSelector('#v-hub', { state: 'attached' });
  await p.waitForTimeout(1500);
  return { ctx, p, resp };
}
const estreito = (p) => p.setViewportSize({ width: 400, height: 800 }).then(() => p.waitForTimeout(300));
const visivel = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!(e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null); }, sel);

(async () => {
  const srv = await servir(PORTA);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const erros = [];
  for (const [arq] of PAGINAS) {
    console.log('\n▶ ' + arq);
    /* ligado (sem arquivo: padrão ligado) */
    { const { ctx, p } = await abrir(browser, arq, null, '#hub', erros);
      conferir(await visivel(p, '.hub-ck'), arq + ': ligada: o destaque da Colinha aparece no início');
      /* ligada: o aviso "Novidade!" abre sozinho (janela comum, trava a página); Esc fecha e o teste segue */
      await p.locator('.ck-nov').waitFor({ state: 'visible', timeout: 8000 }); await p.keyboard.press('Escape'); await p.locator('.ck-nov').waitFor({ state: 'detached', timeout: 3000 });
      await p.click('#modo-b'); await p.waitForTimeout(300);
      conferir(await p.evaluate(() => [...document.querySelectorAll('#modo-pop [role=menuitem]')].some(e => getComputedStyle(e).display !== 'none' && /Colinha|cheat sheet/i.test(e.textContent))), arq + ': ligada: a Colinha aparece no menu de partes');
      await estreito(p);
      conferir(await visivel(p, '#modo-seg button.ck'), arq + ': ligada: o botão Colinha aparece na barra (celular)');
      await p.setViewportSize({ width: 1100, height: 800 });
      await p.evaluate(() => { location.hash = '#colinha'; }); await p.waitForTimeout(800);
      conferir(await p.evaluate(() => document.getElementById('v-colinha').classList.contains('on')), arq + ': ligada: #colinha abre a Colinha');
      await ctx.close(); }
    /* desligado desde o começo */
    { const { ctx, p } = await abrir(browser, arq, false, '#hub', erros);
      conferir(!(await visivel(p, '.hub-ck')), arq + ': desligada: some o destaque do início');
      await p.click('#modo-b'); await p.waitForTimeout(300);
      const itens = await p.evaluate(() => [...document.querySelectorAll('#modo-pop [role=menuitem]')].filter(e => getComputedStyle(e).display !== 'none' && /Colinha|cheat sheet/i.test(e.textContent)).length);
      conferir(itens === 0 && await p.evaluate(() => document.querySelectorAll('#modo-pop [role=menuitem]').length) >= 3, arq + ': desligada: some do menu de partes (as outras continuam)');
      await estreito(p);
      conferir(!(await visivel(p, '#modo-seg button.ck')) && await visivel(p, '#modo-seg button[data-m=congresso]'), arq + ': desligada: some o botão da barra (celular), os outros ficam');
      await p.setViewportSize({ width: 1100, height: 800 });
      await p.evaluate(() => { location.hash = '#colinha'; }); await p.waitForTimeout(1000);
      const r = await p.evaluate(() => ({ h: location.hash, on: document.getElementById('v-colinha').classList.contains('on'), hub: document.getElementById('v-hub').classList.contains('on') }));
      conferir(r.h === '#hub' && !r.on && r.hub, arq + ': desligada: #colinha cai no início (' + r.h + ')');
      await p.waitForTimeout(3500);
      conferir(!(await p.$('.ck-nov')), arq + ': desligada: o aviso "Novidade!" não abre');
      await ctx.close(); }
    /* ligada com a página aberta na Colinha; o arquivo muda para desligado */
    { const { ctx, p, resp } = await abrir(browser, arq, true, '#colinha', erros);
      conferir(await p.evaluate(() => document.getElementById('v-colinha').classList.contains('on')), arq + ': aberta direto em #colinha com ela ligada');
      resp.ligado = false;
      await p.evaluate(() => SolverRecursos.atualizar()); await p.waitForTimeout(1200);
      conferir(await p.evaluate(() => location.hash) === '#hub', arq + ': chegou o arquivo desligando: volta para o início sem recarregar');
      await ctx.close(); }
  }
  conferir(erros.length === 0, 'nenhuma tela com erro de JavaScript' + (erros.length ? ' — ' + erros.slice(0, 3).join(' | ') : ''));
  await browser.close(); srv.close();
  if (falhas.length) { console.log('\n' + falhas.length + ' falha(s)'); process.exit(1); }
  console.log('\ntudo certo');
})().catch(e => { console.error(e); process.exit(1); });
