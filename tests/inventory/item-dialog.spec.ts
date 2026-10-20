import { test, expect, type Page } from "@playwright/test";

async function prepareInventory(
  page: Page,
  { theme = "dark", failMovement = false, delay = 0 } = {},
) {
  let item = {
    id: "inventory-fixture",
    name: "vidro",
    type: "Vidro Industrial",
    quantity: 100,
    unit: "kg",
    targetQuantity: 200,
    deadline: "2026-10-26",
    status: "em_producao",
    createdAt: "2026-10-19T12:00:00Z",
    updatedAt: "2026-10-19T12:00:00Z",
  };
  const movements = [
    {
      id: "initial",
      itemId: item.id,
      itemName: item.name,
      itemType: item.type,
      type: "entrada",
      quantity: 100,
      unit: "kg",
      note: "Cadastro inicial",
      createdAt: item.createdAt,
      resultingQuantity: 100,
    },
  ];
  const requests = {
    reservations: [] as Record<string, unknown>[],
    movements: [] as Record<string, unknown>[],
    deletes: 0,
  };
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("zenwaste.auth-token", "inventory-ui-test");
    localStorage.setItem("zenwaste-theme", selectedTheme);
  }, theme);
  await page.route("https://**/*", (route) => route.abort());
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/me/"))
      return route.fulfill({
        json: {
          user: {
            id: "inventory-user",
            razaoSocial: "Empresa de teste",
            cnpj: "11222333000181",
            segmento: "Indústria",
            email: "teste@example.com",
            telefone: "11999999999",
          },
        },
      });
    if (path.endsWith("/inventory/items/"))
      return route.fulfill({ json: { items: [item] } });
    if (path.endsWith("/inventory/movements/"))
      return route.fulfill({ json: { movements } });
    if (path.endsWith("/inventory-fixture/movements/")) {
      const body = request.postDataJSON();
      requests.movements.push(body);
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (failMovement)
        return route.fulfill({
          status: 400,
          json: { message: "Não foi possível registrar esta operação." },
        });
      item = {
        ...item,
        quantity: Number(
          (
            item.quantity +
            (body.type === "entrada" ? body.quantity : -body.quantity)
          ).toFixed(3),
        ),
        updatedAt: new Date().toISOString(),
      };
      item.status =
        item.quantity >= item.targetQuantity ? "concluido" : "em_producao";
      const movement = {
        ...movements[0],
        id: String(movements.length + 1),
        type: body.type,
        quantity: body.quantity,
        note: body.note ?? "",
        createdAt: item.updatedAt,
        resultingQuantity: item.quantity,
      };
      movements.unshift(movement);
      return route.fulfill({ json: { item, movement } });
    }
    if (
      path.endsWith("/inventory/items/inventory-fixture/") &&
      request.method() === "PATCH"
    ) {
      const body = request.postDataJSON();
      requests.reservations.push(body);
      item = { ...item, ...body, updatedAt: new Date().toISOString() };
      item.status =
        item.quantity >= item.targetQuantity ? "concluido" : "em_producao";
      return route.fulfill({ json: { item } });
    }
    if (
      path.endsWith("/inventory/items/inventory-fixture/") &&
      request.method() === "DELETE"
    ) {
      requests.deletes++;
      return route.fulfill({ json: { closedAds: 0 } });
    }
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto("/dashboard/inventory", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Ver detalhes do item" }).click();
  await expect(page.getByTestId("inventory-details-modal")).toBeVisible();
  return requests;
}

test("compact overview and stacked reservation editor preserve details and focus", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests = await prepareInventory(page);
  const base = page.getByTestId("inventory-details-modal");
  await expect(base.getByTestId("inventory-current-balance")).toContainText(
    "100",
  );
  await expect(base.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  await page.screenshot({ path: ".workspace/inventory-overview-desktop.png" });
  await base.getByRole("button", { name: "Editar reserva" }).click();
  const editor = page.getByRole("dialog", {
    name: "Editar reserva",
    exact: true,
  });
  await expect(editor).toBeVisible();
  await expect(base).toBeVisible();
  await expect(editor.getByLabel("Quantidade reservada (kg)")).toHaveValue(
    "200",
  );
  await page.screenshot({
    path: ".workspace/inventory-reservation-stacked.png",
  });
  await editor.getByLabel("Quantidade reservada (kg)").fill("150");
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(base).toBeVisible();
  await expect(
    base.getByRole("button", { name: "Editar reserva" }),
  ).toBeFocused();
  await base.getByRole("button", { name: "Editar reserva" }).click();
  await expect(editor.getByLabel("Quantidade reservada (kg)")).toHaveValue(
    "200",
  );
  await editor.getByLabel("Quantidade reservada (kg)").fill("120");
  await editor.getByLabel("Prazo da reserva").fill("2026-11-10");
  await editor.getByRole("button", { name: "Salvar reserva" }).click();
  await expect(editor).toHaveCount(0);
  await expect(base).toContainText("120 kg");
  await expect(base).toContainText("10/11/2026");
  expect(requests.reservations).toEqual([
    { targetQuantity: 120, deadline: "2026-11-10" },
  ]);
  await page.keyboard.press("Escape");
  await expect(base).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("entry and exit update the base overview and their notes appear in history", async ({
  page,
}) => {
  const requests = await prepareInventory(page, { delay: 350 });
  const base = page.getByTestId("inventory-details-modal");
  await base.getByRole("button", { name: "Entrada", exact: true }).click();
  const entry = page.getByRole("dialog", {
    name: "Registrar entrada",
    exact: true,
  });
  await entry.getByLabel("Quantidade (kg)", { exact: true }).fill("50");
  await entry.getByLabel(/Observação/).fill("Novo lote recebido");
  await expect(entry.getByTestId("movement-projected-balance")).toContainText(
    "150 kg",
  );
  await entry
    .getByRole("button", { name: "Confirmar", exact: true })
    .click({ clickCount: 2 });
  await expect(entry).toHaveCount(0);
  await expect(base.getByTestId("inventory-current-balance")).toContainText(
    "150",
  );
  expect(requests.movements).toHaveLength(1);
  await base.getByRole("button", { name: "Saída", exact: true }).click();
  const exit = page.getByRole("dialog", {
    name: "Registrar saída",
    exact: true,
  });
  await exit.getByLabel("Quantidade (kg)", { exact: true }).fill("200");
  await expect(
    exit.getByText("A saída não pode ultrapassar o saldo disponível."),
  ).toBeVisible();
  await expect(
    exit.getByRole("button", { name: "Confirmar", exact: true }),
  ).toBeDisabled();
  await exit.getByLabel("Quantidade (kg)", { exact: true }).fill("25");
  await exit.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(exit).toHaveCount(0);
  await expect(base.getByTestId("inventory-current-balance")).toContainText(
    "125",
  );
  expect(requests.movements).toHaveLength(2);
  await base.getByRole("button", { name: /Histórico/ }).click();
  const history = page.getByRole("dialog", {
    name: "Histórico de movimentações",
    exact: true,
  });
  await expect(history.getByText("Novo lote recebido")).toBeVisible();
  await expect(history.getByRole("listitem")).toHaveCount(3);
  await history.getByRole("button", { name: "Voltar aos detalhes" }).click();
  await expect(base).toBeVisible();
});

test("close button and outside click dismiss only the action dialog", async ({
  page,
}) => {
  await prepareInventory(page);
  const base = page.getByTestId("inventory-details-modal");
  await base.getByRole("button", { name: "Saída", exact: true }).click();
  await page
    .getByRole("button", { name: "Fechar movimentação", exact: true })
    .click();
  await expect(base).toBeVisible();
  await expect(
    base.getByRole("button", { name: "Saída", exact: true }),
  ).toBeFocused();
  await base.getByRole("button", { name: "Editar reserva" }).click();
  await page.mouse.click(20, 20);
  await expect(
    page.getByRole("dialog", { name: "Editar reserva", exact: true }),
  ).toHaveCount(0);
  await expect(base).toBeVisible();
  await base
    .getByRole("button", { name: "Fechar detalhes", exact: true })
    .click();
  await expect(base).toHaveCount(0);
});

test("request errors keep the operation and base open with no balance change", async ({
  page,
}) => {
  await prepareInventory(page, { failMovement: true });
  const base = page.getByTestId("inventory-details-modal");
  await base.getByRole("button", { name: "Entrada", exact: true }).click();
  const entry = page.getByRole("dialog", {
    name: "Registrar entrada",
    exact: true,
  });
  await entry.getByLabel("Quantidade (kg)", { exact: true }).fill("50");
  await entry.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(entry.getByRole("alert")).toContainText(
    "Não foi possível registrar esta operação.",
  );
  await expect(
    entry.getByLabel("Quantidade (kg)", { exact: true }),
  ).toHaveValue("50");
  await entry.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(base.getByTestId("inventory-current-balance")).toContainText(
    "100",
  );
});

test("fractional reservations reach the API unchanged and deletion can be canceled", async ({
  page,
}) => {
  const requests = await prepareInventory(page, { theme: "light" });
  const base = page.getByTestId("inventory-details-modal");
  await base.getByRole("button", { name: "Editar reserva" }).click();
  const editor = page.getByRole("dialog", {
    name: "Editar reserva",
    exact: true,
  });
  await editor.getByLabel("Quantidade reservada (kg)").fill("0.5");
  await editor.getByRole("button", { name: "Salvar reserva" }).click();
  await expect(editor).toHaveCount(0);
  expect(requests.reservations[0].targetQuantity).toBe(0.5);
  await expect(base).toContainText("0,5 kg");
  await expect(base.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await base.getByRole("button", { name: "Excluir item", exact: true }).click();
  await page.getByRole("button", { name: "Manter item" }).click();
  await expect(base).toBeVisible();
  expect(requests.deletes).toBe(0);
});

test("mobile layout keeps actions in view and the stacked editor inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 660 });
  await prepareInventory(page);
  const base = page.getByTestId("inventory-details-modal");
  const insideViewport = async (locator: ReturnType<Page["locator"]>) => {
    const box = await locator.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(660);
    expect(box!.width).toBeLessThanOrEqual(390);
  };
  await insideViewport(base);
  await insideViewport(base.getByRole("button", { name: "Editar reserva" }));
  await insideViewport(
    base.getByRole("button", { name: "Entrada", exact: true }),
  );
  await page.screenshot({ path: ".workspace/inventory-overview-mobile.png" });
  await base.getByRole("button", { name: "Entrada", exact: true }).click();
  const entry = page.getByRole("dialog", {
    name: "Registrar entrada",
    exact: true,
  });
  await insideViewport(entry);
  await insideViewport(
    entry.getByRole("button", { name: "Confirmar", exact: true }),
  );
  await page.screenshot({ path: ".workspace/inventory-entry-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(base).toBeVisible();
});
