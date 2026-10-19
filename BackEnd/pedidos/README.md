# Pedidos e pagamentos

O app `pedidos` e dono do ciclo de compra. Ele nao substitui `anuncios.Reserva`, que continua atendendo o fluxo de reserva comercial existente.

## Banco

PostgreSQL e a configuracao recomendada para ambientes compartilhados. O projeto ja usa `psycopg2` e seleciona o banco por variaveis de ambiente:

```powershell
$env:ZENWASTE_DB_ENGINE = "postgresql"
$env:ZENWASTE_DB_NAME = "zenwaste"
$env:ZENWASTE_DB_USER = "postgres"
$env:ZENWASTE_DB_PASSWORD = "<senha local>"
$env:ZENWASTE_DB_HOST = "localhost"
$env:ZENWASTE_DB_PORT = "5432"
$env:ZENWASTE_SECRET_KEY = "<chave forte gerada fora do repositorio>"
$env:ZENWASTE_DEBUG = "False"
python manage.py migrate
```

Sem `ZENWASTE_DB_ENGINE`, o projeto segue usando SQLite para desenvolvimento isolado e testes. Credenciais nao devem ser adicionadas ao repositorio. Com `ZENWASTE_DEBUG=False`, uma `ZENWASTE_SECRET_KEY` explicita e obrigatoria.

## Gateway

`ZENWASTE_PAYMENT_GATEWAY=sandbox` ativa o gateway fake somente quando `DEBUG=True`. O Pix sandbox nao e um BR Code e nunca movimenta dinheiro. Em producao, o padrao e `disabled`.

Um gateway real deve implementar `pedidos.gateways.PaymentGateway` e ser apontado por `ZENWASTE_PAYMENT_GATEWAY_CLASS` com o caminho Python da classe. O adaptador concreto e responsavel por tokenizar/processar no PSP, idempotencia no provedor, cancelamento, verificacao da assinatura nativa do webhook (sobrescrevendo `verify_webhook`) e normalizacao dos estados para `GatewayResult`. O token recebido da aplicacao nunca deve conter PAN/CVV; esses dados ficam nos campos hospedados/SDK do PSP.

Para habilitar o endpoint de webhook e necessario definir `ZENWASTE_PAYMENT_WEBHOOK_SECRET`. O contrato interno atual assina o corpo bruto com HMAC-SHA256 no header `X-Payment-Signature`; provedores que tenham outro protocolo devem verificar sua assinatura dentro do adaptador, antes de normalizar o evento.

## API

Todas as rotas de pedido exigem `Authorization: Bearer <token da empresa>` e pedidos ficam visiveis apenas para a empresa compradora.

| Metodo | Rota | Uso |
| --- | --- | --- |
| POST | `/api/orders/` | Criar pedido; recebe `listingId`, `quantity` e `buyer`; requer `Idempotency-Key` |
| GET | `/api/orders/` | Historico da empresa autenticada |
| GET | `/api/orders/<uuid>/` | Detalhes e status |
| POST | `/api/orders/<uuid>/payments/` | Iniciar cartao com token do provedor; requer `Idempotency-Key` |
| POST | `/api/orders/<uuid>/pix/` | Criar ou recuperar Pix; requer `Idempotency-Key` |
| POST | `/api/orders/<uuid>/cancel/` | Cancelar pedido ainda nao pago |
| POST | `/api/orders/<uuid>/sandbox-result/` | Simular resultado Pix apenas em sandbox local |
| POST | `/api/payments/webhooks/<provider>/` | Receber evento final assinado pelo provedor |

O backend recalcula preco e total a partir do anuncio. Pedidos ativos reservam quantidade sem baixar estoque; cancelamento ou expiracao libera a reserva. A confirmacao de pagamento baixa o saldo e registra uma movimentacao de estoque em uma transacao. Baixas manuais e alteracoes/finalizacoes de anuncio nao podem consumir saldo reservado.

Valores monetarios sao armazenados em `Decimal` de duas casas e expostos como centavos inteiros. PAN e CVV nao sao aceitos nem persistidos. `Order`, `PaymentAttempt` e `WebhookEvent` mantem snapshots, tentativas idempotentes e deduplicacao de eventos.

## Limites conhecidos

O app fornece a fronteira e o fluxo sandbox, nao uma integracao comercial com PSP. Antes de cobrar em producao, escolha o provedor, implemente seu adaptador concreto e teste os webhooks e cancelamentos no ambiente de homologacao. Tambem e necessario executar um worker agendado para expirar reservas e reconciliar pagamentos pendentes; no momento a expiracao e aplicada quando pedidos sao consultados ou pagos.