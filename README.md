# ZenWaste

Plataforma B2B para gestão de resíduos industriais, controle de estoque, reservas, anúncios e inteligência de mercado.

O projeto utiliza React e TypeScript no frontend e Django REST Framework no backend. A aplicação permite que empresas cadastrem materiais, registrem movimentações de estoque, publiquem anúncios, acompanhem reservas e consultem sugestões de preço e descrição.

## Funcionalidades

- Cadastro, autenticação e atualização do perfil da empresa.
- Controle de itens e movimentações de estoque.
- Reservas com acompanhamento de quantidade, prazo e status.
- Publicação, edição, cancelamento e finalização de anúncios.
- Marketplace público com contato pelo WhatsApp.
- Histórico e inteligência de preços.
- Sugestões de preço e descrição com Gemini ou fallback local.
- Dashboard com telas de anúncios, reservas e auditoria de frete.

## Tecnologias

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Radix UI
- Vitest e Testing Library

### Backend

- Python
- Django 6
- Django REST Framework
- SQLite por padrão
- PostgreSQL opcional
- Google Gen AI

## Estrutura do projeto

```text
ZenWaste/
├── BackEnd/
│   ├── anuncios/          # Entidades Anuncio e Reserva
│   ├── app/               # Configuração e rotas principais do Django
│   ├── authentication/    # Endpoints, validações, tokens e serviços de autenticação
│   ├── empresas/          # Cadastro e domínio de empresas
│   ├── gemini_api/        # Cliente da integração Gemini
│   ├── market/            # Inteligência e sugestões de mercado
│   ├── marketplace/       # API de anúncios
│   ├── produtos/          # Estoque, movimentações e reservas
│   ├── db.sqlite3
│   ├── manage.py
│   └── requirements.txt
├── FrontEnd/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── layouts/
│   │   ├── lib/
│   │   ├── pages/
│   │   └── test/
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   ├── diagramas/
│   └── planejamento/
├── .env.example
├── .gitignore
└── README.md
```

## Pré-requisitos

- Python 3.12 ou superior
- Node.js 18 ou superior
- npm

## Configuração

### 1. Backend

No PowerShell, a partir da raiz do projeto:

```powershell
cd BackEnd
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

A API ficará disponível em:

```text
http://127.0.0.1:8000/
```

O SQLite é usado por padrão e seu arquivo permanece em `BackEnd/db.sqlite3`.

### 2. Frontend

Em outro terminal, a partir da raiz do projeto:

```powershell
cd FrontEnd
npm ci
npm run dev
```

O frontend ficará disponível em:

```text
http://localhost:8080/
```

## Variáveis de ambiente

O arquivo `.env.example` na raiz contém os nomes básicos utilizados pelo projeto.

Para configurar o frontend, crie `FrontEnd/.env`:

```dotenv
VITE_API_URL=http://127.0.0.1:8000/api
```

Para habilitar as sugestões por IA, crie `BackEnd/.env`:

```dotenv
GEMINI_API_KEY=sua_chave
```

Sem uma chave válida, preço e descrição continuam funcionando por meio do fallback local.

O backend também aceita estas variáveis diretamente no ambiente do processo:

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

## Autenticação da API

O login principal retorna um token assinado com validade de sete dias. Envie-o nas rotas protegidas:

```http
Authorization: Bearer TOKEN
```

Exemplo de cadastro:

```json
{
  "razaoSocial": "Empresa Exemplo",
  "cnpj": "11222333000181",
  "segmento": "Metalúrgica",
  "email": "contato@empresa.com",
  "telefone": "11999999999",
  "password": "senha-segura"
}
```

Exemplo de login:

```json
{
  "email": "contato@empresa.com",
  "password": "senha-segura"
}
```

## API principal

Base local:

```text
http://127.0.0.1:8000/api
```

### Autenticação e empresa

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `POST` | `/auth/register/` | Cadastra uma empresa |
| `POST` | `/auth/login/` | Autentica e devolve token e usuário |
| `GET` | `/auth/me/` | Consulta o perfil autenticado |
| `PATCH` | `/auth/me/` | Atualiza o perfil autenticado |
| `POST` | `/auth/recover-password/` | Solicita recuperação de senha |
| `POST` | `/auth/logout/` | Finaliza a sessão no cliente |

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

### Marketplace

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `GET`, `POST` | `/marketplace/ads/` | Lista ou publica anúncios |
| `GET` | `/marketplace/ads/mine/` | Lista anúncios da empresa autenticada |
| `PATCH`, `DELETE` | `/marketplace/ads/{id}/` | Edita ou cancela um anúncio |
| `POST` | `/marketplace/ads/{id}/finalize/` | Finaliza a venda e movimenta o estoque |

### Inteligência de mercado

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `GET` | `/market/prices/` | Retorna histórico e indicadores |
| `GET`, `POST` | `/market/suggest-price/` | Sugere preço para um material |
| `GET`, `POST` | `/market/suggest-description/` | Sugere descrição de anúncio |

## Rotas legadas

As rotas abaixo continuam disponíveis para compatibilidade com entregas anteriores:

- `/empresa/` e `/empresa/{id}`
- `/produto` e `/produto/{id}`
- `/anuncio`
- `/login` e `/auth/login/`
- `/authentication/token/`
- `/authentication/token/refresh/`
- `/authentication/token/verify/`

Para novas integrações, utilize preferencialmente os endpoints sob `/api/`.

## Scripts e testes

### Frontend

```powershell
cd FrontEnd
npm run lint
npm test
npm run build
```

Scripts adicionais:

```powershell
npm run test:watch
npm run build:dev
npm run preview
```

### Backend

```powershell
cd BackEnd
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Na última validação estrutural:

- 19 testes Django foram aprovados.
- O teste Vitest foi aprovado.
- O ESLint terminou sem erros.
- O build de produção foi concluído com sucesso.

## Documentação acadêmica

Diagramas e documentos de planejamento estão organizados em:

- `docs/diagramas/`
- `docs/planejamento/`

## Observações

- Não envie arquivos `.env` ou chaves de API ao repositório.
- O arquivo SQLite é adequado para desenvolvimento local.
- Para produção, configure uma chave secreta segura, desative o modo de depuração e use variáveis de ambiente apropriadas.
- O projeto mantém endpoints legados apenas para compatibilidade; a aplicação React utiliza a API sob `/api/`.
