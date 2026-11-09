# Auditoria de Fretes — API persistente

Referência: 08/11/2026, America/Sao_Paulo.

O backend implementa os comandos de fretes com PostgreSQL, histórico transacional,
autorização por empresa e idempotência. As rotas estão registradas em
`app/urls.py`. A página React `FreightAudit` utiliza `AuditoriaIntegrada` e a API
real; os componentes demonstrativos antigos não são o caminho dessa página.

**Banco principal:** na inspeção somente de leitura desta finalização full-stack,
`fretes.0001_initial` e `0002_resolucao_divergencia_cancelamento` já estavam
aplicadas. O registro anterior de `0002` pendente pertence à etapa de backend.
Não foi executado migrate no principal nesta tarefa. Os executores criam bancos
descartáveis exclusivos; veja o [relatório atual](../../RELATORIO_FINAL_FRETES.md).

## Arquitetura

```text
Bearer da empresa -> view com autenticação explícita -> contrato de entrada
  -> serviço transacional -> models + histórico na mesma transação
  -> serializers de leitura com visibilidade por participante
```

| Arquivo | Responsabilidade |
| --- | --- |
| `dominio.py` | Conferência Decimal imutável e políticas de estado/logística. |
| `models.py` | Sete entidades, relacionamentos, snapshots, constraints e proteção de registros históricos. |
| `validacoes.py` | Valores monetários, medidas e imagem PNG da assinatura. |
| `servicos.py` | Casos de uso, autorização específica, locks, transações, idempotência e histórico. |
| `consultas.py` | Participação no processo e quantidades disponíveis por Pedido. |
| `serializers.py` | Entradas, projeções de saída, decimais como texto e restrição de cotações/documentos. |
| `views.py` e `urls.py` | Autenticação obrigatória, roteamento, filtros, paginação e respostas HTTP. |
| `test_modelagem.py` | Os 36 testes de modelagem preservados. |
| `test_integracao.py` | Persistência, API, constraints, rollback, concorrência e migrations reais no PostgreSQL descartável. |
| `executar_testes_postgresql.py` | Cria banco novo de teste, restringe conexões e remove esse banco no encerramento. |

O monólito modular, a Service Layer e os erros de `app/excecoes.py` foram mantidos.
As views não implementam as regras comerciais. O Value Object e as políticas
existentes foram reutilizados, sem acrescentar Repository, Singleton ou uma
hierarquia State/Strategy sem necessidade concreta. Não se alteraram serviços de
pagamentos, estoque ou comercialização.

## Entidades e integridade

| Entidade | Relações e responsabilidade |
| --- | --- |
| `Frete` | Zero ou um Pedido; vendedora e compradora obrigatórias e distintas; transportadora opcional; quantidade/unidade e dados da remessa. |
| `CotacaoFrete` | N por Frete; proposta de Empresa transportadora; no máximo uma aprovada por Frete. |
| `DocumentoCTe` | N versões por Frete; versão única; original não é sobrescrito. |
| `DivergenciaFrete` | No máximo uma por documento original; snapshot de referência/cobrança/diferença; tipo de resolução e documento de correção. |
| `ConfirmacaoEntrega` | No máximo uma por Frete; empresa confirmadora, assinatura, nome declarado e eventual ressalva. |
| `HistoricoFrete` | N eventos por Frete, com autora, instante, mudança de situação, chave e fingerprint do comando. Tratativas são eventos. |
| `DemandaTransporte` | N publicações internas por Frete; não dispara comunicação externa. |

Um Pedido pode originar várias remessas parciais. O serviço bloqueia o Pedido e
confere a soma alocada antes de inserir outra remessa. A soma não excede a quantidade
negociada; a unidade vem do snapshot comercial do Pedido. Não há outra FK para
Reserva nem outra reserva de estoque criada pelo módulo.

No frete avulso, o destinatário é uma empresa compradora ativa e cadastrada. Não
se criam Pedido, Produto ou Empresa fictícios. No vinculado, material e compradora
vêm do Pedido autorizado da vendedora; Pedido cancelado/expirado não recebe nova
remessa. Uma remessa cancelada antes da retirada/recebimento libera sua alocação.
Registros legados cancelados com retirada/entrega mantêm a proteção conservadora
da consulta de alocação.

## Regras e transições

### Classificação

- `cotar`: entra em `em_cotacao`; a vendedora registra propostas e aprova uma delas.
- `contratado`: exige transportadora ativa com papel de transportadora e referência
  informada; entra em `aguardando_conferencia`, sem cotação artificial.
- `retirada_cliente`: conforme a resposta do usuário, dispensa cotação e CT-e e
  segue para `aguardando_entrega`. Não cria referência financeira de valor zero.

A classificação ocorre em `aguardando_classificacao`; aprovação de cotação ocorre
em `em_cotacao`. Não há PATCH livre de modalidade, referência ou situação.

### CT-e e divergências

```text
diferença = cobrança - referência
divergência = abs(diferença) > Decimal('5.00')
```

Diferenças de R$ 5,00, positivas ou negativas, estão dentro da tolerância; R$ 5,01
ultrapassa o limite. O valor de referência não é alterado para aceitar a cobrança.

O primeiro CT-e e suas correções usam `registrar-cte`. Cada chamada nova gera uma
versão posterior. Havendo divergência aberta, a operação persiste atomicamente:

1. O novo documento.
2. A substituição da análise anterior, ligada ao CT-e corrigido e à empresa autora.
3. Outra divergência aberta, se a nova cobrança ainda ultrapassar a tolerância,
   preservando a referência original.
4. O estado recalculado e o evento de histórico.

Uma falha intermediária reverte o conjunto. CT-e corrigido dentro da tolerância
encerra a análise anterior sem criar outra. `resolver-divergencia` realiza o aceite
com justificativa obrigatória e autoria; não apaga documentos ou valores anteriores.

Registro/correção de CT-e é permitido em `aguardando_conferencia`, `com_divergencia`
e `aguardando_entrega`, com referência definida e modalidade compatível. Processos
cancelados/concluídos não são reabertos por esse comando. Dados legados com mais de
uma análise aberta incoerente produzem conflito, em vez de resolução implícita.

### Retirada, recebimento e conclusão

Retirada e recebimento são permitidos em `com_divergencia` e `aguardando_entrega`.
A vendedora registra retirada; a compradora/destinatária confirma recebimento com
assinatura PNG obrigatória. Recebimento com ressalva exige texto. Uma confirmação
persistida não pode ser duplicada. Retirada/recebimento não movimentam estoque.

| Divergência aberta | Recebimento confirmado | Situação após conferência/resolução/recebimento |
| --- | --- | --- |
| Sim | Não | `com_divergencia` |
| Sim | Sim | `com_divergencia` |
| Não | Não | `aguardando_entrega` |
| Não | Sim | `concluido` |

A resolução da última pendência depois do recebimento conclui a auditoria sem
repetir a confirmação física. A vendedora mantém a gestão após o recebimento.
`divergente` continua indicando diferença factual; `divergencia_aberta` indica
análise pendente, inclusive quando a diferença foi aceita com justificativa.

### Cancelamento, tratativas e demandas

Cancelamento exige justificativa, etapa ativa e ausência de retirada/recebimento.
Não cancela Pedido ou Reserva, não estorna pagamento e não devolve saldo ao estoque.
Tratativas são eventos internos da vendedora, sem alegar envio de mensagem.
Demandas internas podem ser registradas em processo ainda não encerrado; não
representam marketplace público, notificação ou contratação externa.

## Autorização e exposição de dados

Todas as views chamam explicitamente a autenticação de empresa existente
(`django.core.signing` e Bearer). A classe base DRF sozinha não confere acesso.

| Participante | Leitura e comandos |
| --- | --- |
| Vendedora ativa do processo | Gestão, cotações, documentos, resolução, cancelamento permitido, tratativas, retirada e demanda. |
| Compradora ativa do processo | Acompanhamento e confirmação de recebimento; vê todas as cotações. |
| Transportadora atribuída ou com proposta no processo | Acompanhamento; somente suas próprias cotações, inclusive no histórico. Não possui comandos de gestão ou recebimento. |
| Terceira empresa | Processo não encontrado; listas, demandas, documentos e histórico não o incluem. |
| Sem token, token inválido ou empresa inativa | HTTP 401. |

Transportadora que apenas propôs, sem ter sido escolhida, também não recebe os
valores/documentos financeiros da contratação concorrente. Os diretórios expõem
somente `id` e `razao_social`, com busca e paginação. Não expõem CNPJ, contatos,
senha ou dados de pagamento. A assinatura não aparece nas respostas nem nos
detalhes do histórico; a entrega informa somente `assinatura_registrada` e metadados.
Não foi criado endpoint público para recuperar a imagem privada da assinatura.

O ator autenticado é uma empresa, não uma pessoa/funcionário. O canvas é um registro
eletrônico e não comprova assinatura criptográfica ou identidade individual.

## Transações, locks e idempotência

Ordem de bloqueio: **Empresa autora -> Pedido, quando houver -> Frete**.
Nenhum comando adquire esses locks em ordem inversa. A leitura do vínculo não
substitui o lock: o serviço o confere novamente depois de bloquear o Frete.

O lock da autora usa PostgreSQL `NO KEY UPDATE`, permitindo referências por FK.
Ele serializa as escritas da mesma autora, inclusive criações e reutilizações de
chave em fretes distintos. É uma escolha conservadora: reduz paralelismo de
comandos da mesma empresa, além da serialização por Pedido/Frete necessária.

Todos os comandos de escrita exigem `Idempotency-Key`, não vazia e com até 128
caracteres. O escopo é **empresa autora + ação + chave**. Um SHA-256 inclui o Frete
alvo e os dados já normalizados pelo contrato de entrada. O histórico imutável
registra chave/fingerprint na mesma transação da alteração.

- Mesma chave/ação/autora e conteúdo equivalente: retorna o detalhe atual do mesmo
  Frete, sem repetir efeitos, documento, confirmação ou histórico.
- Mesma chave/ação/autora com outro conteúdo ou Frete: HTTP 409.
- Ações diferentes têm namespaces de chave independentes.
- Falha antes do commit: não deixa comando parcial nem chave consumida.
- Falha de comunicação depois do commit: repetir com a mesma chave recupera o
  resultado persistido, sem nova execução. A resposta é o estado atual do recurso,
  não uma cópia congelada da resposta HTTP original.

Autorização é revalidada inclusive no replay. Aprovação, correção e confirmação
concorrentes são serializadas. A integridade é reforçada pelas constraints e pelos
vínculos únicos. `full_clean()` é chamado pelo serviço; não se presume que `save()`
execute essa validação automaticamente.

## Endpoints e contratos

Base: `/api/fretes/`. GETs retornam 200; criação retorna 201, inclusive no replay;
comandos retornam 200. Erros de entrada são 400, autenticação 401, permissão 403,
recurso inacessível/inexistente 404 e conflito de estado/idempotência 409.

| Método | Caminho relativo | Entrada principal |
| --- | --- | --- |
| GET | `/` | `pagina`, `tamanho_pagina`, `situacao`, `transportadora_id`, `busca`, `data_inicio`, `data_fim`. |
| POST | `/` | Remessa vinculada ou avulsa, conforme exemplos. |
| GET | `/{uuid}/` | Detalhe do participante. |
| POST | `/{uuid}/classificar/` | `modalidade`, e transportadora/referência quando contratado. |
| POST | `/{uuid}/cotacoes/` | `transportadora_id`, `valor`, `prazo_dias`, `observacao` opcional. |
| POST | `/{uuid}/aprovar-cotacao/` | `cotacao_id`. |
| POST | `/{uuid}/registrar-cte/` | `numero`, `valor`, `nome_arquivo` e `arquivo_nfe` opcionais. |
| POST | `/{uuid}/resolver-divergencia/` | `justificativa`. |
| POST | `/{uuid}/cancelar/` | `justificativa`. |
| POST | `/{uuid}/tratativas/` | `observacao`. |
| POST | `/{uuid}/retirada/` | `nome_foto`, somente metadado. |
| POST | `/{uuid}/confirmar-entrega/` | `nome_recebedor`, `dados_assinatura`, `tipo_recebimento`, `ressalva` quando aplicável. |
| POST | `/{uuid}/publicar-demanda/` | `valor_sugerido`, `janela_coleta`, `tipo_veiculo`, `observacoes` opcional. |
| GET | `/pedidos-disponiveis/` | Busca/paginação; quantidades negociada e restante da vendedora. |
| GET | `/compradoras/` | Busca/paginação de destinatárias elegíveis. |
| GET | `/transportadoras/` | Busca/paginação de transportadoras elegíveis. |
| GET | `/demandas/` | Demandas dos processos permitidos; filtros e paginação. |

Paginação: padrão 10, máximo 100; página inválida gera 400. Cada listagem possui
`resultados` e `paginacao` com página, tamanho, total e total de páginas. O período
da consulta de fretes usa `data_pedido`. A listagem inclui `indicadores` globais
dos processos permitidos, sem depender dos filtros/página. Direções de ordenação
não são aceitas livremente; usa-se a ordem determinística definida nas consultas.

As saídas preservam os DTOs preparados no frontend, com dinheiro/medidas em texto,
`cliente`, participantes mínimos e permissões. O detalhe acrescenta `documentos`
e `divergencias` para as versões/análises, além do `documento` atual esperado.
`recebimento_confirmado` e a permissão de retirada são extensões aditivas.
Legados com medidas não informadas conservam `null`; não se inventa medida zero.
`propostas` de uma demanda conta cotações internas do Frete, sem alegar proposta
recebida de um serviço externo.

### Exemplos de payloads

Em todas as escritas, enviar `Authorization: Bearer <token>` e uma chave
`Idempotency-Key` própria da intenção. Os IDs abaixo são ilustrativos; devem ser
substituídos por cadastros do ambiente. Campos não pertencentes ao comando são rejeitados.

Criação avulsa:

```json
{
  "empresa_compradora_id": 102,
  "material": "Material de exemplo",
  "unidade": "KG",
  "quantidade": "3.000",
  "origem": "Local de origem",
  "destino": "Local de destino",
  "peso_toneladas": "0.003",
  "cubagem_m3": "1.000",
  "quantidade_volumes": 1,
  "previsao_entrega": null
}
```

Na criação vinculada, substituir `empresa_compradora_id`, `material` e `unidade`
por `pedido_id` com UUID válido. Se unidade/compradora também forem enviadas,
devem corresponder ao Pedido; os dados comerciais são derivados dele.
`previsao_entrega` ausente, nula ou vazia representa ausência de previsão.

Classificação contratada:

```json
{"modalidade": "contratado", "transportadora_id": 103, "valor_referencia": "500.00"}
```

Primeiro CT-e ou correção:

```json
{"numero": "CTE-EXEMPLO", "valor": "620.00", "nome_arquivo": "exemplo.xml"}
```

Aceite:

```json
{"justificativa": "Diferença conferida e aceita pela vendedora."}
```

Recebimento com ressalva:

```text
nome_recebedor: nome declarado
dados_assinatura: data:image/png;base64,<conteúdo PNG válido>
tipo_recebimento: com_ressalva
ressalva: descrição obrigatória da ressalva
```

O placeholder de assinatura não é uma imagem válida. A validação existente confere
formato PNG/base64, tamanho e estrutura; não é verificação de identidade pessoal.

## Migrations e testes

Migrations existentes e preservadas:

- `0001_initial`: sete entidades e integridade inicial.
- `0002_resolucao_divergencia_cancelamento`: tipo/documento de resolução e quatro
  constraints complementares. Não preenche ou reclassifica histórico antigo.
- Nenhuma migration nova foi necessária nesta finalização dos serviços/API.

As duas foram aplicadas em PostgreSQL novo descartável. O teste específico remove
o esquema de fretes nesse ambiente isolado, aplica a `0001`, preserva um registro
compatível ao avançar à `0002`, reverte a `0002` e restaura o estado final. Essa
reversão de teste não certifica reversão sem perda de metadados em produção.

O executor cria um banco aleatório exclusivo, permite conexões somente a ele e
ao banco de manutenção `postgres`, configura o Django apenas no processo e remove
o descartável no `finally`. Não reusa bancos de teste anteriores. Não modifica
arquivos privados nem executa migração no principal.

Reprodução a partir de `BackEnd`:

```powershell
# Regressão completa relacionada, sempre em banco novo descartável:
.\.venv-local\Scripts\python.exe -B -m fretes.executar_testes_postgresql

# Somente fretes, ainda com PostgreSQL real:
.\.venv-local\Scripts\python.exe -B -m fretes.executar_testes_postgresql fretes

# Apenas os 36 testes de modelagem, sem banco e sem carregar .env:
.\.venv-local\Scripts\python.exe -B -m django test fretes.test_modelagem --settings=fretes.configuracao_testes
```

Os testes de integração exigem as variáveis PostgreSQL existentes e permissão de
criar/remover o descartável; as credenciais não são impressas. Não executar esses
casos diretamente contra o principal. O próprio cenário exige o prefixo de banco
do executor, e os testes de concorrência usam conexões PostgreSQL separadas.

Cobertura executada nesta implementação:

| Execução nesta implementação | Resultado |
| --- | --- |
| Primeira suíte de fretes | 69/69 aprovados; depois foram acrescentados casos críticos adicionais. |
| Regressão antes do último cenário HTTP | 147/147 aprovados. |
| Regressão da etapa de backend (histórica) | 148/148 aprovados, em 32,151 s de suíte. |
| Regressão atual, na integração full-stack | **149/149 aprovados**, zero falhas/erros/ignorados, em 60,168 s de suíte. |
| Composição atual | 36 testes de modelagem + 40 de integração/fretes/CORS + 73 de regressão dos demais módulos. |
| Verificações Django | Nenhum problema identificado. |
| Isolamento | Zero conexões bloqueadas fora dos bancos permitidos; descartável final removido. |

Python 3.14.3, Django 6.0.4 e psycopg2 2.9.12. O primeiro ensaio do executor
parou antes de executar testes porque a configuração TEST havia substituído os
defaults do Django; foi corrigido para alterar somente TEST.NAME. O banco dessa
tentativa também foi removido. Nenhum resultado histórico foi contado como teste
da implementação atual.

- Cadastro vinculado/avulso; limite e unidade; cotação/aprovação/referência.
- Conferência na tolerância positiva/negativa; correções, snapshots e histórico.
- Aceite, retirada com divergência, assinatura/ressalva e conclusão posterior.
- Cancelamento permitido/bloqueado sem efeito comercial ou nova baixa.
- Rollback real após falha injetada no histórico, inclusive na correção e entrega.
- Idempotência, conteúdo incompatível e chaves reaproveitadas em outro Frete.
- Alocação, aprovação, versões de CT-e, confirmação, aceite/recebimento e
  cancelamento/retirada concorrentes.
- HTTP de todos os casos de uso, isolamento, cotações próprias, imagem não exposta,
  filtros, paginação, indicadores e diretórios mínimos.
- Aplicação/reversão de migrations e constraints PostgreSQL reais.
- Regressão de pedidos, produtos, anúncios, comercialização, empresas, acesso e mercado.

O mock utilizado para rollback apenas injeta a falha depois de gravações reais;
persistência, consultas, transações, locks e constraints não são substituídos por mocks.

## Integração React e navegador

`AuditoriaIntegrada` apresenta consultas paginadas e todos os comandos aplicáveis
dos 17 contratos HTTP acima. O hook `useConsultaAuditoriaApi` controla páginas,
seleção, erros e comandos por sessão; `usePainelAuditoriaIntegrada` mantém os
formulários. Os diálogos reutilizam os componentes visuais existentes. Dinheiro e
medidas permanecem em texto no contrato; dados ausentes não são apresentados como
zero. O recebimento físico e o estado da auditoria são exibidos separadamente.

O cliente HTTP compartilhado preserva Bearer. O serviço de fretes agrupa comandos
iguais em andamento, conserva a chave após falhas de transporte/5xx e cria uma
nova após sucesso ou rejeição definitiva. A troca de sessão invalida operações
antigas, inclusive durante o cálculo do hash. O Django permite explicitamente
`idempotency-key` no CORS; a permissão é verificada por teste de OPTIONS e pelo
navegador real. Consultas posteriores a comandos bem-sucedidos podem falhar sem
transformar a gravação confirmada em erro de comando.

Para executar E2E com Edge, Django, Vite e PostgreSQL reais, a partir de `BackEnd`:

```powershell
.\.venv-local\Scripts\python.exe -B -m fretes.executar_e2e
```

O executor gera senha, chave de assinatura, empresas e banco de teste exclusivos,
aplica migrations apenas no descartável, verifica a preservação dos dados
comerciais e remove o banco ao terminar. Os logs e evidências ficam em
`test-results/test_zenwaste_fretes_e2e_*/`, ignorados pelo Git. A configuração
`playwright.fretes.config.ts` é separada da regressão com respostas HTTP simuladas.
Resultados atuais e reprodução das demais verificações estão no relatório.

## Limitações e continuidade

- Nome de arquivo de CT-e/foto é metadado; não há upload, emissão fiscal, SIGOR,
  MTR, ERP, rastreio ou comunicação externa nesta entrega.
- Assinatura não possui certificação criptográfica; autenticação identifica empresa.
- A baixa física comercial foi preservada. Transferi-la para a expedição exige
  revisão coordenada em outra evolução.
- Ensaios de carga, falhas de infraestrutura e homologação externa não foram feitos.
  O lock por autora é conservador e pode ser revisto com medição de contenção,
  preservando unicidade/idempotência e a ordem de locks.

O backend e a página integrada não usam o serviço demonstrativo para concluir
comandos. O código demonstrativo legado continua disponível para seus testes
isolados; ele não substitui uma falha da API por resultados fictícios.
