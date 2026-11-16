"""Projecao fechada de catalogos; dados comerciais ou segredos nunca sao copiados."""
from mtr.sigor.privacidade import ErroSeguro

CAMPOS={
    'classes':('claCodigo','claDescricao'), 'unidades-medida':('uniCodigo','uniDescricao'),
    'tratamentos':('traCodigo','traDescricao'), 'estados-fisicos':('tieCodigo','tieDescricao'),
    'acondicionamentos':('tiaCodigo','tiaDescricao'), 'residuos':('resCodigoIbama','resDescricao'),
    'classes-por-residuo':('claCodigo','claDescricao'), 'acondicionamentos-por-estado':('tiaCodigo','tiaDescricao'),
}

def normalizar_catalogo(operacao,itens):
    if operacao not in CAMPOS or not isinstance(itens,list) or len(itens)>100000: raise ErroSeguro('RESPOSTA_INCOMPATIVEL')
    codigo,descricao=CAMPOS[operacao]; resultado=[]; vistos=set()
    for item in itens:
        if not isinstance(item,dict): raise ErroSeguro('RESPOSTA_INCOMPATIVEL')
        cod=item.get(codigo); desc=item.get(descricao)
        if operacao=='residuos':
            if not isinstance(cod,str) or not 1<=len(cod)<=80 or any(ord(c)<32 for c in cod): raise ErroSeguro('RESPOSTA_INCOMPATIVEL')
        elif type(cod) is not int or not 1<=cod<=2147483647: raise ErroSeguro('RESPOSTA_INCOMPATIVEL')
        if not isinstance(desc,str) or not 1<=len(desc)<=2000 or any(ord(c)<32 for c in desc) or cod in vistos: raise ErroSeguro('RESPOSTA_INCOMPATIVEL')
        vistos.add(cod); resultado.append({'codigo':cod,'descricao':desc})
    return resultado
