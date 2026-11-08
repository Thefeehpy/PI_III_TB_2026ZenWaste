import { expect, test, type Page } from "@playwright/test";
import type { ItemEstoque } from "../../src/types/estoque";

const item: ItemEstoque = {
  id: "vidro-estoque",
  name: "Vidro para reciclagem",
  type: "Vidro Industrial",
  description: "Vidro limpo",
  quantity: 100,
  committedQuantity: 60,
  availableQuantity: 40,
  unit: "kg",
  targetQuantity: 0,
  deadline: "2026-11-06",
  status: "concluido",
  createdAt: "2026-11-06",
  updatedAt: "2026-11-06T12:00:00Z",
};

async function prepararSessao(pagina: Page) {
  await pagina.addInitScript(() => {
    localStorage.setItem("zenwaste.auth-token", "sessao-teste-estoque");
  });
  await pagina.route("https://**/*", (rota) => rota.abort());
  await pagina.route("**/api/**", (rota) => {
    const caminho = new URL(rota.request().url()).pathname;
    if (caminho.endsWith("/auth/me/")) {
      return rota.fulfill({
        json: {
          user: {
            id: "empresa-estoque",
            razaoSocial: "Empresa de teste",
            cnpj: "11222333000181",
            segmento: "Indústria",
            email: "teste@example.com",
            telefone: "11999999999",
            ativo: true,
            roles: ["vendedora", "compradora"],
          },
        },
      });
    }
    if (caminho.endsWith("/inventory/items/")) return rota.fulfill({ json: { items: [item] } });
    if (caminho.endsWith("/inventory/movements/")) return rota.fulfill({ json: { movements: [] } });
    return rota.fulfill({ json: { items: [] } });
  });
}

test("uma falha na consulta não aparece como estoque vazio e permite nova tentativa", async ({ page }) => {
  await prepararSessao(page);
  let consultas = 0;
  await page.route("**/api/inventory/items/", (rota) => {
    consultas += 1;
    return consultas === 1
      ? rota.fulfill({ status: 503, json: { message: "Consulta de estoque indisponível." } })
      : rota.fulfill({ json: { items: [item] } });
  });
  await page.goto("/dashboard/inventory", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("alert")).toContainText("Consulta de estoque indisponível.");
  await expect(page.getByRole("heading", { name: "Nenhum item cadastrado no estoque" })).toHaveCount(0);
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ver detalhes do item" })).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(consultas).toBe(2);
});

test("uma consulta vazia bem-sucedida apresenta a orientação de cadastro", async ({ page }) => {
  await prepararSessao(page);
  await page.route("**/api/inventory/items/", (rota) => rota.fulfill({ json: { items: [] } }));
  await page.goto("/dashboard/inventory", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Nenhum item cadastrado no estoque" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cadastrar item", exact: true })).toBeEnabled();
});

test("a falha no histórico preserva os produtos consultados", async ({ page }) => {
  await prepararSessao(page);
  await page.route("**/api/inventory/movements/", (rota) => rota.fulfill({
    status: 503,
    json: { message: "Histórico temporariamente indisponível." },
  }));
  await page.goto("/dashboard/inventory", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("alert")).toContainText("Histórico temporariamente indisponível.");
  await expect(page.getByRole("button", { name: "Ver detalhes do item" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Nenhum item cadastrado no estoque" })).toHaveCount(0);
});
