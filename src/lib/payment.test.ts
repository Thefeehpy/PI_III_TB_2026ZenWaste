import { describe, expect, it } from "vitest";
import { calculateTotal, validDocument, validateCard } from "@/lib/payment";

describe("checkout validation", () => {
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
