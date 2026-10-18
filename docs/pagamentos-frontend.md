# Pagamentos do marketplace

Esta entrega é **somente front-end**. Não altera o Django, não realiza cobranças, não reserva estoque e não envia dados a um provedor de pagamentos. O aviso de demonstração é intencional.

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

O contrato público está em `src/types/payment.ts`, na interface `PaymentService`. A implementação atual é `src/services/demo-payment-service.ts`, selecionada em `src/hooks/use-payments.ts`.

Para integrar, criar um adaptador HTTP que implemente essa interface e selecioná-lo em `usePayments`. O escopo do cache deve continuar separado por usuário. O serviço real deve retornar `mode: "live"`; condicionar também os avisos de demonstração, o download e a disponibilidade de compra sem autenticação à configuração da aplicação. `simulateResult` é opcional e deve ser omitido no adaptador real.

O formulário atual bloqueia a finalização em modo `live`: antes da ativação, substituir a geração do token de demonstração em `CheckoutPayment.tsx` pelos campos hospedados/SDK de tokenização do provedor. PAN e CVV nunca devem passar pelo adaptador HTTP, pelos logs ou pelo armazenamento da aplicação. Autenticação adicional de cartão, se exigida pelo provedor, deve ser tratada pelo SDK antes da consulta final do pedido.

### Endpoints propostos (ainda não implementados)

| Operação | Endpoint sugerido | Contrato |
| --- | --- | --- |
| Criar pedido | `POST /api/orders/` | `listingId`, `quantity`, `buyer`, `fulfillment: "pickup"`; chave de idempotência no header |
| Histórico | `GET /api/orders/` | Apenas pedidos do usuário autenticado; mapear para `PaymentOrder[]` |
| Detalhes/status | `GET /api/orders/:id/` | `PaymentOrder`, incluindo status atualizado |
| Cartão | `POST /api/orders/:id/payments/` | Método, token do provedor, parcelas; chave de idempotência no header |
| Pix | `POST /api/orders/:id/pix/` | Retornar pedido com `pix: { id, copyPaste, expiresAt }` |
| Cancelar | `POST /api/orders/:id/cancel/` | Retornar pedido atualizado; invalidar cobrança pendente |

O adaptador recebe `listing` no contrato de demonstração para montar a prévia. **Ao chamar o backend, enviar somente `listing.id` e a quantidade; nunca confiar no objeto, no preço ou no total enviado pelo cliente.** O backend deve recalcular preço, disponibilidade, limites, parcelas e total, e devolver o snapshot autorizado. Todos os valores monetários de `PaymentOrder` são inteiros em centavos de BRL; quantidades admitem até três casas decimais. Nenhuma taxa ou frete é inventado na tela: esta versão considera retirada, sem frete incluso.

### Estados e consistência

`awaiting_payment` → `pending` → `paid` / `failed` / `expired`; pedidos ainda não pagos podem virar `canceled`. `failed` e `expired` permitem nova tentativa. `paid` e `canceled` são finais. A API deve garantir essas transições atomicamente e proteger tentativas simultâneas. A demonstração mantém idempotência por operação e bloqueia duplo clique na UI.

O backend deve autenticar e autorizar cada acesso, reservar/liberar estoque conforme as regras do produto, invalidar o Pix anterior ao trocar de método ou cancelar e validar o prazo no servidor. O estado `paid` deve vir de confirmação confiável do provedor/webhook, nunca do front-end. Devolver erros de negócio em mensagens legíveis. Manter datas ISO 8601 com fuso; as telas apresentam datas no fuso do navegador e valores em pt-BR.

Para Pix real, `copyPaste` precisa ser o **payload completo** devolvido pelo provedor (BR Code). Ele alimenta QR Code e cópia, sem reconstrução no navegador. Não substituir por uma chave Pix avulsa. O provedor deve fornecer um identificador de cobrança único e `expiresAt`. Regenerações concorrentes precisam ser idempotentes no servidor.

## Validação local

```powershell
npm run build
npx tsc --noEmit -p tsconfig.app.json
npm test
npx playwright test --config playwright.payment.config.ts
```

Os testes de navegador usam o Chrome instalado e o preview local do build de produção (`npm run build` deve ser executado antes). O backend não é necessário: os anúncios da API são interceptados com fixtures nos testes, e os pagamentos usam o adaptador demonstrativo. Requisições externas de fontes e imagens são bloqueadas nos testes para não depender da internet.
