import { expect, test, type Locator, type Page } from "@playwright/test";
import { randomUUID as gerarIdentificador } from "node:crypto";

const cenario = JSON.parse(process.env.ZENWASTE_E2E_CENARIO || "{}");
const senha = process.env.ZENWASTE_E2E_SENHA;
const enderecoApi = process.env.ZENWASTE_E2E_API_URL;
if (!senha || !enderecoApi)
  throw new Error("Execute pelo ambiente PostgreSQL descartável de E2E.");

async function entrar(pagina: Page, papel = "vendedora") {
  if (pagina.url() !== "about:blank")
    await pagina.evaluate(() => localStorage.removeItem("zenwaste.auth-token"));
  await pagina.goto("/login");
  await pagina.getByLabel("E-mail", { exact: true }).fill(cenario[papel].email);
  await pagina.getByLabel("Senha", { exact: true }).fill(senha);
  await pagina
    .getByRole("button", { name: "Entrar no painel", exact: true })
    .click();
  await expect(pagina).toHaveURL(/\/dashboard$/);
  await pagina.goto("/dashboard/freight-audit");
  await expect(
    pagina.getByRole("heading", { name: "Auditoria de fretes", exact: true }),
  ).toBeVisible();
}
function detalhes(pagina: Page) {
  return pagina
    .getByRole("dialog")
    .filter({ has: pagina.getByRole("tab", { name: "Resumo", exact: true }) });
}
async function abrirProcesso(pagina: Page, material: string) {
  await pagina
    .locator("article")
    .filter({ hasText: material })
    .getByRole("button", { name: "Detalhes", exact: true })
    .click();
  await expect(
    detalhes(pagina).getByRole("tab", { name: "Resumo", exact: true }),
  ).toBeVisible();
}
async function criar(pagina: Page, material: string, vinculado = false) {
  await pagina
    .getByRole("button", { name: "Cadastrar frete", exact: true })
    .click();
  const cadastro = pagina.getByRole("dialog", {
    name: "Cadastrar frete",
    exact: true,
  });
  if (vinculado)
    await cadastro
      .getByRole("combobox", { name: "Pedido", exact: true })
      .selectOption(cenario.pedido.id);
  else {
    await cadastro
      .getByRole("combobox", { name: "Origem do frete", exact: true })
      .selectOption("avulso");
    await cadastro
      .getByRole("combobox", { name: "Compradora", exact: true })
      .selectOption(String(cenario.compradora.id));
    await cadastro.getByLabel("Material", { exact: true }).fill(material);
    await cadastro.getByLabel("Unidade", { exact: true }).fill("KG");
  }
  for (const [rotulo, valor] of [
    ["Quantidade da remessa", "2"],
    ["Origem", "Origem E2E"],
    ["Destino", "Destino E2E"],
    ["Peso (t)", "0.002"],
    ["Cubagem (m³)", "1"],
    ["Volumes", "1"],
  ])
    await cadastro.getByLabel(rotulo, { exact: true }).fill(valor);
  const consulta = pagina.waitForResponse(
    (resposta) =>
      resposta.request().method() === "POST" &&
      resposta.url() === `${enderecoApi}/fretes/`,
  );
  await cadastro
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  const resposta = await consulta;
  expect(resposta.status()).toBe(201);
  const dados = await resposta.json();
  await expect(
    detalhes(pagina).getByRole("button", {
      name: "Classificar frete",
      exact: true,
    }),
  ).toBeVisible();
  return dados.id as string;
}
async function classificar(pagina: Page, modalidade: string) {
  await detalhes(pagina)
    .getByRole("button", { name: "Classificar frete", exact: true })
    .click();
  const dialogo = pagina.getByRole("dialog", {
    name: "Classificar frete",
    exact: true,
  });
  await dialogo
    .getByRole("combobox", { name: "Modalidade", exact: true })
    .selectOption(modalidade);
  if (modalidade === "contratado") {
    await dialogo
      .getByRole("combobox", { name: "Transportadora", exact: true })
      .selectOption(String(cenario.transportadora.id));
    await dialogo
      .getByLabel("Valor de referência", { exact: true })
      .fill("500");
  }
  await dialogo.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(dialogo).not.toBeVisible();
}
async function cotar(pagina: Page, empresa = "transportadora", valor = "500") {
  await detalhes(pagina)
    .getByRole("tab", { name: "Cotações", exact: true })
    .click();
  await detalhes(pagina)
    .getByRole("button", { name: "Registrar cotação", exact: true })
    .click();
  const dialogo = pagina.getByRole("dialog", {
    name: "Registrar cotação",
    exact: true,
  });
  await dialogo
    .getByRole("combobox", { name: "Transportadora", exact: true })
    .selectOption(String(cenario[empresa].id));
  await dialogo.getByLabel("Valor da cotação", { exact: true }).fill(valor);
  await dialogo.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(dialogo).not.toBeVisible();
}
async function registrarDocumento(pagina: Page, numero: string, valor: string) {
  const dialogo = detalhes(pagina);
  await dialogo.getByRole("tab", { name: "Documentos", exact: true }).click();
  await dialogo.getByLabel("Número do CT-e", { exact: true }).fill(numero);
  await dialogo.getByLabel("Valor do CT-e", { exact: true }).fill(valor);
  await dialogo
    .getByRole("button", { name: "Salvar CT-e", exact: true })
    .click();
  await expect(dialogo.getByText(new RegExp(numero))).toBeVisible();
  await expect(
    dialogo.getByLabel("Número do CT-e", { exact: true }),
  ).toHaveValue("");
}
async function retirar(pagina: Page) {
  const dialogo = detalhes(pagina);
  await dialogo.getByRole("tab", { name: "Entrega", exact: true }).click();
  await dialogo
    .getByLabel("Nome da foto de retirada", { exact: true })
    .fill("retirada-sintetica.png");
  await dialogo
    .getByRole("button", { name: "Registrar retirada", exact: true })
    .click();
  await expect(
    dialogo.getByText("Retirada registrada · retirada-sintetica.png", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialogo.getByRole("button", { name: "Cancelar frete", exact: true }),
  ).toHaveCount(0);
}
async function assinar(pagina: Page, dialogo: Locator) {
  const tela = dialogo.locator("canvas");
  await tela.scrollIntoViewIfNeeded();
  const area = await tela.boundingBox();
  if (!area) throw new Error("Canvas de assinatura não encontrado.");
  await pagina.mouse.move(area.x + 20, area.y + 30);
  await pagina.mouse.down();
  await pagina.mouse.move(area.x + 120, area.y + 65, { steps: 12 });
  await pagina.mouse.up();
}
async function receber(pagina: Page, material: string) {
  await entrar(pagina, "compradora");
  await abrirProcesso(pagina, material);
  await detalhes(pagina)
    .getByRole("tab", { name: "Entrega", exact: true })
    .click();
  await detalhes(pagina)
    .getByRole("button", { name: "Confirmar recebimento", exact: true })
    .click();
  const dialogo = pagina.getByRole("dialog", {
    name: "Confirmar recebimento",
    exact: true,
  });
  await dialogo
    .getByLabel("Nome do recebedor", { exact: true })
    .fill("Recebedor sintético E2E");
  await assinar(pagina, dialogo);
  await dialogo.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(dialogo).not.toBeVisible();
  await expect(
    detalhes(pagina).getByText("Recebimento confirmado", { exact: true }),
  ).toBeVisible();
}
async function cabecalhos(pagina: Page) {
  const token = await pagina.evaluate(() =>
    localStorage.getItem("zenwaste.auth-token"),
  );
  return {
    Authorization: `Bearer ${token}`,
    "Idempotency-Key": gerarIdentificador(),
  };
}

test("A — fluxo normal persiste cotação, CT-e, retirada e recebimento", async ({
  page: pagina,
}, informacoes) => {
  await entrar(pagina);
  await criar(pagina, "Material sintético", true);
  await classificar(pagina, "cotar");
  await cotar(pagina);
  await detalhes(pagina)
    .getByRole("button", { name: "Aprovar cotação", exact: true })
    .click();
  await registrarDocumento(pagina, "CTE-E2E-A", "500");
  await retirar(pagina);
  await receber(pagina, "Material negociado");
  await expect(
    detalhes(pagina).getByText("Auditoria concluída", { exact: true }).first(),
  ).toBeVisible();
  await pagina.screenshot({ path: informacoes.outputPath("fluxo-normal.png") });
});

test("B — recebimento divergente mantém auditoria pendente até aceite", async ({
  page: pagina,
}, informacoes) => {
  await entrar(pagina);
  await criar(pagina, "Material E2E B");
  await classificar(pagina, "contratado");
  await registrarDocumento(pagina, "CTE-E2E-B", "650");
  await retirar(pagina);
  await receber(pagina, "Material E2E B");
  await expect(
    detalhes(pagina).getByText("Auditoria pendente: divergência aberta", {
      exact: true,
    }),
  ).toBeVisible();
  await entrar(pagina);
  await abrirProcesso(pagina, "Material E2E B");
  await detalhes(pagina)
    .getByRole("tab", { name: "Divergências", exact: true })
    .click();
  await detalhes(pagina)
    .getByRole("button", { name: "Aceitar diferença", exact: true })
    .click();
  const dialogo = pagina.getByRole("dialog", {
    name: "Aceitar diferença",
    exact: true,
  });
  await dialogo
    .getByLabel("Justificativa do aceite", { exact: true })
    .fill("Diferença sintética conferida após recebimento.");
  await dialogo.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(dialogo).not.toBeVisible();
  await expect(
    detalhes(pagina).getByText("Auditoria concluída", { exact: true }).first(),
  ).toBeVisible();
  await pagina.screenshot({
    path: informacoes.outputPath("aceite-apos-recebimento.png"),
  });
});

test("C — correções preservam versões e análises anteriores", async ({
  page: pagina,
}, informacoes) => {
  await entrar(pagina);
  await criar(pagina, "Material E2E C");
  await classificar(pagina, "contratado");
  await registrarDocumento(pagina, "CTE-E2E-C1", "650");
  await registrarDocumento(pagina, "CTE-E2E-C2", "620");
  await detalhes(pagina)
    .getByRole("tab", { name: "Divergências", exact: true })
    .click();
  await expect(
    detalhes(pagina).getByText("Substituída por correção", { exact: true }),
  ).toBeVisible();
  await expect(
    detalhes(pagina).getByText("Divergência aberta", { exact: true }),
  ).toBeVisible();
  await registrarDocumento(pagina, "CTE-E2E-C3", "500");
  await expect(
    detalhes(pagina).getByText("Versão 1 · CTE-E2E-C1", { exact: true }),
  ).toBeVisible();
  await expect(
    detalhes(pagina).getByText("Versão 2 · CTE-E2E-C2", { exact: true }),
  ).toBeVisible();
  await expect(
    detalhes(pagina).getByText("Versão 3 · CTE-E2E-C3", { exact: true }),
  ).toBeVisible();
  await expect(
    detalhes(pagina).getByText("Aguardando entrega", { exact: true }).first(),
  ).toBeVisible();
  await pagina.screenshot({ path: informacoes.outputPath("versoes-cte.png") });
});

test("D — retirada pelo cliente conclui sem cotação ou CT-e", async ({
  page: pagina,
}) => {
  await entrar(pagina);
  const identificador = await criar(pagina, "Material E2E D");
  await classificar(pagina, "retirada_cliente");
  await detalhes(pagina)
    .getByRole("tab", { name: "Documentos", exact: true })
    .click();
  await expect(
    detalhes(pagina).getByText(
      "Retirada pelo cliente: cotação e CT-e dispensados neste fluxo.",
      { exact: true },
    ),
  ).toBeVisible();
  await retirar(pagina);
  await receber(pagina, "Material E2E D");
  await expect(
    detalhes(pagina).getByText("Auditoria concluída", { exact: true }).first(),
  ).toBeVisible();
  const consulta = await pagina.request.get(
    `${enderecoApi}/fretes/${identificador}/`,
    { headers: await cabecalhos(pagina) },
  );
  expect((await consulta.json()).documentos).toEqual([]);
});

test("E — isolamento, cotações próprias e rejeição de comandos indevidos", async ({
  page: pagina,
}) => {
  await entrar(pagina);
  const identificador = await criar(pagina, "Segurança E2E");
  await classificar(pagina, "cotar");
  await cotar(pagina);
  await cotar(pagina, "concorrente", "999");
  await entrar(pagina, "transportadora");
  await abrirProcesso(pagina, "Segurança E2E");
  await detalhes(pagina)
    .getByRole("tab", { name: "Cotações", exact: true })
    .click();
  await expect(
    detalhes(pagina).getByText(cenario.transportadora.nome, { exact: true }),
  ).toBeVisible();
  await expect(
    detalhes(pagina).getByText(cenario.concorrente.nome, { exact: true }),
  ).toHaveCount(0);
  await expect(
    detalhes(pagina).getByRole("button", {
      name: "Aprovar cotação",
      exact: true,
    }),
  ).toHaveCount(0);
  const proibida = await pagina.request.post(
    `${enderecoApi}/fretes/${identificador}/cancelar/`,
    {
      headers: await cabecalhos(pagina),
      data: { justificativa: "Tentativa indevida sintética." },
    },
  );
  expect(proibida.status()).toBe(403);
  await entrar(pagina, "terceira");
  const inacessivel = await pagina.request.get(
    `${enderecoApi}/fretes/${identificador}/`,
    { headers: await cabecalhos(pagina) },
  );
  expect(inacessivel.status()).toBe(404);
  await expect(
    pagina.locator("article").filter({ hasText: "Segurança E2E" }),
  ).toHaveCount(0);
});

test("F — assinatura, idempotência, alocação e cancelamento são validados na API real", async ({
  page: pagina,
}) => {
  await entrar(pagina);
  const identificador = await criar(pagina, "Integridade E2E");
  await classificar(pagina, "retirada_cliente");
  await entrar(pagina, "compradora");
  await abrirProcesso(pagina, "Integridade E2E");
  await detalhes(pagina)
    .getByRole("tab", { name: "Entrega", exact: true })
    .click();
  await detalhes(pagina)
    .getByRole("button", { name: "Confirmar recebimento", exact: true })
    .click();
  const dialogo = pagina.getByRole("dialog", {
    name: "Confirmar recebimento",
    exact: true,
  });
  await dialogo
    .getByLabel("Nome do recebedor", { exact: true })
    .fill("Recebedor de teste");
  await dialogo.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(dialogo.getByRole("alert")).toContainText(
    "Registre a assinatura",
  );
  const invalida = await pagina.request.post(
    `${enderecoApi}/fretes/${identificador}/confirmar-entrega/`,
    {
      headers: await cabecalhos(pagina),
      data: {
        nome_recebedor: "Teste",
        dados_assinatura: "inválida",
        tipo_recebimento: "completo",
      },
    },
  );
  expect(invalida.status()).toBe(400);
  await entrar(pagina);
  const entrada = {
    empresa_compradora_id: cenario.compradora.id,
    material: "Duplicado E2E",
    unidade: "KG",
    quantidade: "1",
    origem: "Origem",
    destino: "Destino",
    peso_toneladas: "0.001",
    cubagem_m3: "1",
    quantidade_volumes: 1,
  };
  const cabecalho = await cabecalhos(pagina);
  const respostas = await Promise.all(
    [0, 1].map(() =>
      pagina.request.post(`${enderecoApi}/fretes/`, {
        headers: cabecalho,
        data: entrada,
      }),
    ),
  );
  expect(respostas.map((resposta) => resposta.status())).toEqual([201, 201]);
  const [primeira, segunda] = await Promise.all(
    respostas.map((resposta) => resposta.json()),
  );
  expect(primeira.id).toBe(segunda.id);
  expect(
    primeira.historico.filter(
      (evento: { tipo: string }) => evento.tipo === "criar",
    ),
  ).toHaveLength(1);
  const excesso = await pagina.request.post(`${enderecoApi}/fretes/`, {
    headers: await cabecalhos(pagina),
    data: { ...entrada, pedido_id: cenario.pedido.id, quantidade: "11" },
  });
  expect(excesso.status()).toBe(409);
  await abrirProcesso(pagina, "Integridade E2E");
  await retirar(pagina);
  const cancelamento = await pagina.request.post(
    `${enderecoApi}/fretes/${identificador}/cancelar/`,
    {
      headers: await cabecalhos(pagina),
      data: { justificativa: "Cancelamento após retirada." },
    },
  );
  expect(cancelamento.status()).toBe(409);
  await pagina.keyboard.press("Escape");
  await pagina.setViewportSize({ width: 390, height: 844 });
  expect(
    await pagina.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("G — tratativa, demanda, filtros, paginação e cancelamento persistem", async ({
  page: pagina,
}) => {
  await entrar(pagina);
  await criar(pagina, "Material E2E G");
  await detalhes(pagina)
    .getByRole("tab", { name: "Histórico", exact: true })
    .click();
  await detalhes(pagina)
    .getByRole("button", { name: "Registrar tratativa", exact: true })
    .click();
  const tratativa = pagina.getByRole("dialog", {
    name: "Registrar tratativa",
    exact: true,
  });
  await tratativa
    .getByLabel("Observação da tratativa", { exact: true })
    .fill("Tratativa sintética persistida.");
  await tratativa
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(tratativa).not.toBeVisible();
  await expect(
    detalhes(pagina).getByText("Tratativa sintética persistida.", {
      exact: true,
    }),
  ).toBeVisible();
  await detalhes(pagina)
    .getByRole("button", { name: "Registrar demanda interna", exact: true })
    .click();
  const demanda = pagina.getByRole("dialog", {
    name: "Registrar demanda interna",
    exact: true,
  });
  for (const [rotulo, valor] of [
    ["Valor sugerido", "450"],
    ["Janela de coleta", "A combinar E2E"],
    ["Tipo de veículo", "Caminhão sintético"],
  ])
    await demanda.getByLabel(rotulo, { exact: true }).fill(valor);
  await demanda.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(demanda).not.toBeVisible();
  await detalhes(pagina)
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    pagina.locator("article").filter({ hasText: "A combinar E2E" }),
  ).toBeVisible();
  // Preparação pela API real garante mais de uma página mesmo na execução isolada deste caso.
  for (let indice = 0; indice < 5; indice++) {
    const resposta = await pagina.request.post(`${enderecoApi}/fretes/`, {
      headers: await cabecalhos(pagina),
      data: {
        empresa_compradora_id: cenario.compradora.id,
        material: `Paginação E2E ${indice}`,
        unidade: "KG",
        quantidade: "1",
        origem: "Origem",
        destino: "Destino",
        peso_toneladas: "0.001",
        cubagem_m3: "1",
        quantidade_volumes: 1,
      },
    });
    expect(resposta.status()).toBe(201);
  }
  await pagina.reload();
  await pagina
    .getByRole("combobox", { name: "Registros por página", exact: true })
    .selectOption("5");
  const paginacao = pagina
    .getByRole("navigation", { name: "Paginação", exact: true })
    .filter({ hasText: "Página" })
    .first();
  await expect(
    paginacao.getByRole("button", { name: "Próxima", exact: true }),
  ).toBeEnabled();
  await paginacao.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(paginacao).toContainText("Página 2 de");
  await pagina
    .getByRole("textbox", { name: "Buscar fretes", exact: true })
    .fill("Material E2E G");
  await expect(paginacao).toContainText("Página 1 de 1 · 1 registro(s)");
  await pagina
    .getByRole("combobox", { name: "Situação da auditoria", exact: true })
    .selectOption("aguardando_classificacao");
  await abrirProcesso(pagina, "Material E2E G");
  await detalhes(pagina)
    .getByRole("tab", { name: "Histórico", exact: true })
    .click();
  await expect(
    detalhes(pagina).getByText("Tratativa sintética persistida.", {
      exact: true,
    }),
  ).toBeVisible();
  await detalhes(pagina)
    .getByRole("button", { name: "Cancelar frete", exact: true })
    .click();
  const cancelamento = pagina.getByRole("dialog", {
    name: "Cancelar frete",
    exact: true,
  });
  await cancelamento
    .getByLabel("Justificativa do cancelamento", { exact: true })
    .fill("Cancelamento sintético antes da retirada.");
  await cancelamento
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(cancelamento).not.toBeVisible();
  await expect(
    detalhes(pagina).getByText("Cancelado", { exact: true }),
  ).toBeVisible();
});
