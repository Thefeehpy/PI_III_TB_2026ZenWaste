import { expect, test, type Page } from "@playwright/test";

const listing = {
  id: "receiver-fixture", name: "Plástico para teste de entrega", type: "Plástico Industrial",
  description: "Material para demonstração", quantity: 100, unit: "kg", price: 2.8,
  location: "São Paulo - SP", company: "Empresa de teste", imageUrl: "", createdAt: "2026-11-09",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("zenwaste.auth-token", "receiver-ui-test");
    localStorage.setItem("zenwaste-theme", "dark");
  });
  await page.route("https://**/*", (route) => route.abort());
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me/")) return route.fulfill({ json: { user: {
      id: "receiver-user", razaoSocial: "Empresa de teste", cnpj: "11222333000181",
      email: "teste@example.com", telefone: "11999999999", segmento: "Indústria",
    } } });
    if (path.endsWith("/marketplace/ads/")) return route.fulfill({ json: { items: [listing] } });
    if (path.endsWith("/inventory/items/")) return route.fulfill({ json: { items: [] } });
    return route.fulfill({ json: { items: [], reservations: [], movements: [] } });
  });
});

async function openFreightReceiver(page: Page, number = "5842") {
  await page.goto("/dashboard/freight-audit", { waitUntil: "domcontentloaded" });
  await page.getByRole("article").filter({ hasText: `Pedido #${number}` })
    .getByRole("button", { name: "Ver detalhes", exact: true }).click();
  await page.getByRole("tab", { name: "Recebedor", exact: true }).click();
}

async function registerReceiver(page: Page, name = "Pedro Tanaka", cpf = "52998224725") {
  await page.getByLabel("Nome completo do recebedor", { exact: true }).fill(name);
  await page.getByLabel("CPF do recebedor", { exact: true }).fill(cpf);
  await page.getByRole("button", { name: "Salvar recebedor", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Recebedor cadastrado:" })).toContainText(name);
}

test("registers in freight details, persists, validates identity, and releases signing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openFreightReceiver(page);
  await page.getByLabel("Nome completo do recebedor", { exact: true }).fill("Pedro");
  await page.getByLabel("CPF do recebedor", { exact: true }).fill("12345678901");
  await page.getByRole("button", { name: "Salvar recebedor", exact: true }).click();
  await expect(page.getByText("Informe o nome completo do recebedor.", { exact: true })).toBeVisible();
  await expect(page.getByText("Informe um CPF válido.", { exact: true })).toBeVisible();
  await registerReceiver(page);
  await page.screenshot({ path: ".workspace/receiver-registration-desktop.png", fullPage: true });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("article").filter({ hasText: "Pedido #5842" })
    .getByRole("button", { name: "Ver detalhes", exact: true }).click();
  await page.getByRole("tab", { name: "Recebedor", exact: true }).click();
  await expect(page.getByLabel("Nome completo do recebedor", { exact: true })).toHaveValue("Pedro Tanaka");
  await page.getByRole("link", { name: "Abrir assinatura do pedido" }).click();
  await page.getByLabel("Nome de quem recebeu", { exact: true }).fill("Pedro Tanaka");
  await page.getByLabel("CPF", { exact: true }).fill("11144477735");
  await page.getByRole("button", { name: "Liberar assinatura", exact: true }).click();
  await expect(page.getByText("Nome ou CPF não conferem", { exact: false })).toBeVisible();
  await page.getByLabel("Nome de quem recebeu", { exact: true }).fill("  PEDRO   TANAKA  ");
  await page.getByLabel("CPF", { exact: true }).fill("52998224725");
  await page.getByRole("button", { name: "Liberar assinatura", exact: true }).click();
  await expect(page.getByRole("button", { name: "Assinatura liberada", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar recebimento", exact: true })).toBeDisabled();
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 25, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 110, { steps: 12 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Confirmar recebimento", exact: true }).click();
  await expect(page.getByText("Assinatura registrada", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("blocks missing registration and does not reuse another order's receiver", async ({ page }) => {
  await openFreightReceiver(page);
  await registerReceiver(page);
  await page.goto("/driver/deliveries", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Pedro Tanaka • 529.***.***-25", { exact: true })).toBeVisible();
  await page.goto("/delivery-signature/5846", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Recebedor não cadastrado", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Nome de quem recebeu", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Liberar assinatura", exact: true })).toBeDisabled();
  await page.goto("/delivery-signature/5842?token=canhoto-5846-coleta-verde", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Nome de quem recebeu", { exact: true }).fill("Pedro Tanaka");
  await page.getByLabel("CPF", { exact: true }).fill("52998224725");
  await page.getByRole("button", { name: "Liberar assinatura", exact: true }).click();
  await expect(page.getByText("Este QR Code não pertence ao pedido selecionado.", { exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("updates an already open signing tab when the authorized receiver changes", async ({ page, context }) => {
  await openFreightReceiver(page);
  await registerReceiver(page);
  const signaturePage = await context.newPage();
  await signaturePage.goto("/delivery-signature/5842", { waitUntil: "domcontentloaded" });
  await signaturePage.getByLabel("Nome de quem recebeu", { exact: true }).fill("Pedro Tanaka");
  await signaturePage.getByLabel("CPF", { exact: true }).fill("52998224725");
  await signaturePage.getByRole("button", { name: "Liberar assinatura", exact: true }).click();
  await expect(signaturePage.locator("canvas")).toBeVisible();
  await page.getByLabel("Nome completo do recebedor", { exact: true }).fill("Maria Silva");
  await page.getByLabel("CPF do recebedor", { exact: true }).fill("11144477735");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(signaturePage.locator("canvas")).toHaveCount(0);
  await expect(signaturePage.getByLabel("Nome de quem recebeu", { exact: true })).toHaveValue("");
  await signaturePage.getByLabel("Nome de quem recebeu", { exact: true }).fill("Pedro Tanaka");
  await signaturePage.getByLabel("CPF", { exact: true }).fill("52998224725");
  await signaturePage.getByRole("button", { name: "Liberar assinatura", exact: true }).click();
  await expect(signaturePage.getByText("Nome ou CPF não conferem", { exact: false })).toBeVisible();
  await signaturePage.getByLabel("Nome de quem recebeu", { exact: true }).fill("Maria Silva");
  await signaturePage.getByLabel("CPF", { exact: true }).fill("11144477735");
  await signaturePage.getByRole("button", { name: "Liberar assinatura", exact: true }).click();
  await expect(signaturePage.locator("canvas")).toBeVisible();
});

test("registers the receiver on a new marketplace order and works on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/checkout/${listing.id}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Quantidade (kg)", { exact: true }).fill("10");
  await page.getByLabel("Nome completo ou razão social", { exact: true }).fill("Empresa de teste");
  await page.getByLabel("CPF ou CNPJ", { exact: true }).fill("11222333000181");
  await page.getByLabel("Telefone com DDD", { exact: true }).fill("11999999999");
  await page.getByLabel("E-mail", { exact: true }).fill("teste@example.com");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Ir para pagamento", exact: true }).click();
  await page.getByRole("button", { name: "Preencher dados de teste", exact: true }).click();
  await page.getByRole("button", { name: "Simular pagamento de" }).click();
  await expect(page).toHaveURL(/\/orders\//);
  await registerReceiver(page);
  await page.getByRole("heading", { name: "Recebedor autorizado", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".workspace/receiver-registration-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Abrir assinatura do pedido" }).click();
  await expect(page.getByText(`Empresa de teste • ${listing.name}`, { exact: true })).toBeVisible();
  await page.getByLabel("Nome de quem recebeu", { exact: true }).fill("Pedro Tanaka");
  await page.getByLabel("CPF", { exact: true }).fill("52998224725");
  await page.getByRole("button", { name: "Liberar assinatura", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByLabel("Nome de quem recebeu", { exact: true }).fill("Outro Nome");
  await expect(page.locator("canvas")).toHaveCount(0);
});
