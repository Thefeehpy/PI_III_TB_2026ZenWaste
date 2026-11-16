import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOrderReceiver,
  parseReceiverSnapshot,
  receiverMatches,
  saveOrderReceiver,
  validateReceiver,
} from "@/lib/order-receiver";

const receiver = { name: "Pedro Tanaka", cpf: "529.982.247-25" };

describe("authorized order receiver", () => {
  beforeEach(() => localStorage.clear());

  it("requires a full name and a CPF with valid check digits", () => {
    expect(validateReceiver({ name: "Pedro", cpf: "123.456.789-01" })).toEqual({
      name: "Informe o nome completo do recebedor.",
      cpf: "Informe um CPF válido.",
    });
    expect(validateReceiver({ name: "", cpf: "11.222.333/0001-81" }).cpf).toBeDefined();
    expect(validateReceiver(receiver)).toEqual({});
  });

  it("persists the entered receiver for only the selected order", () => {
    saveOrderReceiver("5842", { ...receiver, name: "  Pedro   Tanaka  " });
    expect(getOrderReceiver("5842")).toEqual({ name: "Pedro Tanaka", cpf: "52998224725" });
    expect(getOrderReceiver("5846")).toBeNull();
    saveOrderReceiver("5846", { name: "Outra Pessoa", cpf: "11144477735" });
    expect(getOrderReceiver("5842")?.name).toBe("Pedro Tanaka");
  });

  it("matches accent and case differences but requires both identity fields", () => {
    const saved = { name: "João da Silva", cpf: "52998224725" };
    expect(receiverMatches(saved, "  JOAO   DA SILVA ", "529.982.247-25")).toBe(true);
    expect(receiverMatches(saved, "Outra Pessoa", saved.cpf)).toBe(false);
    expect(receiverMatches(saved, saved.name, "11144477735")).toBe(false);
  });

  it("replaces the previous receiver without authorizing their former identity", () => {
    saveOrderReceiver("5842", receiver);
    saveOrderReceiver("5842", { name: "Nova Pessoa", cpf: "11144477735" });
    expect(receiverMatches(getOrderReceiver("5842")!, receiver.name, receiver.cpf)).toBe(false);
  });

  it("treats damaged or invalid stored data as a missing registration", () => {
    for (const raw of [null, "broken-json", "null", "[]", '{"name":"Pedro"}', JSON.stringify({ ...receiver, cpf: "12345678901" })]) {
      expect(parseReceiverSnapshot(raw)).toBeNull();
    }
  });

  it("reports storage errors instead of claiming the registration was saved", () => {
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    try {
      expect(() => saveOrderReceiver("5842", receiver)).toThrow("Não foi possível salvar o recebedor");
      expect(getOrderReceiver("5842")).toBeNull();
    } finally {
      write.mockRestore();
    }
  });
});
