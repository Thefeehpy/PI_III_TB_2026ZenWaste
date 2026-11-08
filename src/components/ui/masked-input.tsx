import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type MaskedInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "defaultValue" | "onChange"
> & {
  value: string;
  formatValue?: (value: string) => string;
  onValueChange: (value: string) => void;
};

export function MaskedInput({
  value,
  formatValue,
  onValueChange,
  onKeyDown,
  ...props
}: MaskedInputProps) {
  const ajustePendente = useRef<{ campo: HTMLInputElement; cursor: number }>();
  useLayoutEffect(() => {
    const ajuste = ajustePendente.current;
    ajustePendente.current = undefined;
    if (ajuste && document.activeElement === ajuste.campo) {
      ajuste.campo.setSelectionRange(ajuste.cursor, ajuste.cursor);
    }
  }, [value]);

  const update = (input: HTMLInputElement, raw: string, position: number) => {
    const formatted = formatValue?.(raw) ?? raw;
    const digitsBefore = raw.slice(0, position).replace(/\D/g, "").length;
    let caret = formatted === raw ? position : 0;
    let digits = 0;
    while (
      formatted !== raw &&
      caret < formatted.length &&
      digits < digitsBefore
    ) {
      if (/\d/.test(formatted[caret])) digits++;
      caret++;
    }
    if (!digitsBefore && formatted.startsWith("(")) caret = 1;

    // Aplica o cursor na confirmação do valor, antes da próxima interação.
    // Um RAF atrasado pode desfazer Ctrl+A ou uma seleção feita pelo usuário.
    if (formatted === value) {
      ajustePendente.current = undefined;
      input.value = formatted;
      input.setSelectionRange(caret, caret);
    } else {
      ajustePendente.current = { campo: input, cursor: caret };
    }
    onValueChange(formatted);
  };

  return (
    <Input
      {...props}
      value={formatValue?.(value) ?? value}
      onChange={(event) =>
        formatValue
          ? update(
              event.currentTarget,
              event.currentTarget.value,
              event.currentTarget.selectionStart ??
                event.currentTarget.value.length,
            )
          : onValueChange(event.currentTarget.value)
      }
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          !formatValue ||
          event.defaultPrevented ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        )
          return;
        const input = event.currentTarget;
        if (formatValue(input.value.replace(/\D/g, "")) !== input.value) return;
        const start = input.selectionStart;
        if (start === null || start !== input.selectionEnd) return;
        const backwards = event.key === "Backspace";
        if (!backwards && event.key !== "Delete") return;

        let index = backwards ? start - 1 : start;
        if (
          index < 0 ||
          index >= input.value.length ||
          /\d/.test(input.value[index])
        )
          return;
        while (
          index >= 0 &&
          index < input.value.length &&
          /\D/.test(input.value[index])
        )
          index += backwards ? -1 : 1;
        if (index < 0 || index >= input.value.length) return;
        event.preventDefault();
        update(
          input,
          input.value.slice(0, index) + input.value.slice(index + 1),
          backwards ? index : start,
        );
      }}
    />
  );
}
