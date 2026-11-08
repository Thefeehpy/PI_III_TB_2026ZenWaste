import { expect, test, type Page } from "@playwright/test";
import type { Anuncio } from "../../src/types/anuncio";
import type { Reserva } from "../../src/types/reserva";

const anuncio: Anuncio = {
  id: "anuncio-teste", name: "Papelão de teste", type: "Papel e Papelão", description: "Material limpo",
  quantity: 40, unit: "kg", price: 1, location: "Campinas - SP", company: "Vendedora de teste",
  imageUrl: "", images: [], createdAt: "2026-11-06", contactPhone: "", whatsappUrl: "",
};
const reserva: Reserva = {
  id: "reserva-teste", itemId: "produto-teste", itemName: anuncio.name, itemType: anuncio.type,
  unit: "kg", currentQuantity: 100, missingQuantity: 0, buyerCompanyId: 2, orderId: "pedido-teste",
  modality: "compromisso", buyerName: "Compradora registrada", buyerPhone: "11999999999",
  quantity: 40, unitPrice: 1, totalPrice: 40, status: "pronta", note: "Observação da negociação",
  deadline: "", reservedAt: "2026-11-06T12:00:00Z", finalizedAt: "",
};

async function prepararApi(pagina: Page) {
  await pagina.addInitScript(() => localStorage.setItem("zenwaste.auth-token", "sessao-teste"));
  await pagina.route("https://**/*", (rota) => rota.abort());
  await pagina.route("**/api/**", (rota) => {
    const caminho = new URL(rota.request().url()).pathname;
    if (caminho.endsWith("/auth/me/")) return rota.fulfill({ json: { user: {
      id: "empresa-teste", razaoSocial: "Vendedora de teste", cnpj: "11222333000181",
      email: "teste@example.com", telefone: "11999999999", segmento: "Indústria", ativo: true, roles: ["vendedora"],
    } } });
    if (caminho.endsWith("/inventory/reservations/")) return rota.fulfill({ json: { items: [reserva] } });
    if (caminho.endsWith("/inventory/movements/")) return rota.fulfill({ json: { movements: [] } });
    if (caminho.endsWith("/marketplace/ads/")) return rota.fulfill({ json: { items: [anuncio] } });
    return rota.fulfill({ json: { items: [] } });
  });
}

test("a falha do marketplace não publica anúncios fictícios e permite nova tentativa", async ({ page }) => {
  await prepararApi(page);
  let consultaDisponivel = false;
  await page.route("**/api/marketplace/ads/", (rota) => consultaDisponivel
    ? rota.fulfill({ json: { items: [anuncio] } })
    : rota.fulfill({ status: 503, json: { message: "Anúncios indisponíveis." } }));
  await page.goto("/marketplace");
  await expect(page.getByRole("alert")).toContainText("Anúncios indisponíveis.");
  await expect(page.getByRole("link", { name: /^Comprar / })).toHaveCount(0);
  consultaDisponivel = true;
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByRole("link", { name: `Comprar ${anuncio.name}`, exact: true })).toBeVisible();
});

test("reservas exibem a compradora e o pedido registrados pela API", async ({ page }) => {
  await prepararApi(page);
  await page.goto("/dashboard/reservations");
  await expect(page.getByText("Compradora registrada", { exact: true })).toBeVisible();
  await expect(page.getByText("Pedido vinculado", { exact: true })).toBeVisible();
  await expect(page.getByText("Observação da negociação", { exact: true })).toBeVisible();
});

test("a bolsa informa indisponibilidade em vez de substituir a API por preços simulados", async ({ page }) => {
  await prepararApi(page);
  await page.route("**/api/market/prices/", (rota) => rota.fulfill({ status: 503, json: { message: "Bolsa indisponível." } }));
  await page.goto("/market-intelligence");
  await expect(page.getByRole("alert")).toContainText("Bolsa indisponível.");
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expect(page.getByText("R$ 2,80", { exact: true })).toHaveCount(0);
});

test("publicação usa o saldo disponível e identifica o transporte como simulação", async ({ page }) => {
  await prepararApi(page);
  const publicacoes: Record<string, unknown>[] = [];
  await page.route("https://viacep.com.br/ws/13010000/json/", (rota) => rota.fulfill({ json: {
    logradouro: "Rua de teste", bairro: "Centro", localidade: "Campinas", uf: "SP",
  } }));
  await page.route("**/api/inventory/items/", (rota) => rota.fulfill({ json: { items: [{
    id: "produto-teste", name: anuncio.name, type: anuncio.type, description: anuncio.description,
    quantity: 100, committedQuantity: 60, availableQuantity: 40, unit: "kg", targetQuantity: 0,
    deadline: "2026-11-06", status: "concluido", createdAt: "2026-11-06", updatedAt: "2026-11-06T12:00:00Z",
  }] } }));
  await page.route("**/api/market/suggest-price/", (rota) => rota.fulfill({ json: {
    suggestedPrice: 1, source: "fallback", aiAvailable: false, insight: "Referência recebida do backend",
  } }));
  await page.route("**/api/marketplace/ads/", (rota) => {
    if (rota.request().method() !== "POST") return rota.fulfill({ json: { items: [anuncio] } });
    publicacoes.push(rota.request().postDataJSON());
    return rota.fulfill({ status: 201, json: { item: anuncio } });
  });

  await page.goto("/dashboard/create-ad");
  await page.getByRole("combobox", { name: "Item do estoque" }).click();
  await page.getByRole("option", { name: `${anuncio.name} - 40 kg`, exact: true }).click();
  await page.getByRole("button", { name: "Proximo", exact: true }).click();
  await expect(page.getByLabel("Quantidade para Venda", { exact: true })).toHaveValue("40");
  await page.getByLabel("Quantidade para Venda", { exact: true }).fill("40.001");
  await page.getByLabel("CEP", { exact: true }).fill("13010000");
  await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue("Campinas");
  await page.getByLabel("Número", { exact: true }).fill("10");
  await expect(page.getByRole("button", { name: "Proximo", exact: true })).toBeDisabled();
  await page.getByLabel("Quantidade para Venda", { exact: true }).fill("1.125");
  await page.getByRole("button", { name: "Proximo", exact: true }).click();
  await page.getByLabel("Seu Preço (R$ / kg)", { exact: true }).fill("2.50");
  await page.getByRole("button", { name: "Proximo", exact: true }).click();
  await page.getByRole("button", { name: "Simular transporte", exact: true }).click();
  await page.getByRole("button", { name: "Publicar Anuncio", exact: true }).click();
  await expect(page.getByText("Anúncio publicado", { exact: true })).toBeVisible();
  await expect(page.getByText("Seu resíduo está no marketplace. O transporte é uma simulação local e não foi enviado para transportadoras.", { exact: true })).toBeVisible();
  expect(publicacoes).toHaveLength(1);
  expect(publicacoes[0]).toMatchObject({ inventoryId: "produto-teste", quantity: 1.125, price: 2.5, images: [] });
  expect(publicacoes[0]).not.toHaveProperty("imageUrl");
});

test("auditoria mantém cotação, documento, tratativa e entrega como demonstração local", async ({ page }) => {
  await prepararApi(page);
  const requisicoesGravacao: string[] = [];
  page.on("request", (requisicao) => { if (requisicao.method() === "POST") requisicoesGravacao.push(requisicao.url()); });
  await page.goto("/dashboard/freight-audit");
  await expect(page.getByText("Acompanhe o fluxo demonstrativo, da cotação à entrega. Os dados e as ações são temporários nesta sessão.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Precisa cotação", exact: true }).first().click();
  const detalhes = page.getByRole("dialog", { name: "Pedido #101", exact: true });
  await detalhes.getByRole("tab", { name: "Cotações", exact: true }).click();
  await detalhes.getByRole("button", { name: "Adicionar cotação", exact: true }).click();
  const cotacao = page.getByRole("dialog", { name: "Adicionar cotação", exact: true });
  await cotacao.getByLabel("Transportadora", { exact: true }).fill("Transportadora de teste");
  await cotacao.getByLabel("Valor", { exact: true }).fill("400");
  await cotacao.getByRole("button", { name: "Salvar cotação", exact: true }).click();
  await detalhes.getByRole("button", { name: "Aprovar cotação", exact: true }).click();
  await detalhes.getByRole("tab", { name: "Documentos", exact: true }).click();
  await detalhes.getByLabel("Valor CT-e", { exact: true }).fill("420");
  await detalhes.getByRole("button", { name: "Salvar documentos", exact: true }).click();
  await expect(detalhes.getByText("Divergência encontrada", { exact: true })).toBeVisible();
  await detalhes.getByRole("tab", { name: "Tratativas", exact: true }).click();
  await detalhes.getByRole("button", { name: "Nova tratativa", exact: true }).click();
  const tratativa = page.getByRole("dialog", { name: "Nova tratativa", exact: true });
  await tratativa.getByLabel("Observação da tratativa", { exact: true }).fill("Registro temporário de teste");
  await tratativa.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(detalhes.getByText("Registro temporário de teste", { exact: true })).toBeVisible();
  await detalhes.getByRole("tab", { name: "Entrega", exact: true }).click();
  await detalhes.getByRole("button", { name: "Registrar aqui", exact: true }).click();
  const entrega = page.getByRole("dialog", { name: "Registrar entrega", exact: true });
  await entrega.getByLabel("Nome de quem recebeu", { exact: true }).fill("Recebedor de teste");
  await entrega.getByRole("button", { name: "Confirmar entrega", exact: true }).click();
  await expect(detalhes.getByText("Entrega confirmada", { exact: true })).toBeVisible();
  expect(requisicoesGravacao).toEqual([]);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
