import os

from dotenv import load_dotenv

try:
    from google import genai
except ImportError:
    genai = None


load_dotenv()
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("API_KEY", "")
client = genai.Client(api_key=api_key) if genai and api_key else None


def is_ai_available():
    return client is not None


def _generate_content(prompt):
    if client is None:
        return None

    try:
        response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
    except TypeError:
        response = client.models.generate_content(model="gemini-2.5-flash", content=prompt)
    except Exception:
        return None

    text = getattr(response, "text", None)
    return text.strip() if text else None


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
