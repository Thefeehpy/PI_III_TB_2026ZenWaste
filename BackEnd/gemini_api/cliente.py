import os
from pathlib import Path

from dotenv import load_dotenv

try:
    from google import genai
except ImportError:
    genai = None


BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env", override=True)
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("API_KEY", "")
client = genai.Client(api_key=api_key) if genai and api_key else None
last_error = ""


def _safe_error_message(error):
    error_text = str(error)

    if "reported as leaked" in error_text:
        return "A chave do Gemini configurada foi bloqueada por vazamento. Gere uma nova chave e salve em GEMINI_API_KEY."
    if "PERMISSION_DENIED" in error_text or "API_KEY_INVALID" in error_text:
        return "A chave do Gemini nao tem permissao para gerar conteudo. Confira ou troque a GEMINI_API_KEY."
    if "ConnectError" in error_text or "WinError 10013" in error_text:
        return "Nao foi possivel conectar ao Gemini a partir deste ambiente."

    return "Nao foi possivel obter resposta do Gemini agora."


def get_ai_status():
    if genai is None:
        return {
            "available": False,
            "message": "SDK do Gemini nao instalado no Python em uso. Rode o backend pela .venv ou instale google-genai.",
        }

    if not api_key:
        return {
            "available": False,
            "message": "Chave do Gemini nao configurada. Defina GEMINI_API_KEY no arquivo BackEnd/.env.",
        }

    if last_error:
        return {
            "available": False,
            "message": last_error,
        }

    return {
        "available": client is not None,
        "message": "",
    }


def is_ai_available():
    return get_ai_status()["available"]


def _generate_content(prompt):
    global last_error

    if client is None:
        return None

    try:
        response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
    except TypeError:
        try:
            response = client.models.generate_content(model="gemini-2.5-flash", content=prompt)
        except Exception as error:
            last_error = _safe_error_message(error)
            return None
    except Exception as error:
        last_error = _safe_error_message(error)
        return None

    text = getattr(response, "text", None)
    if text:
        last_error = ""
        return text.strip()

    last_error = "O Gemini respondeu sem texto para esta solicitacao."
    return None


def get_product_ai_description(product_name):
    prompt = f"""
Crie uma descricao objetiva para o item industrial "{product_name}".
Regras:
- Portugues do Brasil.
- No maximo 300 caracteres.
- Sem inventar certificacoes, marcas ou garantias.
- Retorne apenas a descricao.
"""
    return _generate_content(prompt)


def get_anounce_price_ai_description(product_context):
    prompt = f"""
Sugira um preco unitario em reais para este residuo industrial.
Contexto: {product_context}
Regras:
- O preco deve ser por unidade informada no contexto.
- Retorne apenas um numero em reais, sem explicacao. Exemplo: 2,80
"""
    return _generate_content(prompt)


def get_anounce_ai_description(product_context):
    prompt = f"""
Crie uma descricao comercial para um anuncio de residuo industrial.
Contexto: {product_context}
Regras:
- Portugues do Brasil.
- No maximo 300 caracteres.
- Destaque material, quantidade e aplicacao quando informado.
- Nao invente certificacoes, origem, limpeza ou qualidade se nao estiver no contexto.
- Retorne apenas a descricao.
"""
    return _generate_content(prompt)
