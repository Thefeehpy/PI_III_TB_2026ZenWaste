ZenWaste
Plataforma B2B para gestao interna de residuos industriais, marketplace e inteligencia de mercado.
Entrega - Programacao para Web
Este repositorio contem uma API Django funcional para cadastro de empresas, gestao de estoque de residuos, publicacao de anuncios e consulta de inteligencia de mercado.
Produto viavel entregue:
API funcional com CRUD da entidade principal Produto (item de estoque).
Modelagem de dados com entidades principais: Empresa, Produto, estoque.
Conexao com banco SQLite em ambiente local, configurada em back-end/app/settings.py.
Rotas REST em JSON para criar, listar, detalhar, editar e excluir registros.
Estrutura da API
Backend:
back-end/
    app/
        settings.py
        urls.py

    empresas/  #Valores recebidos e serialização dos dados de empresa, estabelecimento do CRUD
        models.py 
        serializers.py
        views.py        
    estoque/   #Valores recebidos e serialização dos dados de estoque, estabelecimento do CRUD e importação da chave estrangeira de Produto

        models.py
        serializers.py
        views.py
    produtos/ #Valores recebidos e serialização dos dados de estoque, estabelecimento do CRUD
        models.py
        serializers.py
        views.py

## Modelagem de dados

Entidades principais:

- `Empresa`: perfil da empresa, ligado ao usuario do Django.
- `Produto`: entidade principal do CRUD; representa um residuo no estoque.
- `estoque`: representação da quantidade de produtos existentes na empresa


## Rodando o backend Django

cd back-end python -m venv .venv .\.venv\Scripts\Activate.ps1 pip install -r requirements.txt python manage.py migrate python manage.py seed_demo_data python manage.py runserver 127.0.0.1:8000
## Rotas principais da API

Base local:

```text
http://127.0.0.1:8000/empresa
Autenticacao

Metodo
Rota
Descricao
GET
/empresa/
Retorna perfil da empresa autenticada
PUT
/empresa/
Atualiza perfil da empresa autenticada
PATCH
/empresa/
Atualiza a empresa atual
DELETE
/empresa/
Deleta a empresa atual
CRUD principal - Produto

Metodo
Rota
Descricao
GET
/produto/
Retorna perfil do produto autenticado
PUT
/produto/
Atualiza perfil do produto autenticado
PATCH
/produto/
Atualiza o produto atual
DELETE
/produto/
Deleta o produto atual
Rotas complementares de estoque:

Metodo
Rota
Descricao
GET
/estoque/
Lista os produtos cadastrados nesse estoque
Testando no Postman
1. empresa
get (http://127.0.0.1:8000/empresa/pk)
{
  {
        "id_empresa": 1,
        "cnpj": "34312163000121",
        "razao_social": "Empresa do zé",
        "telefone_whatsapp": "19999990000",
        "data_cadastro": "2026-04-13",
        "descricao_segmento": "Metalurgica",
        "email": "empresadoze@gmail"
    }
2. produto
[POST (http://127.0.0.1:8000/produto)
{
     "id_produto": 2,
        "tipo_produto": "Aluminio",
        "status": "V",
        "data_registro": "2026-04-13",
        "quantidade": "5.000",
        "descricao_produto": "Cavaco de aluminio"
    }
