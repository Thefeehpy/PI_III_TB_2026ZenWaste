import { test, expect, type Page } from "@playwright/test";

const listing = {
  id: "payment-fixture",
  name: "Aparas de Polietileno (PEAD)",
  type: "Plástico Industrial",
  description: "Material limpo e prensado para reaproveitamento industrial.",
  quantity: 5000,
  unit: "kg",
  price: 2.8,
  location: "São Paulo - SP",
  company: "IndPack Ltda.",
  imageUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%232b7559'/%3E%3C/svg%3E",
  createdAt: "2026-10-18",
};

test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", (route) => route.abort());
  await page.route("**/api/marketplace/ads/", (route) =>
    route.fulfill({ json: { items: [listing] } }),
  );
});

async function createOrder(page: Page) {
  await page.goto("/marketplace", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("link", { name: `Comprar ${listing.name}`, exact: true })
    .click();
  await expect(page).toHaveURL(/\/checkout\/payment-fixture$/);
  await page.getByLabel("Quantidade (kg)", { exact: true }).fill("10");
  await page
    .getByLabel("Nome completo ou razão social")
    .fill("Empresa Demonstração");
  await page.getByLabel("CPF ou CNPJ").fill("11222333000181");
  await page.getByLabel("Telefone com DDD").fill("11999999999");
  await page.getByLabel("E-mail", { exact: true }).fill("teste@example.com");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Ir para pagamento" }).click();
  await expect(page).toHaveURL(/\/checkout\/payment\//);
  await expect(page.getByTestId("order-total")).toContainText("28,00");
}

test("credit purchase, session reload, receipt download and searchable history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await createOrder(page);
  await page.getByRole("button", { name: "Preencher dados de teste" }).click();
  await page.getByLabel("Parcelamento", { exact: true }).selectOption("3");
  await page.screenshot({
    path: ".workspace/payment-card-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Simular pagamento de" }).click();
  await expect(page).toHaveURL(/\/orders\//);
  await expect(
    page.getByText("Pagamento aprovado", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("3 parcelas · total")).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Pagamento aprovado", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar resumo da compra" }).click();
  expect((await download).suggestedFilename()).toMatch(/^resumo-ZW-/);
  await page
    .getByRole("link", { name: "Minhas compras", exact: true })
    .first()
    .click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByLabel("Buscar pedidos").fill("não existe");
  await expect(page.getByText("Nenhum pedido encontrado")).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("declined credit can be retried with debit, without installments", async ({
  page,
}) => {
  await createOrder(page);
  await page.getByRole("button", { name: "Preencher dados de teste" }).click();
  await page.getByLabel("Resultado da simulação").selectOption("decline");
  await page.getByRole("button", { name: "Simular pagamento de" }).click();
  await expect(
    page.getByText("Pagamento não aprovado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Tentar novamente" }).click();
  await page.getByRole("radio", { name: /Débito/ }).check();
  await expect(page.getByLabel("Parcelamento", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Preencher dados de teste" }).click();
  await page.getByRole("button", { name: "Simular pagamento de" }).click();
  await expect(
    page.getByText("Pagamento aprovado", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Cartão de débito", { exact: true }),
  ).toBeVisible();
});

test("Pix renders a QR matching the copy code, expires, renews and confirms", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await createOrder(page);
  await page.getByRole("radio", { name: /Pix/ }).check();
  await page.getByRole("button", { name: "Gerar Pix de" }).click();
  await expect(
    page.getByRole("img", { name: "QR Code do Pix demonstrativo" }),
  ).toBeVisible();
  const firstCode = await page
    .getByLabel("Prefere copiar o código?")
    .inputValue();
  expect(firstCode).toContain("PIX-DEMONSTRACAO");
  await page.getByRole("button", { name: "Copiar código Pix" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    firstCode,
  );
  await page
    .getByRole("button", { name: "Já paguei, verificar status" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Ainda aguardando" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".workspace/payment-pix-desktop.png",
    fullPage: true,
  });
  await page.clock.install();
  await page.clock.fastForward(16 * 60_000);
  await expect(
    page.getByText("QR Code expirado", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copiar código Pix" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Gerar novo Pix" }).click();
  await expect(page.getByTestId("pix-countdown")).toBeVisible();
  expect(
    await page.getByLabel("Prefere copiar o código?").inputValue(),
  ).not.toBe(firstCode);
  await page
    .getByRole("button", { name: "Simular pagamento recebido" })
    .click();
  await expect(
    page.getByText("Pagamento aprovado", { exact: true }),
  ).toBeVisible();
});

test("mobile dark checkout validates buyer, quantity, card and cancellation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem("zenwaste-theme", "dark"),
  );
  await createOrder(page);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Simular pagamento de" }).click();
  await expect(page.getByText("Confira o número do cartão.")).toBeVisible();
  await expect(page.getByLabel("Número do cartão")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".workspace/payment-mobile-dark.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Conferir dados do pedido" }).click();
  await page.getByRole("button", { name: "Cancelar este pedido" }).click();
  await page.getByRole("button", { name: "Sim, cancelar pedido" }).click();
  await expect(
    page.getByText("Pedido cancelado", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continuar pagamento" }),
  ).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Pedido cancelado", { exact: true }).first(),
  ).toBeVisible();
});

test("unavailable listing and missing order have useful recovery routes", async ({
  page,
}) => {
  await page.goto("/checkout/missing-listing", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { name: "Material indisponível" }),
  ).toBeVisible();
  await page.goto("/orders/missing-order", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Pedido não encontrado" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explorar marketplace" }),
  ).toHaveAttribute("href", "/marketplace");
});

test("buyer errors and unavailable quantities prevent continuing checkout", async ({
  page,
}) => {
  await page.goto("/checkout/payment-fixture", {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("button", { name: "Ir para pagamento" }).click();
  await expect(page.getByText("Informe um CPF ou CNPJ válido.")).toBeVisible();
  await expect(page.getByLabel("Nome completo ou razão social")).toBeFocused();
  await page.getByLabel("Quantidade (kg)", { exact: true }).fill("5001");
  await expect(
    page.getByRole("button", { name: "Ir para pagamento" }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Informe uma quantidade maior que zero/),
  ).toBeVisible();
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("link", { name: "Minhas compras", exact: true }).click();
  await expect(page).toHaveURL(/\/orders$/);
});
