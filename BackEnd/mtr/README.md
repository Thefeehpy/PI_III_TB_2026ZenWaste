# MTR operacional — MTR-05 / MTR-05B

O módulo integra a jornada React em `/dashboard/mtr` com Django REST Framework e PostgreSQL. Oferece rascunho, validação, revisão individual, snapshot, intenção, despacho durável, recibos, histórico e resultados explicitamente simulados. Preserva a jornada anterior vinculada a frete.

## Limites e segurança

- Emissão governamental negada por padrão. Publicação do código não é liberação de emissão nem homologação do banco principal.
- Uma liberação exige intenção, referência e hashes correspondentes a uma concessão específica vigente. Uma flag genérica, conta autenticada ou autoridade de consulta não concede emissão.
- Credenciais ficam exclusivamente no processo servidor. O navegador não recebe senha SIGOR, Bearer governamental ou chave de autoridade.
- O primeiro cenário independente usa a mesma empresa/unidade nos três papéis. A unidade é obtida de metadados privados, sem identificador de conta embutido no código.
- CNPJ com máscara e seus mesmos dígitos são comparáveis; documentos incompletos não são preenchidos ou corrigidos automaticamente.
- Cadastro de usuário/vínculo não concede `pode_revisar`, `pode_autorizar` ou `verificado_homologacao`.
- Referência, payload e snapshot são persistidos antes da iniciativa de envio. Timeout, queda ou resposta não comprovada mantém a intenção indeterminada; não há retry automático ou nova referência para contornar esse estado.
- Simulação confirmada não produz número oficial na projeção pública. PDF oficial permanece indisponível até recuperação/associação autorizada.

O catálogo de referência contém somente códigos e descrições de resíduos, com procedência e checksum. A regra Git local de `dados/.gitattributes` preserva seus bytes originais, impedindo que conversão automática de quebras de linha invalide o checksum. A presença de um código não aprova classificação ambiental. Fixtures de testes são integralmente fictícias e não devem ser promovidas para emissão.

## Organização

| Caminho | Responsabilidade |
|---|---|
| `models.py`, `migrations/` | Persistência, constraints e proteção do histórico |
| `views.py`, `serializers.py`, `urls.py` | Contratos e escopo empresarial |
| `servicos_mvp.py`, `operacional.py` | Jornada de preparação e comandos idempotentes |
| `sigor/ambiental.py`, `sigor/despacho.py` | Revisão, claim, finalização, recuperação e reconciliação |
| `sigor/protocolo.py`, `sigor/emissao_controlada.py`, `sigor/escrita.py` | Builder/parser, contrato HTTPS restrito e despacho condicionado |
| `sigor/autoridade_api10.py`, `sigor/ativacao_api10.py` | Autoridade específica e gate fechado por padrão |
| `vinculacao_individual.py`, `management/commands/` | Inspeção e criação/vinculação individual pessoal |
| `src/features/mtr/` na raiz do projeto | Componentes, serviço HTTP tipado e testes frontend |

## Contratos usados pela interface

Base `/api/mtr`, com autenticação empresarial. Comandos recebem `Idempotency-Key` UUID; revisão e autorização exigem também sessão individual `X-MTR-Actor-Token` vinculada à empresa.

| Operação | Método e caminho relativo |
|---|---|
| Listar/criar | GET/POST `rascunhos/` |
| Consultar/editar | GET/PATCH `rascunhos/{id}/` |
| Validar | GET `rascunhos/{id}/validacao/` |
| Identificar pessoa | POST `sessoes-operador/` |
| Revisar | POST `rascunhos/{id}/revisoes/` |
| Preparar intenção | POST `rascunhos/{id}/intencoes/` |
| Consultar despacho | GET `sigor/despachos/{id}/` |
| Simular | POST `sigor/despachos/{id}/executar-simulacao/` |
| Solicitar autorização | POST `sigor/despachos/{id}/solicitacoes-emissao/` |
| Despachar autorizado | POST `sigor/despachos/{id}/emitir/`, bloqueado sem concessão/liberação |
| Reconciliar | POST `sigor/despachos/{id}/reconciliacoes/` |
| Recuperar recibo | GET `comandos/{chave}/` |

O candidato usa `tipo=HOMOLOGACAO_INDEPENDENTE` e `cenario=MTR05B_HOMOLOGACAO`. Sem configuração privada, a unidade proposta é nula e a criação permanece bloqueada. O cenário não cria vínculos empresariais ou aprovações automaticamente.

## Configuração privada

Não versionar cadastro de conta, senhas, chaves, concessões, manifesto de liberação, evidências de participantes, bancos, logs ou runtime.

`MTR_SIGOR_CADASTRO_API10` aponta para metadados externos em `cadastro-api10.json`. A configuração não contém senha/token/chave e aceita somente os campos definidos em `sigor/preparacao.py`. Conta, unidade, pessoa, representação e revisão ambiental devem ser conferidas administrativamente. O provedor de credencial resolve uma referência opaca no servidor; não utiliza valores da coleção Postman.

Os comandos administrativos requerem `MTR_ISOLADO_ESPERADO`, fornecido pela configuração privada de testes/homologação: `perfil=MTR_ISOLADO`, `database`, `host`, `port` e `system_id`. A identidade é conferida antes das operações; ausência/divergência impede conexão ao alvo. Não há identificador de cluster local embutido no código.

Comandos nativos: `mtr_preparar_homologacao`, `mtr_vincular_operador` e `mtr_conceder_api10`. Usar `--help` com settings isolados. Vinculação e concessão exigem terminal pessoal; senha não é recebida como argumento. O vínculo é idempotente, preserva permissões existentes e cria novos vínculos sem poderes ambientais.

## Migrations

As migrations `0002`/`0003` sustentam a jornada persistente e o despacho. A `0004` permite o cenário independente, cria solicitação/concessão e protege fatos históricos. A `0005` impede reabrir por SQL um rascunho aprovado para alterar seus dados. Não executar no banco principal sem procedimento de implantação separado.

## Testes

Executar testes transacionais somente com PostgreSQL descartável, settings privados que não importem `.env` do principal, identidade `MTR_ISOLADO_ESPERADO` e rede governamental bloqueada. O ambiente deve incluir os apps/URLs Django usados pela API. Por exemplo, com esse módulo privado já configurado:

```text
python manage.py check --settings=<settings_isolados>
python manage.py makemigrations mtr --check --dry-run --settings=<settings_isolados>
python manage.py test mtr app.test_padronizacao_colunas --settings=<settings_isolados>
```

`configuracao_testes.py` é apenas uma configuração offline para verificações sem banco; não é um executor de testes transacionais.

Os testes cobrem escopo empresarial/individual, autorização, migrações, snapshot imutável, idempotência, concorrência, queda real de subprocesso, timeout, reconciliação e prevenção de segundo envio. O auxiliar `testes/processo_interrompido.py` admite somente o banco de teste identificado, recebe configuração efêmera por ambiente e usa transporte falso.

No frontend: `npm test -- --run src/features/mtr`, `npx tsc --noEmit`, `npm run lint` e build em cópia isolada configurada para a API local. Mocks não comprovam integração governamental; nenhuma chamada SIGOR é necessária aos testes.
