import { Link } from "react-router-dom";
import { useId } from "react";
import { ClipboardCheck, FileCheck2, Send, Signature, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ProcessoFrete, FormularioDocumento } from '../tipos';
import { apresentacaoSituacoes, formatarMoeda, formatarData, formatarDataHora, obterCotacaoAprovada, obterDiferenca, obterSituacoesSeparadas } from '../apresentacao';
export function Campo({ label, value, onChange, type = "text", placeholder, }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
}) {
    const identificador = useId();
    return (<div className="space-y-2">
      <Label htmlFor={identificador}>{label}</Label>
      <Input id={identificador} type={type} value={value} placeholder={placeholder} onChange={(evento) => onChange(evento.target.value)} className="h-11 rounded-2xl"/>
    </div>);
}
export function Informacao({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>);
}
export function CartaoInformacao({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="rounded-2xl border border-border/70 bg-background/80 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-semibold text-foreground">{value}</p>
    </div>);
}
export function AbaResumo({ processo }: {
    processo: ProcessoFrete;
}) {
    const cotacaoAprovada = obterCotacaoAprovada(processo);
    const diferenca = obterDiferenca(processo);
    const situacao = apresentacaoSituacoes[processo.situacao];
    return (<>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CartaoInformacao label="Cliente" value={processo.cliente}/>
        <CartaoInformacao label="Origem" value={processo.origem}/>
        <CartaoInformacao label="Destino" value={processo.destino}/>
        <CartaoInformacao label="Cubagem" value={`${processo.metrosCubicos} m³`}/>
        <CartaoInformacao label="Transportadora" value={cotacaoAprovada?.transportadora ?? "Não definida"}/>
        <CartaoInformacao label="Valor aprovado" value={cotacaoAprovada ? formatarMoeda(cotacaoAprovada.valor) : "Aguardando"}/>
        <CartaoInformacao label="Valor cobrado" value={processo.documento ? formatarMoeda(processo.documento.valorCte) : "Não recebido"}/>
        <CartaoInformacao label="Situação atual" value={situacao.label}/>
      </div>
      <div className="rounded-[24px] border border-border/70 bg-muted/20 p-5">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 text-primary"/>
          <div>
            <p className="font-semibold text-foreground">Resumo da jornada</p>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              {obterSituacoesSeparadas(processo).map((item) => (<div key={item.label} className="rounded-2xl border border-border/70 bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
                </div>))}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              O pedido #{processo.numeroPedido} está em {situacao.label.toLowerCase()}.
              {diferenca !== null
            ? ` A diferença atual entre cotação aprovada e CT-e é de ${formatarMoeda(diferenca)}.`
            : " O CT-e ainda não foi conferido para este pedido."}
            </p>
          </div>
        </div>
      </div>
    </>);
}
export function AbaDocumentos({ processo, formularioDocumento, definirFormularioDocumento, aoRegistrarDocumento, }: {
    processo: ProcessoFrete;
    formularioDocumento: FormularioDocumento;
    definirFormularioDocumento: (value: FormularioDocumento) => void;
    aoRegistrarDocumento: () => void;
}) {
    const cotacaoAprovada = obterCotacaoAprovada(processo);
    const diferenca = obterDiferenca(processo);
    const possuiDivergencia = diferenca !== null && Math.abs(diferenca) > 5;
    return (<div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <div className="space-y-4">
        <div className="rounded-[24px] border border-dashed border-border bg-muted/20 p-8 text-center">
          <UploadCloud className="mx-auto h-8 w-8 text-primary"/>
          <p className="mt-4 font-semibold text-foreground">Arraste o documento aqui ou selecione um arquivo</p>
          <p className="mt-2 text-sm text-muted-foreground">Upload visual simulado, sem envio para backend.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Campo label="Arquivo NF-e" value={formularioDocumento.arquivoNfe} onChange={(value) => definirFormularioDocumento({ ...formularioDocumento, arquivoNfe: value })}/>
          <Campo label="Arquivo" value={formularioDocumento.nomeArquivo} onChange={(value) => definirFormularioDocumento({ ...formularioDocumento, nomeArquivo: value })}/>
          <Campo label="Número CT-e" value={formularioDocumento.numeroCte} onChange={(value) => definirFormularioDocumento({ ...formularioDocumento, numeroCte: value })}/>
          <Campo label="Valor CT-e" type="number" value={formularioDocumento.valorCte} onChange={(value) => definirFormularioDocumento({ ...formularioDocumento, valorCte: value })}/>
        </div>
        <Button className="rounded-2xl" onClick={aoRegistrarDocumento}>
          <FileCheck2 className="mr-2 h-4 w-4"/>
          Salvar documentos
        </Button>
      </div>

      <div className="rounded-[24px] border border-border/70 bg-background/80 p-5">
        <h3 className="font-semibold text-foreground">Documentos e conferência</h3>
        <div className="mt-4 space-y-3 text-sm">
          <Informacao label="NF-e" value={processo.arquivoNfe ?? "Pendente"}/>
          <Informacao label="Valor da cotação aprovada" value={cotacaoAprovada ? formatarMoeda(cotacaoAprovada.valor) : "Sem cotação aprovada"}/>
          <Informacao label="Valor do CT-e" value={processo.documento ? formatarMoeda(processo.documento.valorCte) : "Documento não recebido"}/>
          {processo.documento && <Informacao label="Documento" value={`${processo.documento.numeroCte} • ${processo.documento.nomeArquivo}`}/>}
        </div>
        {diferenca !== null && (<div className={cn("mt-5 rounded-2xl border p-4", possuiDivergencia ? "border-destructive/25 bg-destructive/10" : "border-primary/25 bg-primary/10")}>
            <p className={cn("font-semibold", possuiDivergencia ? "text-destructive" : "text-primary")}>
              {possuiDivergencia ? "Divergência encontrada" : "Valores conferidos"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Diferença: {formatarMoeda(diferenca)}</p>
          </div>)}
      </div>
    </div>);
}
export function AbaEntrega({ processo, nomeFotoRetirada, definirNomeFotoRetirada, aoRegistrarRetirada, aoAbrirEntrega, }: {
    processo: ProcessoFrete;
    nomeFotoRetirada: string;
    definirNomeFotoRetirada: (value: string) => void;
    aoRegistrarRetirada: () => void;
    aoAbrirEntrega: () => void;
}) {
    if (processo.entrega) {
        return (<div className="rounded-[24px] border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <Signature className="mt-0.5 h-5 w-5 text-primary"/>
          <div>
            <p className="font-semibold text-foreground">Entrega confirmada</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Recebido por {processo.entrega.nomeRecebedor} em {formatarDataHora(processo.entrega.confirmadoEm)}.
            </p>
            {processo.entrega.tipoRecebimento === "with_reservation" && (<p className="mt-2 text-sm text-warning">Ressalva: {processo.entrega.textoRessalva || "sem observação detalhada"}</p>)}
            <Badge className="mt-4 rounded-full">Canhoto temporário nesta sessão</Badge>
          </div>
        </div>
      </div>);
    }
    return (<div className="space-y-5">
      <div className="rounded-[24px] border border-border/70 bg-background/80 p-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Informacao label="Status" value={processo.registroRetirada ? "Carga retirada / em transporte" : "Aguardando retirada"}/>
        <Informacao label="Previsão" value={formatarData(processo.previsaoEntrega)}/>
        <Informacao label="Destino" value={processo.destino}/>
        <Informacao label="Transportadora" value={obterCotacaoAprovada(processo)?.transportadora ?? "Não definida"}/>
      </div>
      </div>

      <div className="rounded-[24px] border border-border/70 bg-muted/20 p-5">
        <div className="flex items-start gap-3">
          <UploadCloud className="mt-0.5 h-5 w-5 text-primary"/>
          <div className="flex-1">
            <p className="font-semibold text-foreground">Retirada da carga</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Anexe visualmente a foto da carga carregada no caminhão para simular a retirada nesta sessão.
            </p>
            {processo.registroRetirada ? (<div className="mt-4 rounded-2xl border border-primary/25 bg-primary/10 p-4">
                <p className="text-sm font-semibold text-foreground">{processo.registroRetirada.nomeFoto}</p>
                <p className="mt-1 text-xs text-muted-foreground">Registrado em {formatarDataHora(processo.registroRetirada.registradaEm)}</p>
              </div>) : (<div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input aria-label="Nome da foto de retirada" value={nomeFotoRetirada} onChange={(evento) => definirNomeFotoRetirada(evento.target.value)} placeholder="Ex.: carga-pedido-5842.jpg" className="h-11 rounded-2xl"/>
                <Button className="rounded-2xl" onClick={aoRegistrarRetirada}>
                  <UploadCloud className="mr-2 h-4 w-4"/>
                  Registrar retirada
                </Button>
              </div>)}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Button className="rounded-2xl" onClick={aoAbrirEntrega}>
          <Send className="mr-2 h-4 w-4"/>
          Registrar aqui
        </Button>
        <Button asChild variant="outline" className="rounded-2xl">
          <Link to="/driver/deliveries">Tela do entregador</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-2xl">
          <Link to={`/delivery-signature/${processo.numeroPedido}`}>Link do cliente</Link>
        </Button>
      </div>
    </div>);
}
