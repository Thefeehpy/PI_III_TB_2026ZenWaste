import os
from pathlib import Path

from dotenv import load_dotenv

try:
    from google import genai
except ImportError:
    genai = None


DIRETORIO_BASE = Path(__file__).resolve().parent.parent

load_dotenv(DIRETORIO_BASE / ".env", override=True)
chave_api = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("API_KEY", "")
cliente = genai.Client(api_key=chave_api) if genai and chave_api else None
ultimo_erro = ""


def _mensagem_erro_segura(erro):
    texto_erro = str(erro)
    codigo = getattr(erro, "code", None)
    if codigo == 429:
        return "Limite de uso do Gemini atingido. Confira a cota do projeto no Google AI Studio."
    if codigo == 503:
        return "Gemini temporariamente sobrecarregado. Tente novamente em alguns minutos."
    if codigo == 504 or "timed out" in texto_erro.lower() or "timeout" in texto_erro.lower():
        return "O Gemini excedeu o tempo de resposta. Tente novamente em alguns minutos."
    if codigo == 404:
        return "Modelo Gemini indisponivel para este projeto. Confira GEMINI_MODEL no BackEnd/.env."

    if "reported as leaked" in texto_erro:
        return "A chave do Gemini configurada foi bloqueada por vazamento. Gere uma nova chave e salve em GEMINI_API_KEY."
    if "PERMISSION_DENIED" in texto_erro or "API_KEY_INVALID" in texto_erro:
        return "A chave do Gemini nao tem permissao para gerar conteudo. Confira ou troque a GEMINI_API_KEY."
    if "ConnectError" in texto_erro or "WinError 10013" in texto_erro:
        return "Nao foi possivel conectar ao Gemini a partir deste ambiente."

    return "Nao foi possivel obter resposta do Gemini agora."


def obter_situacao_ia():
    if genai is None:
        return {
            "available": False,
            "message": "SDK do Gemini nao instalado no Python em uso. Rode o backend pela .venv ou instale google-genai.",
        }

    if not chave_api:
        return {
            "available": False,
            "message": "Chave do Gemini nao configurada. Defina GEMINI_API_KEY no arquivo BackEnd/.env.",
        }

    if ultimo_erro:
        return {
            "available": False,
            "message": ultimo_erro,
        }

    return {
        "available": cliente is not None,
        "message": "",
    }


def ia_disponivel():
    return cliente is not None


def _gerar_conteudo(instrucao):
    global ultimo_erro

    if cliente is None:
        return None

    try:
        resposta = cliente.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
            contents=instrucao,
            config={"http_options": {"timeout": 30000}},
        )
    except Exception as erro:
        ultimo_erro = _mensagem_erro_segura(erro)
        return None

    texto = getattr(resposta, "text", None)
    if texto:
        ultimo_erro = ""
        return texto.strip()

    ultimo_erro = "O Gemini respondeu sem texto para esta solicitacao."
    return None


def gerar_descricao_produto_ia(nome_produto):
    instrucao = f"""
Crie uma descricao objetiva para o item industrial "{nome_produto}".
Regras:
- Portugues do Brasil.
- No maximo 300 caracteres.
- Sem inventar certificacoes, marcas ou garantias.
- Retorne apenas a descricao.
"""
    return _gerar_conteudo(instrucao)


def gerar_preco_anuncio_ia(contexto_produto):
    instrucao = f"""
Sugira um preco unitario em reais para este residuo industrial.
Contexto: {contexto_produto}
Regras:
- O preco deve ser por unidade informada no contexto.
- Retorne apenas um numero em reais, sem explicacao. Exemplo: 2,80
"""
    return _gerar_conteudo(instrucao)


def gerar_descricao_anuncio_ia(contexto_produto):
    instrucao = f"""
Crie uma descricao comercial para um anuncio de residuo industrial.
Contexto: {contexto_produto}
Regras:
- Portugues do Brasil.
- No maximo 300 caracteres.
- Destaque material, quantidade e aplicacao quando informado.
- Nao invente certificacoes, origem, limpeza ou qualidade se nao estiver no contexto.
- Retorne apenas a descricao.
"""
    return _gerar_conteudo(instrucao)
