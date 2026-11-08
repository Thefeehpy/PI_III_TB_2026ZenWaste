"""Configuracoes do projeto Django ZenWaste."""

import os
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

# Diretorio de referencia para os caminhos locais do projeto.
DIRETORIO_BASE = Path(__file__).resolve().parent.parent
load_dotenv(DIRETORIO_BASE / '.env', override=False)


# Configuracoes do ambiente de desenvolvimento.
# Referencia: https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/

# A chave do ambiente compartilhado deve vir da configuracao externa.
DEBUG = os.getenv('ZENWASTE_DEBUG', 'True').lower() in ('1', 'true', 'yes')
CHAVE_DESENVOLVIMENTO = 'django-insecure-s=!$sv$!$s*_g*&0many3kk$sbl(vj0du--lrvt$schj+2rw$-'
SECRET_KEY = os.getenv('ZENWASTE_SECRET_KEY') or CHAVE_DESENVOLVIMENTO
if not DEBUG and SECRET_KEY == CHAVE_DESENVOLVIMENTO:
    raise ImproperlyConfigured('Configure ZENWASTE_SECRET_KEY fora do ambiente local.')

ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']


# Aplicativos e componentes do projeto.

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'localflavor',    

    'autenticacao.apps.ConfiguracaoAutenticacao',
    'empresas',
    'produtos',     
    'acesso.apps.ConfiguracaoAcesso',
    'anuncios',
    'comercializacao.apps.ConfiguracaoComercializacao',
    'mercado.apps.ConfiguracaoMercado',
    'pedidos',
    'fretes.apps.ConfiguracaoFretes',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'app.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'app.wsgi.application'


# Banco de dados.
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases
#
MOTOR_BANCO = os.getenv('ZENWASTE_DB_ENGINE', '').strip().lower()
if MOTOR_BANCO != 'postgresql':
    raise ImproperlyConfigured(
        "ZENWASTE_DB_ENGINE deve ser configurado como 'postgresql'."
    )

VARIAVEIS_POSTGRESQL = (
    'ZENWASTE_DB_NAME',
    'ZENWASTE_DB_USER',
    'ZENWASTE_DB_PASSWORD',
    'ZENWASTE_DB_HOST',
    'ZENWASTE_DB_PORT',
)
VARIAVEIS_BANCO_AUSENTES = [
    nome for nome in VARIAVEIS_POSTGRESQL
    if not os.getenv(nome) or not os.getenv(nome, '').strip()
]
if VARIAVEIS_BANCO_AUSENTES:
    raise ImproperlyConfigured(
        'Configure as variaveis obrigatorias do PostgreSQL: '
        + ', '.join(VARIAVEIS_BANCO_AUSENTES)
        + '.'
    )

try:
    PORTA_BANCO = int(os.environ['ZENWASTE_DB_PORT'])
    if not 1 <= PORTA_BANCO <= 65535:
        raise ValueError
except (TypeError, ValueError):
    raise ImproperlyConfigured(
        'ZENWASTE_DB_PORT deve ser um numero inteiro entre 1 e 65535.'
    ) from None

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ['ZENWASTE_DB_NAME'],
        'USER': os.environ['ZENWASTE_DB_USER'],
        'PASSWORD': os.environ['ZENWASTE_DB_PASSWORD'],
        'HOST': os.environ['ZENWASTE_DB_HOST'],
        'PORT': os.environ['ZENWASTE_DB_PORT'],
    }
}


# Validacao de senha.
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Idioma e fuso horario.
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'pt-br'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Arquivos estaticos (CSS, JavaScript e imagens).
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = 'static/'

CORS_ALLOWED_ORIGINS = [
    'http://127.0.0.1:8080',
    'http://localhost:8080',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://localhost:3000',
]

CORS_ALLOW_CREDENTIALS = True

URL_FRONTEND = os.getenv('FRONTEND_URL')
if URL_FRONTEND and URL_FRONTEND not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(URL_FRONTEND)

REST_FRAMEWORK = {
    'EXCEPTION_HANDLER': 'app.erros_api.tratar_excecao',
    
    'DEFAULT_AUTHENTICATION_CLASSES': (
    
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    )
    
}

INTEGRACAO_PAGAMENTO = os.getenv('ZENWASTE_PAYMENT_GATEWAY', 'sandbox' if DEBUG else 'disabled').lower()
CLASSE_INTEGRACAO_PAGAMENTO = os.getenv('ZENWASTE_PAYMENT_GATEWAY_CLASS', '')
SEGREDO_NOTIFICACAO_PAGAMENTO = os.getenv('ZENWASTE_PAYMENT_WEBHOOK_SECRET', '')
MINUTOS_RESERVA_PEDIDO = int(os.getenv('ZENWASTE_ORDER_RESERVATION_MINUTES', '30'))
