# ZenWaste API

Backend Django para autenticar empresas B2B, manter estoque privado, publicar anuncios no marketplace e expor inteligencia de mercado.

## Como rodar localmente

```powershell
cd back-end
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo_data
python manage.py runserver 127.0.0.1:8000
```

O front usa `VITE_API_URL`. Se a API estiver no endereco padrao, nenhuma variavel extra e necessaria. Para mudar:

```powershell
$env:VITE_API_URL="http://127.0.0.1:8000/api"
npm run dev
```

## Endpoints principais

- `POST /api/auth/register/`: cadastro de empresa com CNPJ valido.
- `POST /api/auth/login/`: autentica e retorna token Bearer.
- `GET /api/auth/me/`: perfil da empresa autenticada.
- `GET|POST /api/inventory/items/`: lista e cria itens privados de estoque.
- `POST /api/inventory/items/<id>/movements/`: registra entrada ou saida.
- `GET /api/inventory/movements/`: historico privado de movimentacoes.
- `GET|POST /api/marketplace/ads/`: lista anuncios publicos e publica anuncio autenticado.
- `GET /api/market/prices/`: historico da bolsa de residuos.
- `GET /api/market/suggest-price/?type=...`: sugestao de preco por tipo de residuo.

## Modelo de banco

As tabelas de negocio seguem o modelo logico do projeto:

- `EMPRESA`
- `CATEGORIA_RESIDUO`
- `PRODUTO`
- `IMAGEM_ANUNCIO`
- `ANUNCIO`
- `RESERVA`
- `UNIDADE_MEDIDA`
- `MVTO_PRODUTO`

O Django tambem cria tabelas tecnicas como `auth_user`, `django_migrations` e `accounts_sessiontoken`.
Elas ficam separadas para autenticar usuarios, armazenar senha com hash e controlar sessoes da API.

Se voce ja tinha criado `db.sqlite3` antes dessa modelagem, recrie o banco de desenvolvimento:

```powershell
cd back-end
Copy-Item db.sqlite3 ..\\.workspace\\db.sqlite3.backup -ErrorAction SilentlyContinue
Remove-Item db.sqlite3
.\\.venv\\Scripts\\python manage.py migrate
.\\.venv\\Scripts\\python manage.py seed_demo_data
```
