"""Erros da aplicação independentes do adaptador HTTP/DRF."""


class ErroRegraNegocio(Exception):
    codigo_http = 400

    def __init__(self, detalhes):
        self.detalhes = detalhes
        super().__init__(str(detalhes))


class ErroConflito(ErroRegraNegocio):
    codigo_http = 409


class ErroProcessamentoPagamento(ErroRegraNegocio):
    codigo_http = 503
