import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MaskedInput } from "./masked-input";
import { formatDocument } from "@/utils/input-masks";

afterEach(() => vi.unstubAllGlobals());

it("preserva uma seleção feita imediatamente depois da formatação", () => {
  const quadros: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (quadro: FrameRequestCallback) => quadros.push(quadro));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  function Documento() {
    const [valor, definirValor] = useState("");
    return <MaskedInput aria-label="Documento" value={valor} onValueChange={definirValor} formatValue={formatDocument} />;
  }
  render(<Documento />);
  const campo = screen.getByLabelText<HTMLInputElement>("Documento");
  campo.focus();
  fireEvent.change(campo, { target: { value: "11222333000181" } });
  expect(campo.value).toBe("11.222.333/0001-81");
  campo.setSelectionRange(0, campo.value.length);
  act(() => quadros.forEach((quadro) => quadro(0)));
  expect(campo.selectionStart).toBe(0);
  expect(campo.selectionEnd).toBe(campo.value.length);
});
