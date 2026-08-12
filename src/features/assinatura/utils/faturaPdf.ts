import { formatCurrencyFromCents } from "@/shared/utils/currency";
import { formatDocument } from "@/shared/utils/format";
import { MONTHS } from "@/shared/utils/date";
import { FaturaMeta, type Fatura, type MinhaAssinatura } from "@/features/assinatura/types/assinatura.types";

/* Import dinâmico pelo mesmo motivo de `downloadNota`: o jsPDF pesa e só é
   necessário no clique de "Baixar". Aqui o PDF é desenhado em vetor, não
   rasterizado — o texto sai selecionável, nítido em qualquer zoom e o arquivo
   fica na casa dos KB em vez dos MB de um print de tela. */

/**
 * Dados de quem emite a cobrança.
 *
 * `cnpj` e `endereco` nascem vazios de propósito: são dados cadastrais reais e
 * inventá-los num documento financeiro seria forjar informação. Campo vazio
 * simplesmente não é impresso — preencha aqui e ele passa a aparecer no PDF.
 */
const EMITENTE = {
  nome: "CodeEx Solutions",
  produto: "CodeEx Flow",
  site: "flow.codeexsolutions.com.br",
  cnpj: "",
  endereco: "",
  email: "",
};

/** Violeta da marca — o mesmo `--accent` do tema claro (index.css). */
const ACCENT: [number, number, number] = [109, 92, 232];
const TINTA: [number, number, number] = [23, 23, 33];
const CINZA: [number, number, number] = [113, 113, 132];
const LINHA: [number, number, number] = [226, 226, 235];

/** A4 retrato, em milímetros. */
const PAGINA_W = 210;
const PAGINA_H = 297;
const MARGEM = 16;
const CONTEUDO_W = PAGINA_W - MARGEM * 2;

const dataBr = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
};

const competenciaBr = (competencia: string) => {
  const [ano, mes] = competencia.split("-");
  return MONTHS[Number(mes) - 1] ? `${MONTHS[Number(mes) - 1]}/${ano}` : competencia;
};

/**
 * Número legível da fatura.
 *
 * O id é um UUID: ninguém lê, ninguém dita no telefone. A competência mais um
 * sufixo curto identifica a cobrança e ainda diz de quando ela é.
 */
const numeroDaFatura = (f: Fatura) =>
  `${f.competencia.replace("-", "")}-${f.id.replace(/\D/g, "").slice(-4) || f.id.slice(-4)}`.toUpperCase();

const nomeArquivo = (nome: string) =>
  nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "cliente";

/**
 * Monta o documento e devolve o par (doc, nome do arquivo), sem salvar.
 *
 * Separado do download para poder ser gerado fora do navegador — é assim que
 * dá para conferir o layout sem ter de clicar na tela a cada ajuste de
 * coordenada.
 */
export async function montarFaturaPdf(fatura: Fatura, assinatura: MinhaAssinatura) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const empresa = assinatura.empresa;
  const numero = numeroDaFatura(fatura);

  /* Metadados do arquivo: é o que aparece na aba do leitor de PDF e na busca
     do sistema operacional. Sem isso o documento se chama "untitled". */
  doc.setDocumentProperties({
    title: `Fatura ${numero} — ${EMITENTE.nome}`,
    subject: `Assinatura ${EMITENTE.produto} · ${competenciaBr(fatura.competencia)}`,
    author: EMITENTE.nome,
    creator: EMITENTE.produto,
  });

  const texto = (
    str: string,
    x: number,
    y: number,
    o: { tamanho?: number; cor?: [number, number, number]; peso?: "normal" | "bold"; align?: "left" | "right" | "center" } = {},
  ) => {
    doc.setFont("helvetica", o.peso ?? "normal");
    doc.setFontSize(o.tamanho ?? 9);
    doc.setTextColor(...(o.cor ?? TINTA));
    doc.text(str, x, y, { align: o.align ?? "left" });
  };

  /* ---------------- Faixa da marca ---------------- */

  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, PAGINA_W, 34, "F");

  texto(EMITENTE.nome, MARGEM, 15, { tamanho: 17, peso: "bold", cor: [255, 255, 255] });
  texto(`${EMITENTE.produto} · assinatura de software`, MARGEM, 21.5, { tamanho: 8.5, cor: [226, 222, 255] });
  texto(EMITENTE.site, MARGEM, 26.5, { tamanho: 8.5, cor: [226, 222, 255] });

  texto("FATURA", PAGINA_W - MARGEM, 15, { tamanho: 17, peso: "bold", cor: [255, 255, 255], align: "right" });
  texto(`Nº ${numero}`, PAGINA_W - MARGEM, 21.5, { tamanho: 9, cor: [226, 222, 255], align: "right" });
  texto(`Competência ${competenciaBr(fatura.competencia)}`, PAGINA_W - MARGEM, 26.5, { tamanho: 8.5, cor: [226, 222, 255], align: "right" });

  /* ---------------- Emitente e cliente, lado a lado ---------------- */

  let y = 48;
  const colunaD = MARGEM + CONTEUDO_W / 2 + 4;

  texto("EMITENTE", MARGEM, y, { tamanho: 7.5, cor: CINZA, peso: "bold" });
  texto("COBRAR DE", colunaD, y, { tamanho: 7.5, cor: CINZA, peso: "bold" });

  y += 6;
  texto(EMITENTE.nome, MARGEM, y, { tamanho: 10.5, peso: "bold" });
  texto(empresa.nomeFantasia || "—", colunaD, y, { tamanho: 10.5, peso: "bold" });

  /* Cada bloco cresce por conta própria: o emitente pode não ter CNPJ
     preenchido e o cliente sempre tem. Duas réguas independentes evitam que
     uma coluna curta empurre a outra. */
  let yE = y + 5.5;
  let yC = y + 5.5;

  const linhaEmitente = (str: string) => {
    if (!str) return;
    texto(str, MARGEM, yE, { tamanho: 8.5, cor: CINZA });
    yE += 4.6;
  };

  const linhaCliente = (str: string) => {
    if (!str) return;
    texto(str, colunaD, yC, { tamanho: 8.5, cor: CINZA });
    yC += 4.6;
  };

  linhaEmitente(EMITENTE.cnpj ? `CNPJ ${formatDocument(EMITENTE.cnpj)}` : "");
  linhaEmitente(EMITENTE.endereco);
  linhaEmitente(EMITENTE.email || assinatura.suporte?.email || "");
  linhaEmitente(EMITENTE.site);

  linhaCliente(empresa.cpfCnpj ? `CNPJ/CPF ${formatDocument(empresa.cpfCnpj)}` : "");
  linhaCliente(empresa.nomeRepresentante ? `Resp. ${empresa.nomeRepresentante}` : "");
  linhaCliente(`Código da empresa ${empresa.codigoEmpresa}`);

  y = Math.max(yE, yC) + 8;

  /* ---------------- Tabela de itens ---------------- */

  /* Colunas numéricas alinhadas à DIREITA, pela borda.
     Alinhadas à esquerda, "10/08/2026" invadia o "R$ 149,90" da coluna
     seguinte — e datas e valores só se comparam de uma linha para a outra
     quando as casas ficam sob as casas. */
  const fimValor = PAGINA_W - MARGEM - 3;
  const fimVenc = fimValor - 33;
  const fimComp = fimVenc - 32;
  /* Onde a descrição precisa parar para não encostar na competência. */
  const descricaoW = fimComp - 26 - (MARGEM + 3);

  doc.setFillColor(246, 246, 250);
  doc.rect(MARGEM, y - 5, CONTEUDO_W, 8, "F");

  texto("DESCRIÇÃO", MARGEM + 3, y, { tamanho: 7.5, cor: CINZA, peso: "bold" });
  texto("COMPETÊNCIA", fimComp, y, { tamanho: 7.5, cor: CINZA, peso: "bold", align: "right" });
  texto("VENCIMENTO", fimVenc, y, { tamanho: 7.5, cor: CINZA, peso: "bold", align: "right" });
  texto("VALOR", fimValor, y, { tamanho: 7.5, cor: CINZA, peso: "bold", align: "right" });

  y += 10;

  const descricao = fatura.descricao || `Assinatura ${EMITENTE.produto}`;
  const planoNome = fatura.planoNome || assinatura.plano?.nome || "";

  /* Descrição comprida quebra em linhas em vez de atravessar a tabela. */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const linhasDescricao = doc.splitTextToSize(descricao, descricaoW) as string[];

  texto(linhasDescricao[0], MARGEM + 3, y, { tamanho: 9.5 });
  texto(competenciaBr(fatura.competencia), fimComp, y, { tamanho: 9, align: "right" });
  texto(dataBr(fatura.vencimento), fimVenc, y, { tamanho: 9, align: "right" });
  texto(formatCurrencyFromCents(fatura.valorCentavos), fimValor, y, { tamanho: 9.5, peso: "bold", align: "right" });

  for (const linha of linhasDescricao.slice(1, 3)) {
    y += 4.6;
    texto(linha, MARGEM + 3, y, { tamanho: 9.5 });
  }

  if (planoNome) {
    y += 4.8;
    texto(`Plano ${planoNome}`, MARGEM + 3, y, { tamanho: 8, cor: CINZA });
  }

  y += 6;
  doc.setDrawColor(...LINHA);
  doc.setLineWidth(0.2);
  doc.line(MARGEM, y, PAGINA_W - MARGEM, y);

  /* ---------------- Total ---------------- */

  y += 12;
  const caixaW = 78;
  const caixaX = PAGINA_W - MARGEM - caixaW;

  doc.setFillColor(246, 246, 250);
  doc.roundedRect(caixaX, y - 7, caixaW, 17, 2, 2, "F");

  texto("TOTAL", caixaX + 5, y, { tamanho: 8, cor: CINZA, peso: "bold" });
  texto(formatCurrencyFromCents(fatura.valorCentavos), caixaX + caixaW - 5, y + 1.5, {
    tamanho: 15,
    peso: "bold",
    align: "right",
  });

  /* Situação ao lado do total, escrita por extenso — cor sozinha não informa
     em documento impresso, e muita gente imprime em preto e branco. */
  const meta = FaturaMeta[fatura.status];
  texto("SITUAÇÃO", MARGEM, y, { tamanho: 8, cor: CINZA, peso: "bold" });
  texto(meta.label.toUpperCase(), MARGEM, y + 7, { tamanho: 12, peso: "bold" });

  const quando =
    fatura.status === "PAGA"
      ? `Pago em ${dataBr(fatura.pagoEm)}`
      : fatura.status === "AGUARDANDO_CONFIRMACAO"
        ? `Comprovante enviado em ${dataBr(fatura.comprovanteEnviadoEm)}`
        : `Vence em ${dataBr(fatura.vencimento)}`;

  y += 18;
  texto(quando, MARGEM, y, { tamanho: 8.5, cor: CINZA });

  if (fatura.metodoPagamento) {
    y += 4.8;
    texto(`Forma de pagamento: ${fatura.metodoPagamento}`, MARGEM, y, { tamanho: 8.5, cor: CINZA });
  }

  /* ---------------- Pagamento / recibo ---------------- */
  /*
   * O miolo da folha ficava vazio, e documento com buraco no meio parece
   * inacabado. O que entra aqui não é enfeite: quem ainda não pagou precisa dos
   * dados para pagar, e quem já pagou precisa da frase que transforma a fatura
   * em recibo — que é justamente o motivo de a pessoa baixar o PDF.
   */
  y += 16;

  const caixaY = y;
  const caixaH = 34;

  doc.setDrawColor(...LINHA);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGEM, caixaY, CONTEUDO_W, caixaH, 2, 2, "S");

  y = caixaY + 8;

  if (fatura.status === "PAGA") {
    texto("PAGAMENTO CONFIRMADO", MARGEM + 6, y, { tamanho: 8, cor: CINZA, peso: "bold" });
    y += 6;
    texto(
      `Recebemos ${formatCurrencyFromCents(fatura.valorCentavos)} referente à competência ${competenciaBr(fatura.competencia)}.`,
      MARGEM + 6,
      y,
      { tamanho: 9 },
    );
    y += 5.2;
    texto(
      `Este documento serve como comprovante da assinatura ${EMITENTE.produto} no período.`,
      MARGEM + 6,
      y,
      { tamanho: 8.5, cor: CINZA },
    );
  } else if (fatura.status === "CANCELADA") {
    texto("COBRANÇA CANCELADA", MARGEM + 6, y, { tamanho: 8, cor: CINZA, peso: "bold" });
    y += 6;
    texto("Esta fatura foi cancelada e não deve ser paga.", MARGEM + 6, y, { tamanho: 9 });
  } else {
    texto("COMO PAGAR", MARGEM + 6, y, { tamanho: 8, cor: CINZA, peso: "bold" });
    y += 6;

    const pix = assinatura.pix;

    if (pix?.chave) {
      texto(`Pix — chave ${pix.chave}`, MARGEM + 6, y, { tamanho: 9 });
      y += 5.2;
      texto(`Beneficiário: ${pix.beneficiario}`, MARGEM + 6, y, { tamanho: 8.5, cor: CINZA });
      y += 4.6;
      texto(
        `Ou pague pelo sistema, em Configurações › Faturas, com QR Code e confirmação automática.`,
        MARGEM + 6,
        y,
        { tamanho: 8.5, cor: CINZA },
      );
    } else {
      texto("Pague pelo sistema, em Configurações › Faturas.", MARGEM + 6, y, { tamanho: 9 });
      y += 5.2;
      texto("Lá o QR Code do Pix é gerado na hora e o acesso é liberado automaticamente.", MARGEM + 6, y, {
        tamanho: 8.5,
        cor: CINZA,
      });
    }
  }

  /* ---------------- Rodapé ---------------- */

  const rodapeY = PAGINA_H - 30;

  doc.setDrawColor(...LINHA);
  doc.line(MARGEM, rodapeY, PAGINA_W - MARGEM, rodapeY);

  const suporte = assinatura.suporte;
  const canais = [suporte?.whatsapp ? `WhatsApp ${suporte.whatsapp}` : "", suporte?.email].filter(Boolean).join("  ·  ");

  if (canais) texto(`Suporte: ${canais}`, MARGEM, rodapeY + 6, { tamanho: 8, cor: CINZA });

  texto(
    `Documento gerado em ${new Date().toLocaleString("pt-BR")} por ${EMITENTE.produto}.`,
    MARGEM,
    rodapeY + 11,
    { tamanho: 7.5, cor: CINZA },
  );

  /* Ressalva obrigatória: isto é demonstrativo de cobrança, não documento
     fiscal. Sem a frase, um PDF com esta cara passa por nota fiscal. */
  texto(
    "Este documento é um demonstrativo de cobrança de assinatura e não substitui nota fiscal.",
    MARGEM,
    rodapeY + 16,
    { tamanho: 7.5, cor: CINZA },
  );

  texto(numero, PAGINA_W - MARGEM, rodapeY + 16, { tamanho: 7.5, cor: CINZA, align: "right" });

  return { doc, arquivo: `fatura-${fatura.competencia}-${nomeArquivo(empresa.nomeFantasia)}.pdf` };
}

/**
 * Gera o PDF de uma fatura, em nome da CodeEx Solutions, e baixa.
 *
 * Devolve o nome do arquivo salvo — a tela usa isso na mensagem de sucesso.
 */
export async function baixarFaturaPdf(fatura: Fatura, assinatura: MinhaAssinatura): Promise<string> {
  const { doc, arquivo } = await montarFaturaPdf(fatura, assinatura);

  doc.save(arquivo);

  return arquivo;
}
