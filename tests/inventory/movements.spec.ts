import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

test.use({ timezoneId: "America/Sao_Paulo" });

async function prepare(page: Page, { empty = false, theme = "dark" } = {}) {
  const items = [
    {
      id: "glass",
      name: "Vidro",
      type: "Vidro Industrial",
      quantity: 100,
      unit: "kg",
      targetQuantity: 200,
      deadline: "2026-10-26",
      status: "em_producao",
      createdAt: "2026-10-01T12:00:00-03:00",
      updatedAt: "2026-10-19T12:00:00-03:00",
    },
    {
      id: "paper",
      name: "Papelão",
      type: "Papel e Papelão",
      quantity: 50,
      unit: "kg",
      targetQuantity: 20,
      deadline: "2026-10-26",
      status: "concluido",
      createdAt: "2026-10-01T12:00:00-03:00",
      updatedAt: "2026-10-19T12:00:00-03:00",
    },
  ];
  const movement = (
    id: string,
    itemId: string,
    type: string,
    date: string,
    note: string,
  ) => {
    const item = items.find((candidate) => candidate.id === itemId)!;
    return {
      id,
      itemId,
      itemName: item.name,
      itemType: item.type,
      type,
      quantity: 10,
      unit: "kg",
      note,
      createdAt: date,
      resultingQuantity: 100,
    };
  };
  const movements = empty
    ? []
    : [
        movement(
          "start",
          "glass",
          "entrada",
          "2026-10-19T00:00:00-03:00",
          "Lote da manhã",
        ),
        movement(
          "end",
          "glass",
          "saida",
          "2026-10-19T23:59:59-03:00",
          "Saída no último segundo",
        ),
        movement(
          "paper",
          "paper",
          "entrada",
          "2026-10-19T10:30:00-03:00",
          "Papelão prensado",
        ),
        movement(
          "tomorrow",
          "paper",
          "saida",
          "2026-10-20T00:00:00-03:00",
          "Fora do dia",
        ),
        movement(
          "week",
          "glass",
          "saida",
          "2026-10-13T00:00:00-03:00",
          "Limite sete dias",
        ),
        movement(
          "before-week",
          "glass",
          "entrada",
          "2026-10-12T23:59:59-03:00",
          "Antes da semana",
        ),
        movement(
          "last-month",
          "paper",
          "entrada",
          "2026-09-30T12:00:00-03:00",
          "Mês anterior",
        ),
        ...Array.from({ length: 20 }, (_, index) =>
          movement(
            `older-${index}`,
            index % 2 ? "paper" : "glass",
            index % 2 ? "saida" : "entrada",
            `2026-09-${String(index + 1).padStart(2, "0")}T12:00:00-03:00`,
            `Recebimento antigo ${index + 1}`,
          ),
        ),
      ];
  await page.clock.setFixedTime(new Date("2026-10-19T15:00:00Z"));
  await page.addInitScript((value) => {
    localStorage.setItem("zenwaste.auth-token", "inventory-movements-test");
    localStorage.setItem("zenwaste-theme", value);
  }, theme);
  await page.route("https://**/*", (route) => route.abort());
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me/"))
      return route.fulfill({
        json: {
          user: {
            id: "history-user",
            razaoSocial: "Empresa de teste",
            cnpj: "11222333000181",
            segmento: "Indústria",
            email: "teste@example.com",
            telefone: "11999999999",
          },
        },
      });
    if (path.endsWith("/inventory/items/"))
      return route.fulfill({ json: { items } });
    if (path.endsWith("/inventory/movements/"))
      return route.fulfill({ json: { movements } });
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto("/dashboard/inventory", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Ver detalhes do item" }),
  ).toHaveCount(2);
  return movements;
}

async function openHistory(page: Page) {
  await page
    .getByRole("button", { name: "Ver movimentações do estoque", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Movimentações do estoque",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("summary card is last, replaces the recent history and opens a large keyboard-accessible modal", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await prepare(page);
  const cards = page
    .getByTestId("inventory-summary-cards")
    .locator(":scope > *");
  await expect(cards.nth(2)).toContainText("Reservas pendentes");
  await expect(cards.nth(3)).toHaveAttribute(
    "aria-label",
    "Ver movimentações do estoque",
  );
  await expect(
    page.getByText("Movimentações recentes", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: ".workspace/inventory-history-card.png" });
  const dialog = await openHistory(page);
  const box = await dialog.boundingBox();
  expect(box!.width).toBeGreaterThan(1000);
  expect(box!.height).toBeGreaterThan(350);
  await expect(dialog.getByTestId("movement-result-count")).toHaveText("27");
  await page.screenshot({ path: ".workspace/inventory-history-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ver movimentações do estoque" }),
  ).toBeFocused();
  expect(errors).toEqual([]);
});

test("custom dates include the whole final day and combine with operation and material", async ({
  page,
}) => {
  await prepare(page);
  const dialog = await openHistory(page);
  await dialog.getByLabel("Data inicial", { exact: true }).fill("2026-10-19");
  await dialog.getByLabel("Data final", { exact: true }).fill("2026-10-19");
  await expect(dialog.getByTestId("movement-result-count")).toHaveText("3");
  await expect(
    dialog.getByRole("cell", { name: "Saída no último segundo", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("cell", { name: "Fora do dia", exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("group", { name: "Tipo de movimentação" })
    .getByRole("button", { name: "Saídas", exact: true })
    .click();
  await dialog.getByRole("combobox", { name: "Material", exact: true }).click();
  await page.getByRole("option", { name: "Vidro", exact: true }).click();
  await expect(dialog.getByTestId("movement-result-count")).toHaveText("1");
  await dialog
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .click();
  await expect(dialog.getByTestId("movement-result-count")).toHaveText("27");
  await dialog.getByLabel("Buscar movimentações").fill("papelao prensado");
  await expect(dialog.getByTestId("movement-result-count")).toHaveText("1");
  await expect(
    dialog.getByRole("cell", { name: "Papelão prensado", exact: true }),
  ).toBeVisible();
});

test("shows three movements before scrolling and shrinks for fewer results", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 625 });
  await prepare(page);
  const dialog = await openHistory(page);
  const scrollArea = dialog.getByTestId("movement-scroll-area");
  const rows = dialog.getByRole("row");
  await expect(rows.nth(1)).toBeInViewport({ ratio: 0.99 });
  await expect(rows.nth(3)).toBeInViewport({ ratio: 0.99 });
  await expect(rows.nth(4)).not.toBeInViewport({ ratio: 0.1 });
  const initialHeight = (await dialog.boundingBox())!.height;
  await page.screenshot({
    path: ".workspace/inventory-history-three-rows.png",
  });
  await scrollArea.evaluate((element) => {
    element.scrollTop = 160;
  });
  await expect(rows.nth(4)).toBeInViewport({ ratio: 0.99 });
  await dialog.getByLabel("Buscar movimentações").fill("papelao prensado");
  await expect(dialog.getByTestId("movement-result-count")).toHaveText("1");
  await expect(rows.nth(1)).toBeInViewport({ ratio: 0.99 });
  await expect
    .poll(async () => (await dialog.boundingBox())!.height)
    .toBeLessThan(initialHeight);
  const dimensions = await scrollArea.evaluate((element) => ({
    client: element.clientHeight,
    content: element.scrollHeight,
    top: element.scrollTop,
  }));
  expect(dimensions.client).toBeGreaterThanOrEqual(dimensions.content - 1);
  expect(dimensions.top).toBe(0);
});

test("quick periods work and invalid ranges cannot be exported", async ({
  page,
}) => {
  await prepare(page);
  const dialog = await openHistory(page);
  await dialog.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(dialog.getByTestId("movement-result-count")).toHaveText("3");
  await dialog.getByRole("button", { name: "7 dias", exact: true }).click();
  await expect(dialog.getByLabel("Data inicial", { exact: true })).toHaveValue(
    "2026-10-13",
  );
  await expect(dialog.getByTestId("movement-result-count")).toHaveText("4");
  await dialog.getByRole("button", { name: "30 dias", exact: true }).click();
  await expect(dialog.getByLabel("Data inicial", { exact: true })).toHaveValue(
    "2026-09-20",
  );
  await dialog.getByRole("button", { name: "Este mês", exact: true }).click();
  await expect(dialog.getByTestId("movement-result-count")).toHaveText("5");
  await dialog.getByLabel("Data inicial", { exact: true }).fill("2026-10-20");
  await expect(dialog.getByRole("alert")).toContainText(
    "A data inicial deve ser anterior",
  );
  await expect(
    dialog.getByRole("button", { name: "Exportar CSV", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .first()
    .click();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});

test("pagination, ordering and CSV cover all filtered results, not only the current page", async ({
  page,
}) => {
  await prepare(page, { theme: "light" });
  const dialog = await openHistory(page);
  await expect(
    dialog.getByText("1–10 de 27 movimentações", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("row")).toHaveCount(11);
  await dialog
    .getByRole("button", { name: "Próxima página", exact: true })
    .click();
  await expect(
    dialog.getByText("11–20 de 27 movimentações", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Próxima página", exact: true })
    .click();
  await expect(
    dialog.getByText("21–27 de 27 movimentações", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Próxima página", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Ordenar movimentações").selectOption("oldest");
  await expect(
    dialog.getByText("1–10 de 27 movimentações", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("row").nth(1)).toContainText(
    "Recebimento antigo 1",
  );
  const pendingDownload = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Exportar CSV", exact: true })
    .click();
  const download = await pendingDownload;
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv.split("\r\n")).toHaveLength(28);
  expect(csv).toContain("Papelão prensado");
  await dialog.getByLabel("Buscar movimentações").fill("Papelão prensado");
  const filteredDownload = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Exportar CSV", exact: true })
    .click();
  const filteredCsv = await readFile(
    (await (await filteredDownload).path())!,
    "utf8",
  );
  expect(filteredCsv.split("\r\n")).toHaveLength(2);
  expect(filteredCsv).not.toContain("Fora do dia");
});

test("empty history and unmatched searches have useful recovery states", async ({
  page,
}) => {
  await prepare(page, { empty: true });
  const dialog = await openHistory(page);
  await expect(
    dialog.getByRole("heading", { name: "Seu histórico começa aqui" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Exportar CSV", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Próxima página", exact: true }),
  ).toBeDisabled();
});

test("mobile filters, results and pagination stay inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await prepare(page);
  const dialog = await openHistory(page);
  await expect(
    dialog.getByRole("button", { name: "Filtros", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Data inicial", { exact: true })).toBeHidden();
  await dialog.getByRole("button", { name: "Filtros", exact: true }).click();
  await dialog.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(dialog.getByTestId("movement-result-count")).toHaveText("3");
  await dialog.getByRole("button", { name: /Filtros/ }).click();
  await expect(dialog.getByRole("listitem")).toHaveCount(3);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const box = await dialog.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(720);
  await page.screenshot({ path: ".workspace/inventory-history-mobile.png" });
  await dialog
    .getByRole("button", { name: "Fechar movimentações", exact: true })
    .click();
  const reopened = await openHistory(page);
  await expect(reopened.getByTestId("movement-result-count")).toHaveText("27");
});
