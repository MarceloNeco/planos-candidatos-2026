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
PRES_SAIDA = os.path.join(AQUI, 'presidencia')
# número de urna -> código do candidato no site (o mesmo dos nomes dos PDFs dos planos)
NUM_PRES = {'13': 'lul', '22': 'bol', '14': 'ren', '28': 'mar', '29': 'rui', '30': 'zem', '55': 'cai', '70': 'cur'}
EXECUTIVO = {'Poder Executivo', 'Presidência da República'}
csv.field_size_limit(10 ** 8)


def legislatura(hoje=None):
    """Legislatura em curso: nº e o dia em que começou. Cada uma começa em 1º de fevereiro
    do ano seguinte à eleição (57ª: 01/02/2023; 58ª: 01/02/2027). Troca sozinha pela data."""
    hoje = hoje or date.today()
    n = (hoje.year - 1795) // 4
    if hoje < date(1795 + 4 * n, 2, 1):
        n -= 1
    return n, date(1795 + 4 * n, 2, 1)


def mandato_presidencial(hoje=None):
    """Início do mandato presidencial em curso. Desde 2027 a posse é em 5 de janeiro
    (Emenda Constitucional 111/2021); antes era em 1º de janeiro."""
    hoje = hoje or date.today()
    a = hoje.year - (hoje.year - 2023) % 4
    ini = date(a, 1, 5) if a >= 2027 else date(a, 1, 1)
    if hoje < ini:
        a -= 4
        ini = date(a, 1, 5) if a >= 2027 else date(a, 1, 1)
    return ini


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


def mandato(leg, ini, ligados, tmp):
    """Mandato em curso, para cada parlamentar ligado a uma candidatura: em quantas votações
    nominais do plenário votou desde o início da legislatura, quantas vezes votou com a maioria
    do próprio partido e, na Câmara, com a orientação do Governo. Devolve também as últimas
    votações (as duas Casas) com o voto de cada um, para os avisos da página."""
    import bisect
    hoje, desde_iso = date.today(), ini.isoformat()
    plen, votos_v, gov = {}, {}, {}
    for ano in range(ini.year, hoje.year + 1):
        print('mandato: Câmara', ano, '…')
        try:
            arq = {}
            for nome in ('votacoes', 'votacoesProposicoes', 'votacoesOrientacoes', 'votacoesVotos'):
                arq[nome] = baixa('%s/%s/csv/%s-%d.csv' % (CAMARA_ARQ, nome, nome, ano), json_=False,
                                  destino=os.path.join(tmp, nome + '.csv'))
        except Exception as e:
            print('  sem arquivo de %d (%s)' % (ano, e)); continue
        ler = lambda n: csv.DictReader(open(arq[n], encoding='utf-8-sig'), delimiter=';')
        for r in ler('votacoes'):
            if r['siglaOrgao'] == 'PLEN' and r['data'] >= desde_iso:
                plen['c' + r['id']] = {'casa': 'c', 'data': r['data'], 'desc': (r['descricao'] or '')[:300]}
        for r in ler('votacoesProposicoes'):
            k = 'c' + r['idVotacao']
            if k in plen and 'prop' not in plen[k]:
                plen[k].update(prop=r['proposicao_titulo'].split(' (')[0], em=(r['proposicao_ementa'] or '')[:240],
                               pid=r['proposicao_id'])
        for r in ler('votacoesOrientacoes'):
            k = 'c' + r['idVotacao']
            if k in plen and r['siglaBancada'] == 'Governo' and r['orientacao'] in ('Sim', 'Não'):
                gov[k] = 'S' if r['orientacao'] == 'Sim' else 'N'
        for r in ler('votacoesVotos'):
            k = 'c' + r['idVotacao']
            cod = VOTO_CAMARA.get(r['voto'])
            if k in plen and cod and r['deputado_id']:
                votos_v.setdefault(k, {})[('dep', int(r['deputado_id']))] = (cod, partido(r['deputado_siglaPartido']))
        for f in arq.values():
            os.remove(f)
    for ano in range(ini.year, hoje.year + 1):
        print('mandato: Senado', ano, '…')
        a, b = max(ini, date(ano, 1, 1)), min(hoje, date(ano, 12, 31))
        for v in baixa('%s/votacao?dataInicio=%s&dataFim=%s' % (SENADO, a, b)) or []:
            if v.get('votacaoSecreta') == 'S':
                continue
            k = 's%d' % v['codigoSessaoVotacao']
            plen[k] = {'casa': 's', 'data': v.get('dataSessao') or '', 'desc': (v.get('descricaoVotacao') or '')[:300],
                       'prop': v.get('identificacao') or '', 'em': (v.get('ementa') or '')[:240], 'mat': v.get('codigoMateria')}
            for x in v.get('votos') or []:
                cod = VOTO_SENADO.get(x.get('siglaVotoParlamentar'))
                if cod:
                    votos_v.setdefault(k, {})[('sen', x['codigoParlamentar'])] = (cod, partido(x.get('siglaPartidoParlamentar')))
    plen = {k: v for k, v in plen.items() if k in votos_v}   # só votação com voto registrado (nominal)
    # posição da maioria de cada partido em cada votação (com pelo menos 3 votos Sim/Não, sem empate)
    maioria = {}
    for k, vv in votos_v.items():
        cont = {}
        for cod, pt in vv.values():
            if cod in 'SN':
                c = cont.setdefault(pt, [0, 0]); c[0 if cod == 'S' else 1] += 1
        maioria[k] = {pt: ('S' if a > b else 'N') for pt, (a, b) in cont.items() if a != b and a + b >= 3}
    datas = {c: sorted(v['data'] for v in plen.values() if v['casa'] == c) for c in 'cs'}
    alvo, por_pid = set(ligados), {}
    for k, vv in votos_v.items():
        for pid, (cod, pt) in vv.items():
            if pid in alvo:
                por_pid.setdefault(pid, []).append((plen[k]['data'], k, cod, pt))
    stats = {}
    for pid, L in por_pid.items():
        ds = sorted(x[0] for x in L)
        dl = datas['c' if pid[0] == 'dep' else 's']
        # presença: só conta o período em que a pessoa estava votando (posse, licença, suplência)
        tot = bisect.bisect_right(dl, ds[-1]) - bisect.bisect_left(dl, ds[0])
        pp, gv = [0, 0], [0, 0]
        for d, k, cod, pt in L:
            if cod in 'SN':
                mj = maioria[k].get(pt)
                if mj:
                    pp[1] += 1; pp[0] += cod == mj
                if k in gov:
                    gv[1] += 1; gv[0] += cod == gov[k]
        st = {'leg': leg, 'vt': len(L), 'tot': tot, 'de': ds[0], 'ate': ds[-1], 'pp': pp}
        if gv[1]:
            st['gv'] = gv
        stats[pid] = st
    rec = []
    for k, v in sorted(plen.items(), key=lambda kv: (kv[1]['data'], kv[0]), reverse=True)[:25]:
        vv = votos_v[k]
        item = {'k': k, 'casa': v['casa'], 'data': v['data'], 'desc': v['desc'], 'prop': v.get('prop', ''),
                'em': v.get('em', ''), 'placar': [sum(1 for c, _ in vv.values() if c == 'S'), sum(1 for c, _ in vv.values() if c == 'N')],
                'v': {('d%d' if pid[0] == 'dep' else 's%d') % pid[1]: cod for pid, (cod, pt) in vv.items() if pid in alvo}}
        if k in gov:
            item['gov'] = gov[k]
        if v.get('pid'):
            item['pid'] = v['pid']
        if v.get('mat'):
            item['mat'] = v['mat']
        rec.append(item)
    return stats, rec


# cargos da colinha, na ordem em que aparecem na urna em 2026
COLA_CARGOS = {'DEPUTADO FEDERAL': 'F', 'DEPUTADO ESTADUAL': 'E', 'DEPUTADO DISTRITAL': 'E',
               'SENADOR': 'S', 'GOVERNADOR': 'G', 'PRESIDENTE': 'P'}


def gera_cola(zbytes):
    """Lista leve de TODAS as candidaturas que vão na urna (presidente, governador, senador,
    deputado federal e estadual/distrital), um arquivo por estado (cola/SP.json) e um para a
    Presidência (cola/BR.json). É o que a Colinha da eleição usa para buscar e montar a cola.
    Cada item: [cargo, número, nome de urna, partido, id do TSE (para a foto), resultado]."""
    z = zipfile.ZipFile(io.BytesIO(zbytes))
    nome_csv = [n for n in z.namelist() if n.endswith('_BRASIL.csv')][0]
    por_uf, partidos, vistos = {}, {}, set()
    for r in csv.DictReader(io.TextIOWrapper(z.open(nome_csv), encoding='latin-1'), delimiter=';'):
        cg = COLA_CARGOS.get(r['DS_CARGO'])
        if not cg or r['SQ_CANDIDATO'] in vistos:
            continue
        vistos.add(r['SQ_CANDIDATO'])
        uf = 'BR' if cg == 'P' else r['SG_UF']
        res = (r.get('DS_SIT_TOT_TURNO') or '').strip()
        item = [cg, r['NR_CANDIDATO'], r['NM_URNA_CANDIDATO'].strip(), r['SG_PARTIDO'], r['SQ_CANDIDATO']]
        if res and not res.startswith('#'):
            item.append(res)
        por_uf.setdefault(uf, []).append(item)
        partidos[r['SG_PARTIDO']] = r['NR_PARTIDO']
    pasta = os.path.join(AQUI, 'cola')
    os.makedirs(pasta, exist_ok=True)
    for uf, L in por_uf.items():
        L.sort(key=lambda x: ('PGSFE'.index(x[0]), norm(x[2])))
        with io.open(os.path.join(pasta, uf + '.json'), 'w', encoding='utf-8') as f:
            json.dump({'uf': uf, 'c': L}, f, ensure_ascii=False, separators=(',', ':'))
    with io.open(os.path.join(pasta, 'partidos.json'), 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(partidos.items())), f, ensure_ascii=False, separators=(',', ':'))
    print('colinha: %d candidaturas em %d arquivos' % (len(vistos), len(por_uf)))
    gera_fotos(por_uf)


FOTOS_TSE = 'https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_%s_div.zip'


def gera_fotos(por_uf):
    """Foto de cada candidatura da colinha, pequena (até 120x160, JPEG), em cola/fotos/<UF>/<id>.jpg.
    O site do TSE não deixa o navegador usar a foto dele numa imagem (manda o cabeçalho de
    permissão repetido), então a foto oficial é copiada do pacote de fotos do TSE para cá.
    Só baixa o pacote de um estado quando falta alguma foto dele."""
    try:
        from PIL import Image
    except ImportError:
        print('fotos: sem o Pillow (pip install pillow), ficam as que já existem')
        return
    total = 0
    for uf, L in sorted(por_uf.items()):
        pasta = os.path.join(AQUI, 'cola', 'fotos', uf)
        os.makedirs(pasta, exist_ok=True)
        quer = {x[4] for x in L}
        tem = {n[:-4] for n in os.listdir(pasta) if n.endswith('.jpg')}
        for velho in tem - quer:   # candidatura que saiu da lista
            os.remove(os.path.join(pasta, velho + '.jpg'))
        falta = quer - tem
        if not falta:
            continue
        try:
            z = zipfile.ZipFile(io.BytesIO(baixa(FOTOS_TSE % uf, json_=False)))
        except Exception as e:
            print('fotos %s: pacote do TSE indisponível (%s)' % (uf, e))
            continue
        for n in z.namelist():
            m = re.search(r'(\d+)_div\.jpe?g$', n, re.I)
            if not m or m.group(1) not in falta:
                continue
            try:
                im = Image.open(io.BytesIO(z.read(n))).convert('RGB')
                im.thumbnail((120, 160))
                im.save(os.path.join(pasta, m.group(1) + '.jpg'), 'JPEG', quality=70, optimize=True, progressive=True)
                total += 1
            except Exception:
                pass
    print('fotos: %d novas' % total)


def main():
    if '--so-cola' in sys.argv:   # só a colinha (rápido: um download do TSE)
        gera_cola(baixa(TSE + '/consulta_cand/consulta_cand_2026.zip', json_=False))
        return
    LEG, INI = legislatura()
    POSSE = date(2027, 1, 5)   # mandato do presidente eleito em 2026 (EC 111/2021); antes disso não há atos dele
    print('legislatura %d desde %s' % (LEG, INI))
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

    data_de = {chave(v): v.get('data', '') for v in todas}

    def eixos_de(vv, filtro=None):
        """nota por eixo (-1 = lado A, +1 = lado B) e a nota geral, com o nº de votos.
        filtro: 'antes' / 'depois' do início da legislatura em curso"""
        por, tot = {}, [0, 0]
        for k, cod in vv.items():
            if filtro and (data_de.get(k, '') >= INI.isoformat()) != (filtro == 'depois'):
                continue
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
    # deputados da legislatura em curso (a partir de fev/2027, os novos eleitos), mesmo sem voto ainda
    for pag in range(1, 30):
        r = baixa('%s/deputados?idLegislatura=%d&itens=100&pagina=%d&ordem=ASC&ordenarPor=nome' % (CAMARA, LEG, pag))
        if not r.get('dados'):
            break
        for d in r['dados']:
            info.setdefault(('dep', d['id']), (d['siglaUf'], d['nome']))
    # 55: quem estava no meio do mandato em 2019; até a legislatura em curso (novos senadores em 2027)
    try:
        sl = baixa('%s/senador/lista/legislatura/55/%d.json' % (SENADO, max(57, LEG)))
    except Exception:
        sl = baixa('%s/senador/lista/legislatura/55/57.json' % SENADO)
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
    zbytes = baixa(TSE + '/consulta_cand/consulta_cand_2026.zip', json_=False)
    gera_cola(zbytes)
    z = zipfile.ZipFile(io.BytesIO(zbytes))
    nome_csv = [n for n in z.namelist() if n.endswith('_BRASIL.csv')][0]
    linhas = csv.DictReader(io.TextIOWrapper(z.open(nome_csv), encoding='latin-1'), delimiter=';')
    cands, vistos, pres_res = [], set(), {}
    for r in linhas:
        if r['DS_CARGO'] == 'PRESIDENTE' and NUM_PRES.get(r['NR_CANDIDATO']):
            res = (r.get('DS_SIT_TOT_TURNO') or '').strip()
            if res and not res.startswith('#'):
                pres_res[NUM_PRES[r['NR_CANDIDATO']]] = res
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

    def soma(pid, ids_pauta, rot, link, nova=False):
        d = prio.setdefault(pid, {'n': 0, 'p': {}, 'x': {}, 'nl': 0, 'pl': {}})
        d['n'] += 1
        if nova:   # apresentada na legislatura em curso
            d['nl'] += 1
            for pa in ids_pauta:
                d['pl'][pa] = d['pl'].get(pa, 0) + 1
        for pa in ids_pauta:
            d['p'][pa] = d['p'].get(pa, 0) + 1
            ex = d['x'].setdefault(pa, [])
            if len(ex) < 3:
                ex.append([rot, link])

    tmp = tempfile.mkdtemp()
    atos = []   # projetos e medidas provisórias enviados pelo Executivo desde a posse do eleito
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
        autores, do_exec = {}, set()
        for r in csv.DictReader(open(fa, encoding='utf-8-sig'), delimiter=';'):
            if r['idDeputadoAutor'] and int(r['idDeputadoAutor']) in deps:
                autores.setdefault(r['idProposicao'], set()).add(int(r['idDeputadoAutor']))
            if r['nomeAutor'] in EXECUTIVO:
                do_exec.add(r['idProposicao'])
        temas = {}
        for r in csv.DictReader(open(ft, encoding='utf-8-sig'), delimiter=';'):
            temas.setdefault(r['uriProposicao'].rsplit('/', 1)[1], set()).add(r['tema'])
        for r in csv.DictReader(open(fp, encoding='utf-8-sig'), delimiter=';'):
            quando = (r.get('dataApresentacao') or '')[:10]
            if r['id'] in do_exec and r['siglaTipo'] in TIPOS | {'MPV'} and quando >= POSSE.isoformat():
                atos.append({'id': r['id'], 'tipo': r['siglaTipo'], 'num': r['numero'], 'ano': r['ano'], 'data': quando,
                             'em': (r['ementa'] or '')[:300], 'temas': sorted(temas.get(r['id'], set()))})
            if r['siglaTipo'] not in TIPOS or r['id'] not in autores:
                continue
            tm, em = temas.get(r['id'], set()), r['ementa'] or ''
            ids = [p['id'] for p in pautas if tm & temas_de[p['id']] or (p['id'] in re_cam and re_cam[p['id']].search(em))]
            rot = '%s %s/%s' % (r['siglaTipo'], r['numero'], r['ano'])
            link = 'c' + r['id']   # a página monta o endereço da Câmara
            for i in autores[r['id']]:
                soma(('dep', i), ids, rot, link, quando >= INI.isoformat())
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
            soma(('sen', i), ids, ident, 's%s' % r.get('codigoMateria'),   # a página monta o endereço do Senado
                 (r.get('dataApresentacao') or '')[:10] >= INI.isoformat())

    # ---------- mandato em curso ----------
    m_stats, recentes = mandato(LEG, INI, ligados, tmp)

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
        vv, pr = {}, {'n': 0, 'p': {}, 'x': {}, 'nl': 0, 'pl': {}}
        for pid in achou:
            c[pid[0]] = pid[1]
            if pid in desde:
                c[pid[0] + '_desde'] = desde[pid]
            if pid in m_stats:
                c.setdefault('m', {})['c' if pid[0] == 'dep' else 's'] = m_stats[pid]
            vv.update(votos.get(pid, {}))
            if pid in prio:
                pr['n'] += prio[pid]['n']
                pr['nl'] += prio[pid]['nl']
                for k, n in prio[pid]['p'].items():
                    pr['p'][k] = pr['p'].get(k, 0) + n
                for k, n in prio[pid]['pl'].items():
                    pr['pl'][k] = pr['pl'].get(k, 0) + n
                for k, ex in prio[pid]['x'].items():
                    pr['x'].setdefault(k, []).extend(ex[:3 - len(pr['x'].get(k, []))])
        if vv:
            c['v'] = vv
            e, g = eixos_de(vv)
            if e:
                c['e'] = e
            if g:
                c['g'] = g
            # antes x depois do início da legislatura em curso (coerência); só quando há os dois
            ea, _ = eixos_de(vv, 'antes')
            ed, _ = eixos_de(vv, 'depois')
            if ea and ed:
                c['ea'], c['ed'] = ea, ed
        if pr['n']:
            if not pr['nl']:
                del pr['nl'], pr['pl']
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
    indice['legislatura'] = {'n': LEG, 'inicio': INI.isoformat(), 'proxima': date(1795 + 4 * (LEG + 1), 2, 1).isoformat()}
    with io.open(os.path.join(SAIDA, 'indice.json'), 'w', encoding='utf-8') as f:
        json.dump(indice, f, ensure_ascii=False, indent=1)
    with io.open(os.path.join(SAIDA, 'recentes.json'), 'w', encoding='utf-8') as f:
        json.dump({'legislatura': LEG, 'votacoes': recentes}, f, ensure_ascii=False, separators=(',', ':'))
    # Presidência: resultado do TSE e atos do Executivo desde a posse do eleito
    os.makedirs(PRES_SAIDA, exist_ok=True)
    eleito = next((k for k, v in pres_res.items() if v == 'ELEITO'), None)
    atos.sort(key=lambda a: (a['data'], a['id']), reverse=True)
    with io.open(os.path.join(PRES_SAIDA, 'mandato.json'), 'w', encoding='utf-8') as f:
        json.dump({'posse': POSSE.isoformat(), 'eleito': eleito, 'resultado': pres_res,
                   'segundo_turno': sorted(k for k, v in pres_res.items() if '2' in v and 'TURNO' in v.upper()),
                   'atos': atos}, f, ensure_ascii=False, indent=1)
    total = sum(len(c) for c in estados.values())
    print('pronto: %d candidaturas, %d com mandato ligado, %s' % (total, len(ligados), agora))


if __name__ == '__main__':
    main()
