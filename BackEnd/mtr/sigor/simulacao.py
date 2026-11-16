"""Fixtures de transporte: nunca consultam ou emitem perante o governo."""
from copy import deepcopy
from decimal import Decimal
import json
from mtr.sigor.leitura import RespostaPrivada
from mtr.sigor_contrato import json_wire

class TransporteDespachoSimulado:
    rede_real=False
    def __init__(self,cenario='sucesso'):
        if cenario not in {'sucesso','rejeicao','timeout','malformada','participante_invalido','parcial'}: raise ValueError('CENARIO_INVALIDO')
        self.cenario=cenario
    def enviar(self,wire):
        if self.cenario=='timeout': raise TimeoutError('Timeout exclusivamente simulado')
        p=json.loads(wire,parse_float=Decimal)[0]; m=deepcopy(p)
        m.update(restResponseValido=self.cenario!='rejeicao',manifestoNumeroNacional=999999999999 if self.cenario!='rejeicao' else None,manifestoNumeroEstadual=None,armazenadorTemporario=None)
        for k in ['transportador','destinador']: m[k]['restResponseValido']=True
        for i in m['listaManifestoResiduos']: i['restResponseValido']=self.cenario!='rejeicao'
        if self.cenario=='participante_invalido': m['destinador']['unidade']+=1
        if self.cenario=='parcial': m['listaManifestoResiduos'][0]['restResponseValido']=False
        retorno={'erroNacional':False,'respostaApiwsManifestoDTO':[m]}
        if self.cenario=='malformada': retorno={'erro':False,'objetoResposta':'nao e API10'}
        return RespostaPrivada(200,'application/json',json_wire(retorno).encode())

    def consultar(self,wire,consulta,gerador):
        p=json.loads(wire,parse_float=Decimal)[0]; e=p['listaManifestoResiduos'][0]
        r={'residuo':{'resCodigoIbama':e['resCodigoIbama']},'unidade':{'uniCodigo':e['uniCodigo']},'tratamento':{'traCodigo':e['traCodigo']},'tipoEstado':{'tieCodigo':e['tieCodigo']},'tipoAcondicionamento':{'tiaCodigo':e['tiaCodigo']},'classe':{'claCodigo':e['claCodigo']},'marQuantidade':e['marQuantidade']}
        m={'manNumero':'999999999999','manNumeroEstadual':None,'manResponsavel':p['nomeResponsavel'],'parceiroGerador':{'parCnpj':gerador['cpf_cnpj'],'parCodigo':gerador['unidade']},
            **{out:{'parCnpj':p[k]['cpfCnpj'],'parCodigo':p[k]['unidade']} for out,k in [('parceiroTransportador','transportador'),('parceiroDestinador','destinador')]},'listaManifestoResiduo':[r]}
        return RespostaPrivada(200,'application/json',json_wire({'erro':False,'objetoResposta':m}).encode())
