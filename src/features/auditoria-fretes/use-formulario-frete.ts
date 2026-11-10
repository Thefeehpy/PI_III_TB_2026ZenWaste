import { useLayoutEffect, useRef, useState, type SetStateAction } from "react";
import type { ErrosFrete } from "./validacoes";

export type PedirDescarte = (descricao: string, continuar: () => void) => void;

/** Rascunho em memória, vinculado à sessão e, quando aplicável, ao UUID do frete. */
export function useFormularioFrete<T>(contexto: object, inicial: T, pedirDescarte: PedirDescarte) {
  const criar = () => ({ contexto, formulario: inicial, aberto: false, erros: {} as ErrosFrete });
  const [estado, definirEstado] = useState(criar);
  const atual = estado.contexto === contexto ? estado : criar();
  const ativo = useRef<object | null>(contexto);
  useLayoutEffect(() => {
    ativo.current = contexto;
    return () => { ativo.current = null; };
  }, [contexto]);
  const aplicar = (transformar: (anterior: typeof estado) => typeof estado) => {
    if (ativo.current !== contexto) return;
    definirEstado(anterior => ativo.current === contexto
      ? transformar(anterior.contexto === contexto ? anterior : criar()) : anterior);
  };
  const sujo = JSON.stringify(atual.formulario) !== JSON.stringify(inicial);
  const limpar = () => aplicar(() => criar());
  const trocar = (acao: () => void) => {
    const continuar = () => { if (ativo.current === contexto) acao(); };
    if (sujo) pedirDescarte("Os dados deste formulário serão descartados ao mudar de contexto.", continuar);
    else continuar();
  };
  return {
    ...atual, sujo, limpar, trocar,
    definir: (valor: SetStateAction<T>) => aplicar(anterior => ({ ...anterior,
      formulario: typeof valor === "function" ? (valor as (v: T) => T)(anterior.formulario) : valor,
      erros: {},
    })),
    definirErros: (erros: ErrosFrete) => aplicar(anterior => ({ ...anterior, erros })),
    abrir: (aberto: boolean) => {
      if (!aberto) trocar(limpar);
      else aplicar(anterior => ({ ...anterior, aberto: true, erros: {} }));
    },
  };
}
