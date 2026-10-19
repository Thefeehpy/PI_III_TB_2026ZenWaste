# Pagamentos do marketplace

As telas oferecem uma demonstração local e um adapter HTTP para o app Django `pedidos`. O sandbox Django não movimenta dinheiro e seu Pix não é um BR Code bancário. Cobranças reais dependem da implementação de um provedor comercial.

## Navegação

| Rota | Tela |
| --- | --- |
| `/checkout/:itemId` | Material, quantidade, comprador e retirada |
| `/checkout/payment/:orderId` | Crédito, débito, parcelamento e início do Pix |
| `/checkout/pix/:orderId` | QR Code, copia e cola, validade, renovação e consulta de status |
| `/orders/:orderId` | Confirmação, recusa, cancelamento, pendência e resumo para download |
| `/orders` | Histórico, busca, filtros e retomada do pagamento |

O botão **Comprar agora** do `WasteCard` inicia o fluxo. **Minhas compras** está no menu desktop e mobile. As telas seguem os temas claro/escuro e os tokens visuais existentes. As novas páginas são carregadas sob demanda.

## Demonstração

- Pedidos em `sessionStorage`, separados pelo ID do usuário autenticado ou pelo escopo `guest`. São mantidos ao recarregar a aba; não constituem histórico durável. Se o navegador bloquear esse armazenamento, há fallback em memória.
- O formulário pode preencher um cartão fictício. Número e CVV não são persistidos nem enviados ao serviço. Apenas bandeira, últimos quatro dígitos e um token `demo_…` chegam ao adaptador.
- Crédito permite testar aprovação, recusa e parcelamento. Débito é sempre à vista. As condições de parcelamento exibidas são demonstrativas.
- O QR Code é gerado localmente com `qrcode`, a partir do mesmo conteúdo disponível em **Copiar código Pix**. O payload começa com `ZENWASTE|PIX-DEMONSTRACAO` e **não é um BR Code bancário**. Não se deve tentar pagá-lo.
- Cada Pix dura 15 minutos. A consulta de status ocorre a cada 5 segundos enquanto o pedido está pendente; a expiração também é calculada pelo relógio da tela. Gerar outro Pix substitui o anterior; voltar para o código vigente não renova seu prazo.
- **Simular pagamento recebido** permite revisar a confirmação sem um banco. Não há confirmação automática baseada somente em um clique de “já paguei”.
- O download é um resumo TXT identificado como demonstração, sem valor fiscal ou bancário.

## Ponto de integração

O contrato público está em `src/types/payment.ts`, na interface `PaymentService`. O modo padrão usa `src/services/demo-payment-service.ts`. Para apontar o checkout ao Django, configure `VITE_PAYMENT_MODE=backend` no ambiente do Vite e reinicie o servidor. Nesse modo, checkout/histórico exigem login e usam a sessão da empresa. A API base continua configurada por `VITE_API_URL` (padrão `http://127.0.0.1:8000/api`).

O adapter HTTP está em `src/services/api-payment-service.ts`. O escopo do cache continua separado por usuário. O servidor de desenvolvimento usa o gateway sandbox quando `DEBUG=True`; todas as respostas continuam marcadas visualmente como demonstração. `simulateResult` só é usado pelo sandbox e não deve ser oferecido em produção.

O formulário atual bloqueia a finalização em modo `live`: antes da ativação, substituir a geração do token de demonstração em `CheckoutPayment.tsx` pelos campos hospedados/SDK de tokenização do provedor. PAN e CVV nunca devem passar pelo adaptador HTTP, pelos logs ou pelo armazenamento da aplicação. Autenticação adicional de cartão, se exigida pelo provedor, deve ser tratada pelo SDK antes da consulta final do pedido.

### Endpoints Django

| Operação | Endpoint | Contrato |
| --- | --- | --- |
| Criar pedido | `POST /api/orders/` | `listingId`, `quantity`, `buyer`; `Idempotency-Key` obrigatório |
| Histórico | `GET /api/orders/` | Pedidos da empresa autenticada |
| Detalhes/status | `GET /api/orders/:uuid/` | `PaymentOrder` com status atualizado |
| Cartão | `POST /api/orders/:uuid/payments/` | Método, token do PSP, parcelas; `Idempotency-Key` obrigatório |
| Pix | `POST /api/orders/:uuid/pix/` | Pedido com `pix: { id, copyPaste, expiresAt }`; chave idempotente obrigatória |
| Cancelar | `POST /api/orders/:uuid/cancel/` | Pedido atualizado; invalida tentativa pendente |
| Webhook | `POST /api/payments/webhooks/:provider/` | Evento final assinado e com valor em centavos |

O adapter recebe `listing` no contrato compartilhado para montar a prévia. **Ao chamar o backend, envia somente `listing.id` e quantidade; nunca confia no preço ou total do cliente.** O servidor calcula preço, disponibilidade e total, e retorna o snapshot autorizado. Valores monetários em `PaymentOrder` são centavos inteiros de BRL; quantidades aceitam até três casas decimais. A compra é para retirada, sem frete incluso.

### Estados e consistência

`awaiting_payment` → `pending` → `paid` / `failed` / `expired`; pedidos ainda não pagos podem virar `canceled`. `failed` e `expired` permitem nova tentativa. `paid` e `canceled` são finais. A API deve garantir essas transições atomicamente e proteger tentativas simultâneas. A demonstração mantém idempotência por operação e bloqueia duplo clique na UI.

O backend autentica e autoriza cada pedido pela empresa, reserva/libera estoque, invalida pagamentos anteriores ao trocar de método/cancelar e valida prazos no servidor. `paid` vem do PSP/webhook; somente o sandbox local aceita simulação. Erros de negócio retornam mensagens legíveis. Datas são ISO 8601 com fuso e valores são exibidos em pt-BR.

Para Pix real, `copyPaste` precisa ser o **payload completo** devolvido pelo PSP (BR Code), usado diretamente pelo QR e pela cópia. Não deve ser reconstruído no navegador nem substituído por uma chave Pix. O PSP fornece identificador único, validade e deve respeitar as chaves de idempotência.

A configuração do gateway, setup PostgreSQL e os limites para habilitar cobranças reais estão documentados em `BackEnd/pedidos/README.md`. O repositório ainda não contém um adaptador de PSP comercial; o modo atual não realiza cobranças reais.

## Validação local

```powershell
npm run build
npx tsc --noEmit -p tsconfig.app.json
npm test
npx playwright test --config playwright.payment.config.ts
```

Os testes de navegador usam o Chrome instalado e o preview local do build de produção (`npm run build` deve ser executado antes). O backend não é necessário: os anúncios da API são interceptados com fixtures nos testes, e os pagamentos usam o adaptador demonstrativo. Requisições externas de fontes e imagens são bloqueadas nos testes para não depender da internet.
