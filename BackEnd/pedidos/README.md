> Documentação central: [índice e continuidade](../../../../documentacao_zenwaste/00_INDICE.md).
> Configuração vigente: PostgreSQL exclusivo. Exemplos abaixo são históricos; não aplicar migrations no banco atual sem autorização. Fretes permanece adiado.

# Pedidos e pagamentos

O app `pedidos` e dono do ciclo de compra. Cada novo checkout cria e sincroniza uma `anuncios.Reserva` vinculada ao pedido e a empresa compradora. A disponibilidade soma pedidos vigentes e compromissos manuais sem pedido, sem somar novamente a reserva vinculada. Metas de captacao legadas continuam distintas de compromissos de estoque.

A modelagem, os relacionamentos, a arquitetura SOLID/patterns e a transicao futura estao consolidados em [modelagem e continuidade](../../../../documentacao_zenwaste/00_INDICE.md). As migrations desta reestruturacao precisam de revisao e homologacao antes de serem aplicadas no banco compartilhado.

## Banco e configuracao

O backend utiliza exclusivamente PostgreSQL. A configuracao e recebida pelo
ambiente do processo ou por BackEnd/.env, sem sobrescrever variaveis ja definidas.

Use o .env.example da raiz como referencia. Preencha os campos privados
localmente e preserve qualquer arquivo .env existente:

```dotenv
ZENWASTE_DB_ENGINE=postgresql
ZENWASTE_DB_NAME=
ZENWASTE_DB_USER=
ZENWASTE_DB_PASSWORD=
ZENWASTE_DB_HOST=
ZENWASTE_DB_PORT=
ZENWASTE_SECRET_KEY=
ZENWASTE_DEBUG=False
```

Os campos vazios precisam ser preenchidos no ambiente privado antes da execucao.
Nao registre credenciais, chaves ou arquivos de ambiente no Git.

Esta documentacao nao autoriza executar ou reaplicar migrations no banco
existente. A migration fretes/0001_initial nao deve ser aplicada.

Testes devem utilizar exclusivamente bancos isolados autorizados, com NAME
e TEST.NAME configurados explicitamente. Um comando generico de testes nao
garante esse isolamento.

## Gateway

`ZENWASTE_PAYMENT_GATEWAY=sandbox` ativa o gateway fake somente quando `DEBUG=True`. O Pix sandbox nao e um BR Code e nunca movimenta dinheiro. Em producao, o padrao e `disabled`.

Um gateway real deve implementar `pedidos.integracoes.IntegracaoPagamento` e ser apontado por `ZENWASTE_PAYMENT_GATEWAY_CLASS` com o caminho Python da classe. O adaptador concreto e responsavel por tokenizar/processar no PSP, idempotencia no provedor, cancelamento, verificacao da assinatura nativa do webhook (sobrescrevendo `validar_notificacao`) e normalizacao dos estados para `ResultadoPagamento`. O token recebido da aplicacao nunca deve conter PAN/CVV; esses dados ficam nos campos hospedados/SDK do PSP.

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

O backend recalcula preco e total a partir do anuncio. Pedidos ativos reservam quantidade sem baixar estoque; cancelamento ou expiracao libera a reserva. Nesta etapa, a confirmacao de pagamento ainda baixa o saldo, registra uma movimentacao e encerra a reserva vinculada em uma transacao. No fluxo futuro acordado, a baixa sera transferida para a expedicao; transporte/MTR ainda nao foram implementados. Baixas manuais e alteracoes/finalizacoes de anuncio nao podem consumir saldo reservado.

Valores monetarios sao armazenados em `Decimal` de duas casas e expostos como centavos inteiros. PAN e CVV nao sao aceitos nem persistidos. `Pedido`, `TentativaPagamento` e `EventoWebhook` mantem snapshots, tentativas idempotentes e deduplicacao de eventos.

## Limites conhecidos

O app fornece a fronteira e o fluxo sandbox, nao uma integracao comercial com PSP. Antes de cobrar em producao, escolha o provedor, implemente seu adaptador concreto e teste os webhooks e cancelamentos no ambiente de homologacao. Tambem e necessario executar um worker agendado para expirar reservas e reconciliar pagamentos pendentes; no momento a expiracao e aplicada quando pedidos sao consultados ou pagos.