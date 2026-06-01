import os

from dotenv import load_dotenv


load_dotenv()
api_key = os.getenv("API_KEY", "")

# Produto does not have a dedicated AI description column in the current
# database schema. Keep this module import-safe because AppConfig loads it
# during Django startup.
