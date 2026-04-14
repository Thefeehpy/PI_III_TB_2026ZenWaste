# ZenWaste

Plataforma B2B para gestao interna de residuos industriais, marketplace e inteligencia de mercado.

## Entrega - Programacao para Web

Este repositorio contem uma API Django funcional para cadastro de empresas, gestao de estoque de residuos, publicacao de anuncios e consulta de inteligencia de mercado.

Produto viavel entregue:

- API funcional com CRUD da entidade principal `Produto` (item de estoque).
- Modelagem de dados com entidades principais: `Empresa`, `Produto`, `CategoriaResiduo`, `UnidadeMedida`, `Reserva`, `MvtoProduto`, `Anuncio`, `ImagemAnuncio` e `SessionToken`.
- Conexao com banco SQLite em ambiente local, configurada em `back-end/config/settings.py`.
- Rotas REST em JSON para criar, listar, detalhar, editar e excluir registros.
- Autenticacao por token Bearer para rotas privadas.
- README com instrucoes de execucao e exemplos para testar no Postman.

## Estrutura da API

Backend:

```text
back-end/
  config/
    settings.py
    urls.py
  apps/
    accounts/      cadastro, login, token e perfil da empresa
    inventory/     CRUD da entidade principal Produto e movimentacoes
    marketplace/   anuncios publicos e publicacao autenticada
    market/        historico e sugestao de precos
    common/        helpers de JSON, erros e CORS
```

Frontend:

```text
src/lib/api.ts      cliente HTTP usado pelo React
src/contexts/       contexts de autenticacao, estoque e marketplace
src/pages/          telas da aplicacao
```

## Modelagem de dados

Entidades principais:

- `Empresa`: perfil da empresa, ligado ao usuario do Django.
- `SessionToken`: token de sessao usado no header `Authorization: Bearer <token>`.
- `Produto`: entidade principal do CRUD; representa um residuo no estoque.
- `CategoriaResiduo`: tipo/material do residuo.
- `UnidadeMedida`: unidade, como `kg`.
- `Reserva`: meta de quantidade do item.
- `MvtoProduto`: entradas e saidas de estoque.
- `Anuncio`: publicacao de um produto no marketplace.
- `ImagemAnuncio`: URL de imagem associada ao produto anunciado.

Relacionamento principal:

```text
User Django -> Empresa -> Produto -> Anuncio
                         -> MvtoProduto
                         -> Reserva
                         -> CategoriaResiduo
                         -> UnidadeMedida
```

## Rodando o backend Django

```powershell
cd back-end
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo_data
python manage.py runserver 127.0.0.1:8000
```

Se o `back-end/db.sqlite3` foi criado antes da modelagem atual, faca backup e recrie o banco para gerar as tabelas `EMPRESA`, `PRODUTO`, `ANUNCIO`, `RESERVA` e relacionadas:

```powershell
cd back-end
Copy-Item db.sqlite3 ..\.workspace\db.sqlite3.backup -ErrorAction SilentlyContinue
Remove-Item db.sqlite3
.\.venv\Scripts\python manage.py migrate
.\.venv\Scripts\python manage.py seed_demo_data
```

## Rodando o frontend

```powershell
npm install
npm run dev
```

Por padrao o front chama `http://127.0.0.1:8000/api`. Para mudar:

```powershell
$env:VITE_API_URL="http://127.0.0.1:8000/api"
npm run dev
```

## Rotas principais da API

Base local:

```text
http://127.0.0.1:8000/api
```

### Autenticacao

| Metodo | Rota | Descricao |
| --- | --- | --- |
| POST | `/api/auth/register/` | Cadastra empresa com CNPJ valido |
| POST | `/api/auth/login/` | Autentica e retorna token Bearer |
| GET | `/api/auth/me/` | Retorna perfil da empresa autenticada |
| PATCH | `/api/auth/me/` | Atualiza perfil da empresa autenticada |
| POST | `/api/auth/logout/` | Encerra o token atual |

### CRUD principal - Produto / Estoque

| Metodo | Rota | Descricao |
| --- | --- | --- |
| GET | `/api/inventory/items/` | Lista produtos do estoque da empresa logada |
| POST | `/api/inventory/items/` | Cria produto no estoque |
| GET | `/api/inventory/items/<id>/` | Detalha um produto |
| PATCH | `/api/inventory/items/<id>/` | Edita dados do produto |
| DELETE | `/api/inventory/items/<id>/` | Exclui produto |

Rotas complementares de estoque:

| Metodo | Rota | Descricao |
| --- | --- | --- |
| GET | `/api/inventory/movements/` | Lista movimentacoes da empresa logada |
| GET | `/api/inventory/items/<id>/movements/` | Lista movimentacoes de um produto |
| POST | `/api/inventory/items/<id>/movements/` | Registra entrada ou saida de estoque |

### Marketplace e inteligencia de mercado

| Metodo | Rota | Descricao |
| --- | --- | --- |
| GET | `/api/marketplace/ads/` | Lista anuncios publicos |
| POST | `/api/marketplace/ads/` | Publica anuncio autenticado |
| GET | `/api/marketplace/ads/<id>/` | Detalha anuncio |
| PATCH | `/api/marketplace/ads/<id>/` | Edita anuncio da propria empresa |
| DELETE | `/api/marketplace/ads/<id>/` | Inativa anuncio da propria empresa |
| GET | `/api/marketplace/ads/<id>/whatsapp/` | Gera link de WhatsApp |
| GET | `/api/market/prices/` | Retorna historico de precos |
| GET | `/api/market/suggest-price/?type=Plastico%20Industrial` | Retorna sugestao de preco por tipo |

## Testando no Postman

Crie um Environment no Postman:

```text
baseUrl = http://127.0.0.1:8000/api
token =
itemId =
```

Use `Body > raw > JSON` nas requisicoes com corpo. Depois do login, use `Authorization > Bearer Token` com `{{token}}`.

### 1. Cadastro

`POST {{baseUrl}}/auth/register/`

```json
{
  "razaoSocial": "Empresa Teste Ltda",
  "cnpj": "11.222.333/0001-81",
  "segmento": "Reciclagem industrial",
  "email": "teste@zenwaste.local",
  "telefone": "11999999999",
  "password": "SenhaTeste123"
}
```

### 2. Login

`POST {{baseUrl}}/auth/login/`

```json
{
  "email": "teste@zenwaste.local",
  "password": "SenhaTeste123"
}
```

Na aba `Tests` do Postman, salve o token automaticamente:

```javascript
const data = pm.response.json();
if (data.token) {
  pm.environment.set("token", data.token);
}
```

### 3. Criar produto

`POST {{baseUrl}}/inventory/items/`

```json
{
  "name": "Aparas de PEAD",
  "type": "Plastico Industrial",
  "quantity": 500,
  "unit": "kg",
  "targetQuantity": 1000,
  "deadline": "2026-04-30"
}
```

Na aba `Tests`, salve o id:

```javascript
const data = pm.response.json();
if (data.item && data.item.id) {
  pm.environment.set("itemId", data.item.id);
}
```

### 4. Listar produtos

`GET {{baseUrl}}/inventory/items/`

### 5. Detalhar produto

`GET {{baseUrl}}/inventory/items/{{itemId}}/`

### 6. Editar produto

`PATCH {{baseUrl}}/inventory/items/{{itemId}}/`

```json
{
  "name": "Aparas de PEAD - lote revisado",
  "type": "Plastico Industrial",
  "unit": "kg",
  "targetQuantity": 1200
}
```

### 7. Registrar movimentacao

`POST {{baseUrl}}/inventory/items/{{itemId}}/movements/`

```json
{
  "type": "entrada",
  "quantity": 100,
  "note": "Teste via Postman"
}
```

Para testar saida:

```json
{
  "type": "saida",
  "quantity": 50,
  "note": "Baixa via Postman"
}
```

### 8. Excluir produto

`DELETE {{baseUrl}}/inventory/items/{{itemId}}/`

## Verificacoes

```powershell
npm run build
npm run lint
cd back-end
.\\.venv\\Scripts\\python manage.py test
```
