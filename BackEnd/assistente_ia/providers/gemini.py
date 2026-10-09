import os
from pathlib import Path

from dotenv import load_dotenv

try:
    from google import genai
except (ImportError, SystemError):
    genai = None


class IAServiceManager:
    """Cliente resiliente do Gemini; a aplicação funciona mesmo sem o provedor."""

    _instancia = None

    def __new__(cls):
        if cls._instancia is None:
            cls._instancia = super().__new__(cls)
            cls._instancia._inicializar_recursos()
        return cls._instancia

    def _inicializar_recursos(self):
        base_dir = Path(__file__).resolve().parents[2]
        load_dotenv(base_dir / ".env", override=False)
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("API_KEY", "")
        self.client = genai.Client(api_key=self.api_key) if genai and self.api_key else None
        self.last_error = ""

    @staticmethod
    def _safe_error_message(error):
        error_text = str(error)
        if "reported as leaked" in error_text:
            return "A chave do Gemini foi bloqueada. Gere uma nova GEMINI_API_KEY."
        if "PERMISSION_DENIED" in error_text or "API_KEY_INVALID" in error_text:
            return "A GEMINI_API_KEY não tem permissão para gerar conteúdo."
        if "ConnectError" in error_text or "WinError 10013" in error_text:
            return "Não foi possível conectar ao Gemini neste ambiente."
        return "Não foi possível obter resposta do Gemini agora."

    def get_ai_status(self):
        if genai is None:
            return {"available": False, "message": "SDK do Gemini não está instalado."}
        if not self.api_key:
            return {"available": False, "message": "Defina GEMINI_API_KEY no arquivo BackEnd/.env."}
        if self.last_error:
            return {"available": False, "message": self.last_error}
        return {"available": self.client is not None, "message": ""}

    def is_ai_available(self):
        return self.get_ai_status()["available"]

    def _generate_content(self, prompt):
        if self.client is None:
            return None
        try:
            response = self.client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        except TypeError:
            try:
                response = self.client.models.generate_content(model="gemini-2.5-flash", content=prompt)
            except Exception as error:  # integração externa não pode interromper o fluxo local
                self.last_error = self._safe_error_message(error)
                return None
        except Exception as error:  # integração externa não pode interromper o fluxo local
            self.last_error = self._safe_error_message(error)
            return None

        text = getattr(response, "text", None)
        if text:
            self.last_error = ""
            return text.strip()
        self.last_error = "O Gemini respondeu sem texto para esta solicitação."
        return None

    def get_product_ai_description(self, product_name):
        return self._generate_content(
            "Crie uma descrição objetiva, em português do Brasil e com até 300 caracteres "
            f'para o item industrial "{product_name}". Não invente certificações. Retorne apenas a descrição.'
        )

    def get_anounce_price_ai_description(self, product_context):
        return self._generate_content(
            "Sugira um preço unitário em reais para este resíduo industrial. "
            f"Contexto: {product_context}. Retorne somente o número, como 2,80."
        )

    def get_anounce_ai_description(self, product_context):
        return self._generate_content(
            "Crie uma descrição comercial em português do Brasil, com até 300 caracteres, "
            f"para este anúncio de resíduo: {product_context}. Não invente dados. Retorne apenas a descrição."
        )

    def get_freight_recommendation(self, freight_context):
        return self._generate_content(
            "Recomende de forma objetiva o veículo e os cuidados para este frete de resíduos: "
            f"{freight_context}. Use português do Brasil e no máximo 300 caracteres."
        )
