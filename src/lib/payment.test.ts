import { describe, expect, it } from "vitest";
import { calculateTotal, validDocument, validateCard, validarCompradorEmpresarial, formatarTelefoneEmpresarial, validateBuyer } from "@/lib/payment";
import { empresaR1 } from "@/test/fixtures/acesso";

describe("checkout validation", () => {
  const comprador = { name: "Contato de teste", email: "contato@example.invalid", document: empresaR1.cnpj, phone: "11999999999" };
  it("aceita comprador B2B e preserva documento de pessoa física na demonstração", () => {
    expect(validarCompradorEmpresarial(comprador, empresaR1)).toEqual({});
    expect(validarCompradorEmpresarial({ ...comprador, document: "52998224725" }, empresaR1).document).toBeTruthy();
    expect(validateBuyer({ ...comprador, document: "52998224725" })).toEqual({});
  });
  it("rejeita outra empresa e ausência de identidade confirmada", () => {
    expect(validarCompradorEmpresarial({ ...comprador, document: "11444777000161" }, empresaR1).document).toBeTruthy();
    expect(validarCompradorEmpresarial(comprador, null).document).toBeTruthy();
  });
  it("valida limites e obrigatoriedade dos contatos sem truncar dados", () => {
    expect(validarCompradorEmpresarial({ ...comprador, name: "x".repeat(120), email: "x".repeat(240) + "@example.invalid", phone: "5511999999999" }, empresaR1)).toEqual({});
    expect(validarCompradorEmpresarial({ ...comprador, name: "x".repeat(121), email: "x".repeat(257), phone: "123" }, empresaR1)).toMatchObject({ name: expect.any(String), email: expect.any(String), phone: expect.any(String) });
    expect(validarCompradorEmpresarial({ name: "", email: "", document: "", phone: "" }, empresaR1)).toEqual({ name: expect.any(String), email: expect.any(String), document: expect.any(String), phone: expect.any(String) });
    expect(formatarTelefoneEmpresarial("+55 11 99999-9999").replace(/\D/g, "")).toBe("5511999999999");
  });
  it("calculates integer cents for decimal quantities without binary currency drift", () => {
    expect(calculateTotal(2.8, 12.345)).toBe(3457);
    expect(calculateTotal(0.45, 10000)).toBe(450000);
    expect(calculateTotal(0.1, 3)).toBe(30);
  });

  it("checks document check digits, rather than just length", () => {
    expect(validDocument("529.982.247-25")).toBe(true);
    expect(validDocument("11.222.333/0001-81")).toBe(true);
    expect(validDocument("111.111.111-11")).toBe(false);
    expect(validDocument("529.982.247-26")).toBe(false);
    expect(validDocument("11.222.333/0001-82")).toBe(false);
  });

  it("rejects invalid card checksums, expired cards and wrong CVV lengths", () => {
    const now = new Date(2026, 9, 18);
    const valid = {
      number: "4242 4242 4242 4242",
      holder: "TEST BUYER",
      expiry: "10/26",
      cvv: "123",
    };
    expect(validateCard(valid, now)).toEqual({});
    expect(
      validateCard({ ...valid, number: "4242 4242 4242 4241" }, now).number,
    ).toBeTruthy();
    expect(
      validateCard({ ...valid, expiry: "09/26" }, now).expiry,
    ).toBeTruthy();
    expect(
      validateCard({ ...valid, expiry: "13/27" }, now).expiry,
    ).toBeTruthy();
    expect(validateCard({ ...valid, cvv: "1234" }, now).cvv).toBeTruthy();
  });
});
