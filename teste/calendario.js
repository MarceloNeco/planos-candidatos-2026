/* Teste do CALENDÁRIO ELEITORAL (v2.5.0), nas DUAS páginas. Só valores de mentira, relógio simulado e nada vai à internet:
     - o arquivo do RootifyONE (solverone-dados/recursos/eleicoes-2026.json) é simulado: interruptor "colinha" e o
       comportamento "eleicao.calendario"
     - o TSE é simulado (ele-c.json com eleições de outro ano e uma suplementar para confundir, e os arquivos dos finalistas)
   Casos: fase 1 · troca de fase no horário de Brasília (aparelho em Tóquio) · fase 2 com estado no 2º turno (RN) e sem
   (SP) · pós-eleição · fase forçada pelo RootifyONE (também com a página aberta) · TSE falhando com lista manual e sem ela ·
   cópia guardada e no máximo 1 ida ao TSE por hora · cola guardada com candidato fora do 2º turno (a do 1º turno fica) ·
   interruptor por cima da fase · padrão de fábrica igual ao do recursos-do-app.json.
   Uso: node teste/calendario.js */
const fs = require('fs'), path = require('path');
const { chromium, servir, novoContexto, semear, PAGINAS, relatorio } = require('./comum');
const PORTA = process.env.PORTA || 8099, BASE = 'http://localhost:' + PORTA;
const { falhas, conferir } = relatorio();
const RAIZ = path.join(__dirname, '..');

/* datas (meio-dia de Brasília = 15h UTC) */
const D = { t1: '2026-10-01T15:00:00Z', t2: '2026-10-18T15:00:00Z', pos: '2026-10-26T15:00:00Z' };
/* ids do TSE de verdade (cola/RN.json e cola/BR.json): finalistas e quem ficou de fora */
const RN = JSON.parse(fs.readFileSync(path.join(RAIZ, 'cola/RN.json'), 'utf8')).c;
const id = (lista, cg, nome) => lista.find(c => c[0] === cg && c[2] === nome)[4];
const BRL = JSON.parse(fs.readFileSync(path.join(RAIZ, 'cola/BR.json'), 'utf8')).c;
const FIN_RN = [id(RN, 'G', 'CADU DE LULA'), id(RN, 'G', 'ALLYSON')], FIN_BR = [id(BRL, 'P', 'FLAVIO BOLSONARO'), id(BRL, 'P', 'LULA')];
const GOV_RN = RN.filter(c => c[0] === 'G').length;

/* o TSE de mentira: mesma forma do ele-c.json e do arquivo unificado (-u.json) de verdade */
const ELE_C = { dg: '15/10/2026', hg: '09:35:49', f: 'o', pl: [
  { cd: '3220', c: 'ele2026', dt: '04/10/2026', e: [
    { cd: '6257', t: '1', tp: '8', nm: 'Eleição Ordinária Federal - 2026 1º Turno', abr: [{ cd: 'br', cp: [{ cd: '1', ds: 'Presidente' }] }] },
    { cd: '6259', t: '1', tp: '1', nm: 'Eleição Ordinária Estadual - 2026 1º Turno', abr: [{ cd: 'br', cp: [{ cd: '3' }, { cd: '5' }, { cd: '6' }, { cd: '7' }, { cd: '8' }] }] }] },
  { cd: '3221', c: 'ele2026', dt: '25/10/2026', e: [
    /* suplementar no mesmo dia, com governador em SP: não pode contar (só eleição ordinária) */
    { cd: '6299', t: '2', tp: '4', nm: 'Eleição Suplementar - Teste', abr: [{ cd: 'sp', cp: [{ cd: '3', ds: 'Governador' }] }] },
    { cd: '6260', t: '2', tp: '1', nm: 'Eleição Ordinária Estadual - 2026 2º Turno', abr: ['ac', 'am', 'df', 'es', 'rn', 'to'].map(u => ({ cd: u, cp: [{ cd: '3', ds: 'Governador' }] })) },
    { cd: '6258', t: '2', tp: '8', nm: 'Eleição Ordinária Federal - 2026 2º Turno', abr: [{ cd: 'br', cp: [{ cd: '1', ds: 'Presidente' }] }] }] },
  /* outro ano, com governador em MG no 2º turno: não pode contar */
  { cd: '453', c: 'ele2022', dt: '30/10/2022', e: [{ cd: '545', t: '2', tp: '1', nm: 'Eleição Ordinária Estadual - 2022 2º Turno', abr: [{ cd: 'mg', cp: [{ cd: '3' }] }] }] }] };
const unificado = ids => ({ ele: '0', t: '2', carg: [{ cd: '3', agr: [{ par: [{ cand: ids.map((x, i) => ({ n: String(10 + i), sqcand: x, nmu: 'X' })) }] }] }] });
const ARQ_TSE = {
  'comum/config/ele-c.json': ELE_C,
  'ele2026/6260/dados/rn/rn-c0003-e006260-u.json': unificado(FIN_RN),
  'ele2026/6258/dados/br/br-c0001-e006258-u.json': unificado(FIN_BR)
};

/* abre a página com o relógio, o RootifyONE e o TSE simulados. o.cal = eleicao.calendario; o.colinha = interruptor;
   o.tse = 'ok' | 'falha' | 'lento'; o.itens = localStorage antes de abrir; o.fuso = fuso do aparelho */
async function abrir(browser, arq, o, erros) {
  let ctx;
  if (o.fuso) {   /* aparelho noutro fuso: contexto próprio (o comum.js usa o fuso da máquina) */
    ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1100, height: 800 }, locale: 'pt-BR', timezoneId: o.fuso, reducedMotion: 'reduce' });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  } else ctx = await novoContexto(browser, o.largura || 1100, []);
  return preparar(ctx, arq, o, erros);
}
async function preparar(ctx, arq, o, erros) {
  await ctx.clock.setFixedTime(new Date(o.data));
  if (o.semGuardar) await ctx.addInitScript(() => {   /* o navegador recusa guardar a cópia do TSE */
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'planos2026:tse') throw new Error('QuotaExceededError'); return orig.call(this, k, v); };
  });
  await semear(ctx, Object.assign({ 'planos2026:prefs': { aoVisto: true, telaCiente: true }, 'planos2026:novidade-colinha': 1 }, o.itens || {}));
  const est = { cal: o.cal === undefined ? null : o.cal, colinha: o.colinha === undefined ? null : o.colinha, tse: o.tse || 'ok', pedidos: [] };
  await ctx.route(BASE + '/solverone-dados/recursos/*.json', r => {
    if (!/eleicoes-2026\.json$/.test(r.request().url())) return r.fulfill({ status: 404, body: '' });
    const j = { recursos: {}, comportamentos: {} };
    if (est.colinha !== null) j.recursos.colinha = { ligado: est.colinha };
    if (est.cal !== null) j.comportamentos['eleicao.calendario'] = est.cal;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
  await ctx.route(/^https:\/\/resultados\.tse\.jus\.br\//, async r => {
    const rel = r.request().url().replace('https://resultados.tse.jus.br/oficial/', '');
    est.pedidos.push(rel);
    if (est.tse === 'falha') return r.abort();
    if (est.tse === 'lento') await new Promise(ok => setTimeout(ok, 2500));
    const j = ARQ_TSE[rel];
    return j ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(j) })
      : r.fulfill({ status: 404, body: 'NoSuchKey' });
  });
  const p = await ctx.newPage(); p.on('pageerror', e => erros.push(arq + ': ' + e.message));
  await p.goto(BASE + '/' + arq + (o.hash || '#colinha')); await p.waitForSelector('#v-hub', { state: 'attached' });
  await p.waitForTimeout(1500);
  return { ctx, p, est };
}
const vagas = p => p.evaluate(() => [...document.querySelectorAll('#v-colinha .ck-slot')].map(e => e.dataset.vaga));
const texto = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].map(e => e.textContent).join(' | '), sel);
const naColinha = p => p.evaluate(() => document.getElementById('v-colinha').classList.contains('on'));
const visivel = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!(e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null); }, sel);
/* abre a escolha de uma vaga e devolve os nomes da lista (e o aviso, se houver); fecha no ✕ */
async function lista(p, vaga) {
  await p.locator('#v-colinha .ck-slot[data-vaga="' + vaga + '"]').click();
  await p.locator('#ck-dlg .ck-it').first().waitFor({ state: 'visible', timeout: 5000 });
  const r = await p.evaluate(() => ({ nomes: [...document.querySelectorAll('#ck-dlg .ck-it .nm b')].map(e => e.textContent), aviso: !!document.querySelector('#ck-dlg .ck-aviso') }));
  await p.click('#ck-dlg .x'); await p.locator('#ck-dlg').waitFor({ state: 'hidden', timeout: 3000 });
  return r;
}
const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const srv = await servir(PORTA);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const erros = [];
  const manifesto = JSON.parse(fs.readFileSync(path.join(RAIZ, 'recursos-do-app.json'), 'utf8'));
  const padraoManifesto = manifesto.comportamentos.find(c => c && c.id === 'eleicao.calendario');

  for (const [arq, lg] of PAGINAS) {
    const L = arq + ': ', en = lg === 'en';
    console.log('\n▶ ' + arq);

    /* padrão de fábrica = o do recursos-do-app.json (o RootifyONE mostra "obedece" pelo id) */
    { const { ctx, p } = await abrir(browser, arq, { data: D.t1, hash: '#hub' }, erros);
      conferir(!!padraoManifesto && iguais(await p.evaluate(() => Calendario.padrao()), padraoManifesto.padrao), L + 'padrão de fábrica do código = o declarado no recursos-do-app.json');
      await ctx.close(); }

    /* 1. fase 1: os seis votos, sem ir ao TSE */
    { const { ctx, p, est } = await abrir(browser, arq, { data: D.t1, itens: { 'planos2026:colinha': { uf: 'SP' } } }, erros);
      conferir(await p.evaluate(() => Calendario.fase()) === 1, L + 'fase 1: até o dia do 1º turno');
      conferir(iguais(await vagas(p), ['F', 'E', 'S1', 'S2', 'G', 'P']), L + 'fase 1: os seis votos na ordem da urna (' + (await vagas(p)).join(' ') + ')');
      conferir(/1º turno em 4 de outubro|first round on 4 October/.test(await texto(p, '#v-colinha .eyebrow')), L + 'fase 1: o cabeçalho diz o 1º turno e a data');
      conferir(est.pedidos.length === 0, L + 'fase 1: não consulta o TSE (' + est.pedidos.length + ' pedidos)');
      await ctx.close(); }

    /* 2. a troca de fase segue o horário de Brasília, com o aparelho em Tóquio */
    for (const [quando, f, rot] of [['2026-10-05T02:30:00Z', 1, '23h30 de 4/Out em Brasília'], ['2026-10-05T03:30:00Z', 2, '0h30 de 5/Out em Brasília'],
      ['2026-10-26T02:59:00Z', 2, '23h59 de 25/Out em Brasília'], ['2026-10-26T03:00:00Z', 'pos', '0h de 26/Out em Brasília']]) {
      const { ctx, p } = await abrir(browser, arq, { data: quando, fuso: 'Asia/Tokyo', hash: '#hub', tse: 'falha' }, erros);
      conferir(await p.evaluate(() => Calendario.fase()) === f, L + 'horário de Brasília com o aparelho em Tóquio: ' + rot + ' → fase ' + f);
      await ctx.close();
    }

    /* 3. fase 2, estado com 2º turno (RN): governador e presidente, só os finalistas */
    { const { ctx, p, est } = await abrir(browser, arq, { data: D.t2, itens: { 'planos2026:colinha': { uf: 'RN' } } }, erros);
      await p.waitForTimeout(800);
      conferir(iguais(await vagas(p), ['G', 'P']), L + 'fase 2 (RN): só governador e presidente (' + (await vagas(p)).join(' ') + ')');
      conferir(/2º turno em 25 de outubro|second round on 25 October/.test(await texto(p, '#v-colinha .eyebrow')), L + 'fase 2: o cabeçalho diz o 2º turno e a data');
      const g = await lista(p, 'G'), pr = await lista(p, 'P');
      conferir(iguais(g.nomes.slice().sort(), ['ALLYSON', 'CADU DE LULA']) && !g.aviso, L + 'fase 2 (RN): governador só com os dois finalistas (' + g.nomes.join(', ') + ')');
      conferir(iguais(pr.nomes.slice().sort(), ['FLAVIO BOLSONARO', 'LULA']) && !pr.aviso, L + 'fase 2: presidente só com os dois finalistas (' + pr.nomes.join(', ') + ')');
      conferir(est.pedidos.filter(u => /ele-c/.test(u)).length === 1 && est.pedidos.length === 3, L + 'fase 2: uma ida ao TSE por arquivo (' + est.pedidos.join(', ') + ')');
      conferir(!(await p.$('#v-colinha .ck-aviso')), L + 'fase 2 com o TSE respondendo: sem aviso de incerteza');
      await ctx.close(); }

    /* 4. fase 2, estado sem 2º turno (SP): só presidente, e diz por quê (a suplementar de mentira em SP não conta) */
    { const { ctx, p, est } = await abrir(browser, arq, { data: D.t2, itens: { 'planos2026:colinha': { uf: 'SP' } } }, erros);
      await p.waitForTimeout(800);
      conferir(iguais(await vagas(p), ['P']), L + 'fase 2 (SP): só presidente (' + (await vagas(p)).join(' ') + ')');
      conferir(/São Paulo não há 2º turno para governador|no round 2 for governor in São Paulo/.test(await texto(p, '#v-colinha .ck-nota')), L + 'fase 2 (SP): avisa que não há 2º turno para governador');
      conferir(!est.pedidos.some(u => /\/sp\//.test(u)), L + 'fase 2 (SP): não busca finalistas onde não há 2º turno');
      await ctx.close(); }

    /* 5. pós-eleição: a Colinha some sozinha, sem ir ao TSE */
    { const { ctx, p, est } = await abrir(browser, arq, { data: D.pos, hash: '#hub', itens: { 'planos2026:novidade-colinha': null } }, erros);
      conferir(await p.evaluate(() => Calendario.fase()) === 'pos', L + 'pós-eleição: depois do último turno');
      conferir(!(await visivel(p, '.hub-ck')), L + 'pós-eleição: some o destaque da Colinha no início');
      conferir(/encerrada|concluded/.test(await texto(p, '#v-hub .eyebrow')), L + 'pós-eleição: o início diz que a eleição acabou');
      await p.evaluate(() => { location.hash = '#colinha'; }); await p.waitForTimeout(900);
      conferir(await p.evaluate(() => location.hash) === '#hub' && !(await naColinha(p)), L + 'pós-eleição: #colinha volta para o início');
      await p.waitForTimeout(2000);
      conferir(!(await p.$('.ck-nov')), L + 'pós-eleição: o aviso "Novidade!" não abre');
      conferir(est.pedidos.length === 0, L + 'pós-eleição: não consulta o TSE');
      await p.setViewportSize({ width: 400, height: 800 }); await p.waitForTimeout(300);
      conferir(!(await visivel(p, '#modo-seg button.ck')) && await visivel(p, '#modo-seg button[data-m=congresso]'), L + 'pós-eleição: some o botão da barra do celular, os outros ficam');
      await ctx.close(); }

    /* 6. fase forçada pelo RootifyONE */
    { const { ctx, p } = await abrir(browser, arq, { data: D.t2, cal: { fase: '1' }, itens: { 'planos2026:colinha': { uf: 'RN' } } }, erros);
      conferir(iguais(await vagas(p), ['F', 'E', 'S1', 'S2', 'G', 'P']), L + 'fase forçada "1" no 2º turno: volta a Colinha do 1º turno, com os seis votos');
      await ctx.close(); }
    { const { ctx, p } = await abrir(browser, arq, { data: D.t2, cal: { fase: 'pos' } }, erros);
      conferir(await p.evaluate(() => location.hash) === '#hub' && !(await visivel(p, '.hub-ck')), L + 'fase forçada "pos" no 2º turno: a Colinha some');
      await ctx.close(); }
    { const { ctx, p } = await abrir(browser, arq, { data: D.pos, cal: { fase: '2' }, hash: '#hub', itens: { 'planos2026:colinha': { uf: 'RN' } } }, erros);
      conferir(await visivel(p, '.hub-ck'), L + 'fase forçada "2" depois da eleição: a Colinha volta ao início');
      await p.evaluate(() => { location.hash = '#colinha'; }); await p.waitForTimeout(1200);
      conferir(await naColinha(p) && iguais(await vagas(p), ['G', 'P']), L + 'fase forçada "2" depois da eleição: abre a Colinha do 2º turno');
      await ctx.close(); }
    { const { ctx, p, est } = await abrir(browser, arq, { data: D.t2, itens: { 'planos2026:colinha': { uf: 'RN' } } }, erros);
      est.cal = { fase: '1' }; await p.evaluate(() => SolverRecursos.atualizar()); await p.waitForTimeout(1200);
      conferir(iguais(await vagas(p), ['F', 'E', 'S1', 'S2', 'G', 'P']), L + 'fase forçada com a página aberta: a Colinha troca sozinha, sem recarregar');
      est.cal = { fase: 'pos' }; await p.evaluate(() => SolverRecursos.atualizar()); await p.waitForTimeout(1200);
      conferir(await p.evaluate(() => location.hash) === '#hub', L + 'fase "pos" chegando com a página aberta: volta para o início');
      await ctx.close(); }

    /* 7. TSE falhando, com a lista manual do RootifyONE */
    { const { ctx, p } = await abrir(browser, arq, { data: D.t2, tse: 'falha', cal: { segundoTurno: { G: ['RN'] } }, itens: { 'planos2026:colinha': { uf: 'RN' } } }, erros);
      await p.waitForTimeout(800);
      conferir(iguais(await vagas(p), ['G', 'P']), L + 'TSE falhando + lista manual (RN): governador e presidente aparecem');
      const g = await lista(p, 'G');
      conferir(g.nomes.length === GOV_RN && g.aviso, L + 'TSE falhando + lista manual: sem finalistas, todos os ' + GOV_RN + ' candidatos com o aviso "confira na urna"');
      conferir(/Não consegui confirmar no TSE|Could not confirm with the electoral court/.test(await texto(p, '#v-colinha .ck-aviso')), L + 'TSE falhando: a Colinha avisa na tela');
      await p.selectOption('#ck-uf', 'SP'); await p.waitForTimeout(1200);
      conferir(iguais(await vagas(p), ['P']) && /São Paulo/.test(await texto(p, '#v-colinha .ck-nota')), L + 'TSE falhando + lista manual: em SP (fora da lista) só presidente');
      await ctx.close(); }

    /* 8. TSE falhando, sem lista manual e sem cópia guardada */
    { const { ctx, p } = await abrir(browser, arq, { data: D.t2, tse: 'falha', itens: { 'planos2026:colinha': { uf: 'SP' } } }, erros);
      await p.waitForTimeout(800);
      conferir(iguais(await vagas(p), ['G', 'P']), L + 'TSE falhando sem lista manual: governador e presidente aparecem');
      conferir(/Não consegui confirmar no TSE|Could not confirm with the electoral court/.test(await texto(p, '#v-colinha .ck-aviso')), L + 'TSE falhando sem lista manual: avisa "confira na urna"');
      const pr = await lista(p, 'P');
      conferir(pr.nomes.length === BRL.filter(c => c[0] === 'P').length && pr.aviso, L + 'TSE falhando sem lista manual: presidente com todos os candidatos e o aviso');
      await ctx.close(); }

    /* 9. cópia guardada e no máximo uma ida ao TSE por hora */
    { const { ctx, p, est } = await abrir(browser, arq, { data: D.t2, itens: { 'planos2026:colinha': { uf: 'RN' } } }, erros);
      await p.waitForTimeout(800);
      const n1 = est.pedidos.length;
      await ctx.clock.setFixedTime(new Date(Date.parse(D.t2) + 40 * 60000)); await p.reload(); await p.waitForTimeout(1800);
      conferir(est.pedidos.length === n1 && iguais(await vagas(p), ['G', 'P']), L + '40 min depois: não volta ao TSE e usa a cópia guardada (' + (est.pedidos.length - n1) + ' pedidos novos)');
      est.tse = 'lento';
      await ctx.clock.setFixedTime(new Date(Date.parse(D.t2) + 61 * 60000)); await p.reload(); await p.waitForTimeout(1200);
      const g = await lista(p, 'G');
      conferir(iguais(g.nomes.slice().sort(), ['ALLYSON', 'CADU DE LULA']) && !(await p.$('#v-colinha .ck-aviso')), L + '61 min depois, TSE lento: a cópia guardada vale enquanto a nova não chega (tela sem travar)');
      await p.waitForTimeout(5500);
      conferir(est.pedidos.length === n1 * 2, L + '61 min depois: volta ao TSE uma vez por arquivo (' + (est.pedidos.length - n1) + ' pedidos novos)');
      est.tse = 'falha';
      await ctx.clock.setFixedTime(new Date(Date.parse(D.t2) + 130 * 60000)); await p.reload(); await p.waitForTimeout(1500);
      conferir(iguais(await vagas(p), ['G', 'P']) && !(await p.$('#v-colinha .ck-aviso')), L + 'TSE fora do ar com cópia guardada: segue com a cópia, sem aviso');
      await ctx.close(); }

    /* 9b. navegador que não deixa guardar a cópia do TSE: o limite de 1 ida por hora vale na memória da página */
    { const { ctx, p, est } = await abrir(browser, arq, { data: D.t2, itens: { 'planos2026:colinha': { uf: 'RN' } }, semGuardar: true }, erros);
      await p.waitForTimeout(800);
      const n1 = est.pedidos.length;
      await p.evaluate(() => { location.hash = '#hub'; }); await p.waitForTimeout(400);
      await p.evaluate(() => { location.hash = '#colinha'; }); await p.waitForTimeout(1200);
      conferir(n1 === 3 && est.pedidos.length === n1 && iguais(await vagas(p), ['G', 'P']), L + 'sem poder guardar no aparelho: não volta ao TSE ao reabrir a Colinha e mostra os finalistas (' + est.pedidos.length + ' pedidos)');
      await ctx.close(); }

    /* 10. cola guardada (da 2.4.0) com candidato fora do 2º turno */
    { const F = RN.find(c => c[0] === 'F'), S = RN.filter(c => c[0] === 'S');
      const antiga = { uf: 'RN', esc: { F: ['RN', F[4]], S1: ['RN', S[0][4]], S2: ['RN', S[1][4]], G: ['RN', id(RN, 'G', 'ÁLVARO DIAS')], P: ['BR', FIN_BR[1]] } };
      const { ctx, p } = await abrir(browser, arq, { data: D.t2, itens: { 'planos2026:colinha': antiga } }, erros);
      await p.waitForTimeout(800);
      conferir(/ÁLVARO DIAS não está no 2º turno|ÁLVARO DIAS is not in round 2/.test(await texto(p, '#v-colinha .ck-slot[data-vaga=G] .ck-fora')), L + 'cola guardada: governador fora do 2º turno → "não está no 2º turno. Escolha de novo."');
      conferir(/LULA/.test(await texto(p, '#v-colinha .ck-slot[data-vaga=P] b')), L + 'cola guardada: presidente que está no 2º turno continua escolhido');
      await p.locator('#v-colinha .ck-slot[data-vaga=G]').click(); await p.locator('#ck-dlg .ck-it').first().waitFor();
      await p.locator('#ck-dlg .ck-it', { hasText: 'ALLYSON' }).click(); await p.waitForTimeout(600);
      const st = await p.evaluate(() => JSON.parse(localStorage.getItem('planos2026:colinha')));
      conferir(iguais(st.por['2026-1'], antiga.esc) && !st.esc, L + 'cola guardada: a do 1º turno continua inteira (agora em por["2026-1"])');
      conferir(iguais(st.por['2026-2'], { G: ['RN', FIN_RN[1]] }), L + 'cola guardada: a escolha nova vai só para a cola do 2º turno');
      conferir(/ALLYSON/.test(await texto(p, '#v-colinha .ck-slot[data-vaga=G] b')), L + 'cola guardada: depois de escolher de novo, a vaga mostra o finalista');
      await ctx.close();
      /* a mesma pessoa vendo a fase 1 (forçada): a cola do 1º turno aparece como ela deixou */
      const r = await abrir(browser, arq, { data: D.t2, cal: { fase: '1' }, itens: { 'planos2026:colinha': st } }, erros);
      conferir(/ÁLVARO DIAS/.test(await texto(r.p, '#v-colinha .ck-slot[data-vaga=G] b')) && /LULA/.test(await texto(r.p, '#v-colinha .ck-slot[data-vaga=P] b')), L + 'cola guardada: a Colinha do 1º turno mostra a cola dela, sem mudança');
      await r.ctx.close(); }

    /* 11. o interruptor vale por cima da fase */
    { const { ctx, p } = await abrir(browser, arq, { data: D.t2, colinha: false, hash: '#hub' }, erros);
      conferir(!(await visivel(p, '.hub-ck')), L + 'interruptor desligado no 2º turno: a Colinha some');
      await ctx.close(); }
    { const { ctx, p } = await abrir(browser, arq, { data: D.t2, colinha: true, hash: '#hub' }, erros);
      conferir(await visivel(p, '.hub-ck'), L + 'interruptor religado no 2º turno: a Colinha volta');
      await ctx.close(); }
    { const { ctx, p } = await abrir(browser, arq, { data: D.pos, colinha: true, hash: '#hub' }, erros);
      conferir(!(await visivel(p, '.hub-ck')), L + 'pós-eleição com o interruptor ligado: continua escondida (para mostrar, force a fase no calendário)');
      await ctx.close(); }

    /* 12. aba Mandato da Presidência: a posse e as datas vêm do calendário */
    { const { ctx, p } = await abrir(browser, arq, { data: D.t2, hash: '#mandato', cal: { posse: '2027-01-06' } }, erros);
      await p.waitForTimeout(1500);
      const t = await texto(p, '#v-mandato');
      conferir(/25\/Out\/2026|Oct\/25\/2026/.test(t) && /Aguardando posse|Awaiting inauguration/.test(t), L + 'aba Mandato: data do 2º turno e "aguardando posse" pelo calendário');
      conferir(await p.evaluate(() => Calendario.posse()) === '2027-01-06', L + 'aba Mandato: a posse vem do RootifyONE quando ele manda');
      await ctx.close(); }
  }
  conferir(erros.length === 0, 'nenhuma tela com erro de JavaScript' + (erros.length ? ' — ' + erros.slice(0, 3).join(' | ') : ''));
  await browser.close(); srv.close();
  if (falhas.length) { console.log('\n' + falhas.length + ' falha(s)'); process.exit(1); }
  console.log('\ntudo certo');
})().catch(e => { console.error(e); process.exit(1); });
