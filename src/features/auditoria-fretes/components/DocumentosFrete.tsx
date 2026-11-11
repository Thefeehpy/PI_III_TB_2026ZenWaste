import type { FreteDetalheDTO } from "../tipos-api";
import { apresentarData, apresentarMoeda } from "../apresentacao-api";

export function DocumentosFrete({ documentos, documento, historico }: Pick<FreteDetalheDTO, "documentos" | "documento" | "historico">) {
  return <section aria-label="Versões de CT-e" className="space-y-3">
    <p className="text-sm text-muted-foreground">Registros comerciais para auditoria. Nomes de arquivos são metadados; não houve upload, emissão fiscal ou consulta à SEFAZ por esta tela.</p>
    {!documentos.length && <p>Nenhuma versão de CT-e disponibilizada para este participante.</p>}
    {documentos.map(d => {
      const evento = historico.find(e => e.tipo === "registrar-cte" && e.detalhes.documento_id === d.id);
      return <article key={d.id} className={`space-y-2 rounded-2xl border p-4 text-sm ${documento?.id === d.id ? "border-primary/50 bg-primary/5" : ""}`}>
        <h3 className="font-semibold">Versão {d.versao} · {d.numero} {documento?.id === d.id ? "— atual" : "— anterior"}</h3>
        <p>Valor informado: {apresentarMoeda(d.valor)}</p>
        <p>Nome do arquivo CT-e (metadado): {d.nome_arquivo || "não informado"}</p>
        <p>Referência NF-e (metadado): {d.arquivo_nfe || "não informada"}</p>
        <p>Registrado em {apresentarData(d.recebido_em)}</p>
        {evento && <p>Empresa autora, conforme histórico: {evento.autor.razao_social}</p>}
      </article>;
    })}
  </section>;
}
