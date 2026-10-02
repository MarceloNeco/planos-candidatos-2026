#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Atualiza os dados da aba Congresso a partir das fontes oficiais.

    python3 congresso-sync.py

O que faz, nesta ordem:
  1. Lê as perguntas em congresso-pautas.json (cada uma aponta para uma
     votação nominal da Câmara e/ou do Senado).
  2. Baixa da API da Câmara e da API do Senado como cada parlamentar votou
     nessas votações, e a lista de deputados (nome civil) e senadores.
  3. Baixa do TSE a lista de candidaturas de 2026 a senador e a deputado
     federal (consulta_cand_2026.zip).
  4. Liga candidato a parlamentar pelo NOME CIVIL + ESTADO (a Câmara não
     publica o CPF; o CPF do TSE é usado só para não duplicar, e não sai
     daqui). Na falta, tenta o nome de urna = nome parlamentar, no mesmo
     estado, e só aceita se for único.
  5. Grava congresso/indice.json (perguntas, placares, datas) e um arquivo por
     estado (congresso/SP.json etc.) — é isso que a página lê.

Só usa a biblioteca padrão do Python. Roda também no GitHub Actions
(.github/workflows/congresso-sync.yml), uma vez por dia.
"""
import csv, hashlib, io, json, os, re, sys, time, unicodedata, urllib.request, zipfile
from datetime import datetime, timezone

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, 'congresso')
CAMARA = 'https://dadosabertos.camara.leg.br/api/v2'
CAMARA_ARQ = 'https://dadosabertos.camara.leg.br/arquivos'
SENADO = 'https://legis.senado.leg.br/dadosabertos'
TSE_ZIP = 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip'
CARGOS = {'SENADOR': 'S', 'DEPUTADO FEDERAL': 'F'}
UFS = ('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO').split()


def baixa(url, json_=True, tentativas=4):
    """GET com insistência (as APIs públicas às vezes respondem 5xx)."""
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={'Accept': 'application/json' if json_ else '*/*',
                                                       'User-Agent': 'eleicoes2026-congresso-sync'})
            with urllib.request.urlopen(req, timeout=180) as r:
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


def lista(x):
    return x if isinstance(x, list) else ([x] if x else [])


# Sim e Não contam para a afinidade; abstenção e obstrução aparecem, mas não contam.
VOTO_CAMARA = {'Sim': 'S', 'Não': 'N', 'Abstenção': 'A', 'Obstrução': 'O'}
VOTO_SENADO = {'Sim': 'S', 'Não': 'N', 'Abstenção': 'A', 'P-NRV': 'A'}


def votos_camara(p):
    vid = p['camara']['id']
    det = baixa('%s/votacoes/%s' % (CAMARA, vid))['dados']
    props = det.get('proposicoesAfetadas') or []
    p['camara'].update({'data': det['data'], 'descricao': det['descricao'],
                        'prop_id': props[0]['id'] if props else None})
    votos = baixa('%s/votacoes/%s/votos' % (CAMARA, vid))['dados']
    out = {}
    for v in votos:
        d = v['deputado_']
        cod = VOTO_CAMARA.get(v['tipoVoto'])
        if cod:
            out[d['id']] = (cod, d['siglaUf'], d['nome'])
    sim = sum(1 for c in out.values() if c[0] == 'S')
    nao = sum(1 for c in out.values() if c[0] == 'N')
    p['camara']['placar'] = [sim, nao]
    return out


def votos_senado(p):
    s = p['senado']
    lst = baixa('%s/votacao?dataInicio=%s&dataFim=%s' % (SENADO, s['data'], s['data']))
    alvo = [v for v in lst if v.get('codigoSessaoVotacao') == s['cod']]
    if not alvo:
        sys.exit('Senado: votação %s não encontrada em %s' % (s['cod'], s['data']))
    v = alvo[0]
    s.update({'materia': v.get('codigoMateria'), 'descricao': v.get('descricaoVotacao')})
    out = {}
    for x in v.get('votos') or []:
        cod = VOTO_SENADO.get(x.get('siglaVotoParlamentar'))
        if cod:
            out[x['codigoParlamentar']] = (cod, x.get('siglaUFParlamentar'), x.get('nomeParlamentar'))
    s['placar'] = [sum(1 for c in out.values() if c[0] == 'S'), sum(1 for c in out.values() if c[0] == 'N')]
    return out


def main():
    pautas_arq = json.load(io.open(os.path.join(AQUI, 'congresso-pautas.json'), encoding='utf-8'))
    pautas = pautas_arq['pautas']

    # 1) votos de cada pergunta
    dep_votos, sen_votos = {}, {}      # id parlamentar -> {pauta: voto}
    dep_info, sen_info = {}, {}        # id -> (uf, nome parlamentar)
    for p in pautas:
        print('votação:', p['id'])
        if p.get('camara'):
            for i, (c, uf, nome) in votos_camara(p).items():
                dep_votos.setdefault(i, {})[p['id']] = c
                dep_info[i] = (uf, nome)
        if p.get('senado'):
            for i, (c, uf, nome) in votos_senado(p).items():
                sen_votos.setdefault(i, {})[p['id']] = c
                sen_info[i] = (uf, nome)

    # 2) nome civil dos deputados (arquivo da Câmara) e dos senadores (API do Senado)
    print('deputados e senadores…')
    txt = baixa('%s/deputados/csv/deputados.csv' % CAMARA_ARQ, json_=False).decode('utf-8-sig')
    civil_dep = {}
    for r in csv.DictReader(io.StringIO(txt), delimiter=';'):
        i = int(r['uri'].rsplit('/', 1)[1])
        if i in dep_info:
            civil_dep[i] = r['nomeCivil']
    sl = baixa('%s/senador/lista/legislatura/56/57.json' % SENADO)
    civil_sen = {}
    for par in lista(sl['ListaParlamentarLegislatura']['Parlamentares']['Parlamentar']):
        idp = par['IdentificacaoParlamentar']
        cod = int(idp['CodigoParlamentar'])
        ufs = {m.get('UfParlamentar') for m in lista((par.get('Mandatos') or {}).get('Mandato'))}
        civil_sen[cod] = (idp.get('NomeCompletoParlamentar') or '', ufs)

    # chaves de busca: (nome civil, UF); de reserva, o nome civil em qualquer estado
    # (quem mudou de estado para concorrer) e (nome parlamentar, UF)
    por_civil, por_civil_br, por_parl = {}, {}, {}
    for i, (uf, nome) in dep_info.items():
        por_civil.setdefault((norm(civil_dep.get(i)), uf), []).append(('dep', i))
        por_civil_br.setdefault(norm(civil_dep.get(i)), []).append(('dep', i))
        por_parl.setdefault((norm(nome), uf), []).append(('dep', i))
    for i, (uf, nome) in sen_info.items():
        civ, ufs = civil_sen.get(i, ('', set()))
        for u in (ufs or {uf}):
            por_civil.setdefault((norm(civ), u), []).append(('sen', i))
        por_civil_br.setdefault(norm(civ), []).append(('sen', i))
        por_parl.setdefault((norm(nome), uf), []).append(('sen', i))
    por_civil_br.pop('', None)

    # 3) candidaturas do TSE
    print('candidaturas do TSE…')
    z = zipfile.ZipFile(io.BytesIO(baixa(TSE_ZIP, json_=False)))
    nome_csv = [n for n in z.namelist() if n.endswith('_BRASIL.csv')][0]
    linhas = csv.DictReader(io.TextIOWrapper(z.open(nome_csv), encoding='latin-1'), delimiter=';')
    estados = {uf: [] for uf in UFS}
    vistos, ligados = set(), 0
    for r in linhas:
        cg = CARGOS.get(r['DS_CARGO'])
        uf = r['SG_UF']
        if not cg or uf not in estados:
            continue
        chave = (r['NR_CPF_CANDIDATO'], cg)
        if chave in vistos:
            continue
        vistos.add(chave)
        achou = por_civil.get((norm(r['NM_CANDIDATO']), uf)) or []
        if not achou:
            achou = por_civil_br.get(norm(r['NM_CANDIDATO'])) or []
        if not achou:
            achou = por_parl.get((norm(r['NM_URNA_CANDIDATO']), uf)) or []
        # mesma pessoa pode ter sido deputada e senadora; mais de um deputado com o mesmo nome = ambíguo
        if len([a for a in achou if a[0] == 'dep']) > 1 or len([a for a in achou if a[0] == 'sen']) > 1:
            achou = []
        c = {'n': r['NM_URNA_CANDIDATO'].strip(), 'p': r['SG_PARTIDO'], 'num': r['NR_CANDIDATO'], 'cg': cg}
        v = {}
        for casa, i in achou:
            c[casa] = i
            v.update((dep_votos if casa == 'dep' else sen_votos).get(i, {}))
        if achou:
            ligados += 1
            c['v'] = v
        res = (r.get('DS_SIT_TOT_TURNO') or '').strip()
        if res and not res.startswith('#'):
            c['r'] = res
        estados[uf].append(c)

    # 4) grava
    os.makedirs(SAIDA, exist_ok=True)
    agora = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    resumo, impressao = {}, hashlib.sha256()
    for uf, cs in estados.items():
        cs.sort(key=lambda c: (c['cg'], norm(c['n'])))
        resumo[uf] = {'S': sum(c['cg'] == 'S' for c in cs), 'F': sum(c['cg'] == 'F' for c in cs),
                      'mandato': sum('v' in c for c in cs)}
        txt = json.dumps({'uf': uf, 'c': cs}, ensure_ascii=False, separators=(',', ':'))
        impressao.update(txt.encode('utf-8'))
        with io.open(os.path.join(SAIDA, uf + '.json'), 'w', encoding='utf-8') as f:
            f.write(txt)
    impressao.update(json.dumps(pautas, ensure_ascii=False, sort_keys=True).encode('utf-8'))
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
              'fontes': {'camara': CAMARA, 'senado': SENADO, 'tse': TSE_ZIP},
              'pautas': pautas, 'ufs': resumo}
    with io.open(os.path.join(SAIDA, 'indice.json'), 'w', encoding='utf-8') as f:
        json.dump(indice, f, ensure_ascii=False, indent=1)
    total = sum(len(c) for c in estados.values())
    print('pronto: %d candidaturas, %d com votos no Congresso, %s' % (total, ligados, agora))


if __name__ == '__main__':
    main()
