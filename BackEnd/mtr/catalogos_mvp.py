"""Catálogos explícitos de simulação; nunca classificações aprovadas para emissão real."""
from pathlib import Path
from functools import lru_cache
from hashlib import sha256
import json

TIPOS = {
    'unidades': ('uniCodigo', [(9001, 'FICTÍCIO · quilograma')]),
    'tratamentos': ('traCodigo', [(9002, 'FICTÍCIO · tratamento de teste')]),
    'estados': ('tieCodigo', [(9003, 'FICTÍCIO · sólido de teste')]),
    'acondicionamentos': ('tiaCodigo', [(9004, 'FICTÍCIO · embalagem de teste')]),
    'classes': ('claCodigo', [(9005, 'FICTÍCIO · classe de teste')]),
}


@lru_cache(maxsize=1)
def referencia_operador():
    pasta=Path(__file__).parent/'dados'
    bruto=(pasta/'residuos_referencia_operador.json').read_bytes()
    dados=json.loads(bruto.decode('utf-8-sig'))
    meta=json.loads((pasta/'procedencia_referencia.json').read_text(encoding='utf-8'))
    if sha256(bruto).hexdigest()!=meta['sha256'] or dados.get('erro') is not False or len(dados['objetoResposta'])!=meta['registros']:
        raise ValueError('Integridade da referencia de catalogo inconsistente.')
    linhas=dados['objetoResposta']
    if any(not isinstance(r.get('resCodigoIbama'),str) or not isinstance(r.get('resDescricao'),str) for r in linhas) or len({r['resCodigoIbama'] for r in linhas})!=len(linhas):
        raise ValueError('Codigos da referencia devem ser textuais e unicos.')
    return tuple({'codigo':r['resCodigoIbama'],'descricao':r['resDescricao'],'perigoso':True if '*' in r['resCodigoIbama'] else None,
        'origem':'referencia_operador_homologacao','aprovado_ambientalmente':False} for r in dados['objetoResposta']),meta


def catalogos_mvp():
    arquivo = Path(__file__).parent / 'dados' / 'catalogo_mock.json'
    original = json.loads(arquivo.read_text(encoding='utf-8'))
    referencia,procedencia=referencia_operador()
    return {
        'ambiente': 'MOCK', 'simulado': True, 'aprovado_ambientalmente': False,
        'fonte': original['referencia_fonte'], 'versao': original['versao'],
        'residuos': [{'codigo': r['codigo'], 'descricao': r['descricao'], 'perigoso': r['perigoso'], 'origem':'fixture_fase1a', 'aprovado_ambientalmente':False} for r in original['codigos']] + list(referencia),
        'referencia_operador':procedencia,
        **{tipo: [{'codigo': codigo, 'descricao': texto} for codigo,texto in itens] for tipo,(_,itens) in TIPOS.items()},
        'compatibilidades': {'natureza': 'somente_simulacao', 'regra': 'Combinações destes itens são exclusivamente fictícias.'},
    }
