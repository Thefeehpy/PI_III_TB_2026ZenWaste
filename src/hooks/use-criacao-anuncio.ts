import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useEstoque } from "@/contexts/InventoryContext";
import { useAnuncios } from "@/contexts/MarketplaceContext";
import { useToast } from "@/hooks/use-toast";
import { servicoMercado } from "@/services/servico-mercado";
import { servicoEnderecos } from "@/services/servico-enderecos";
import { obterPrecoReferenciaLocal } from "@/utils/referencias-mercado";
import { processarImagemAnuncio } from "@/utils/imagens-anuncio";
import { formatarCep, normalizarCep } from "@/utils/cep";
import { sugerirVeiculoDemonstrativo, estimarFreteDemonstrativo } from "@/utils/frete-demonstrativo";
const etapas = ["Selecionar Item", "Detalhes do Anúncio", "Precificação", "Revisão"];
const REFERENCIA_LOCAL = "Referência demonstrativa local. Consulte a sugestão para obter os dados atuais do backend.";
type EstadoConsultaCep = "idle" | "loading" | "success" | "erro";

export function useCriacaoAnuncio() {
  const { itens, carregando: carregandoEstoque, erro: erroEstoque, atualizarEstoque } = useEstoque();
  const { user: empresa } = useAuth();
  const { criarAnuncio } = useAnuncios();
  const { toast } = useToast();
  const itensDisponiveis = itens.filter((item) => item.availableQuantity > 0);
  const entradaImagemRef = useRef<HTMLInputElement | null>(null);
  const ultimoCepConsultadoRef = useRef("");
  const publicacaoEmAndamento = useRef(false);
  const sequenciaPreco = useRef(0);
  const sequenciaDescricao = useRef(0);
  const sequenciaImagem = useRef(0);
  const montado = useRef(false);
  const [publicando, definirPublicando] = useState(false);

  const [etapaAtual, definirEtapaAtual] = useState(0);
  const [arrastandoImagem, definirArrastandoImagem] = useState(false);
  const [processandoImagem, definirProcessandoImagem] = useState(false);
  const [sugerindoDescricao, definirSugerindoDescricao] = useState(false);
  const [sugerindoPreco, definirSugerindoPreco] = useState(false);
  const [nomeFotoSelecionada, definirNomeFotoSelecionada] = useState("");
  const [estadoConsultaCep, definirEstadoConsultaCep] = useState<EstadoConsultaCep>("idle");
  const [mensagemConsultaCep, definirMensagemConsultaCep] = useState("");
  const [analisePreco, definirAnalisePreco] = useState(REFERENCIA_LOCAL);
  const [simularTransporte, definirSimularTransporte] = useState(false);
  const [formulario, definirFormulario] = useState({
    inventoryId: "",
    title: "",
    type: "",
    description: "",
    quantity: "",
    unit: "kg",
    cep: "",
    street: "",
    neighborhood: "",
    number: "",
    city: "",
    state: "",
    location: "",
    price: "",
    suggestedPrice: "0.00",
    photos: [] as string[],
  });
  const [formularioTransporte, definirFormularioTransporte] = useState({
    suggestedFreight: "",
    pickupWindow: "",
    destination: "A combinar com o comprador",
    vehicleType: "",
    notes: "",
  });

  const cepNormalizado = useMemo(() => normalizarCep(formulario.cep), [formulario.cep]);
  const cidadeEstado = formulario.city && formulario.state ? `${formulario.city} - ${formulario.state}` : "";
  const logradouroNumero = formulario.street ? `${formulario.street}${formulario.number ? `, ${formulario.number}` : ""}` : "";
  const localizacaoCompleta = [logradouroNumero, formulario.neighborhood, cidadeEstado].filter(Boolean).join(", ");
  const chaveContexto = JSON.stringify([empresa?.id, formulario.inventoryId, formulario.title, formulario.type, formulario.quantity, formulario.unit, localizacaoCompleta]);
  const contextoAtual = useRef(chaveContexto);
  const formularioAtual = useRef(formulario);
  const empresaAtual = useRef(empresa?.id);

  useLayoutEffect(() => {
    contextoAtual.current = chaveContexto;
    formularioAtual.current = formulario;
    empresaAtual.current = empresa?.id;
  }, [chaveContexto, formulario, empresa?.id]);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const avancar = () => definirEtapaAtual((step) => Math.min(step + 1, etapas.length - 1));
  const voltar = () => definirEtapaAtual((step) => Math.max(step - 1, 0));

  const selecionarProduto = (identificador: string) => {
    const produto = itens.find((item) => item.id === identificador);
    if (!produto) return;
    definirFormulario((atual) => ({
      ...atual, inventoryId: produto.id, title: produto.name, type: produto.type,
      quantity: String(produto.availableQuantity), unit: produto.unit,
      description: produto.description, photos: [], price: "",
      suggestedPrice: obterPrecoReferenciaLocal(produto.type).toFixed(2),
    }));
  };

  const alterarCep = (valor: string) => {
    if (normalizarCep(valor) === cepNormalizado) return;
    ultimoCepConsultadoRef.current = "";
    definirFormulario((atual) => ({
      ...atual, cep: formatarCep(valor), street: "", neighborhood: "", number: "",
      city: "", state: "", location: "",
    }));
  };

  useEffect(() => {
    const consulta = ++sequenciaPreco.current;
    ++sequenciaDescricao.current;
    ++sequenciaImagem.current;
    definirSugerindoPreco(false);
    definirSugerindoDescricao(false);
    definirProcessandoImagem(false);
    definirNomeFotoSelecionada("");
    if (!formulario.type) {
      return;
    }

    let ativo = true;
    const precoReferenciaLocal = obterPrecoReferenciaLocal(formulario.type).toFixed(2);

    definirFormulario((atual) => ({
      ...atual,
      suggestedPrice: precoReferenciaLocal,
    }));
    definirAnalisePreco(REFERENCIA_LOCAL);

    servicoMercado
      .sugerirPreco(formulario.type)
      .then((resposta) => {
        if (ativo && consulta === sequenciaPreco.current) {
          definirFormulario((atual) => ({
            ...atual,
            suggestedPrice: resposta.suggestedPrice.toFixed(2),
          }));
          definirAnalisePreco(`${resposta.source === "ai" ? "Sugestão de IA" : "Referência de mercado"}: ${resposta.insight}`);
        }
      })
      .catch(() => { if (ativo && consulta === sequenciaPreco.current) definirAnalisePreco(`Consulta indisponível. ${REFERENCIA_LOCAL}`); });

    return () => {
      ativo = false;
    };
  }, [formulario.type, formulario.inventoryId, empresa?.id]);

  useEffect(() => {
    if (!cepNormalizado) {
      ultimoCepConsultadoRef.current = "";
      definirEstadoConsultaCep("idle");
      definirMensagemConsultaCep("");
      definirFormulario((atual) => ({
        ...atual,
        street: "",
        neighborhood: "",
        number: "",
        city: "",
        state: "",
        location: "",
      }));
      return;
    }

    if (cepNormalizado.length < 8) {
      ultimoCepConsultadoRef.current = "";
      definirEstadoConsultaCep("idle");
      definirMensagemConsultaCep("Digite um CEP com 8 numeros.");
      definirFormulario((atual) => ({
        ...atual,
        street: "",
        neighborhood: "",
        number: "",
        city: "",
        state: "",
        location: "",
      }));
      return;
    }

    if (ultimoCepConsultadoRef.current === cepNormalizado) {
      return;
    }

    let ativo = true;
    const controle = new AbortController();

    definirEstadoConsultaCep("loading");
    definirMensagemConsultaCep("Buscando endereço...");

    servicoEnderecos.consultarCep(cepNormalizado, controle.signal)
      .then(({ city, state, street, neighborhood }) => {
        if (!ativo) {
          return;
        }

        ultimoCepConsultadoRef.current = cepNormalizado;
        definirFormulario((atual) => ({
          ...atual,
          street,
          neighborhood,
          city,
          state,
          location: [street, neighborhood, `${city} - ${state}`].filter(Boolean).join(", "),
        }));
        definirEstadoConsultaCep("success");
        definirMensagemConsultaCep("Endereço preenchido automaticamente. Informe o número para concluir.");
      })
      .catch((erro) => {
        if (!ativo) {
          return;
        }

        ultimoCepConsultadoRef.current = "";
        definirFormulario((atual) => ({
          ...atual,
          street: "",
          neighborhood: "",
          number: "",
          city: "",
          state: "",
          location: "",
        }));
        definirEstadoConsultaCep("erro");
        definirMensagemConsultaCep(erro instanceof Error ? erro.message : "Não foi possível consultar o CEP.");
      });

    return () => {
      ativo = false;
      controle.abort();
    };
  }, [cepNormalizado]);

  const limparFormulario = () => {
    ++sequenciaPreco.current;
    ++sequenciaDescricao.current;
    ++sequenciaImagem.current;
    definirEtapaAtual(0);
    definirNomeFotoSelecionada("");
    definirArrastandoImagem(false);
    definirProcessandoImagem(false);
    definirSugerindoDescricao(false);
    definirSugerindoPreco(false);
    definirEstadoConsultaCep("idle");
    definirMensagemConsultaCep("");
    definirAnalisePreco(REFERENCIA_LOCAL);
    definirSimularTransporte(false);
    ultimoCepConsultadoRef.current = "";
    definirFormulario({
      inventoryId: "",
      title: "",
      type: "",
      description: "",
      quantity: "",
      unit: "kg",
      cep: "",
      street: "",
      neighborhood: "",
      number: "",
      city: "",
      state: "",
      location: "",
      price: "",
      suggestedPrice: "0.00",
      photos: [],
    });
    definirFormularioTransporte({
      suggestedFreight: "",
      pickupWindow: "",
      destination: "A combinar com o comprador",
      vehicleType: "",
      notes: "",
    });
  };

  const publicar = async () => {
    const produtoSelecionado = itens.find((item) => item.id === formulario.inventoryId);
    if (!produtoSelecionado || !empresa || !podePublicar || publicacaoEmAndamento.current) {
      return;
    }
    publicacaoEmAndamento.current = true;
    definirPublicando(true);
    const rascunhoPublicado = JSON.stringify({ ...formulario, suggestedPrice: undefined });
    const empresaPublicacao = empresa.id;
    try {
    const resultado = await criarAnuncio({
      inventoryId: produtoSelecionado.id,
      name: formulario.title,
      type: produtoSelecionado.type,
      description: formulario.description.trim(),
      quantity: Number(formulario.quantity),
      unit: formulario.unit,
      location: localizacaoCompleta,
      price: Number(formulario.price || formulario.suggestedPrice),
      images: formulario.photos.map((url, indice) => ({ url, isCover: indice === 0, order: indice })),
    });

    if (!montado.current || empresaAtual.current !== empresaPublicacao) return;
    if (!resultado.sucesso) {
      toast({
        title: "Anúncio não publicado",
        description: resultado.mensagem,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Anúncio publicado",
      description: simularTransporte
        ? "Seu resíduo está no marketplace. O transporte é uma simulação local e não foi enviado para transportadoras."
        : "Seu resíduo já está disponível no marketplace.",
    });

    if (JSON.stringify({ ...formularioAtual.current, suggestedPrice: undefined }) === rascunhoPublicado) limparFormulario();
    } catch (erro) {
      if (montado.current && empresaAtual.current === empresaPublicacao) toast({
        title: "Anúncio não publicado",
        description: erro instanceof Error ? erro.message : "Não foi possível publicar o anúncio.",
        variant: "destructive",
      });
    } finally {
      publicacaoEmAndamento.current = false;
      if (montado.current) definirPublicando(false);
    }
  };

  const anexarFoto = async (arquivo: File) => {
    const consulta = ++sequenciaImagem.current;
    const produtoImagem = formulario.inventoryId;
    const empresaImagem = empresa?.id;
    definirProcessandoImagem(true);

    try {
      const imagemProcessada = await processarImagemAnuncio(arquivo);
      if (!montado.current || consulta !== sequenciaImagem.current || formularioAtual.current.inventoryId !== produtoImagem || empresaAtual.current !== empresaImagem) return;

      definirFormulario((atual) => ({
        ...atual,
        photos: [imagemProcessada],
      }));
      definirNomeFotoSelecionada(arquivo.name);

      toast({
        title: "Imagem anexada",
        description: "A imagem foi adicionada ao anúncio e será publicada junto com ele.",
      });
    } catch (erro) {
      if (!montado.current || consulta !== sequenciaImagem.current || formularioAtual.current.inventoryId !== produtoImagem || empresaAtual.current !== empresaImagem) return;
      toast({
        title: "Não foi possível anexar a imagem",
        description: erro instanceof Error ? erro.message : "Tente novamente com outra imagem.",
        variant: "destructive",
      });
    } finally {
      if (montado.current && consulta === sequenciaImagem.current) {
        definirProcessandoImagem(false);
        definirArrastandoImagem(false);
      }
    }
  };

  const removerFoto = () => {
    ++sequenciaImagem.current;
    definirProcessandoImagem(false);
    definirFormulario((atual) => ({ ...atual, photos: [] }));
    definirNomeFotoSelecionada("");
  };

  const selecionarArquivo = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    await anexarFoto(files[0]);
  };

  const montarContextoSugestao = () => ({
    name: formulario.title,
    type: formulario.type,
    quantity: Number(formulario.quantity) || undefined,
    unit: formulario.unit,
    location: localizacaoCompleta || undefined,
  });

  const alternarSimulacaoTransporte = () => {
    const proximoValor = !simularTransporte;
    definirSimularTransporte(proximoValor);

    if (proximoValor) {
      definirFormularioTransporte((atual) => ({
        ...atual,
        suggestedFreight:
          atual.suggestedFreight || estimarFreteDemonstrativo(formulario.type, formulario.quantity, formulario.unit),
        pickupWindow: atual.pickupWindow || "Até 2 dias após confirmação",
        vehicleType: atual.vehicleType || sugerirVeiculoDemonstrativo(formulario.type),
        notes:
          atual.notes ||
          "Transporte vinculado ao anúncio. Coleta no endereço informado e destino definido após reserva do comprador.",
      }));
    }
  };

  const sugerirDescricao = async () => {
    if (!formulario.title || !formulario.type) {
      toast({
        title: "Dados insuficientes",
        description: "Selecione um item e informe o título antes de gerar a descrição.",
        variant: "destructive",
      });
      return;
    }

    const consulta = ++sequenciaDescricao.current;
    const contextoSolicitado = chaveContexto;
    const descricaoOriginal = formulario.description;
    const respostaVigente = () => montado.current && consulta === sequenciaDescricao.current && contextoAtual.current === contextoSolicitado && formularioAtual.current.description === descricaoOriginal;
    definirSugerindoDescricao(true);
    try {
      const resposta = await servicoMercado.sugerirDescricao(montarContextoSugestao());
      if (!respostaVigente()) return;
      definirFormulario((atual) => ({ ...atual, description: resposta.description }));
      toast({
        title: resposta.source === "ai" ? "Descrição gerada por IA" : "Descrição sugerida",
        description:
          resposta.source === "ai"
            ? "Revise o texto antes de publicar."
            : resposta.message || "IA indisponível; usei uma sugestão padrão.",
      });
    } catch (erro) {
      if (!respostaVigente()) return;
      toast({
        title: "Descrição não gerada",
        description: erro instanceof Error ? erro.message : "Não foi possível gerar a descrição.",
        variant: "destructive",
      });
    } finally {
      if (montado.current && consulta === sequenciaDescricao.current) definirSugerindoDescricao(false);
    }
  };

  const sugerirPreco = async () => {
    if (!formulario.type) {
      toast({
        title: "Tipo obrigatorio",
        description: "Selecione um item antes de sugerir o preço.",
        variant: "destructive",
      });
      return;
    }

    const consulta = ++sequenciaPreco.current;
    const contextoSolicitado = chaveContexto;
    const precoOriginal = formulario.price;
    const respostaVigente = () => montado.current && consulta === sequenciaPreco.current && contextoAtual.current === contextoSolicitado && formularioAtual.current.price === precoOriginal;
    definirSugerindoPreco(true);
    try {
      const resposta = await servicoMercado.sugerirPreco(montarContextoSugestao());
      if (!respostaVigente()) return;
      definirFormulario((atual) => ({
        ...atual,
        suggestedPrice: resposta.suggestedPrice.toFixed(2),
        price: resposta.suggestedPrice.toFixed(2),
      }));
      definirAnalisePreco(resposta.insight);
      toast({
        title: resposta.source === "ai" ? "Preço sugerido por IA" : "Preço sugerido",
        description:
          resposta.source === "ai"
            ? "Revise o valor antes de publicar."
            : resposta.message || "IA indisponível; usei histórico de mercado.",
      });
    } catch (erro) {
      if (!respostaVigente()) return;
      toast({
        title: "Preço não sugerido",
        description: erro instanceof Error ? erro.message : "Não foi possível sugerir o preço.",
        variant: "destructive",
      });
    } finally {
      if (montado.current && consulta === sequenciaPreco.current) definirSugerindoPreco(false);
    }
  };

  const enderecoCompleto = Boolean(formulario.city && formulario.state && formulario.number && cepNormalizado.length === 8);
  const quantidade = Number(formulario.quantity);
  const produtoSelecionado = itens.find((item) => item.id === formulario.inventoryId);
  const quantidadeValida = Number.isFinite(quantidade) && quantidade > 0 && Boolean(produtoSelecionado && quantidade <= produtoSelecionado.availableQuantity);
  const podeAvancarDetalhes = Boolean(formulario.title && quantidadeValida && enderecoCompleto);
  const podeSimularTransporte =
    !simularTransporte || Boolean(formularioTransporte.suggestedFreight && formularioTransporte.pickupWindow && formularioTransporte.vehicleType);
  const preco = Number(formulario.price || formulario.suggestedPrice);
  const podePublicar = podeAvancarDetalhes && podeSimularTransporte && Number.isFinite(preco) && preco >= 0 && !publicando && !processandoImagem;

  return {
    itens, empresa, itensDisponiveis, entradaImagemRef,
    carregandoEstoque, erroEstoque, atualizarEstoque, publicando,
    etapaAtual, arrastandoImagem, definirArrastandoImagem, processandoImagem,
    sugerindoDescricao, sugerindoPreco, nomeFotoSelecionada,
    estadoConsultaCep, mensagemConsultaCep, analisePreco, simularTransporte,
    formulario, definirFormulario, formularioTransporte, definirFormularioTransporte, cidadeEstado, logradouroNumero, localizacaoCompleta,
    avancar, voltar, publicar, selecionarProduto, alterarCep, selecionarArquivo, removerFoto, alternarSimulacaoTransporte,
    sugerirDescricao, sugerirPreco, podeAvancarDetalhes, podePublicar, etapas,
  };
}
