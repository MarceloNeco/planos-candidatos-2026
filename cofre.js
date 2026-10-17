/* =====================================================================
   COFRE COMUM DE CHAVES  —  cofre.js  (SolverCofre 1.4.0, 17/Out/2026)
   ---------------------------------------------------------------------
   POR QUE ESTE ARQUIVO EXISTE
   Todos os apps da SolverONE moram no MESMO endereço (solverone.com.br/<app>/).
   Até aqui, cada app guardava as chaves de IA (e o token do Telegram) em texto
   aberto no navegador, em 4 lugares diferentes. Qualquer cópia do navegador,
   backup ou extensão curiosa lia tudo. Agora existe UM cofre só, igual em todos
   os apps: as chaves ficam embaralhadas aqui no aparelho e só abrem com o PIN.

   1.4.0 (17/Out/2026, pedido do dono): (1) a janela do PIN passa pela janela comum (janela.js, SolverJanela):
   a página de trás não rola nem recebe toque, e tocar fora, Esc ou Voltar valem "Agora não" (o PIN digitado pela
   metade não pergunta "Descartar?"). Sem o janela.js na página, o cofre avisa no console e abre do jeito antigo.
   (2) As regras do PIN do Contador 1.25 viram uma opção de todo app: SolverCofre.proteger({...}) → com chave
   guardada, pede o PIN ao abrir e ao recarregar (F5); tranca ao sair do app (fechar, recarregar, ir para outro
   site ou outro app), com o app escondido por mais de 1 minuto e com 5 minutos sem uso ("ocupado" só adia este
   último). Passar de uma página para outra do MESMO app não pede o PIN de novo. Quem não guarda chave nunca vê o PIN.
   A digital de verdade (chave derivada pela própria digital, PRF) fica para a próxima versão (pendência #113).

   1.3.0 (17/Out/2026, pedido do dono): a digital deixa de ficar escondida. PIN e digital andam juntos na MESMA
   janela: (1) com a digital ligada, a janela de abrir já tenta a digital sozinha (se o navegador deixar sem toque;
   senão o botão grande fica focado e um toque basta), o PIN fica embaixo, menor, e o teclado nunca abre sozinho;
   (2) logo depois de criar o PIN ou abrir com ele, se o aparelho tem digital e ela não está ligada, a mesma janela
   pergunta UMA vez "Quer abrir com a digital da próxima vez?" ("Agora não" vale para este aparelho); (3) função
   pública SolverCofre.painelDigital(elemento) desenha o estado da digital (ligada/desligada, ligar, tirar) dentro
   do elemento que o app indicar, igual em todo app, trancado ou aberto. Aparelho sem digital: nenhuma pergunta
   nem botão, só uma frase de orientação.

   1.2.0 (17/Out/2026, pedido do dono): abrir com a DIGITAL (WebAuthn, o mesmo jeito do RootifyONE) no
   lugar de digitar o PIN, que continua sendo a reserva (troca de celular, digital que falhou). Depois de abrir
   com o PIN, o app oferece "ativar a digital": o navegador cria uma chave presa ao aparelho (IndexedDB, não
   exportável) que embrulha a chave de dados; ela só é usada depois que o sistema confirma a digital. Nada de
   biometria sai do aparelho. A digital é presa ao endereço (solverone.com.br) e a este navegador. Mesmo limite
   de sempre: código ruim dentro da página, com o cofre aberto, poderia usar as chaves.

   1.1.0 (17/Out/2026, pedido do dono, pendência #37 do Contador): sem "Lembrar neste
   aparelho" (abria sem PIN para qualquer um com o aparelho destravado; quem tinha
   ligado volta a pedir o PIN e a chave do aparelho é apagada sozinha) e o campo do
   PIN tratado como senha que não se guarda (o navegador não oferece salvar, não
   copia nem recorta).

   COMO FUNCIONA (o mesmo jeito do cofre do RootifyONE, rootify-base.js)
   - Uma chave de dados aleatória (AES-GCM 256) embaralha um objeto JSON com os
     segredos, cada um com um nome: 'ia:openai', 'ia:gemini', 'telegram:omnilife-one'…
   - Essa chave de dados fica guardada "embrulhada":
       pelo PIN/senha (PBKDF2-SHA256, 310 mil rodadas, sal aleatório).
   - Recarregar a página (F5) não pede o PIN de novo (a não ser no app que pediu SolverCofre.proteger): a chave de dados fica
     embrulhada por uma chave de sessão não exportável (IndexedDB) e o pacote
     vai para o sessionStorage, que é só desta aba e some quando ela fecha.
   - Nada secreto fica em claro. Em claro só ficam os NOMES dos segredos
     (ex.: 'ia:gemini'), para o app saber que existe uma chave sem abrir o cofre.
   - O PIN não tem como ser recuperado. Esqueceu = apagar o cofre e colar as
     chaves de novo (elas continuam valendo no site de cada provedor).

   ORDEM NA PÁGINA (em todo app):
       <script src="janela.js"></script>
       <script src="cofre.js"></script>
       <script src="diretrizes.js"></script>
       <script src="diretrizes-config.js"></script>
   Funciona também sozinho (app sem o módulo comum): global SolverCofre.

   LIMITE HONESTO
   Mesmo endereço = mesma casa. Enquanto o cofre está aberto, um código ruim
   rodando DENTRO da página poderia usar as chaves. A defesa é não rodar código de
   fora: Content-Security-Policy sem scripts de terceiros. Isolar de verdade pediria
   um endereço separado por app, e aí perderíamos o login e o cofre únicos (não
   recomendado).

   ARQUIVO MASTER: mora no rootify-one e vai IGUAL para todos os apps. Não editar
   a cópia de um app; mudar aqui e copiar.
   ===================================================================== */
(function (raiz) {
  'use strict';
  if (raiz.SolverCofre && raiz.SolverCofre.__carregado) return;

  var VERSAO = '1.4.0';
  var NOME = 'dgo:global:cofre';                 /* localStorage: o cofre (embaralhado) */
  var NOME_ERROS = 'dgo:global:cofre:erros';     /* localStorage: PIN errado { n, ate } */
  var NOME_OFERTA = 'dgo:global:cofre:digital-recusada';  /* localStorage: '1' = a pessoa disse "Agora não" à pergunta da digital */
  var NOME_SESSAO = 'dgo:global:cofre:sessao';   /* sessionStorage: { id, pac } desta aba */
  var NOME_SAIU = 'dgo:global:cofre:saiu';       /* sessionStorage: { app, em } de quando a página saiu (proteger: passar de página no mesmo app) */
  var BANCO = 'solverone-cofre';                 /* IndexedDB: chaves não exportáveis */
  var ITER = 310000;
  var MIN_PIN = 6;
  var ERROS_LIVRES = 5;                          /* depois disso, espera que cresce */
  var d = raiz.document;
  var sub = raiz.crypto && raiz.crypto.subtle;

  /* ------------------------------------------------------------------
     1. TEXTOS (PT / EN)
     ------------------------------------------------------------------ */
  var TX = {
    tituloCriar: ['🔐 Proteger as chaves de IA', '🔐 Protect your AI keys'],
    tituloAbrir: ['🔐 Abrir o cofre de chaves', '🔐 Open the key vault'],
    tituloEsqueci: ['Esqueci o PIN', 'I forgot the PIN'],
    explicaCriar: ['Crie um PIN para trancar as chaves de IA (e outros segredos dos apps SolverONE) neste navegador. Sem o PIN, ninguém lê as chaves, nem com uma cópia do navegador.',
                   'Create a PIN to lock your AI keys (and other SolverONE app secrets) in this browser. Without the PIN nobody can read them, not even with a copy of the browser.'],
    explicaAbrir: ['Digite o seu PIN para usar as chaves guardadas.', 'Type your PIN to use the saved keys.'],
    pin: ['PIN (6 ou mais letras ou números)', 'PIN (6 or more letters or numbers)'],
    pinEx: ['Ex.: um que só você saiba', 'E.g. one only you know'],
    pinDe: ['Repita o PIN', 'Repeat the PIN'],
    avisoPerda: ['Se esquecer o PIN, as chaves não voltam: aí é só colar de novo (elas continuam valendo no site de cada provedor).',
                 'If you forget the PIN the keys cannot come back: just paste them again (they still work on each provider’s site).'],
    criar: ['Criar e abrir', 'Create and open'],
    abrir: ['Abrir', 'Open'],
    agoraNao: ['Agora não', 'Not now'],
    esqueci: ['Esqueci o PIN', 'I forgot the PIN'],
    curto: ['O PIN precisa de pelo menos 6 letras ou números.', 'The PIN needs at least 6 letters or numbers.'],
    diferente: ['Os dois PINs não são iguais. Digite de novo.', 'The two PINs do not match. Type them again.'],
    errado: ['PIN errado. Confira e tente de novo.', 'Wrong PIN. Check it and try again.'],
    restam: ['PIN errado. Mais {n} tentativa(s) e o cofre pede uma pausa curta.', 'Wrong PIN. {n} more try(ies) and the vault asks for a short pause.'],
    esperar: ['Muitas tentativas. Espere {s} segundos e tente de novo (nada foi apagado).', 'Too many tries. Wait {s} seconds and try again (nothing was deleted).'],
    abrindo: ['Abrindo…', 'Opening…'],
    falhou: ['Não deu para abrir o cofre neste navegador.', 'Could not open the vault in this browser.'],
    esqueciTexto: ['O PIN não tem como ser recuperado: é ele que tranca as chaves, e ninguém (nem a SolverONE) tem cópia. O que dá para fazer é apagar o cofre e criar outro, colando as chaves de novo. Os outros dados dos apps não são apagados.',
                   'The PIN cannot be recovered: it is what locks the keys, and nobody (not even SolverONE) has a copy. What you can do is delete the vault and create a new one, pasting the keys again. The apps’ other data is not deleted.'],
    digite: ['Para confirmar, digite APAGAR', 'To confirm, type DELETE'],
    palavra: ['APAGAR', 'DELETE'],
    apagarTudo: ['Apagar o cofre e começar de novo', 'Delete the vault and start over'],
    voltar: ['Voltar', 'Back'],
    apagado: ['Cofre apagado. Crie um PIN novo e cole as chaves de novo.', 'Vault deleted. Create a new PIN and paste the keys again.'],
    mostrar: ['Mostrar o PIN', 'Show the PIN'],
    digitalBotao: ['👆 Abrir com a digital', '👆 Open with fingerprint'],
    ouPin: ['ou digite o PIN', 'or type the PIN'],
    ofertaTitulo: ['Quer abrir com a digital da próxima vez?', 'Want to open with your fingerprint next time?'],
    ofertaTexto: ['Sem digitar o PIN. O PIN continua valendo como reserva.', 'No need to type the PIN. The PIN still works as the backup.'],
    ofertaSim: ['👆 Sim, usar a digital', '👆 Yes, use my fingerprint'],
    ofertaFalhou: ['Não deu certo com a digital. Tente de novo ou toque em "Agora não".', 'The fingerprint did not work. Try again or tap "Not now".'],
    digitalLigada: ['Digital ligada', 'Fingerprint on'],
    digitalLigadaTexto: ['O cofre abre com a digital. O PIN continua valendo como reserva.', 'The vault opens with your fingerprint. The PIN still works as the backup.'],
    digitalDesligada: ['Digital desligada', 'Fingerprint off'],
    digitalDesligadaTexto: ['Hoje o cofre abre só com o PIN.', 'Right now the vault opens only with the PIN.'],
    ligar: ['👆 Ligar a digital', '👆 Turn on the fingerprint'],
    tirar: ['Tirar a digital', 'Turn off the fingerprint'],
    ligouMsg: ['✓ Digital ligada. Na próxima vez é só tocar nela.', '✓ Fingerprint on. Next time just touch it.'],
    tirouMsg: ['Digital desligada. Vale só o PIN.', 'Fingerprint off. Only the PIN works.'],
    ligarFalhou: ['Não deu certo com a digital. Tente de novo.', 'The fingerprint did not work. Try again.'],
    semDigitalNoAparelho: ['Para abrir com a digital, cadastre uma digital (ou o rosto) nas configurações do celular.', 'To open with your fingerprint, set up a fingerprint (or face) in your phone settings.'],
    motivoLigar: ['Digite o PIN para ligar a digital.', 'Type the PIN to turn on the fingerprint.'],
    digitalFalhou: ['Não deu certo com a digital. Tente de novo ou digite o PIN.', 'The fingerprint did not work. Try again or type the PIN.'],
    digitalPerdida: ['A digital deste aparelho não vale mais. Digite o PIN (depois você pode ativar a digital de novo).',
                     'This device’s fingerprint is no longer valid. Type the PIN (you can turn the fingerprint on again afterwards).'],
    motivoPadrao: ['Um app quer usar uma chave guardada.', 'An app wants to use a saved key.']
  };
  function lingua() {
    try { if (raiz.DGO && typeof raiz.DGO.idioma === 'function') return raiz.DGO.idioma() === 'en' ? 'en' : 'pt'; } catch (e) {}
    var l = (d.documentElement.getAttribute('lang') || '').toLowerCase();
    if (l) return l.indexOf('en') === 0 ? 'en' : 'pt';
    try { var g = JSON.parse(raiz.localStorage.getItem('dgo:global:idioma') || 'null'); if (g) return g === 'en' ? 'en' : 'pt'; } catch (e2) {}
    return 'pt';
  }
  function t(k, troca) {
    var v = TX[k], s = v ? v[lingua() === 'en' ? 1 : 0] : k;
    if (troca) Object.keys(troca).forEach(function (c) { s = s.replace('{' + c + '}', troca[c]); });
    return s;
  }
  function textoDe(o) { if (!o) return ''; if (typeof o === 'string') return o; return o[lingua()] || o.pt || ''; }

  /* ------------------------------------------------------------------
     2. CRIPTOGRAFIA (WebCrypto) — mesmos algoritmos do rootify-base.js
     ------------------------------------------------------------------ */
  function b64(buf) {
    var s = '', a = new Uint8Array(buf), i;
    for (i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function deB64(s) {
    var bin = atob(s), a = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function aleatorio(n) { var a = new Uint8Array(n); raiz.crypto.getRandomValues(a); return a; }
  function derivar(segredo, salB64, iter) {
    return sub.importKey('raw', new TextEncoder().encode(String(segredo)), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return sub.deriveKey({ name: 'PBKDF2', salt: deB64(salB64), iterations: iter || ITER, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }
  function cifrar(chave, bytes) {
    var iv = aleatorio(12);
    return sub.encrypt({ name: 'AES-GCM', iv: iv }, chave, bytes)
      .then(function (ct) { return { iv: b64(iv), ct: b64(ct) }; });
  }
  function decifrar(chave, pac) {
    return sub.decrypt({ name: 'AES-GCM', iv: deB64(pac.iv) }, chave, deB64(pac.ct))
      .then(function (pt) { return new Uint8Array(pt); });
  }
  function importarDEK(bruta) { return sub.importKey('raw', bruta, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); }
  function novaChaveFixa() { return sub.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
  function paraBytes(obj) { return new TextEncoder().encode(JSON.stringify(obj)); }
  function deBytes(b) { return JSON.parse(new TextDecoder().decode(b)); }

  /* ------------------------------------------------------------------
     3. ONDE GUARDA
     ------------------------------------------------------------------ */
  function lerRegistro() {
    try {
      var r = JSON.parse(raiz.localStorage.getItem(NOME) || 'null');
      if (!r || r.formato !== 1 || typeof r.sal !== 'string' || !r.envoltas || !r.envoltas.pin || !r.envoltas.pin.ct || !r.dados || !r.dados.ct) return null;
      return r;
    } catch (e) { return null; }
  }
  function gravarRegistro(r) { raiz.localStorage.setItem(NOME, JSON.stringify(r)); }
  function idDe(r) { return r ? (r.criado + '|' + r.sal) : ''; }

  /* IndexedDB: só chaves NÃO exportáveis (ninguém consegue ler o conteúdo delas, só usar) */
  var _banco = null;
  function banco() {
    if (_banco) return _banco;
    _banco = new Promise(function (ok, erro) {
      if (!raiz.indexedDB) return erro(new Error('sem-indexeddb'));
      var r;
      try { r = raiz.indexedDB.open(BANCO, 1); } catch (e) { return erro(e); }
      r.onupgradeneeded = function () { r.result.createObjectStore('chaves'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { erro(r.error); };
    });
    _banco.catch(function () { _banco = null; });
    return _banco;
  }
  function idbPegar(k) {
    return banco().then(function (db) {
      return new Promise(function (ok, erro) {
        var q = db.transaction('chaves', 'readonly').objectStore('chaves').get(k);
        q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { erro(q.error); };
      });
    });
  }
  function idbPor(k, v) {
    return banco().then(function (db) {
      return new Promise(function (ok, erro) {
        var q = db.transaction('chaves', 'readwrite').objectStore('chaves').put(v, k);
        q.onsuccess = function () { ok(); }; q.onerror = function () { erro(q.error); };
      });
    });
  }
  function idbTirar(k) {
    return banco().then(function (db) {
      return new Promise(function (ok) {
        var q = db.transaction('chaves', 'readwrite').objectStore('chaves').delete(k);
        q.onsuccess = q.onerror = function () { ok(); };
      });
    }).catch(function () {});
  }
  /* chaves de sessão de abas antigas (mais de 3 dias) saem, para não acumular */
  function idbPodarSessoes(manter) {
    return banco().then(function (db) {
      return new Promise(function (ok) {
        var loja = db.transaction('chaves', 'readwrite').objectStore('chaves'), limite = Date.now() - 3 * 864e5;
        var c = loja.openCursor();
        c.onsuccess = function () {
          var cur = c.result; if (!cur) return ok();
          var k = String(cur.key);
          if (k.indexOf('sessao:') === 0 && k !== manter && (!cur.value || !cur.value.em || cur.value.em < limite)) cur.delete();
          cur.continue();
        };
        c.onerror = function () { ok(); };
      });
    }).catch(function () {});
  }

  /* digital (WebAuthn): o registro guarda { id, dominio, env } em envoltas.digital; a chave que abre o env
     fica no IndexedDB ('digital', não exportável) e só é usada depois que o sistema confirma a digital */
  function dominioAtual() { return String(raiz.location && raiz.location.hostname || '').toLowerCase(); }
  function lerDigital(r) { var x = r && r.envoltas && r.envoltas.digital; return x && x.id && x.env && x.env.ct ? x : null; }
  var _disp = null;       /* o aparelho tem digital? (lembrado: o painel se repinta sem pular) */
  function ofertaRecusada() { try { return raiz.localStorage.getItem(NOME_OFERTA) === '1'; } catch (e) { return false; } }
  function recusarOferta() { try { raiz.localStorage.setItem(NOME_OFERTA, '1'); } catch (e) {} }
  function esquecerOferta() { try { raiz.localStorage.removeItem(NOME_OFERTA); } catch (e) {} }
  function tirarDigital() {
    var r = lerRegistro();
    if (r && r.envoltas && r.envoltas.digital) { delete r.envoltas.digital; gravarRegistro(r); }
    return idbTirar('digital');
  }

  /* ------------------------------------------------------------------
     4. ESTADO EM MEMÓRIA (só enquanto aberto)
     ------------------------------------------------------------------ */
  var E = { aberto: false, bruta: null, dek: null, conteudo: null, id: '' };
  var _fila = Promise.resolve();

  function avisar(nome, detalhe) {
    try { d.dispatchEvent(new CustomEvent(nome, { detail: detalhe || {} })); } catch (e) {}
  }
  function abrirCom(bruta, conteudo, reg) {
    return importarDEK(bruta).then(function (dek) {
      E.aberto = true; E.bruta = bruta; E.dek = dek; E.conteudo = conteudo || {}; E.id = idDe(reg);
    });
  }
  function fecharMemoria() {
    var estava = E.aberto;
    if (E.bruta && E.bruta.fill) { try { E.bruta.fill(0); } catch (e) {} }
    E.aberto = false; E.bruta = null; E.dek = null; E.conteudo = null; E.id = '';
    return estava;
  }
  /* depois de abrir por qualquer caminho: sessão desta aba + mudança das chaves antigas */
  function depoisDeAbrir(como) {
    return guardarSessao().then(function () {
      avisar('cofre:aberto', { como: como });
      return API.migrar().catch(function () {});
    }).then(function () { return true; });
  }
  function persistir() {
    _fila = _fila.then(function () {
      if (!E.aberto) throw new Error('cofre-trancado');
      var reg = lerRegistro();
      if (!reg || idDe(reg) !== E.id) { fecharMemoria(); avisar('cofre:trancado', { motivo: 'trocado' }); throw new Error('cofre-trocado'); }
      return cifrar(E.dek, paraBytes(E.conteudo)).then(function (pac) {
        var r2 = lerRegistro() || reg;
        r2.dados = pac; r2.nomes = Object.keys(E.conteudo).sort(); r2.atualizado = new Date().toISOString();
        gravarRegistro(r2);
      });
    });
    var p = _fila; _fila = _fila.catch(function () {});
    return p;
  }

  /* sessão desta aba (F5 não pede o PIN de novo) */
  function lerSessao() { try { return JSON.parse(raiz.sessionStorage.getItem(NOME_SESSAO) || 'null'); } catch (e) { return null; } }
  function guardarSessao() {
    if (!E.aberto || !raiz.sessionStorage) return Promise.resolve();
    var s = lerSessao(), id = (s && s.id) || b64(aleatorio(9)).replace(/[^A-Za-z0-9]/g, '');
    return novaChaveFixa().then(function (k) {
      return idbPor('sessao:' + id, { k: k, em: Date.now() }).then(function () { return cifrar(k, E.bruta); });
    }).then(function (pac) {
      try { raiz.sessionStorage.setItem(NOME_SESSAO, JSON.stringify({ id: id, pac: pac, cofre: E.id })); } catch (e) {}
      idbPodarSessoes('sessao:' + id);
    }).catch(function () {});
  }
  function apagarSessao() {
    var s = lerSessao();
    try { raiz.sessionStorage.removeItem(NOME_SESSAO); } catch (e) {}
    return s && s.id ? idbTirar('sessao:' + s.id) : Promise.resolve();
  }

  /* PIN errado: 5 livres, depois esperas que crescem (30 s, 1 min, 2 min… até 1 h). Nada é apagado. */
  function lerErros() { try { return JSON.parse(raiz.localStorage.getItem(NOME_ERROS) || 'null') || { n: 0, ate: 0 }; } catch (e) { return { n: 0, ate: 0 }; } }
  function gravarErros(o) { try { if (!o || !o.n) raiz.localStorage.removeItem(NOME_ERROS); else raiz.localStorage.setItem(NOME_ERROS, JSON.stringify(o)); } catch (e) {} }
  function segundosDeEspera() { var o = lerErros(); return Math.max(0, Math.ceil(((o.ate || 0) - Date.now()) / 1000)); }

  /* ------------------------------------------------------------------
     5. MUDANÇA DAS CHAVES ANTIGAS (texto aberto → cofre)
     Fonte = { chave: 'item do localStorage', caminho: 'a.b' ('' = a raiz),
               mapa: { campo: 'nome no cofre' }  (sem mapa: todo campo de texto → prefixo + campo),
               prefixo: 'ia:' (padrão; '' quando o campo já é o nome, ex.: 'wx:openweather') }
     Só os campos do mapa saem do lugar antigo; o resto do estado do app fica.
     Item que ficou vazio na raiz ({}) sai inteiro.
     ------------------------------------------------------------------ */
  var PROVEDORES_IA = { openrouter: 'ia:openrouter', groq: 'ia:groq', gemini: 'ia:gemini', mistral: 'ia:mistral', openai: 'ia:openai',
    anthropic: 'ia:anthropic', claude: 'ia:anthropic', deepseek: 'ia:deepseek', cerebras: 'ia:cerebras', elevenlabs: 'ia:elevenlabs',
    deepgram: 'ia:deepgram', assemblyai: 'ia:assemblyai', personalizado: 'ia:personalizado' };
  /* manter: true = lugar antigo que OUTROS apps ainda leem (diretrizes.js até 1.9.x no CifrasONE e no HyperNutry;
     o MoneyTRIO). Enquanto algum app não tiver o cofre.js, a chave é COPIADA para o cofre mas fica também no lugar
     antigo — senão aquele app ficaria sem a chave de IA. Quando todos os apps tiverem o cofre, basta pôr
     LIMPAR_COMPARTILHADAS = true (master, numa versão nova) e a cópia aberta some na próxima abertura. */
  var LIMPAR_COMPARTILHADAS = false;
  var PADRAO = [
    /* módulo comum (diretrizes.js até 1.9.x): { provedor: 'chave' } */
    { chave: 'dgo:global:chaves-ia', caminho: '', prefixo: 'ia:', manter: true },
    /* MoneyTRIO (investify-me): { provedor: 'gemini', chaves: { gemini: '…' } } — o "provedor" escolhido fica */
    { chave: 'dgo:global:ia', caminho: 'chaves', mapa: PROVEDORES_IA, manter: true },
    /* formato antigo do mesmo item, se um dia foi plano: { gemini: '…' } */
    { chave: 'dgo:global:ia', caminho: '', mapa: PROVEDORES_IA, manter: true }
  ];
  function deixarNoLugar(f) { return !!(f && f.manter) && !LIMPAR_COMPARTILHADAS; }
  var _registradas = [];
  function pegar(obj, caminho) {
    if (!caminho) return obj;
    var partes = String(caminho).split('.'), o = obj, i;
    for (i = 0; i < partes.length; i++) { if (!o || typeof o !== 'object') return undefined; o = o[partes[i]]; }
    return o;
  }
  function todasFontes(extra) {
    var vistas = {}, saida = [];
    PADRAO.concat(_registradas, Array.isArray(extra) ? extra : (extra ? [extra] : [])).forEach(function (f) {
      if (!f || typeof f.chave !== 'string' || !f.chave) return;
      var id = f.chave + '|' + (f.caminho || '') + '|' + JSON.stringify(f.mapa || null) + '|' + String(f.prefixo);
      if (vistas[id]) return; vistas[id] = 1; saida.push(f);
    });
    return saida;
  }
  /* o que ainda está em texto aberto (sem mexer em nada) */
  function procurar(fontes) {
    var achados = [], erros = [];
    fontes.forEach(function (f) {
      var bruto = null;
      try { bruto = raiz.localStorage.getItem(f.chave); } catch (e) { return; }
      if (bruto === null || bruto === '') return;
      var obj;
      try { obj = JSON.parse(bruto); } catch (e2) { erros.push({ chave: f.chave, motivo: 'nao-deu-para-ler' }); return; }
      var alvo = pegar(obj, f.caminho);
      if (!alvo || typeof alvo !== 'object' || Array.isArray(alvo)) return;
      var campos = f.mapa ? Object.keys(f.mapa) : Object.keys(alvo);
      campos.forEach(function (c) {
        var v = alvo[c];
        if (typeof v !== 'string' || !v.trim()) return;
        var nome = f.mapa ? f.mapa[c] : (typeof f.prefixo === 'string' ? f.prefixo : 'ia:') + c;
        if (typeof nome !== 'string' || !nome) return;
        achados.push({ fonte: f, campo: c, nome: nome, valor: v.trim() });
      });
    });
    return { achados: achados, erros: erros };
  }
  function tirarDoLugarAntigo(f, campos) {
    var bruto = raiz.localStorage.getItem(f.chave);
    if (bruto === null) return;
    var obj = JSON.parse(bruto), alvo = pegar(obj, f.caminho);
    if (!alvo || typeof alvo !== 'object') return;
    campos.forEach(function (c) { delete alvo[c]; });
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && !Object.keys(obj).length) raiz.localStorage.removeItem(f.chave);
    else raiz.localStorage.setItem(f.chave, JSON.stringify(obj));
  }

  /* ------------------------------------------------------------------
     6. JANELA (criar / abrir / esqueci) — só quando precisa; nunca mostra segredo
     ------------------------------------------------------------------ */
  var _pedindo = null;
  function estilo() {
    if (d.getElementById('solver-cofre-estilo')) return;
    var s = d.createElement('style'); s.id = 'solver-cofre-estilo';
    s.textContent = [
      '.sc-fundo{--sc-f:#fff;--sc-t:#0f172a;--sc-t2:#475569;--sc-l:#cbd5e1;--sc-c:#047857;--sc-ct:#fff;--sc-er:#b91c1c;--sc-erf:#fee2e2;--sc-in:#fff;',
      'position:fixed;inset:0;z-index:2147483600;background:rgba(2,6,23,.6);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;overflow:auto}',
      '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .sc-fundo{--sc-f:#111a2b;--sc-t:#e8edf6;--sc-t2:#b9c3d6;--sc-l:#34456a;--sc-c:#34d399;--sc-ct:#06261b;--sc-er:#fca5a5;--sc-erf:#3b1212;--sc-in:#0b1220}}',
      ':root[data-theme="dark"] .sc-fundo{--sc-f:#111a2b;--sc-t:#e8edf6;--sc-t2:#b9c3d6;--sc-l:#34456a;--sc-c:#34d399;--sc-ct:#06261b;--sc-er:#fca5a5;--sc-erf:#3b1212;--sc-in:#0b1220}',
      '.sc-caixa{background:var(--sc-f);color:var(--sc-t);width:100%;max-width:420px;max-height:calc(100vh - 32px);overflow:auto;border-radius:14px;padding:20px;box-sizing:border-box;',
      'font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.4);overflow-wrap:anywhere}',
      '.sc-caixa h2{font-size:1.2rem;margin:0 0 .5rem}.sc-caixa p{margin:.4rem 0}.sc-mini{font-size:.9rem;color:var(--sc-t2)}',
      '.sc-caixa label.sc-campo{display:block;margin:.7rem 0 0;font-weight:600}',
      '.sc-linha-in{display:flex;gap:6px;margin-top:4px}',
      '.sc-caixa input[type=password],.sc-caixa input[type=text]{flex:1;min-width:0;min-height:44px;box-sizing:border-box;padding:8px 10px;font-size:16px;border:1px solid var(--sc-l);border-radius:10px;background:var(--sc-in);color:var(--sc-t)}',
      '.sc-olho{min-width:44px;min-height:44px;border:1px solid var(--sc-l);border-radius:10px;background:transparent;color:var(--sc-t);cursor:pointer;font-size:18px}',
      '.sc-botoes{display:flex;flex-wrap:wrap;gap:8px;margin-top:1rem}',
      '.sc-b{flex:1 1 140px;min-height:44px;padding:8px 14px;border-radius:10px;border:1px solid var(--sc-c);background:var(--sc-c);color:var(--sc-ct);font:600 16px system-ui,sans-serif;cursor:pointer}',
      '.sc-b2{background:transparent;color:var(--sc-t);border-color:var(--sc-l)}',
      '.sc-b[disabled]{opacity:.5;cursor:not-allowed}',
      '.sc-grande{min-height:56px;font-size:18px;width:100%;margin-top:.6rem}',
      '.sc-ou{text-align:center;margin:.8rem 0 .2rem}',
      '.sc-pin-menor{font-size:.92rem}.sc-pin-menor label.sc-campo{margin-top:.2rem;font-weight:500}',
      '.sc-painel p{margin:.3rem 0}.sc-painel .sc-mini{font-size:.9rem;opacity:.85}.sc-painel .sc-botoes{margin-top:.6rem}',
      '.sc-painel .sc-b{flex:0 1 auto;min-height:44px;padding:8px 16px;border-radius:10px;border:1px solid #047857;background:#047857;color:#fff;font:600 16px system-ui,sans-serif;cursor:pointer}',
      '.sc-painel .sc-b2{background:transparent;color:inherit;border-color:currentColor}',
      '.sc-painel .sc-b[disabled]{opacity:.5;cursor:not-allowed}',
      '.sc-link{background:none;border:0;color:var(--sc-t);text-decoration:underline;min-height:44px;padding:0 4px;font:15px system-ui,sans-serif;cursor:pointer;margin-top:.4rem}',
      '.sc-erro{background:var(--sc-erf);color:var(--sc-er);border-radius:10px;padding:8px 10px;margin-top:.7rem}',
      '.sc-erro:empty{display:none}',
      '.sc-caixa :focus-visible{outline:3px solid #f59e0b;outline-offset:2px}'
    ].join('');
    (d.head || d.documentElement).appendChild(s);
  }
  function el(tag, at, filhos) {
    var n = d.createElement(tag);
    Object.keys(at || {}).forEach(function (k) {
      var v = at[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'texto') n.textContent = v;
      else if (k === 'class') n.className = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(typeof f === 'string' ? d.createTextNode(f) : f); });
    return n;
  }
  var _seq = 0;
  /* o PIN é senha que NÃO se guarda: o navegador e os gerenciadores de senha não oferecem salvar
     (autocomplete off + marcas do LastPass/1Password), e não dá para copiar nem recortar o que foi digitado.
     O 👁 fica (padrão da plataforma para campo de senha): mostra só enquanto a pessoa quer. */
  function campoPin(rotulo) {
    var id = 'sc-pin-' + (++_seq);
    var inp = el('input', { type: 'password', id: id, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', inputmode: 'text',
      'data-lpignore': 'true', 'data-1p-ignore': '', 'data-form-type': 'other', placeholder: t('pinEx'), minlength: String(MIN_PIN) });
    ['copy', 'cut'].forEach(function (ev) { inp.addEventListener(ev, function (e) { e.preventDefault(); }); });
    var olho = el('button', { type: 'button', class: 'sc-olho', 'aria-label': t('mostrar'), 'aria-pressed': 'false', texto: '👁',
      onclick: function () { var v = inp.type === 'password'; inp.type = v ? 'text' : 'password'; olho.setAttribute('aria-pressed', v ? 'true' : 'false'); } });
    var bloco = el('div', {}, [el('label', { class: 'sc-campo', for: id, texto: rotulo }), el('div', { class: 'sc-linha-in' }, [inp, olho])]);
    bloco._input = inp;
    return bloco;
  }

  /* 1.4.0: a janela comum (janela.js). Sem ela na página, o jeito antigo continua, com aviso no console. */
  function janelaComum() { var J = raiz.SolverJanela; return (J && J.__carregado) ? J : null; }
  var _avisouSemJanela = false;
  function avisarSemJanela() {
    if (_avisouSemJanela) return; _avisouSemJanela = true;
    try { console.warn('[SolverCofre ' + VERSAO + '] janela.js não está nesta página: a janela do PIN abre do jeito antigo (a página de trás continua rolando). Carregue <script src="janela.js"></script> antes do cofre.js.'); } catch (e) {}
  }

  /* abre a janela; devolve Promise<boolean> (true = cofre aberto) */
  function janela(opcoes) {
    estilo();
    var motivo = textoDe(opcoes && opcoes.motivo);
    var antes = d.activeElement;
    return new Promise(function (resolver) {
      var SJ = janelaComum(), J = null, fundo, caixa;
      var terminou = false, modoAtual = '';
      if (SJ) {
        /* o PIN abre por cima de outra janela quando é ela que precisa da chave (exceção da regra "uma por vez");
           tocar fora, Esc e Voltar = "Agora não"; PIN digitado pela metade não pergunta "Descartar?" */
        caixa = el('div', { class: 'sc-caixa' });
        J = SJ.abrir({ conteudo: caixa, classe: 'sc-fundo', id: 'solver-cofre', porCima: true, temTexto: false,
          atributos: { 'aria-labelledby': 'sc-tit' },
          aoFechar: function (m) { if (m === 'cancelar') cancelou(); } });
        fundo = J.el;
      } else {
        avisarSemJanela();
        fundo = el('div', { class: 'sc-fundo', id: 'solver-cofre' });
        caixa = el('div', { class: 'sc-caixa', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sc-tit' });
        fundo.appendChild(caixa);
      }
      function cancelou() { if (modoAtual === 'oferta') { recusarOferta(); fim(true); } else fim(false); }
      function fim(ok) {
        if (terminou) return; terminou = true;
        if (J) { J.fechar('ok'); resolver(!!ok); return; }
        d.removeEventListener('keydown', teclas, true);
        if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
        try { if (antes && antes.focus) antes.focus(); } catch (e) {}
        resolver(!!ok);
      }
      function teclas(ev) {
        if (!fundo.parentNode) return;
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); if (modoAtual === 'oferta') { recusarOferta(); fim(true); } else fim(false); return; }
        if (ev.key === 'Tab') {     /* o foco não sai da janela */
          var f = caixa.querySelectorAll('button:not([disabled]),input,[tabindex="0"]');
          if (!f.length) return;
          var p = f[0], u = f[f.length - 1];
          if (ev.shiftKey && d.activeElement === p) { ev.preventDefault(); u.focus(); }
          else if (!ev.shiftKey && d.activeElement === u) { ev.preventDefault(); p.focus(); }
        }
      }
      if (!J) d.addEventListener('keydown', teclas, true);   /* com a janela comum, Esc e o foco preso são do navegador */

      /* depois de criar o PIN ou abrir com ele: se o aparelho tem digital e ela não está ligada, pergunta uma vez */
      function oferecerOuFechar() {
        if ((opcoes && opcoes.semOferta) || ofertaRecusada() || API.digitalAtiva()) { fim(true); return; }
        API.digitalDisponivel().then(function (disp) { if (disp) pintar('oferta'); else fim(true); }, function () { fim(true); });
      }
      function pintar(modo, aviso, semAuto) {
        if (terminou) return;
        modoAtual = modo;
        caixa.innerHTML = '';
        var erro = el('p', { class: 'sc-erro', role: 'alert', 'aria-live': 'assertive' });
        if (modo === 'criar') {
          caixa.appendChild(el('h2', { id: 'sc-tit', texto: t('tituloCriar') }));
          if (motivo) caixa.appendChild(el('p', { texto: motivo }));
          if (aviso) caixa.appendChild(el('p', { class: 'sc-mini', role: 'status', texto: aviso }));
          caixa.appendChild(el('p', { class: 'sc-mini', texto: t('explicaCriar') }));
          var c1 = campoPin(t('pin')), c2 = campoPin(t('pinDe'));
          var form = el('form', { novalidate: true, autocomplete: 'off' }, [c1, c2,
            el('p', { class: 'sc-mini', texto: t('avisoPerda') }), erro,
            el('div', { class: 'sc-botoes' }, [
              el('button', { type: 'submit', class: 'sc-b', texto: t('criar') }),
              el('button', { type: 'button', class: 'sc-b sc-b2', texto: t('agoraNao'), onclick: function () { fim(false); } })
            ])]);
          form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            var a = c1._input.value, b = c2._input.value;
            if (a.length < MIN_PIN) { erro.textContent = t('curto'); c1._input.focus(); return; }
            if (a !== b) { erro.textContent = t('diferente'); c2._input.value = ''; c2._input.focus(); return; }
            var bt = form.querySelector('button[type=submit]'); bt.disabled = true; bt.textContent = t('abrindo');
            API.criar(a).then(oferecerOuFechar, function () {
              bt.disabled = false; bt.textContent = t('criar'); erro.textContent = t('falhou');
            });
          });
          caixa.appendChild(form);
          c1._input.focus();
        } else if (modo === 'oferta') {
          caixa.appendChild(el('h2', { id: 'sc-tit', texto: t('ofertaTitulo') }));
          caixa.appendChild(el('p', { texto: t('ofertaTexto') }));
          var bSim = el('button', { type: 'button', class: 'sc-b sc-grande', 'data-sc': 'oferta-sim', texto: t('ofertaSim'),
            onclick: function () {
              bSim.disabled = true; bSim.textContent = t('abrindo');
              API.ativarDigital().then(function () { fim(true); }, function () {
                bSim.disabled = false; bSim.textContent = t('ofertaSim'); erro.textContent = t('ofertaFalhou'); bSim.focus();
              });
            } });
          caixa.appendChild(bSim);
          caixa.appendChild(erro);
          caixa.appendChild(el('div', { class: 'sc-botoes' }, [
            el('button', { type: 'button', class: 'sc-b sc-b2', 'data-sc': 'oferta-nao', texto: t('agoraNao'), onclick: function () { recusarOferta(); fim(true); } })]));
          bSim.focus();
        } else if (modo === 'abrir') {
          caixa.appendChild(el('h2', { id: 'sc-tit', texto: t('tituloAbrir') }));
          if (motivo) caixa.appendChild(el('p', { texto: motivo }));
          var temDigital = API.digitalAtiva();
          var botDigital = null;
          if (!temDigital) caixa.appendChild(el('p', { class: 'sc-mini', texto: t('explicaAbrir') }));
          if (aviso) caixa.appendChild(el('p', { class: 'sc-erro', role: 'alert', texto: aviso }));
          /* digital ligada: o botão grande vem primeiro e já tenta a digital; se o navegador não deixar sem toque,
             o botão fica focado e um toque basta. O PIN fica embaixo, menor, e o teclado nunca abre sozinho. */
          if (temDigital) {
            var tentarDigital = function (auto) {
              botDigital.disabled = true; botDigital.textContent = t('abrindo');
              API.abrirComDigital().then(function () { fim(true); }, function (e) {
                if (e && (e.message === 'digital-perdida' || e.message === 'digital-outro-endereco')) { pintar('abrir', t('digitalPerdida'), true); return; }
                if (terminou) return;
                botDigital.disabled = false; botDigital.textContent = t('digitalBotao'); botDigital.focus();
                if (!auto) erro.textContent = t('digitalFalhou');
              });
            };
            botDigital = el('button', { type: 'button', class: 'sc-b sc-grande', 'data-sc': 'digital', texto: t('digitalBotao'),
              onclick: function () { erro.textContent = ''; tentarDigital(false); } });
            caixa.appendChild(botDigital);
            caixa.appendChild(erro);
            caixa.appendChild(el('p', { class: 'sc-mini sc-ou', texto: t('ouPin') }));
          }
          var cp = campoPin(t('pin'));
          var form2 = el('form', { novalidate: true, autocomplete: 'off', class: temDigital ? 'sc-pin-menor' : '' }, [cp,
            temDigital ? null : erro,
            el('div', { class: 'sc-botoes' }, [
              el('button', { type: 'submit', class: temDigital ? 'sc-b sc-b2' : 'sc-b', texto: t('abrir') }),
              el('button', { type: 'button', class: 'sc-b sc-b2', texto: t('agoraNao'), onclick: function () { fim(false); } })
            ]),
            el('button', { type: 'button', class: 'sc-link', texto: t('esqueci'), onclick: function () { pintar('esqueci'); } })
          ]);
          var esp = segundosDeEspera();
          if (esp) erro.textContent = t('esperar', { s: esp });
          form2.addEventListener('submit', function (ev) {
            ev.preventDefault();
            var bt = form2.querySelector('button[type=submit]'); bt.disabled = true; bt.textContent = t('abrindo');
            API.abrir(cp._input.value).then(oferecerOuFechar, function (e) {
              bt.disabled = false; bt.textContent = t('abrir');
              var m = e && e.message;
              erro.textContent = (m === 'esperar' || (m === 'pin-errado' && e.segundos > 0)) ? t('esperar', { s: e.segundos }) :
                m === 'pin-errado' ? (e.restam > 0 && e.restam <= 3 ? t('restam', { n: e.restam }) : t('errado')) : t('falhou');
              cp._input.value = ''; cp._input.focus();
            });
          });
          caixa.appendChild(form2);
          if (botDigital) { botDigital.focus(); if (!semAuto) tentarDigital(true); }   /* foco no botão: o teclado do celular não abre sozinho */
          else cp._input.focus();
        } else {   /* esqueci */
          caixa.appendChild(el('h2', { id: 'sc-tit', texto: t('tituloEsqueci') }));
          caixa.appendChild(el('p', { texto: t('esqueciTexto') }));
          var idc = 'sc-confirma-' + (++_seq);
          var conf = el('input', { type: 'text', id: idc, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
          var bApagar = el('button', { type: 'button', class: 'sc-b', disabled: true, texto: t('apagarTudo') });
          conf.addEventListener('input', function () { bApagar.disabled = conf.value.trim().toUpperCase() !== t('palavra'); });
          bApagar.addEventListener('click', function () {
            if (conf.value.trim().toUpperCase() !== t('palavra')) return;
            API.apagarCofre().then(function () { pintar('criar', t('apagado')); });
          });
          caixa.appendChild(el('label', { class: 'sc-campo', for: idc, texto: t('digite') }));
          caixa.appendChild(el('div', { class: 'sc-linha-in' }, [conf]));
          caixa.appendChild(el('div', { class: 'sc-botoes' }, [bApagar,
            el('button', { type: 'button', class: 'sc-b sc-b2', texto: t('voltar'), onclick: function () { pintar('abrir', '', true); } })]));
          conf.focus();
        }
      }
      if (!J) d.body.appendChild(fundo);
      pintar(lerRegistro() ? 'abrir' : 'criar');
    });
  }

  /* ------------------------------------------------------------------
     7. API PÚBLICA (global SolverCofre)
     ------------------------------------------------------------------ */
  function erro(cod, extra) { var e = new Error(cod); if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; }); return e; }
  function semCripto() { return !sub || !raiz.localStorage; }

  /* painel da digital (função pública painelDigital): cada elemento indicado pelo app fica na lista e se repinta sozinho
     quando a digital liga/desliga ou o cofre é apagado */
  var _paineis = [];
  function desenharPainel(item) {
    var box = item.el;
    if (!box.isConnected) { _paineis = _paineis.filter(function (x) { return x !== item; }); return; }
    box.textContent = '';
    box.className = (box.className.replace(/\bsc-painel\b/g, '') + ' sc-painel').trim();
    var ativa = API.digitalAtiva();
    if (!lerRegistro() || (_disp === null && !ativa)) return;
    function msg() { if (item.msg) box.appendChild(el('p', { class: 'sc-mini', role: 'status', texto: item.msg })); }
    if (!ativa && !_disp) { box.appendChild(el('p', { class: 'sc-mini', texto: t('semDigitalNoAparelho') })); return; }
    box.appendChild(el('p', {}, [el('strong', { texto: '👆 ' + t(ativa ? 'digitalLigada' : 'digitalDesligada') })]));
    box.appendChild(el('p', { class: 'sc-mini', texto: t(ativa ? 'digitalLigadaTexto' : 'digitalDesligadaTexto') }));
    msg();
    var b = el('button', { type: 'button', class: ativa ? 'sc-b sc-b2' : 'sc-b', 'data-sc': ativa ? 'tirar' : 'ligar', texto: t(ativa ? 'tirar' : 'ligar') });
    b.addEventListener('click', function () {
      b.disabled = true;
      if (ativa) { API.desativarDigital().then(function () { item.msg = t('tirouMsg'); desenharPainel(item); }); return; }
      API.pedir({ motivo: { pt: TX.motivoLigar[0], en: TX.motivoLigar[1] }, semOferta: true }).then(function (ok) {
        if (!ok) return null;
        return API.ativarDigital().then(function () { item.msg = t('ligouMsg'); });
      }).then(function () { desenharPainel(item); }, function (e) {
        item.msg = e && e.message === 'sem-digital-no-aparelho' ? t('semDigitalNoAparelho') : t('ligarFalhou'); desenharPainel(item);
      });
    });
    box.appendChild(el('div', { class: 'sc-botoes' }, [b]));
  }

  /* ------------------------------------------------------------------
     7a. PROTEGER (1.4.0): as regras do PIN do Contador 1.25, para qualquer app que pedir
     ------------------------------------------------------------------ */
  var _prot = null;
  /* o app de um endereço: a primeira pasta (solverone.com.br/<app>/...). Passar de página no mesmo app não tranca. */
  function appDe(caminho) { var m = String(caminho || '').match(/^\/([^\/]+)\//); return m ? m[1] : ''; }
  function appAqui() { return appDe(raiz.location && raiz.location.pathname); }
  function tipoDeEntrada() {
    try { var n = raiz.performance.getEntriesByType('navigation')[0]; if (n && n.type) return n.type; } catch (e) {}
    try { var t = raiz.performance.navigation.type; return t === 1 ? 'reload' : t === 2 ? 'back_forward' : 'navigate'; } catch (e2) {}
    return 'navigate';
  }
  /* veio de outra página DESTE app há poucos segundos (link ou Voltar entre as páginas do app)? */
  function veioDeDentro() {
    var tipo = tipoDeEntrada(), s = null;
    try { s = JSON.parse(raiz.sessionStorage.getItem(NOME_SAIU) || 'null'); raiz.sessionStorage.removeItem(NOME_SAIU); } catch (e) {}
    if (tipo === 'reload' || !s || s.app !== appAqui() || Date.now() - (s.em || 0) > 10000) return false;
    if (tipo === 'back_forward') return true;
    try { var r = d.referrer ? new URL(d.referrer) : null; return !!r && r.origin === raiz.location.origin && appDe(r.pathname) === appAqui(); } catch (e3) { return false; }
  }
  function temSegredo() {
    var r = lerRegistro();
    if (r && Array.isArray(r.nomes) && r.nomes.length) return true;
    return procurar(todasFontes()).achados.length > 0;
  }
  function trancarPor(motivo) {
    _prot && (_prot.adiado = '');
    try { console.info('[cofre] trancado: ' + motivo); } catch (e) {}
    var estava = fecharMemoria();
    return apagarSessao().then(function () { if (estava) avisar('cofre:trancado', { motivo: motivo }); return true; });
  }
  function rotulosOcupado() {
    var f = _prot && _prot.ocupado, r = [];
    (Array.isArray(f) ? f : f ? [f] : []).forEach(function (fn) { try { var v = fn(); if (v) r.push(typeof v === 'string' ? v : 'ocupado'); } catch (e) {} });
    return r;
  }
  function tocandoAgora() { try { return !!(_prot && typeof _prot.tocando === 'function' && _prot.tocando()); } catch (e) { return false; } }
  /* devolve a promessa do trancamento, ou null se nada foi trancado */
  function conferirProtecao(origem) {
    if (!_prot || !E.aberto) return null;
    var agora = Date.now();
    if (_prot.saiuEm && agora - _prot.saiuEm >= _prot.fora) {
      if (tocandoAgora()) { adiar(['audio-tocando']); return null; }
      return trancarPor('fora-do-app');
    }
    if (agora - _prot.ultima >= _prot.ocioso) {
      var por = rotulosOcupado(); if (tocandoAgora()) por.push('audio-tocando');
      if (por.length) { adiar(por); return null; }
      return trancarPor('ocioso');
    }
    return null;
  }
  function adiar(por) {
    var m = '[cofre] trancamento adiado: ' + por.join(', ');
    if (m !== _prot.adiado) { _prot.adiado = m; try { console.info(m); } catch (e) {} }
  }
  function pedirSePrecisa() {
    /* chamado cedo (no <head>): espera a página existir para mostrar a janela */
    if (!d.body) return new Promise(function (ok) { d.addEventListener('DOMContentLoaded', function () { ok(pedirSePrecisa()); }, { once: true }); });
    if (!_prot || E.aberto || _prot.recusou || !temSegredo()) return Promise.resolve(E.aberto);
    return API.pedir({ motivo: _prot.motivo }).then(function (ok) { if (!ok) _prot.recusou = true; return ok; });
  }
  function ligarProtecao() {
    var marca = function () { if (_prot) _prot.ultima = Date.now(); };
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (ev) { d.addEventListener(ev, marca, { passive: true, capture: true }); });
    /* confere a cada 15 s (ou mais vezes, se o app pediu um prazo curto) */
    raiz.setInterval(function () { conferirProtecao('relogio'); }, Math.min(15000, Math.max(500, Math.floor(_prot.ocioso / 3))));
    d.addEventListener('visibilitychange', function () {
      if (!_prot) return;
      if (d.hidden) { _prot.saiuEm = Date.now(); return; }
      var p = conferirProtecao('voltou');                  /* voltou ao app: confere antes de mostrar qualquer coisa */
      _prot.saiuEm = 0; marca();
      if (p) p.then(pedirSePrecisa); else pedirSePrecisa();
    });
    /* saindo da página: tranca a memória (a não ser com áudio tocando). A sessão da aba fica só para a próxima página
       do MESMO app abrir sem PIN; se a próxima for outro app, outro site ou um F5, ela tranca ao carregar. */
    raiz.addEventListener('pagehide', function () {
      if (!_prot || tocandoAgora()) return;
      try { raiz.sessionStorage.setItem(NOME_SAIU, JSON.stringify({ app: appAqui(), em: Date.now(), protegido: true })); } catch (e) {}
      fecharMemoria();
    });
    raiz.addEventListener('pageshow', function (e) {
      if (!_prot || !e.persisted) return;               /* voltou pelo Voltar com a página guardada na memória do navegador */
      _prot.saiuEm = 0; marca();
      var dentro = veioDeDentro();
      (dentro ? API.abrirSemPin() : trancarPor('voltou-de-fora')).then(function () {
        avisar(E.aberto ? 'cofre:aberto' : 'cofre:trancado', { motivo: 'pagina' });
        if (!E.aberto) pedirSePrecisa();
      });
    });
    d.addEventListener('cofre:trancado', function () { if (_prot) _prot.recusou = false; });
  }

  var API = {
    __carregado: true,
    versao: VERSAO,

    existe: function () { return !!lerRegistro(); },
    aberto: function () { return E.aberto; },
    /* digital (WebAuthn). Disponível = o aparelho tem digital/rosto/tela cadastrada e a página é segura */
    digitalDisponivel: function () {
      if (_disp !== null) return Promise.resolve(_disp);
      if (semCripto() || !raiz.PublicKeyCredential || !raiz.isSecureContext || !raiz.navigator || !raiz.navigator.credentials) { _disp = false; return Promise.resolve(false); }
      try { return raiz.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function (v) { _disp = !!v; return _disp; }, function () { _disp = false; return false; }); }
      catch (e) { _disp = false; return Promise.resolve(false); }
    },
    /* a digital está ligada neste aparelho (e vale neste endereço)? */
    digitalAtiva: function () { var x = lerDigital(lerRegistro()); return !!x && x.dominio === dominioAtual(); },
    /* liga a digital: precisa do cofre aberto (pelo PIN). Pede a digital uma vez. Promise<true> */
    ativarDigital: function () {
      if (!E.aberto) return Promise.reject(erro('cofre-trancado'));
      return API.digitalDisponivel().then(function (ok) {
        if (!ok) throw erro('sem-digital-no-aparelho');
        return navigator.credentials.create({ publicKey: {
          challenge: aleatorio(32), rp: { name: 'SolverONE' },
          user: { id: aleatorio(16), name: 'cofre-solverone', displayName: 'Cofre SolverONE' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000, attestation: 'none' } });
      }).then(function (cred) {
        if (!cred) throw erro('digital-cancelada');
        return novaChaveFixa().then(function (k) {
          return idbPor('digital', { k: k, em: Date.now() }).then(function () { return cifrar(k, E.bruta); });
        }).then(function (env) {
          var r = lerRegistro();
          if (!r || idDe(r) !== E.id) throw erro('cofre-trocado');
          r.envoltas.digital = { id: b64(cred.rawId), dominio: dominioAtual(), env: env, em: new Date().toISOString() };
          gravarRegistro(r);
          esquecerOferta();
          avisar('cofre:digital', { ativa: true });
          return true;
        });
      }, function (e) { throw (e && /^(cofre-|sem-)/.test(e.message) ? e : erro('digital-cancelada')); });
    },
    /* abre com a digital (sem PIN). Erros: 'digital-cancelada' (pode tentar de novo), 'digital-perdida' e
       'digital-outro-endereco' (a digital foi tirada daqui: use o PIN), 'sem-digital' */
    abrirComDigital: function () {
      if (semCripto()) return Promise.reject(erro('sem-suporte'));
      var reg = lerRegistro();
      if (!reg) return Promise.reject(erro('sem-cofre'));
      if (E.aberto && E.id === idDe(reg)) return Promise.resolve(true);
      var x = lerDigital(reg);
      if (!x) return Promise.reject(erro('sem-digital'));
      if (x.dominio !== dominioAtual()) return tirarDigital().then(function () { throw erro('digital-outro-endereco'); });
      function perdida() { return tirarDigital().then(function () { throw erro('digital-perdida'); }); }
      return navigator.credentials.get({ publicKey: { challenge: aleatorio(32), userVerification: 'required', timeout: 60000,
        allowCredentials: [{ type: 'public-key', id: deB64(x.id) }] } })
        .then(function (a) { if (!a) throw erro('digital-cancelada'); }, function () { throw erro('digital-cancelada'); })
        .then(function () { return idbPegar('digital'); })
        .then(function (o) { return o && o.k ? decifrar(o.k, x.env).catch(perdida) : perdida(); })
        .then(function (bruta) {
          return importarDEK(bruta).then(function (dek) { return decifrar(dek, reg.dados); }).then(function (b) { return abrirCom(bruta, deBytes(b), reg); });
        })
        .then(function () { return depoisDeAbrir('digital'); });
    },
    /* tirar a digital é escolha da pessoa: a pergunta da próxima abertura não volta */
    desativarDigital: function () { recusarOferta(); return tirarDigital().then(function () { avisar('cofre:digital', { ativa: false }); return true; }); },

    /* desenha, dentro de `elemento` (o app indica), o estado da digital: ligada/desligada, "Ligar a digital" (pede o PIN
       se o cofre estiver trancado e, em seguida, a digital) ou "Tirar a digital". Igual em todo app, trancado ou aberto.
       Só desenha se o cofre existe. Aparelho sem digital cadastrada: só a frase de orientação, sem botão. Se o app
       repintar o elemento por fora, basta chamar de novo. */
    painelDigital: function (elemento) {
      if (!elemento) return false;
      estilo();
      var item = _paineis.filter(function (x) { return x.el === elemento; })[0];
      if (!item) { item = { el: elemento, msg: '' }; _paineis.push(item); }
      elemento.setAttribute('data-dgo-ignorar', '');
      desenharPainel(item);
      if (_disp === null) API.digitalDisponivel().then(function () { desenharPainel(item); });
      return true;
    },


    lembrado: function () { var r = lerRegistro(); return !!(r && r.envoltas && r.envoltas.aparelho); },

    criar: function (pin, opcoes) {
      opcoes = opcoes || {};
      if (semCripto()) return Promise.reject(erro('sem-suporte'));
      if (lerRegistro()) return Promise.reject(erro('ja-existe'));
      if (typeof pin !== 'string' || pin.length < MIN_PIN) return Promise.reject(erro('pin-curto'));
      var bruta = aleatorio(32), sal = b64(aleatorio(16)), reg;
      return derivar(pin, sal, ITER).then(function (kPin) { return cifrar(kPin, bruta); }).then(function (envPin) {
        return importarDEK(bruta).then(function (dek) { return cifrar(dek, paraBytes({})); }).then(function (dados) {
          reg = { formato: 1, criado: new Date().toISOString(), iter: ITER, sal: sal, envoltas: { pin: envPin }, dados: dados, nomes: [] };
          gravarRegistro(reg);
          gravarErros(null);
          return abrirCom(bruta, {}, reg);
        });
      }).then(function () { return depoisDeAbrir('criar'); });
    },

    abrir: function (pin, opcoes) {
      opcoes = opcoes || {};
      if (semCripto()) return Promise.reject(erro('sem-suporte'));
      var reg = lerRegistro();
      if (!reg) return Promise.reject(erro('sem-cofre'));
      if (E.aberto && E.id === idDe(reg)) return Promise.resolve(true);
      var esp = segundosDeEspera();
      if (esp) return Promise.reject(erro('esperar', { segundos: esp }));
      return derivar(String(pin || ''), reg.sal, reg.iter || ITER).then(function (kPin) {
        return decifrar(kPin, reg.envoltas.pin);
      }).then(function (bruta) {
        gravarErros(null);
        return importarDEK(bruta).then(function (dek) { return decifrar(dek, reg.dados); }).then(function (b) {
          return abrirCom(bruta, deBytes(b), reg);
        });
      }, function () {
        var o = lerErros(); o.n = (o.n || 0) + 1;
        if (o.n >= ERROS_LIVRES) o.ate = Date.now() + Math.min(3600, 30 * Math.pow(2, o.n - ERROS_LIVRES)) * 1000;
        gravarErros(o);
        throw erro('pin-errado', { restam: Math.max(0, ERROS_LIVRES - o.n), segundos: segundosDeEspera() });
      }).then(function () { return depoisDeAbrir('pin'); });
    },

    /* sem digitar: só a sessão desta aba (F5). "Lembrar neste aparelho" saiu na 1.1.0. Promise<boolean> */
    abrirSemPin: function () {
      if (E.aberto) return Promise.resolve(true);
      var reg = lerRegistro();
      if (!reg || semCripto()) return Promise.resolve(false);
      function comBruta(bruta) {
        return importarDEK(bruta).then(function (dek) { return decifrar(dek, reg.dados); })
          .then(function (b) { return abrirCom(bruta, deBytes(b), reg); });
      }
      var s = lerSessao();
      var pelaSessao = (s && s.id && s.pac && s.cofre === idDe(reg))
        ? idbPegar('sessao:' + s.id).then(function (o) { if (!o || !o.k) throw erro('sem-sessao'); return decifrar(o.k, s.pac); }).then(comBruta).then(function () { return 'sessao'; })
        : Promise.reject(erro('sem-sessao'));
      return pelaSessao.catch(function (e) {
        if (s) apagarSessao();
        throw e;
      }).then(function (como) {
        return depoisDeAbrir(como);
      }).catch(function () { fecharMemoria(); return false; });
    },

    trancar: function () {
      var estava = fecharMemoria();
      return apagarSessao().then(function () { if (estava) avisar('cofre:trancado', { motivo: 'trancar' }); return true; });
    },

    /* 1.4.0: liga as regras do PIN neste app (uma vez, ao abrir). Promise<boolean> = cofre aberto depois da conferência.
       opcoes: motivo {pt,en} (texto da janela ao abrir) · ocioso (ms, padrão 5 min) · fora (ms escondido, padrão 1 min) ·
       ocupado: função (ou lista) que devolve false/true/'rótulo' — trabalho rodando só adia o trancar por falta de uso ·
       tocando: função — áudio tocando neste instante não tranca ao esconder nem ao sair. */
    proteger: function (opcoes) {
      opcoes = opcoes || {};
      var primeira = !_prot;
      _prot = { motivo: opcoes.motivo || { pt: TX.motivoPadrao[0], en: TX.motivoPadrao[1] },
        ocioso: opcoes.ocioso > 0 ? opcoes.ocioso : 5 * 60 * 1000, fora: opcoes.fora > 0 ? opcoes.fora : 60 * 1000,
        ocupado: opcoes.ocupado || null, tocando: opcoes.tocando || null,
        ultima: Date.now(), saiuEm: d.hidden ? Date.now() : 0, recusou: false, adiado: '' };
      if (!primeira) return Promise.resolve(E.aberto);
      ligarProtecao();
      /* ao abrir: F5, outro app, outro site ou endereço digitado = tranca e pede o PIN; outra página do mesmo app = segue */
      var dentro = veioDeDentro();
      return API.pronto.then(function () {
        return (E.aberto && !dentro) ? trancarPor(tipoDeEntrada() === 'reload' ? 'recarregou' : 'abriu') : null;
      }).then(function () { return pedirSePrecisa(); }).catch(function () { return E.aberto; });
    },

    /* "Lembrar neste aparelho" saiu na 1.1.0 (abria sem PIN para quem pegasse o aparelho destravado).
       A função fica só para app antigo que ainda a chame: não faz nada e responde false. */
    lembrarAparelho: function () { return Promise.resolve(false); },
    esquecerAparelho: function () {
      var r = lerRegistro();
      if (r && r.envoltas && r.envoltas.aparelho) { delete r.envoltas.aparelho; gravarRegistro(r); }
      return idbTirar('aparelho').then(function () { return true; });
    },

    trocarPin: function (novo) {
      if (!E.aberto) return Promise.reject(erro('cofre-trancado'));
      if (typeof novo !== 'string' || novo.length < MIN_PIN) return Promise.reject(erro('pin-curto'));
      var sal = b64(aleatorio(16));
      return derivar(novo, sal, ITER).then(function (k) { return cifrar(k, E.bruta); }).then(function (env) {
        var r = lerRegistro(); if (!r) throw erro('sem-cofre');
        r.sal = sal; r.iter = ITER; r.envoltas.pin = env; gravarRegistro(r); E.id = idDe(r);
        return guardarSessao().then(function () { return true; });
      });
    },

    /* "Esqueci o PIN": apaga SÓ o cofre (os outros dados dos apps ficam) */
    apagarCofre: function () {
      var estava = fecharMemoria();
      try { raiz.localStorage.removeItem(NOME); } catch (e) {}
      esquecerOferta();
      gravarErros(null);
      return Promise.all([apagarSessao(), idbTirar('aparelho'), idbTirar('digital')]).then(function () {
        avisar('cofre:trancado', { motivo: 'apagado', estava: estava }); return true;
      });
    },

    /* sem digitar nada: devolve o que já está aberto ('' se trancado ou se não existe) */
    lerAgora: function (nome) {
      if (!E.aberto) return '';
      var v = E.conteudo[nome];
      return v === undefined || v === null ? '' : v;
    },
    /* existe um segredo com este nome? (não precisa abrir; conta também o que ainda vai ser mudado de lugar) */
    tem: function (nome) {
      if (E.aberto) return Object.prototype.hasOwnProperty.call(E.conteudo, nome) && E.conteudo[nome] !== '';
      var r = lerRegistro();
      if (r && Array.isArray(r.nomes) && r.nomes.indexOf(nome) !== -1) return true;
      return procurar(todasFontes()).achados.some(function (a) { return a.nome === nome; });
    },
    nomes: function () {
      if (E.aberto) return Object.keys(E.conteudo).sort();
      var r = lerRegistro();
      return r && Array.isArray(r.nomes) ? r.nomes.slice() : [];
    },
    /* ainda há segredo em texto aberto esperando ir para o cofre? */
    pendentes: function (fontes) {
      /* cópia que fica de propósito (manter) e já está no cofre não conta como pendente */
      var noCofre = API.nomes();
      return procurar(todasFontes(fontes)).achados
        .filter(function (a) { return !(deixarNoLugar(a.fonte) && noCofre.indexOf(a.nome) !== -1); })
        .map(function (a) { return { chave: a.fonte.chave, campo: a.campo, nome: a.nome }; });
    },

    /* Promise com o valor. Trancado: abre sem PIN se der; senão mostra a janela.
       Sem cofre e sem nada para guardar: ''. Pessoa disse "Agora não": erro 'cofre-trancado'. */
    ler: function (nome, opcoes) {
      if (E.aberto) return Promise.resolve(API.lerAgora(nome));
      if (!lerRegistro() && !procurar(todasFontes()).achados.length) return Promise.resolve('');
      return API.pedir(opcoes).then(function (ok) {
        if (!ok) throw erro('cofre-trancado');
        return API.lerAgora(nome);
      });
    },
    gravar: function (nome, valor, opcoes) {
      if (typeof nome !== 'string' || !nome) return Promise.reject(erro('nome-invalido'));
      if (valor === undefined || valor === null || valor === '') return API.apagar(nome, opcoes);
      if (typeof valor === 'string') valor = valor.trim();
      function fazer() {
        E.conteudo[nome] = valor;
        avisar('cofre:mudou', { nome: nome, tem: true });
        return persistir().then(function () { return true; });
      }
      if (E.aberto) return fazer();
      return API.pedir(opcoes).then(function (ok) { if (!ok) throw erro('cofre-trancado'); return fazer(); });
    },
    apagar: function (nome, opcoes) {
      function fazer() {
        if (!Object.prototype.hasOwnProperty.call(E.conteudo, nome)) return Promise.resolve(true);
        delete E.conteudo[nome];
        avisar('cofre:mudou', { nome: nome, tem: false });
        return persistir().then(function () { return true; });
      }
      if (E.aberto) return fazer();
      if (!lerRegistro()) return Promise.resolve(true);
      return API.pedir(opcoes).then(function (ok) { if (!ok) throw erro('cofre-trancado'); return fazer(); });
    },

    /* abre a janela de criar/abrir (só se precisar). Promise<boolean> */
    pedir: function (opcoes) {
      if (E.aberto) return Promise.resolve(true);
      if (_pedindo) return _pedindo;
      opcoes = opcoes || {};
      _pedindo = API.abrirSemPin().then(function (ok) {
        if (ok) return true;
        if (!d.body) return false;
        return janela({ motivo: opcoes.motivo || { pt: TX.motivoPadrao[0], en: TX.motivoPadrao[1] }, semOferta: !!opcoes.semOferta });
      }).then(function (ok) { _pedindo = null; return ok; }, function () { _pedindo = null; return false; });
      return _pedindo;
    },

    /* onde cada app guardava as chaves antes (ver o cabeçalho da seção 5) */
    registrarFontes: function (lista) {
      (Array.isArray(lista) ? lista : [lista]).forEach(function (f) { if (f && typeof f.chave === 'string') _registradas.push(f); });
      return todasFontes().length;
    },
    fontes: function () { return todasFontes().map(function (f) { return { chave: f.chave, caminho: f.caminho || '', mapa: f.mapa || null, prefixo: typeof f.prefixo === 'string' ? f.prefixo : (f.mapa ? '' : 'ia:') }; }); },

    /* copia as chaves em texto aberto para o cofre e tira SÓ esses campos do lugar antigo.
       Pode rodar quantas vezes quiser. Devolve o relatório (nunca os valores). */
    migrar: function (fontes) {
      var lista = todasFontes(fontes);
      var r = procurar(lista), rel = { movidas: 0, copiadas: 0, itens: [], erros: r.erros.slice(), trancado: false };
      if (!r.achados.length) return Promise.resolve(rel);
      if (!E.aberto) { rel.trancado = true; return Promise.resolve(rel); }
      /* lugar antigo que fica (manter): só copia o que o cofre ainda não tem — a chave trocada no cofre vale,
         a cópia velha não a sobrescreve */
      r.achados = r.achados.filter(function (a) { return !(deixarNoLugar(a.fonte) && Object.prototype.hasOwnProperty.call(E.conteudo, a.nome)); });
      if (!r.achados.length) return Promise.resolve(rel);
      r.achados.forEach(function (a) { E.conteudo[a.nome] = a.valor; });
      return persistir().then(function () {
        var porFonte = [];
        r.achados.forEach(function (a) {
          var g = porFonte.filter(function (x) { return x.fonte === a.fonte; })[0];
          if (!g) { g = { fonte: a.fonte, campos: [], nomes: [] }; porFonte.push(g); }
          g.campos.push(a.campo); g.nomes.push(a.nome);
        });
        porFonte.forEach(function (g) {
          if (deixarNoLugar(g.fonte)) {   /* outros apps ainda leem dali: copiou, não tirou */
            rel.copiadas += g.campos.length;
            rel.itens.push({ chave: g.fonte.chave, caminho: g.fonte.caminho || '', campos: g.campos, nomes: g.nomes, ficou: true });
            return;
          }
          try {
            tirarDoLugarAntigo(g.fonte, g.campos);
            rel.movidas += g.campos.length;
            rel.itens.push({ chave: g.fonte.chave, caminho: g.fonte.caminho || '', campos: g.campos, nomes: g.nomes });
          } catch (e) { rel.erros.push({ chave: g.fonte.chave, motivo: 'nao-deu-para-tirar' }); }
        });
        r.achados.forEach(function (a) { avisar('cofre:mudou', { nome: a.nome, tem: true, migrado: true }); });
        avisar('cofre:migrado', rel);
        return rel;
      }, function (e) {
        rel.erros.push({ chave: '*', motivo: 'nao-deu-para-guardar' });
        return rel;     /* o lugar antigo fica como estava */
      });
    }
  };

  /* outra aba ou outro app mudou o cofre: acompanha (ou tranca, se ele sumiu ou foi trocado) */
  raiz.addEventListener('storage', function (ev) {
    if (ev.key !== NOME || !E.aberto) return;
    var reg = lerRegistro();
    if (!reg || idDe(reg) !== E.id) { if (fecharMemoria()) { apagarSessao(); avisar('cofre:trancado', { motivo: 'outra-aba' }); } return; }
    var dek = E.dek;
    decifrar(dek, reg.dados).then(function (b) { if (E.aberto && E.dek === dek) { E.conteudo = deBytes(b); avisar('cofre:mudou', { nome: '*' }); } })
      .catch(function () { if (fecharMemoria()) avisar('cofre:trancado', { motivo: 'outra-aba' }); });
  });

  /* os painéis da digital acompanham quando ela liga/desliga ou o cofre é apagado */
  ['cofre:digital', 'cofre:trancado'].forEach(function (ev) {
    d.addEventListener(ev, function () { _paineis.slice().forEach(desenharPainel); });
  });
  API.digitalDisponivel();     /* descobre já se o aparelho tem digital: o painel e a janela não precisam esperar */

  /* ao carregar: quem tinha "Lembrar neste aparelho" (1.0.0) perde a chave do aparelho e volta a usar o PIN;
     depois tenta continuar aberto só se for F5 nesta aba */
  /* 1.4.0: se a aba acabou de sair de um app com as regras do PIN (proteger) e esta página é OUTRO app,
     a sessão da aba não serve: o cofre fica trancado (sair do app tranca, em qualquer app que abrir depois) */
  function saiuDeOutroAppProtegido() {
    var s = null;
    try { s = JSON.parse(raiz.sessionStorage.getItem(NOME_SAIU) || 'null'); } catch (e) {}
    if (!s || !s.protegido || s.app === appAqui()) return false;
    try { raiz.sessionStorage.removeItem(NOME_SAIU); } catch (e2) {}
    return true;
  }
  API.pronto = (API.lembrado() ? API.esquecerAparelho().catch(function () {}) : Promise.resolve())
    .then(function () { if (saiuDeOutroAppProtegido()) return apagarSessao().then(function () { return false; }); return API.abrirSemPin(); })
    .catch(function () { return false; });

  raiz.SolverCofre = API;
})(typeof window !== 'undefined' ? window : this);
