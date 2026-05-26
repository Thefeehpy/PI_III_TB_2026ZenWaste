import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("API_KEY")

if len(api_key) > 0:
    client = genai.Client(
        api_key = api_key
    )

def get_product_ai_description(none):

    prompt = """
        Faça a descrição para um anúncio que contém o seguinte item {}, com no máximo 300 caracteres.
    """

    prompt = prompt.format(none)

    response = client.models.generate_content(model="gemini-2.5-flash", content = prompt)

    return response.text

def get_product_price_ai_description(none):

    prompt = """
        Faça a precificação do seguinte produto: {}, faça a cotação de acordo com o preço atualizado e entrega a resposta no formato monetário apenas 'R$XXXX,XX' o preço deve ser correspondente em kilos, não adicione nada na resposta além do valor.
    """

    prompt = prompt.format(none)

    response = client.models.generate_content(model="gemini-2.5-flash", content = prompt)

    return response.text
