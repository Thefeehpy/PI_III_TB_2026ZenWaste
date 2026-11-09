"""Contratos internos MOCK; não reproduzem o schema HTTP da CETESB."""

from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol
import re

from mtr.validacoes import validar_texto


class EstadoOperacaoSimulada(StrEnum):
    PENDENTE = "pendente"
    CONFIRMADA = "confirmada_simulada"
    INDETERMINADA = "indeterminada"
    NAO_ENCONTRADA = "nao_encontrada"


@dataclass(frozen=True)
class IntencaoSimulada:
    identificador_interno: str
    correlacao: str
    resumo_dados: str

    def __post_init__(self):
        validar_texto(self.identificador_interno, "identificador_interno", limite=128)
        validar_texto(self.correlacao, "correlacao", limite=128)
        if not isinstance(self.resumo_dados, str) or not re.fullmatch(r"[0-9a-f]{64}", self.resumo_dados):
            raise ValueError("Resumo deve ser SHA-256 hexadecimal do conteúdo interno.")


@dataclass(frozen=True)
class SessaoSimulada:
    identificador: str = "MOCK-SEM-ACESSO-EXTERNO"
    provedor: str = "MOCK"
    simulado: bool = True


@dataclass(frozen=True)
class ResultadoOperacaoSimulada:
    referencia: str
    correlacao: str
    estado: EstadoOperacaoSimulada
    simulado: bool = True
    numero_oficial: None = None

    def __post_init__(self):
        if self.simulado is not True or self.numero_oficial is not None or not isinstance(self.estado, EstadoOperacaoSimulada):
            raise ValueError("Resultado MOCK não pode declarar número ou confirmação oficial.")


@dataclass(frozen=True)
class DocumentoSimulado:
    conteudo: bytes
    nome_arquivo: str = "simulacao-mtr.txt"
    tipo_conteudo: str = "text/plain; charset=utf-8"
    simulado: bool = True
    oficial: bool = False

    def __post_init__(self):
        if self.simulado is not True or self.oficial is not False or not isinstance(self.conteudo, bytes) or self.conteudo.startswith(b"%PDF-"):
            raise ValueError("Documento MOCK deve ser conteúdo não oficial e não PDF.")


@dataclass(frozen=True)
class ItemCatalogoSimulado:
    codigo: str
    descricao: str
    simulado: bool = True


class IntegracaoMTR(Protocol):
    def autenticar(self) -> SessaoSimulada: ...
    def consultar_catalogos(self) -> tuple[ItemCatalogoSimulado, ...]: ...
    def validar(self, intencao: IntencaoSimulada) -> tuple[str, ...]: ...
    def solicitar_emissao(self, intencao: IntencaoSimulada) -> ResultadoOperacaoSimulada: ...
    def consultar_situacao(self, identificador_interno: str, correlacao: str) -> ResultadoOperacaoSimulada: ...
    def recuperar_documento(self, identificador_interno: str) -> DocumentoSimulado: ...
