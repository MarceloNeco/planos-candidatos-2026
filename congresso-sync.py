#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Atualiza os dados da aba Congresso a partir das fontes oficiais.

    python3 congresso-sync.py

O método inteiro está em congresso-pautas.json (pautas, eixos, destaques).
O que este script faz, nesta ordem:
  1. Votos: para cada votação citada em congresso-pautas.json, baixa da API da
     Câmara ou do Senado como cada parlamentar votou.
  2. Posicionamento: transforma esses votos numa nota de -1 (lado A) a +1
     (lado B) por eixo, para cada parlamentar e para cada partido (média da
     bancada na hora do voto).
  3. Prioridades: conta as propostas (PL, PLP, PEC) de cada parlamentar por
     pauta. Câmara: tema oficial da própria Câmara (arquivos anuais) e, onde
     não há tema, palavras no resumo. Senado: palavras no resumo (o Senado não
     publica tema).
  4. Candidaturas do TSE (senador e deputado federal) e patrimônio declarado.
     Liga candidato a parlamentar pelo NOME CIVIL + ESTADO (a Câmara não publica
     o CPF); de reserva, o nome civil em qualquer estado ou o nome de urna no
     mesmo estado, só se for único. O CPF não sai daqui.
  5. Grava congresso/indice.json e um arquivo por estado (congresso/SP.json…).

Só usa a biblioteca padrão do Python. Roda no GitHub Actions uma vez por dia
(.github/workflows/congresso-sync.yml).
"""
import csv, hashlib, io, json, os, re, sys, tempfile, time, unicodedata, urllib.request, zipfile
from datetime import date, datetime, timezone

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, 'congresso')
CAMARA = 'https://dadosabertos.camara.leg.br/api/v2'
CAMARA_ARQ = 'https://dadosabertos.camara.leg.br/arquivos'
SENADO = 'https://legis.senado.leg.br/dadosabertos'
TSE = 'https://cdn.tse.jus.br/estatistica/sead/odsele'
CARGOS = {'SENADOR': 'S', 'DEPUTADO FEDERAL': 'F'}
UFS = ('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO').split()
ANOS = range(2019, date.today().year + 1)        # propostas e votos desde a legislatura de 2019
TIPOS = {'PL', 'PLP', 'PEC'}                       # só proposta de lei e de emenda à Constituição
DIA_ELEICAO = date(2026, 10, 4)
csv.field_size_limit(10 ** 8)


def baixa(url, json_=True, tentativas=4, destino=None):
    """GET com insistência (as APIs públicas às vezes respondem 5xx).
    Com destino, grava em arquivo (para os arquivos grandes da Câmara)."""
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={'Accept': 'application/json' if json_ else '*/*',
                                                       'User-Agent': 'eleicoes2026-congresso-sync'})
            with urllib.request.urlopen(req, timeout=300) as r:
                if destino:
                    with open(destino, 'wb') as f:
                        while True:
                            b = r.read(1 << 20)
                            if not b:
                                break
                            f.write(b)
                    return destino
                dado = r.read()
            return json.loads(dado.decode('utf-8')) if json_ else dado
        except Exception as e:  # rede instável: espera e tenta de novo
            if i == tentativas - 1:
                raise
            print('  falhou (%s), tentando de novo…' % e)
            time.sleep(2 ** (i + 1))


def norm(nome):
    """MAIÚSCULAS, sem acento e com um espaço só: é a chave de comparação de nomes."""
    s = unicodedata.normalize('NFD', nome or '').encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', s).strip().upper()


def partido(sigla):
    """Mesma sigla escrita de jeitos diferentes pela Câmara, pelo Senado e pelo TSE."""
    s = norm(sigla).replace(' ', '')
    return {'PODEMOS': 'PODE', 'UNIAOBRASIL': 'UNIAO', 'PCDOB': 'PCDOB', 'SOLIDARIEDADE': 'SOLIDARIEDADE',
            'REPUBLICANO': 'REPUBLICANOS', 'CIDADANIA': 'CIDADANIA'}.get(s, s)


def lista(x):
    return x if isinstance(x, list) else ([x] if x else [])


# Sim e Não contam; abstenção e obstrução aparecem na ficha, mas não contam.
VOTO_CAMARA = {'Sim': 'S', 'Não': 'N', 'Abstenção': 'A', 'Obstrução': 'O'}
VOTO_SENADO = {'Sim': 'S', 'Não': 'N', 'Abstenção': 'A', 'P-NRV': 'A'}


def votos_camara(v):
    det = baixa('%s/votacoes/%s' % (CAMARA, v['id']))['dados']
    props = det.get('proposicoesAfetadas') or []
    v.update({'data': det['data'], 'prop_id': props[0]['id'] if props else None})
    out = {}
    for x in baixa('%s/votacoes/%s/votos' % (CAMARA, v['id']))['dados']:
        d = x['deputado_']
        cod = VOTO_CAMARA.get(x['tipoVoto'])
        if cod:
            out[('dep', d['id'])] = (cod, d['siglaUf'], d['nome'], d['siglaPartido'])
    return out


_sen_dia = {}
def votos_senado(v):
    if v['data'] not in _sen_dia:
        _sen_dia[v['data']] = baixa('%s/votacao?dataInicio=%s&dataFim=%s' % (SENADO, v['data'], v['data']))
    alvo = [x for x in _sen_dia[v['data']] if x.get('codigoSessaoVotacao') == v['cod']]
    if not alvo:
        sys.exit('Senado: votação %s não encontrada em %s' % (v['cod'], v['data']))
    v['materia'] = alvo[0].get('codigoMateria')
    out = {}
    for x in alvo[0].get('votos') or []:
        cod = VOTO_SENADO.get(x.get('siglaVotoParlamentar'))
        if cod:
            out[('sen', x['codigoParlamentar'])] = (cod, x.get('siglaUFParlamentar'), x.get('nomeParlamentar'),
                                                    x.get('siglaPartidoParlamentar'))
    return out


def chave(v):
    return ('c' + v['id']) if v.get('casa', 'camara') == 'camara' and 'id' in v else ('s%d' % v['cod'])


def main():
    met = json.load(io.open(os.path.join(AQUI, 'congresso-pautas.json'), encoding='utf-8'))
    pautas, eixos, destaques = met['pautas'], met['eixos'], met['destaques']

    # ---------- 1. votos ----------
    votos = {}            # (casa, id) -> {chave votação: código}
    info = {}             # (casa, id) -> (uf, nome parlamentar)
    lado = {}             # chave votação -> 'A'/'B' (só as dos eixos)
    eixo_de = {}          # chave votação -> id do eixo
    partido_soma = {}     # partido -> {eixo: [soma, n]}
    todas = []
    for e in eixos:
        for v in e['votos']:
            todas.append(v); lado[chave(v)] = v['sim']; eixo_de[chave(v)] = e['id']
    for d in destaques:
        if d.get('camara'):
            d['camara']['casa'] = 'camara'; todas.append(d['camara'])
        if d.get('senado'):
            d['senado']['casa'] = 'senado'; todas.append(d['senado'])
    for v in todas:
        k = chave(v)
        print('votação', k)
        res = votos_camara(v) if v.get('casa', 'camara') == 'camara' else votos_senado(v)
        sim = sum(1 for r in res.values() if r[0] == 'S'); nao = sum(1 for r in res.values() if r[0] == 'N')
        v['placar'] = [sim, nao]
        for pid, (cod, uf, nome, sig) in res.items():
            votos.setdefault(pid, {})[k] = cod
            info[pid] = (uf, nome)
            if k in lado and cod in 'SN':
                val = (-1 if (cod == 'S') == (lado[k] == 'A') else 1)
                ps = partido_soma.setdefault(partido(sig), {}).setdefault(eixo_de[k], [0, 0])
                ps[0] += val; ps[1] += 1

    def eixos_de(vv):
        """nota por eixo (-1 = lado A, +1 = lado B) e a nota geral, com o nº de votos"""
        por, tot = {}, [0, 0]
        for k, cod in vv.items():
            if k in lado and cod in 'SN':
                val = -1 if (cod == 'S') == (lado[k] == 'A') else 1
                p = por.setdefault(eixo_de[k], [0, 0]); p[0] += val; p[1] += 1
                tot[0] += val; tot[1] += 1
        e = {k: [round(s / n, 2), n] for k, (s, n) in por.items()}
        return e, ([round(tot[0] / tot[1], 2), tot[1]] if tot[1] else None)

    partidos = {}
    for sig, por in partido_soma.items():
        tot = [sum(s for s, n in por.values()), sum(n for s, n in por.values())]
        if tot[1] >= 10:   # bancada com voto suficiente para virar estimativa
            partidos[sig] = {'e': {k: round(s / n, 2) for k, (s, n) in por.items() if n >= 3},
                             'g': round(tot[0] / tot[1], 2), 'n': tot[1]}

    # ---------- nomes civis ----------
    print('deputados e senadores…')
    txt = baixa('%s/deputados/csv/deputados.csv' % CAMARA_ARQ, json_=False).decode('utf-8-sig')
    civil, desde = {}, {}
    for r in csv.DictReader(io.StringIO(txt), delimiter=';'):
        i = int(r['uri'].rsplit('/', 1)[1])
        civil[('dep', i)] = r['nomeCivil']
        try:
            desde[('dep', i)] = 1795 + 4 * int(r['idLegislaturaInicial'])   # legislatura 57 = 2023
        except ValueError:
            pass
    sl = baixa('%s/senador/lista/legislatura/55/57.json' % SENADO)   # 55: quem estava no meio do mandato em 2019
    sen_ufs = {}
    for par in lista(sl['ListaParlamentarLegislatura']['Parlamentares']['Parlamentar']):
        idp = par['IdentificacaoParlamentar']
        pid = ('sen', int(idp['CodigoParlamentar']))
        civil[pid] = idp.get('NomeCompletoParlamentar') or ''
        mand = lista((par.get('Mandatos') or {}).get('Mandato'))
        sen_ufs[pid] = {m.get('UfParlamentar') for m in mand}
        inis = [m.get('PrimeiraLegislaturaDoMandato', {}).get('DataInicio', '')[:4] for m in mand]
        inis = [int(a) for a in inis if a.isdigit()]
        if inis:
            desde[pid] = min(inis)
        if pid not in info:
            info[pid] = (next(iter(sen_ufs[pid]), ''), idp.get('NomeParlamentar') or '')

    por_civil, por_civil_br, por_parl, por_parl_br = {}, {}, {}, {}
    for pid, (uf, nome) in info.items():
        ufs = sen_ufs.get(pid) or {uf}
        for u in ufs:
            por_civil.setdefault((norm(civil.get(pid)), u), []).append(pid)
        por_civil_br.setdefault(norm(civil.get(pid)), []).append(pid)
        por_parl.setdefault((norm(nome), uf), []).append(pid)
        por_parl_br.setdefault(norm(nome), []).append(pid)
    por_civil_br.pop('', None)

    def dois_nomes(n):
        return norm(n).split(' ')[:2]

    def por_urna_br(r):
        """nome de urna = nome parlamentar em outro estado (quem mudou de estado e de
        nome civil, ex.: casou): só se for único no país e os 2 primeiros nomes civis baterem"""
        ach = por_parl_br.get(norm(r['NM_URNA_CANDIDATO'])) or []
        if len(ach) == 1 and dois_nomes(civil.get(ach[0])) == dois_nomes(r['NM_CANDIDATO']):
            return ach
        return []

    # ---------- candidaturas do TSE ----------
    print('candidaturas do TSE…')
    z = zipfile.ZipFile(io.BytesIO(baixa(TSE + '/consulta_cand/consulta_cand_2026.zip', json_=False)))
    nome_csv = [n for n in z.namelist() if n.endswith('_BRASIL.csv')][0]
    linhas = csv.DictReader(io.TextIOWrapper(z.open(nome_csv), encoding='latin-1'), delimiter=';')
    cands, vistos = [], set()
    for r in linhas:
        cg, uf = CARGOS.get(r['DS_CARGO']), r['SG_UF']
        if not cg or uf not in UFS or (r['NR_CPF_CANDIDATO'], cg) in vistos:
            continue
        vistos.add((r['NR_CPF_CANDIDATO'], cg))
        achou = (por_civil.get((norm(r['NM_CANDIDATO']), uf)) or por_civil_br.get(norm(r['NM_CANDIDATO']))
                 or por_parl.get((norm(r['NM_URNA_CANDIDATO']), uf)) or por_urna_br(r))
        # mesmo nome para dois deputados (ou dois senadores) = ambíguo: melhor sem voto que voto errado
        if sum(1 for a in achou if a[0] == 'dep') > 1 or sum(1 for a in achou if a[0] == 'sen') > 1:
            achou = []
        cands.append((r, cg, uf, achou))

    print('patrimônio declarado…')
    bens = {}
    zb = zipfile.ZipFile(io.BytesIO(baixa(TSE + '/bem_candidato/bem_candidato_2026.zip', json_=False)))
    nb = [n for n in zb.namelist() if n.endswith('_BRASIL.csv')][0]
    for r in csv.DictReader(io.TextIOWrapper(zb.open(nb), encoding='latin-1'), delimiter=';'):
        try:
            bens[r['SQ_CANDIDATO']] = bens.get(r['SQ_CANDIDATO'], 0) + float(r['VR_BEM_CANDIDATO'].replace(',', '.'))
        except ValueError:
            pass

    # ---------- 3. prioridades: propostas por pauta ----------
    ligados = {a for _, _, _, ach in cands for a in ach}
    deps = {i for c, i in ligados if c == 'dep'}
    temas_de = {p['id']: set(p.get('temas_camara') or []) for p in pautas}
    re_cam = {p['id']: re.compile(p['palavras_camara'] if p.get('palavras_camara') else p['palavras'], re.I)
              for p in pautas if p.get('palavras_camara') or not p.get('temas_camara')}
    re_sen = {p['id']: re.compile(p['palavras'], re.I) for p in pautas}
    prio = {}   # pid -> {'n': total, 'p': {pauta: n}, 'x': {pauta: [[rótulo, link]]}}

    def soma(pid, ids_pauta, rot, link):
        d = prio.setdefault(pid, {'n': 0, 'p': {}, 'x': {}})
        d['n'] += 1
        for pa in ids_pauta:
            d['p'][pa] = d['p'].get(pa, 0) + 1
            ex = d['x'].setdefault(pa, [])
            if len(ex) < 3:
                ex.append([rot, link])

    tmp = tempfile.mkdtemp()
    for ano in ANOS:
        print('propostas da Câmara', ano, '…')
        try:
            fa = baixa('%s/proposicoesAutores/csv/proposicoesAutores-%d.csv' % (CAMARA_ARQ, ano), json_=False,
                       destino=os.path.join(tmp, 'a.csv'))
            fp = baixa('%s/proposicoes/csv/proposicoes-%d.csv' % (CAMARA_ARQ, ano), json_=False,
                       destino=os.path.join(tmp, 'p.csv'))
            ft = baixa('%s/proposicoesTemas/csv/proposicoesTemas-%d.csv' % (CAMARA_ARQ, ano), json_=False,
                       destino=os.path.join(tmp, 't.csv'))
        except Exception as e:
            print('  sem arquivo de %d (%s)' % (ano, e)); continue
        autores = {}
        for r in csv.DictReader(open(fa, encoding='utf-8-sig'), delimiter=';'):
            if r['idDeputadoAutor'] and int(r['idDeputadoAutor']) in deps:
                autores.setdefault(r['idProposicao'], set()).add(int(r['idDeputadoAutor']))
        temas = {}
        for r in csv.DictReader(open(ft, encoding='utf-8-sig'), delimiter=';'):
            temas.setdefault(r['uriProposicao'].rsplit('/', 1)[1], set()).add(r['tema'])
        for r in csv.DictReader(open(fp, encoding='utf-8-sig'), delimiter=';'):
            if r['siglaTipo'] not in TIPOS or r['id'] not in autores:
                continue
            tm, em = temas.get(r['id'], set()), r['ementa'] or ''
            ids = [p['id'] for p in pautas if tm & temas_de[p['id']] or (p['id'] in re_cam and re_cam[p['id']].search(em))]
            rot = '%s %s/%s' % (r['siglaTipo'], r['numero'], r['ano'])
            link = 'c' + r['id']   # a página monta o endereço da Câmara
            for i in autores[r['id']]:
                soma(('dep', i), ids, rot, link)
        for f in (fa, fp, ft):
            os.remove(f)
    for c, i in sorted(ligados):
        if c != 'sen':
            continue
        print('propostas do senador', i, '…')
        lst = baixa('%s/processo?codigoParlamentarAutor=%d&dataInicio=2019-01-01' % (SENADO, i))
        for r in lst or []:
            ident = r.get('identificacao') or ''
            if ident.split(' ')[0] not in TIPOS:
                continue
            em = r.get('ementa') or ''
            ids = [p['id'] for p in pautas if re_sen[p['id']].search(em)]
            soma(('sen', i), ids, ident, 's%s' % r.get('codigoMateria'))   # a página monta o endereço do Senado

    # ---------- 4. monta cada candidatura ----------
    estados = {uf: [] for uf in UFS}
    for r, cg, uf, achou in cands:
        c = {'id': r['SQ_CANDIDATO'], 'n': r['NM_URNA_CANDIDATO'].strip(), 'p': r['SG_PARTIDO'],
             'num': r['NR_CANDIDATO'], 'cg': cg, 'esc': r['DS_GRAU_INSTRUCAO'].strip().capitalize(),
             'ocup': r['DS_OCUPACAO'].strip().capitalize()}
        try:
            d, m, a = (int(x) for x in r['DT_NASCIMENTO'].split('/'))
            c['idade'] = DIA_ELEICAO.year - a - ((DIA_ELEICAO.month, DIA_ELEICAO.day) < (m, d))
        except ValueError:
            pass
        if r['SQ_CANDIDATO'] in bens:
            c['bens'] = round(bens[r['SQ_CANDIDATO']])
        vv, pr = {}, {'n': 0, 'p': {}, 'x': {}}
        for pid in achou:
            c[pid[0]] = pid[1]
            if pid in desde:
                c[pid[0] + '_desde'] = desde[pid]
            vv.update(votos.get(pid, {}))
            if pid in prio:
                pr['n'] += prio[pid]['n']
                for k, n in prio[pid]['p'].items():
                    pr['p'][k] = pr['p'].get(k, 0) + n
                for k, ex in prio[pid]['x'].items():
                    pr['x'].setdefault(k, []).extend(ex[:3 - len(pr['x'].get(k, []))])
        if vv:
            c['v'] = vv
            e, g = eixos_de(vv)
            if e:
                c['e'] = e
            if g:
                c['g'] = g
        if pr['n']:
            c['t'] = pr
        res = (r.get('DS_SIT_TOT_TURNO') or '').strip()
        if res and not res.startswith('#'):
            c['r'] = res
        estados[uf].append(c)

    # ---------- 5. grava ----------
    os.makedirs(SAIDA, exist_ok=True)
    agora = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    resumo, impressao = {}, hashlib.sha256()
    for uf, cs in estados.items():
        cs.sort(key=lambda c: (c['cg'], norm(c['n'])))
        resumo[uf] = {'S': sum(c['cg'] == 'S' for c in cs), 'F': sum(c['cg'] == 'F' for c in cs),
                      'mandato': sum('v' in c or 't' in c for c in cs)}
        txt = json.dumps({'uf': uf, 'c': cs}, ensure_ascii=False, separators=(',', ':'))
        impressao.update(txt.encode('utf-8'))
        with io.open(os.path.join(SAIDA, uf + '.json'), 'w', encoding='utf-8') as f:
            f.write(txt)
    impressao.update(json.dumps([met, partidos], ensure_ascii=False, sort_keys=True).encode('utf-8'))
    impressao = impressao.hexdigest()
    # duas datas: "conferido_em" = esta execução; "atualizado_em" = última vez que algum dado mudou
    atualizado = agora
    try:
        antigo = json.load(io.open(os.path.join(SAIDA, 'indice.json'), encoding='utf-8'))
        if antigo.get('impressao') == impressao:
            atualizado = antigo.get('atualizado_em', agora)
    except (OSError, ValueError):
        pass
    indice = {'atualizado_em': atualizado, 'conferido_em': agora, 'impressao': impressao,
              'fontes': {'camara': CAMARA, 'senado': SENADO, 'tse': TSE},
              'pautas': pautas, 'eixos': eixos, 'destaques': destaques, 'partidos': partidos, 'ufs': resumo}
    with io.open(os.path.join(SAIDA, 'indice.json'), 'w', encoding='utf-8') as f:
        json.dump(indice, f, ensure_ascii=False, indent=1)
    total = sum(len(c) for c in estados.values())
    print('pronto: %d candidaturas, %d com mandato ligado, %s' % (total, len(ligados), agora))


if __name__ == '__main__':
    main()
