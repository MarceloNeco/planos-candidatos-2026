/* =====================================================================
   JANELA COMUM  —  janela.js  (SolverJanela 1.0.1, 17/Out/2026)
   ---------------------------------------------------------------------
   POR QUE ESTE ARQUIVO EXISTE
   No celular, com uma janela aberta (o PIN do cofre, um aviso, uma confirmação), arrastar o dedo fora
   dela rolava a página de trás. A regra da plataforma (diretriz "Janelas (pop-ups)", 17/Out/2026) vale
   para TODA janela de TODO app: enquanto ela está aberta, só ela responde. Este arquivo é o jeito único
   de fazer isso, igual em todos os apps, inclusive nos que não têm o módulo comum (Eleições, MoneyTRIO,
   RiseONE, Leitor OCR). O diretrizes.js e o cofre.js usam este arquivo.

   COMO FUNCIONA (o próprio navegador faz quase tudo)
   - Toda janela é um <dialog> aberto com showModal(): o navegador deixa o resto da página inerte
     (sem toque, sem foco, sem leitor de tela), prende o foco dentro da janela e devolve o foco ao
     botão que abriu quando ela fecha.
   - A rolagem: enquanto houver <dialog class="sj"> aberto, html e body não rolam (regra CSS com :has)
     e o que está dentro da janela tem overscroll-behavior: contain. Janela mais alta que a tela rola
     só por dentro (quem monta o conteúdo deixa a caixa com max-height e overflow:auto).
   - Três saídas em toda janela: o botão da própria janela (quem monta põe o ✕ ou "Cancelar"), Esc e o
     Voltar do celular. Tocar na parte escura fora da caixa vale como "cancelar". O <dialog> leva
     closedby="any" (o jeito oficial do HTML); onde ele ainda não existe, o clique cujo alvo é o próprio
     <dialog> (a parte escura) faz o mesmo.
   - Algo digitado e não salvo: tocar fora, Esc ou Voltar perguntam "Descartar o que você digitou?"
     (Descartar / Continuar) em vez de jogar fora em silêncio. A janela descobre sozinha se algo foi
     digitado (campos de texto; senha e PIN não contam) ou o app diz com temTexto.
   - Uma janela por vez: a segunda espera a primeira fechar. Lista FECHADA do que abre por cima da janela aberta
     (porCima: true): a pergunta "Descartar?", o PIN do cofre quando a própria janela precisa dele e a confirmação
     curta pedida pela própria janela ("Excluir?", "Tem certeza?"; papel alertdialog, sem "Descartar?" nela).
     O que abre por cima fecha junto com a janela de baixo. Nada mais empilha.
   - Ao fechar, a página fica exatamente onde estava (mesma rolagem) e o foco volta ao botão que abriu.
   - Voltar do celular: cada janela ganha uma entrada no histórico; o Voltar fecha só a janela de cima
     (e não chega ao app, que não confunde com "voltar de tela"). Fechar por outro jeito tira a entrada.
   - Única exceção escrita da regra "nenhuma janela sem saída": o pop-up de anúncio com contagem
     visível 3, 2, 1 (opção espera). Passada a contagem, todas as saídas valem.

   1.0.1 (17/Out/2026, pedido do dono): tocar fora só fecha se o toque COMEÇOU e TERMINOU na parte escura
   (antes, arrastar de dentro da caixa e soltar fora contava como "cancelar"); SolverJanela.quandoQuieto(fn).

   USO
       var j = SolverJanela.abrir({
         conteudo: caixa,               // o que vai dentro (a caixa com título, texto e botões)
         classe: 'dgo-modal',           // aparência (o fundo escuro e o centro ficam no CSS de quem usa)
         aoFechar: function (motivo, como) {},   // motivo: 'cancelar' (fora/Esc/Voltar) ou o que o app passou em j.fechar()
         temTexto: function () { return false; },// opcional: o app diz se há texto não salvo
         porCima: false,                // só a lista fechada: "Descartar?", o PIN do cofre e a confirmação curta
         espera: { segundos: 3, botao: botaoX }   // só o anúncio
       });
       j.fechar('salvo');  j.trocar(novaCaixa);  j.pedirFechar();  SolverJanela.aberta();
       SolverJanela.quandoQuieto(fn);   // roda fn depois que o histórico acompanhou (ex.: trocar de tela ao fechar)

   ORDEM NA PÁGINA (antes de tudo que abre janela):
       <script src="janela.js"></script>
       <script src="cofre.js"></script>
       <script src="diretrizes.js"></script>

   ARQUIVO MASTER: mora no rootify-one e vai IGUAL para todos os apps. Não editar a cópia de um app;
   mudar aqui e copiar. Sem sintaxe moderna que quebre navegador velho.
   ===================================================================== */
(function (raiz) {
  'use strict';
  if (raiz.SolverJanela && raiz.SolverJanela.__carregado) return;

  var VERSAO = '1.0.1';
  var d = raiz.document;

  var TX = {
    descartarTit: ['Descartar o que você digitou?', 'Discard what you typed?'],
    descartarTxt: ['O que foi digitado nesta janela ainda não foi salvo.', 'What you typed in this window has not been saved yet.'],
    descartar: ['Descartar', 'Discard'],
    continuar: ['Continuar', 'Keep editing'],
    fechar: ['Fechar', 'Close']
  };
  function lingua() {
    try { if (raiz.DGO && typeof raiz.DGO.idioma === 'function') return raiz.DGO.idioma() === 'en' ? 'en' : 'pt'; } catch (e) {}
    var l = (d.documentElement.getAttribute('lang') || '').toLowerCase();
    if (l) return l.indexOf('en') === 0 ? 'en' : 'pt';
    try { var g = JSON.parse(raiz.localStorage.getItem('dgo:global:idioma') || 'null'); if (g) return g === 'en' ? 'en' : 'pt'; } catch (e2) {}
    return 'pt';
  }
  function t(k) { var v = TX[k]; return v ? v[lingua() === 'en' ? 1 : 0] : k; }

  /* ------------------------------------------------------------------
     1. ESTILO — só o que faz a regra valer; a aparência é de quem usa.
     :where() deixa estas regras com peso zero: a classe do app (ex.: .dgo-modal) sempre manda no visual.
     ------------------------------------------------------------------ */
  function estilo() {
    if (d.getElementById('solver-janela-estilo')) return;
    var s = d.createElement('style'); s.id = 'solver-janela-estilo';
    s.textContent = [
      ':where(dialog.sj){position:fixed;inset:0;width:100%;height:100%;max-width:100%;max-height:100%;margin:0;padding:0;border:0;',
      'background:transparent;color:inherit;overflow:hidden;overscroll-behavior:contain;box-sizing:border-box}',
      ':where(dialog.sj)::backdrop{background:transparent}',
      ':where(dialog.sj *){overscroll-behavior:contain}',
      ':where(dialog.sj:focus){outline:none}',
      /* a trava da rolagem da página de trás: vale enquanto houver uma janela aberta */
      'html:has(dialog.sj[open]),html:has(dialog.sj[open]) body{overflow:hidden}',
      /* a pergunta "Descartar?" (não depende de nenhum outro arquivo) */
      ':where(dialog.sj-pergunta){display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,.55);',
      '--sj-f:#fff;--sj-t:#0f172a;--sj-t2:#475569;--sj-l:#cbd5e1;--sj-c:#b91c1c;--sj-ct:#fff}',
      '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) :where(dialog.sj-pergunta){--sj-f:#111a2b;--sj-t:#e8edf6;--sj-t2:#b9c3d6;--sj-l:#34456a;--sj-c:#f87171;--sj-ct:#1f0a0a}}',
      ':root[data-theme="dark"] :where(dialog.sj-pergunta){--sj-f:#111a2b;--sj-t:#e8edf6;--sj-t2:#b9c3d6;--sj-l:#34456a;--sj-c:#f87171;--sj-ct:#1f0a0a}',
      '.sj-caixa{background:var(--sj-f);color:var(--sj-t);width:100%;max-width:380px;max-height:calc(100% - 8px);overflow:auto;border-radius:14px;',
      'padding:18px;box-sizing:border-box;font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.4)}',
      '.sj-caixa h2{font-size:1.1rem;margin:0 0 .4rem}.sj-caixa p{margin:0;color:var(--sj-t2)}',
      '.sj-botoes{display:flex;flex-wrap:wrap;gap:8px;margin-top:1rem}',
      '.sj-b{flex:1 1 120px;min-height:44px;padding:8px 14px;border-radius:10px;border:1px solid var(--sj-c);background:var(--sj-c);color:var(--sj-ct);',
      'font:600 16px system-ui,sans-serif;cursor:pointer}',
      '.sj-b2{background:transparent;color:var(--sj-t);border-color:var(--sj-l)}',
      '.sj-caixa :focus-visible{outline:3px solid #f59e0b;outline-offset:2px}'
    ].join('');
    (d.head || d.documentElement).appendChild(s);
  }

  /* ------------------------------------------------------------------
     2. ESTADO
     pilha = janelas abertas (a de cima por último); fila = esperando a vez (regra 6).
     engolir = quantos "voltar" foram pedidos por nós (fechar sem ser pelo Voltar tira a entrada do
     histórico); enquanto eles não chegam, o próximo passo espera (o histórico é assíncrono).
     ------------------------------------------------------------------ */
  var pilha = [], fila = [], seq = 0, engolir = 0, depois = [];
  function topo() { return pilha.length ? pilha[pilha.length - 1] : null; }
  function aposVolta(fn) { if (engolir > 0) depois.push(fn); else fn(); }
  function correrDepois() { while (engolir === 0 && depois.length) { var f = depois.shift(); try { f(); } catch (e) {} } }
  function voltarUma() { engolir++; try { raiz.history.back(); } catch (e) { engolir--; } }
  function estado(nivel) { return { sjNivel: nivel }; }
  function nivelAtual() { var s = null; try { s = raiz.history.state; } catch (e) {} return (s && s.sjNivel) || 0; }
  function dedoGrosso() { try { return raiz.matchMedia('(hover: none) and (pointer: coarse)').matches; } catch (e) { return false; } }

  /* campo em que a pessoa digita conteúdo (senha e PIN não contam: perder um PIN digitado não faz falta).
     Um campo de senha que guarda conteúdo de valor (ex.: a chave de IA colada) entra com data-sj-texto. */
  var TIPOS_TEXTO = { text: 1, search: 1, email: 1, url: 1, tel: 1, number: 1, '': 1 };
  function campoDeTexto(n) {
    if (!n || n.nodeType !== 1) return false;
    if (n.hasAttribute('data-sj-texto')) return true;
    if (n.isContentEditable) return true;
    if (n.tagName === 'TEXTAREA') return !n.readOnly;
    if (n.tagName === 'INPUT') return !n.readOnly && !!TIPOS_TEXTO[(n.getAttribute('type') || '').toLowerCase()];
    return false;
  }

  /* ------------------------------------------------------------------
     3. ABRIR / FECHAR
     ------------------------------------------------------------------ */
  function criar(opcoes) {
    var J = { id: ++seq, opcoes: opcoes, aberta: false, fechada: false, sujo: false, temEntrada: false, esperando: false };
    var dlg = d.createElement('dialog');
    dlg.className = ('sj ' + (opcoes.classe || '')).trim();
    dlg.setAttribute('closedby', 'any');
    dlg.setAttribute('tabindex', '-1');
    if (opcoes.id) dlg.id = opcoes.id;
    if (opcoes.papel === 'alertdialog') dlg.setAttribute('role', 'alertdialog');
    if (opcoes.atributos) Object.keys(opcoes.atributos).forEach(function (k) { dlg.setAttribute(k, opcoes.atributos[k]); });
    J.el = dlg;
    colocar(J, opcoes.conteudo);

    /* Esc: tratado aqui (sem deixar o navegador fechar sozinho) para a pergunta "Descartar?" valer sempre */
    dlg.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      e.preventDefault(); e.stopPropagation();
      pedirFechar(J, 'esc');
    });
    /* pedido de fechar que o navegador manda (Esc, Voltar do Android, closedby): vira "cancelar" pelo mesmo caminho */
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); pedirFechar(J, 'esc'); });
    /* toque na parte escura: precisa COMEÇAR e TERMINAR no próprio <dialog> (a parte escura). Arrastar de dentro da
       caixa (ex.: selecionando texto) e soltar fora não fecha; começar fora e soltar dentro também não (nesse caso o
       navegador manda o click para o <dialog>, o "pai" dos dois, por isso confere onde o dedo desceu e onde saiu). */
    dlg.addEventListener('pointerdown', function (e) { J.alvoInicio = e.target; J.alvoFim = null; }, true);
    dlg.addEventListener('pointerup', function (e) { J.alvoFim = e.target; }, true);
    dlg.addEventListener('click', function (e) {
      var comecou = J.alvoInicio, terminou = J.alvoFim; J.alvoInicio = J.alvoFim = null;
      if (e.target === dlg && comecou === dlg && (terminou === dlg || terminou === null)) pedirFechar(J, 'fora');
    });
    dlg.addEventListener('input', function (e) { if (campoDeTexto(e.target)) J.sujo = true; }, true);
    /* fechou por um caminho que não passou por aqui (raro): termina igual, sem deixar nada para trás */
    dlg.addEventListener('close', function () { if (!J.fechada && J.aberta) fechar(J, 'cancelar', 'navegador'); });

    J.fechar = function (motivo) { fechar(J, motivo || 'fechar', 'app'); };
    J.pedirFechar = function (como) { return pedirFechar(J, como || 'app'); };
    J.trocar = function (conteudo) { colocar(J, conteudo); J.sujo = false; };
    J.salvo = function () { J.sujo = false; };
    return J;
  }

  function colocar(J, conteudo) {
    var dlg = J.el;
    while (dlg.firstChild) dlg.removeChild(dlg.firstChild);
    if (conteudo) dlg.appendChild(conteudo);
    /* nome da janela para o leitor de tela: o que o app passou, ou o primeiro título de dentro */
    if (J.opcoes.rotulo) { dlg.setAttribute('aria-label', J.opcoes.rotulo); dlg.removeAttribute('aria-labelledby'); return; }
    var tit = J.opcoes.rotuloDe ? d.getElementById(J.opcoes.rotuloDe) || dlg.querySelector('#' + J.opcoes.rotuloDe) : dlg.querySelector('h1,h2,h3');
    if (tit) { if (!tit.id) tit.id = 'sj-tit-' + J.id; dlg.setAttribute('aria-labelledby', tit.id); dlg.removeAttribute('aria-label'); }
  }

  function mostrar(J) {
    if (J.fechada) return;
    estilo();
    J.antes = d.activeElement;
    J.rolagem = [raiz.scrollX || raiz.pageXOffset || 0, raiz.scrollY || raiz.pageYOffset || 0];
    var dlg = J.el;
    /* no celular o teclado não abre sozinho: o foco fica na própria janela, a não ser que o app peça um campo */
    var focar = J.opcoes.focar;
    if (focar === false || (!focar && dedoGrosso())) dlg.setAttribute('autofocus', '');
    d.body.appendChild(dlg);
    try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
    J.aberta = true;
    pilha.push(J); J.nivel = pilha.length;
    try { raiz.history.pushState(estado(J.nivel), ''); J.temEntrada = true; } catch (e2) {}
    if (focar && focar.focus) { try { focar.focus(); } catch (e3) {} }
    else if (dlg.hasAttribute('autofocus') && d.activeElement !== dlg) { try { dlg.focus(); } catch (e4) {} }
    if (J.opcoes.espera) contar(J);
    avisar('janela:aberta', J);
  }

  /* a contagem do anúncio (única exceção): enquanto ela corre, nenhuma saída fecha; depois, todas */
  function contar(J) {
    var e = J.opcoes.espera, bt = e.botao, resta = Math.max(0, Math.round(e.segundos || 0));
    if (!resta) return;
    J.esperando = true;
    if (bt) { bt.disabled = true; bt.textContent = String(resta); }
    J.relogio = raiz.setInterval(function () {
      resta--;
      if (resta > 0) { if (bt) bt.textContent = String(resta); return; }
      raiz.clearInterval(J.relogio); J.relogio = 0; J.esperando = false;
      if (bt) { bt.disabled = false; bt.textContent = '×'; if (bt.classList) bt.classList.add('dgo-pronto', 'sj-pronto'); }
      if (typeof e.aoTerminar === 'function') { try { e.aoTerminar(); } catch (er) {} }
    }, 1000);
  }

  function temTexto(J) {
    var f = J.opcoes.temTexto;
    if (f === false) return false;
    if (typeof f === 'function') { try { return !!f(); } catch (e) { return false; } }
    return J.sujo;
  }

  /* o caminho de toda saída que não é o app fechando de propósito: devolve true se fechou agora */
  function pedirFechar(J, como) {
    if (!J.aberta || J.fechada || J !== topo() || J.esperando || J.perguntando) return false;
    if (temTexto(J)) {
      J.perguntando = true;
      perguntarDescartar(function (descartar) {
        J.perguntando = false;
        if (descartar) fechar(J, 'cancelar', como);
      });
      return false;
    }
    fechar(J, 'cancelar', como);
    return true;
  }

  function perguntarDescartar(responder) {
    var respondeu = false;
    function fim(sim) { if (respondeu) return; respondeu = true; responder(sim); }
    var bD = el('button', { type: 'button', class: 'sj-b', 'data-sj': 'descartar', texto: t('descartar') });
    var bC = el('button', { type: 'button', class: 'sj-b sj-b2', 'data-sj': 'continuar', texto: t('continuar') });
    var caixa = el('div', { class: 'sj-caixa' }, [el('h2', { texto: t('descartarTit') }), el('p', { texto: t('descartarTxt') }),
      el('div', { class: 'sj-botoes' }, [bC, bD])]);
    var P = abrir({ conteudo: caixa, classe: 'sj-pergunta', papel: 'alertdialog', porCima: true, temTexto: false, focar: bC,
      aoFechar: function (motivo) { fim(motivo === 'descartar'); } });
    /* "Descartar" fecha esta pergunta e, depois que o histórico acompanhar, a janela de baixo */
    bD.addEventListener('click', function () { P.fechar('descartar'); });
    bC.addEventListener('click', function () { P.fechar('continuar'); });
  }

  function fechar(J, motivo, como) {
    if (J.fechada) return;
    J.fechada = true;
    var naFila = fila.indexOf(J);
    if (naFila !== -1) { fila.splice(naFila, 1); chamarAoFechar(J, motivo, como); return; }
    if (!J.aberta) { chamarAoFechar(J, motivo, como); return; }
    /* as janelas de cima (a pergunta "Descartar?", o PIN) fecham junto */
    var i = pilha.indexOf(J);
    while (pilha.length - 1 > i) fechar(topo(), 'cancelar', 'baixo');
    pilha.splice(i, 1);
    J.aberta = false;
    if (J.relogio) { raiz.clearInterval(J.relogio); J.relogio = 0; }
    try { if (J.el.open) J.el.close(); } catch (e) {}
    if (J.el.parentNode) J.el.parentNode.removeChild(J.el);
    /* a página fica onde estava e o foco volta a quem abriu (o navegador já faz; aqui só garante) */
    try {
      var r = J.rolagem || [0, 0];
      if ((raiz.scrollX || 0) !== r[0] || (raiz.scrollY || 0) !== r[1]) raiz.scrollTo(r[0], r[1]);
    } catch (e2) {}
    try {
      if (J.antes && J.antes.focus && J.antes.isConnected !== false && d.activeElement !== J.antes && !topo()) J.antes.focus({ preventScroll: true });
    } catch (e3) {}
    /* tira a entrada do histórico (se ela ainda for a de cima) quando fechou por outro jeito que não o Voltar */
    if (J.temEntrada) {
      J.temEntrada = false;
      aposVolta(function () { if (nivelAtual() === J.nivel) voltarUma(); });
    }
    chamarAoFechar(J, motivo, como);
    avisar('janela:fechada', J, motivo);
    /* a próxima da fila só abre quando não sobrou nenhuma (regra 6) e depois que o histórico acompanhou */
    aposVolta(function () { if (!pilha.length && fila.length) mostrar(fila.shift()); });
  }

  function chamarAoFechar(J, motivo, como) {
    if (typeof J.opcoes.aoFechar === 'function') { try { J.opcoes.aoFechar(motivo, como); } catch (e) { try { console.error(e); } catch (e2) {} } }
  }

  function abrir(opcoes) {
    opcoes = opcoes || {};
    var J = criar(opcoes);
    if (topo() && !opcoes.porCima) { fila.push(J); return J; }
    aposVolta(function () { if (topo() && !opcoes.porCima) fila.push(J); else mostrar(J); });
    return J;
  }

  /* ------------------------------------------------------------------
     4. VOLTAR DO CELULAR
     Fica na frente dos outros (capture, carregado antes do app): o Voltar que fecha uma janela não
     chega ao app; o "voltar" que nós mesmos pedimos para tirar a entrada também não.
     ------------------------------------------------------------------ */
  raiz.addEventListener('popstate', function (ev) {
    if (engolir > 0) {
      engolir--;
      ev.stopImmediatePropagation();
      correrDepois();
      return;
    }
    var J = topo();
    if (!J || J.nivel <= nivelAtual()) return;      /* não era uma janela nossa: o app cuida */
    ev.stopImmediatePropagation();
    J.temEntrada = false;                           /* o Voltar já tirou a entrada */
    /* vai continuar aberta (contagem do anúncio) ou vai perguntar "Descartar?": a entrada volta antes,
       para a pergunta ficar acima dela no histórico */
    if (J.esperando || J.perguntando || temTexto(J)) { try { raiz.history.pushState(estado(J.nivel), ''); J.temEntrada = true; } catch (e) {} }
    pedirFechar(J, 'voltar');
  }, true);

  /* ------------------------------------------------------------------
     5. AJUDANTES E API PÚBLICA (global SolverJanela)
     ------------------------------------------------------------------ */
  function el(tag, at, filhos) {
    var n = d.createElement(tag);
    Object.keys(at || {}).forEach(function (k) {
      var v = at[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'texto') n.textContent = v;
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(typeof f === 'string' ? d.createTextNode(f) : f); });
    return n;
  }
  function avisar(nome, J, motivo) {
    try { d.dispatchEvent(new CustomEvent(nome, { detail: { id: J.id, classe: J.opcoes.classe || '', motivo: motivo || '' } })); } catch (e) {}
  }

  raiz.SolverJanela = {
    __carregado: true,
    versao: VERSAO,
    abrir: abrir,
    /* a janela de cima (ou null) */
    aberta: function () { return topo(); },
    quantas: function () { return pilha.length; },
    /* roda fn quando o histórico já acompanhou o que fechou (ex.: trocar de tela logo depois de fechar) */
    quandoQuieto: function (fn) { aposVolta(fn); },
    esperando: function () { return fila.length; }
  };
})(typeof window !== 'undefined' ? window : this);
