import { expect, test } from "@playwright/test";

const listing = {
  id: "mask-fixture",
  name: "Vidro industrial",
  type: "Vidro",
  description: "Material de teste",
  quantity: 100,
  unit: "kg",
  price: 2,
  location: "São Paulo - SP",
  company: "Empresa de teste",
  imageUrl: "",
  createdAt: "2026-10-19",
};

test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", (route) => route.abort());
  await page.route("**/api/marketplace/ads/", (route) =>
    route.fulfill({ json: { items: [listing] } }),
  );
});

test("checkout formats while typing and supports correcting, pasting and deleting digits", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/checkout/mask-fixture");
  const document = page.getByLabel("CPF ou CNPJ");
  const phone = page.getByLabel("Telefone com DDD");
  await document.pressSequentially("5299822", { delay: 25 });
  await expect(document).toHaveValue("529.982.2");
  await document.pressSequentially("4725", { delay: 25 });
  await expect(document).toHaveValue("529.982.247-25");
  await document.evaluate((input: HTMLInputElement) =>
    input.setSelectionRange(4, 4),
  );
  await document.press("Backspace");
  await expect(document).toHaveValue("529.822.472-5");
  await expect
    .poll(() =>
      document.evaluate((input: HTMLInputElement) => input.selectionStart),
    )
    .toBe(2);
  await document.press("9");
  await expect(document).toHaveValue("529.982.247-25");
  await document.fill("11222333000181");
  await expect(document).toHaveValue("11.222.333/0001-81");
  await document.fill("11.222.333/0001-81");
  await expect(document).toHaveValue("11.222.333/0001-81");
  await document.press("ControlOrMeta+A");
  await document.press("Backspace");
  await expect(document).toHaveValue("");

  await phone.pressSequentially("11", { delay: 25 });
  await expect(phone).toHaveValue("(11)");
  await phone.pressSequentially("999999999", { delay: 25 });
  await expect(phone).toHaveValue("(11) 99999-9999");
  await phone.evaluate((input: HTMLInputElement) =>
    input.setSelectionRange(5, 10),
  );
  await phone.pressSequentially("88888", { delay: 25 });
  await expect(phone).toHaveValue("(11) 88888-9999");
  await phone.fill("1133334444");
  await expect(phone).toHaveValue("(11) 3333-4444");
  await phone.press("End");
  for (let i = 0; i < 10; i++) await phone.press("Backspace");
  await expect(phone).toHaveValue("");
  await phone.fill("letters");
  await expect(phone).toHaveValue("");
  await page.getByLabel("E-mail", { exact: true }).fill("teste@example.com");
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue(
    "teste@example.com",
  );
  expect(errors).toEqual([]);
});

test("checkout formats account data before the buyer starts editing", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("zenwaste.auth-token", "mask-test"),
  );
  await page.route("**/api/auth/me/", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "mask-user",
          razaoSocial: "Empresa de teste",
          cnpj: "11222333000181",
          telefone: "11999999999",
          email: "teste@example.com",
          segmento: "Indústria",
        },
      },
    }),
  );
  await page.goto("/marketplace");
  await expect(
    page.getByText("Empresa de teste", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Comprar Vidro industrial", exact: true })
    .click();
  await expect(page.getByLabel("CPF ou CNPJ")).toHaveValue(
    "11.222.333/0001-81",
  );
  await expect(page.getByLabel("Telefone com DDD")).toHaveValue(
    "(11) 99999-9999",
  );
});

test("registration and delivery signature use the same document and phone formatting", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register");
  await page
    .getByLabel("CNPJ", { exact: true })
    .pressSequentially("11222333000181", { delay: 25 });
  await expect(page.getByLabel("CNPJ", { exact: true })).toHaveValue(
    "11.222.333/0001-81",
  );
  await page.getByLabel("Telefone / WhatsApp").fill("11999999999");
  await expect(page.getByLabel("Telefone / WhatsApp")).toHaveValue(
    "(11) 99999-9999",
  );
  await page
    .getByRole("button", { name: /Entregador \/ Transportador/ })
    .click();
  await page.getByLabel("CNPJ / Registro ANTT").fill("12345678");
  await expect(page.getByLabel("CNPJ / Registro ANTT")).toHaveValue("12345678");
  await page.getByLabel("CNPJ / Registro ANTT").fill("11222333000181");
  await expect(page.getByLabel("CNPJ / Registro ANTT")).toHaveValue(
    "11.222.333/0001-81",
  );
  await page.goto("/delivery-signature/5842");
  await page
    .getByLabel("CPF", { exact: true })
    .pressSequentially("12345678901", { delay: 25 });
  await expect(page.getByLabel("CPF", { exact: true })).toHaveValue(
    "123.456.789-01",
  );
});
