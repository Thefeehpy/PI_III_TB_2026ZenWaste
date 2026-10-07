# ZenWaste

Plataforma B2B para gestão de resíduos industriais, estoque, reservas, anúncios, transportes e inteligência de mercado.

O projeto usa React e TypeScript no front-end e Django REST Framework no back-end. Empresas podem cadastrar materiais, registrar movimentações, publicar anúncios, acompanhar reservas e consultar sugestões de preço e descrição.

## Funcionalidades

- Cadastro, autenticação e atualização do perfil da empresa.
- Cadastro de funcionários e papéis operacionais.
- Controle de itens e movimentações de estoque.
- Reservas com quantidade, prazo e status.
- Publicação, edição, cancelamento e finalização de anúncios.
- Marketplace público com contato por WhatsApp.
- Sugestões de preço e descrição por Gemini ou fallback local.
- Cadastro de transportadoras, caminhões e motoristas.
- Telas de auditoria de frete, entregas, assinatura, reservas e gestão de anúncios.

## Tecnologias

### Front-end

- React 18, TypeScript e Vite
- React Router e TanStack Query
- Tailwind CSS e Radix UI
- Vitest e Testing Library

### Back-end

- Python e Django 6
- Django REST Framework
- SQLite por padrão e PostgreSQL opcional
- Google Gen AI

## Estrutura do projeto

```text
ZenWaste/
├── BackEnd/
│   ├── anuncios/          # Entidades de domínio Anuncio e Reserva
│   ├── app/               # Configuração e rotas principais do Django
│   ├── authentication/    # Login, tokens, endpoints e serviços de autenticação
│   ├── empresas/          # Empresa, Funcionário e papéis
│   ├── gemini_api/        # Cliente da integração Gemini
│   ├── market/            # Inteligência de mercado e automações de IA
│   ├── marketplace/       # Casos de uso e API de anúncios
│   ├── produtos/          # Estoque, movimentações e serviços de reservas
│   ├── transportes/       # Transportadoras, caminhões e motoristas
│   ├── manage.py
│   └── requirements.txt
├── FrontEnd/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   ├── diagramas/
│   ├── documentos/
│   └── planejamento/
├── .env.example
└── README.md
```

## Responsabilidades dos módulos de anúncio

- `anuncios`: modelos, regras de domínio, administração e migrations de `Anuncio` e `Reserva`.
- `marketplace`: endpoints, serializers e coordenação dos casos de uso de publicação, edição, cancelamento e venda.
- `market`: histórico de preços, sugestões e integrações automáticas de IA.

As mudanças de estado ficam nas entidades. Os serviços do marketplace apenas validam e coordenam essas operações. O fluxo de venda utiliza Builder e as movimentações de estoque utilizam Factory.

## Pré-requisitos

- Python 3.12 ou superior
- Node.js 18 ou superior
- npm

## Configuração

### Back-end

No PowerShell, a partir da raiz:

```powershell
cd BackEnd
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

### Front-end

Em outro terminal:

```powershell
cd FrontEnd
npm ci
npm run dev
```

O front-end fica em `http://localhost:8080/` e a API em `http://127.0.0.1:8000/`.

## Variáveis de ambiente

Crie `FrontEnd/.env` quando quiser alterar a URL da API:

```dotenv
VITE_API_URL=http://127.0.0.1:8000/api
```

Para habilitar a IA, crie `BackEnd/.env`:

```dotenv
GEMINI_API_KEY=sua_chave
```

Sem uma chave válida ou sem o SDK disponível, as sugestões continuam funcionando pelo fallback local.

O back-end também aceita:

| Variável | Finalidade | Padrão |
| --- | --- | --- |
| `FRONTEND_URL` | Origem adicional permitida pelo CORS | Não definida |
| `ZENWASTE_DB_ENGINE` | `sqlite` ou `postgresql` | `sqlite` |
| `ZENWASTE_SQLITE_NAME` | Caminho alternativo do SQLite | `BackEnd/db.sqlite3` |
| `ZENWASTE_DB_NAME` | Nome do banco PostgreSQL | `zenwaste` |
| `ZENWASTE_DB_USER` | Usuário PostgreSQL | `postgres` |
| `ZENWASTE_DB_PASSWORD` | Senha PostgreSQL | Configuração local |
| `ZENWASTE_DB_HOST` | Host PostgreSQL | `localhost` |
| `ZENWASTE_DB_PORT` | Porta PostgreSQL | `5432` |

## API principal

Base local: `http://127.0.0.1:8000/api`

### Autenticação e empresa

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `POST` | `/auth/register/` | Cadastra uma empresa |
| `POST` | `/auth/login/` | Autentica e retorna token e empresa |
| `GET`, `PATCH` | `/auth/me/` | Consulta ou atualiza o perfil |
| `POST` | `/auth/recover-password/` | Solicita recuperação de senha |
| `POST` | `/auth/logout/` | Finaliza a sessão no cliente |

Nas rotas protegidas da aplicação, envie `Authorization: Bearer TOKEN`.

### Estoque e reservas

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `GET`, `POST` | `/inventory/items/` | Lista ou cadastra itens |
| `PATCH`, `DELETE` | `/inventory/items/{id}/` | Atualiza ou exclui um item |
| `POST` | `/inventory/items/{id}/movements/` | Registra entrada ou saída |
| `GET` | `/inventory/movements/` | Lista movimentações |
| `POST` | `/inventory/items/{id}/reservations/` | Cria uma reserva |
| `GET` | `/inventory/reservations/` | Lista reservas |
| `PATCH` | `/inventory/reservations/{id}/` | Atualiza o status da reserva |

### Marketplace e inteligência de mercado

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `GET`, `POST` | `/marketplace/ads/` | Lista ou publica anúncios |
| `GET` | `/marketplace/ads/mine/` | Lista anúncios da empresa |
| `PATCH`, `DELETE` | `/marketplace/ads/{id}/` | Edita ou cancela um anúncio |
| `POST` | `/marketplace/ads/{id}/finalize/` | Finaliza a venda e movimenta o estoque |
| `GET` | `/market/prices/` | Retorna histórico e indicadores |
| `GET`, `POST` | `/market/suggest-price/` | Sugere preço |
| `GET`, `POST` | `/market/suggest-description/` | Sugere descrição |

### Transportes

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `GET`, `POST` | `/transportes/transportadoras/` | Lista ou cadastra transportadoras |
| `GET`, `PUT`, `DELETE` | `/transportes/transportadoras/{id}/` | Gerencia uma transportadora |
| `GET`, `POST` | `/transportes/caminhoes/` | Lista ou cadastra caminhões |
| `PUT`, `DELETE` | `/transportes/caminhoes/{id}/` | Gerencia um caminhão |
| `GET`, `POST` | `/transportes/motoristas/` | Lista ou cadastra motoristas |
| `PUT` | `/transportes/motoristas/{id}/` | Atualiza um motorista |

## Rotas legadas

Para manter compatibilidade com entregas anteriores, continuam disponíveis `/empresa/`, `/produto`, `/anuncio`, `/login`, `/auth/login/` e `/authentication/token/`. Novas integrações devem preferir os endpoints sob `/api/`.

## Validação

```powershell
cd BackEnd
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test

cd ..\FrontEnd
npm run lint
npm test
npm run build
```

## Documentação acadêmica

- `docs/diagramas/`: EAP visual e diagrama de rede.
- `docs/planejamento/`: EAP e TAP.
- `docs/documentos/`: plano de integração e relatório de refatoração.

Não versione `.env`, ambientes virtuais, `node_modules` nem artefatos de build. O SQLite local também está ignorado para evitar conflitos entre ambientes.
