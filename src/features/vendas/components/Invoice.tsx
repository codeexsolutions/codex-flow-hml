import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import HeaderInterprise from "@/shared/ui/HeaderInterprise";

import { formatDate } from "@/shared/utils/date";
import { formatCurrency } from "@/shared/utils/currency";

import ProductType from "@/shared/domain/produto";
import type { PedidoClienteType, ItemPedidoType, NovoPedidoDto, PedidoUpdateDto } from "@/shared/domain/pedido";

import NoteService from "@/features/vendas/services/note.service";
import ProductService from "@/features/estoque/services/product.service";
import FinanceiroService from "@/features/financeiro/services/financeiro.service";

import MoneyInput from "@/shared/ui/inputs/MoneyInput";
import { Modal } from "@/shared/ui/Modal";
import { useAlert } from "@/shared/ui/Alert";
import { extractErrorMessage, getErrorTitle } from "@/shared/utils/errorHandler";
import BuscaProduto from "@/features/vendas/components/BuscaProduto";
import MenuDownloadNota from "@/shared/ui/MenuDownloadNota";
import BotaoRecibo from "@/shared/ui/BotaoRecibo";
import FundoNota from "@/shared/ui/FundoNota";
import useEnterprise from "@/features/empresa/store/enterprise.store";
import OrcamentoService from "@/features/orcamentos/services/orcamento.service";

import { Save, Trash2, QrCode, Loader2, FileText } from "lucide-react";
import { Skeleton, SkeletonInvoiceCard, SkeletonInvoiceHeader, SkeletonInvoiceRow, SkeletonSummary } from "@/shared/ui/skeleton";

import { generatePixPayload, getQrCodeDataUrl } from "@/shared/utils/pix";
import PixService, { pixConfigurado, type ConfigPix } from "@/features/config/services/pix.service";
import useAuth from "@/features/auth/store/auth.store";
import useClientes from "@/features/clientes/store/cliente.store";
import { maskPhone } from "@/shared/validation/masks";
import { formatDocument } from "@/shared/utils/format";
import PagamentoForm from "@/shared/ui/PagamentoForm";

const gerarUID = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

type InvoiceProps = {
  id?: string;
  clienteId?: string;
  nome?: string;
  onSaved?: () => void;
  /** Modo orçamento: a mesma nota, mas com título "Orçamento", sem pagamento
      e com "Gerar orçamento" no lugar de "Gerar Nota". */
  modoOrcamento?: boolean;
  /**
   * Itens com que a nota já nasce — usado por quem vem de um orçamento.
   *
   * É o que torna possível "converter em venda" e "editar orçamento" sem
   * relançar produto por produto: a nota abre com a proposta montada, e o
   * operador só confirma. Vale apenas para nota NOVA; havendo `id`, os itens
   * vêm do pedido salvo, que é a verdade.
   */
  itensIniciais?: ItemPedidoType[];
  /**
   * Orçamento que está sendo reescrito. Presente, "Gerar orçamento" salva por
   * cima em vez de criar uma segunda proposta com o mesmo conteúdo.
   */
  orcamentoId?: string;
};


const STATUS_STYLE: Record<string, string> = {
  ABERTO: "bg-warning/25 text-warning ring-warning/25",
  PENDENTE: "bg-warning/25 text-warning ring-warning/25",
  FECHADO: "bg-success/30 text-success ring-success/25",
  PAGO: "bg-success/30 text-success ring-success/25",
  CANCELADO: "bg-danger/25 text-danger ring-danger/25",
};



const Invoice = ({ id: idInicial, clienteId, nome, onSaved, modoOrcamento = false, itensIniciais, orcamentoId }: InvoiceProps) => {
  const alert = useAlert();
  const notaRef = useRef<HTMLDivElement>(null);

  /* O id começa na prop (nota existente) e pode nascer aqui dentro: ao criar
     uma nota nova, o `setPedidoId` é preenchido com o id devolvido pela API —
     a nota continua aberta para o pagamento sem recarregar a tela. */
  const [pedidoId, setPedidoId] = useState<string | undefined>(idInicial);
  const id = pedidoId;

  /* ─── Quem vende e para quem ─── */
  const { user } = useAuth();
  const clientes = useClientes((s) => s.clientes);
  const enterprise = useEnterprise((s) => s.enterprise);

  /** O vendedor da nota é quem está logado emitindo-a. */
  const vendedor = user?.nome || user?.email || "—";

  /**
   * O pedido só traz o nome do cliente; o telefone mora no cadastro. Pega do
   * que já está carregado em memória — sem disparar requisição para a nota.
   */
  /* Documento e e-mail vêm do cadastro já carregado — sem requisição a mais
     só para enriquecer a nota. */
  const clienteCadastro = clientes.find((c) => c.id === clienteId);

  const documentoCliente = clienteCadastro?.cpfCnpj ? formatDocument(String(clienteCadastro.cpfCnpj)) : "";
  const emailCliente = clienteCadastro?.contato?.email ?? "";

  const telefoneCliente = (() => {
    const alvo = clientes.find((c) => c.id === clienteId);
    const contato = alvo?.contato;
    const numero = contato?.celular || contato?.whatsapp || contato?.telefone || "";
    return numero ? maskPhone(String(numero)) : "";
  })();

  /* ─── Loading states ─── */
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [loadingPedido, setLoadingPedido] = useState(!!idInicial);
  const [savingNote, setSavingNote] = useState(false);

  /* ─── Dados ─── */
  const [products, setProducts] = useState<ProductType[]>([]);
  const [pedido, setPedido] = useState<PedidoClienteType | null>(null);

  /* Nota nova pode nascer com itens (veio de um orçamento). Nota existente
     ignora: os itens dela são carregados do pedido logo abaixo. */
  const [itens, setItens] = useState<ItemPedidoType[]>(() => (idInicial ? [] : (itensIniciais ?? [])));

  /** Data de emissão ao lado do vendedor: quem fez e quando, na mesma leitura. */
  const dataEmissao = formatDate(pedido?.pedido?.dataPedido ?? new Date());

  const [valorPagoAnterior, setValorPagoAnterior] = useState(0);
  const [confirmandoPagamento, setConfirmandoPagamento] = useState(false);


  /* ─── UI state ─── */
  const [tipoPagamento, setTipoPagamento] = useState("");
  const [valorPagamento, setValorPagamento] = useState(0);

  /* Logo depois de salvar, o pagamento é o próximo passo: o aside ganha um
     anel de destaque para quem paga "depois de salvar" saber que a nota está
     pronta e o que falta é receber. */
  const [focarPagamento, setFocarPagamento] = useState(false);

  /* Quanto do total o QR vai cobrar. 100 = tudo. Serve para entrada/sinal:
     o cliente paga metade agora e o resto na entrega. */
  const [percentual, setPercentual] = useState(100);
  const [percentualLivre, setPercentualLivre] = useState("");
  const [qrCodeNota, setQrCodeNota] = useState("");
  const [modalCancelar, setModalCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  /* ─── PIX ───
     A configuração é da EMPRESA e vem do servidor. A nota só lê: quem
     configura é o usuário master, em Configurações → Empresa. */
  const [configPix, setConfigPix] = useState<ConfigPix | null>(null);

  const pixConfig = pixConfigurado(configPix);

  /* ─── Carrega config PIX salva ─── */
  useEffect(() => {
    PixService.consultar().then(setConfigPix);
  }, []);

  /* ─── Carrega produtos ─── */
  useEffect(() => {
    ProductService.getAll()
      .then(({ data }) => setProducts(data.data ?? []))
      .catch((err) => alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível carregar os produtos.")))
      .finally(() => setLoadingProdutos(false));
  }, []);

  /* ─── Carrega pedido ─── */
  useEffect(() => {
    if (!id) return;

    NoteService.getById(id)
      .then((pedidoData) => {
        if (!pedidoData) {
          alert.error("Pedido não encontrado", "Não localizamos esse pedido no sistema.");
          return;
        }
        setPedido(pedidoData);
        setValorPagoAnterior(Number(pedidoData.pedido.valorPago ?? 0));

        const itensOriginais = pedidoData.pedido.itensPedido ?? [];
        setItens(itensOriginais.map((item: ItemPedidoType) => ({ ...item })));
      })
      .catch((err) => alert.error(getErrorTitle(err), extractErrorMessage(err, "Erro ao carregar o pedido.")))
      .finally(() => setLoadingPedido(false));
  }, [id]);

  /* ─── Produtos ─── */
  const adicionarProduto = (produtoHandle: ProductType) => {
    setItens((prev) => {
      // Mesmo produto já está na nota → soma a quantidade na linha existente
      // em vez de criar uma segunda linha (duas linhas do mesmo produto
      // quebravam a edição/remoção da nota no backend).
      const existente = prev.find((l) => l.produto.produtoId === produtoHandle.id);
      if (existente) {
        return prev.map((l) => (l.produto.produtoId === produtoHandle.id ? { ...l, quantidadeItem: l.quantidadeItem + 1 } : l));
      }

      return [
        ...prev,
        {
          itemPedidoId: gerarUID(),
          quantidadeItem: 1,
          valorVendaItem: produtoHandle.valorVenda,
          produto: {
            nomeProduto: produtoHandle.nome,
            produtoId: produtoHandle.id,
            valorProduto: produtoHandle.valorVenda,
          },
        },
      ];
    });
    alert.toast("success", "Produto adicionado!", undefined, { position: "bottom-right", timer: 2000 });
  };

  const atualizarLinha = (uid: string, patch: Partial<ItemPedidoType>) => setItens((prev) => prev.map((l) => (l.itemPedidoId === uid ? { ...l, ...patch } : l)));

  const removerProduto = (uid: string) => setItens((prev) => prev.filter((l) => l.itemPedidoId !== uid));

  /* ─── Totais ─── */
  const totalLiquido = useMemo(() => itens.reduce((acc, l) => acc + l.valorVendaItem * l.quantidadeItem, 0), [itens]);
  const totalBruto = useMemo(() => itens.reduce((acc, l) => acc + l.produto.valorProduto * l.quantidadeItem, 0), [itens]);
  const totalDesconto = Math.max(totalBruto - totalLiquido, 0);
  const total = totalLiquido;
  const temDesconto = totalDesconto > 0 && totalBruto > 0;

  /* Não há mais "pago nesta sessão": todo recebimento vai direto ao servidor
     e a nota é relida em seguida. O que o banco diz é o que a tela mostra —
     sem um segundo total local para divergir dele. */
  const totalPago = valorPagoAnterior;
  const pendente = Math.max(total - totalPago, 0);
  const formaPagamento = pedido?.pedido?.formaPagamento ?? "Não consta";

  /* Nota quitada: é o que libera o recibo. Comparado por valor, e não pelo
     status do pedido — nota fechada com pagamento parcial não deve emitir
     comprovante de quitação. */
  const quitada = Boolean(id) && total > 0 && totalPago >= total;

  /* ─── PIX payload ─── */
  /* O QR cobra o percentual escolhido, não necessariamente o total. */
  const valorCobranca = useMemo(() => Math.round(total * (percentual / 100) * 100) / 100, [total, percentual]);

  const pixPayload = useMemo(() => {
    if (!pixConfigurado(configPix) || valorCobranca <= 0) return "";
    return generatePixPayload({
      pixKey: configPix!.chave,
      pixKeyType: configPix!.tipoChave,
      merchantName: configPix!.beneficiario,
      merchantCity: configPix!.cidade,
      amount: valorCobranca,
      transactionId: id || `nota-${Date.now()}`,
      description: "Nota de venda",
    });
  }, [valorCobranca, id, configPix]);

  /* Data URI: é isso que faz o QR sair no PNG do download — imagem externa
     contaminaria o canvas e derrubaria a exportação inteira. */
  useEffect(() => {
    if (!pixPayload) {
      setQrCodeNota("");
      return;
    }

    let vivo = true;
    getQrCodeDataUrl(pixPayload).then((url) => vivo && setQrCodeNota(url));

    return () => {
      vivo = false;
    };
  }, [pixPayload]);


  /* ─── Nota CRUD ─── */
  const montarItens = () =>
    itens.map((item) => ({
      produtoId: item.produto.produtoId,
      quantidade: item.quantidadeItem,
      valorVenda: item.valorVendaItem
    }));

  const handleGerarOrcamento = async () => {
    const nomeCliente = (nome ?? "").trim();

    if (!nomeCliente) {
      alert.warning("Informe o cliente", "O orçamento precisa saber para quem é.");
      return;
    }

    if (itens.length === 0) {
      alert.warning("Sem produtos", "Adicione ao menos um produto ao orçamento.");
      return;
    }

    setSavingNote(true);

    try {
      const proposta = {
        clienteNome: nomeCliente,
        clienteId: clienteId ?? null,
        clienteContato: telefoneCliente || null,
        itens: itens.map((l) => ({
          produtoId: String(l.produto.produtoId ?? "") || null,
          nomeProduto: l.produto.nomeProduto,
          quantidade: l.quantidadeItem,
          valorUnitario: l.valorVendaItem,
        })),
      };

      /* Editando: salva por cima. Sem isso, corrigir a quantidade de um item
         deixaria duas propostas quase idênticas na lista, e o cliente com
         duas versões do mesmo orçamento. */
      if (orcamentoId) {
        await OrcamentoService.atualizar(orcamentoId, proposta);
        alert.success("Orçamento atualizado!", "A proposta foi reescrita e continua aguardando resposta.");
      } else {
        await OrcamentoService.criar(proposta);
        alert.success("Orçamento gerado!", "Ele está na aba Orçamentos, aguardando a resposta do cliente.");
      }

      onSaved?.();
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível gerar o orçamento."));
    } finally {
      setSavingNote(false);
    }
  };

  const handleSalvar = async () => {
    if (!clienteId) {
      alert.warning("Sem cliente", "Selecione um cliente para emitir a nota.");
      return;
    }
    if (itens.length === 0) {
      alert.warning("Nota vazia", "Adicione ao menos um produto à nota.");
      return;
    }
    if (itens.every((l) => l.quantidadeItem <= 0)) {
      alert.warning("Quantidade inválida", "Informe a quantidade dos produtos.");
      return;
    }

    /* Sem exigir Pix para salvar.
       Antes a primeira nota travava até configurar a chave — mas venda em
       dinheiro ou cartão não depende de Pix, e o vendedor não pode nem
       configurar (é do usuário master). Ele ficava preso sem saída. Sem chave,
       a nota simplesmente sai sem QR. */

    setSavingNote(true);
    try {
      if (id) {
        // UPDATE — usa PedidoUpdateDto. Atenção: esse endpoint lê `produtosPedido`,
        // não `itensPedido`.
        const payload: PedidoUpdateDto = { clienteId, produtosPedido: montarItens() };
        await NoteService.update(payload, id);

        // Não há pagamento pendente a gravar junto: registrar já grava direto
        // no servidor, então salvar a nota cuida só dos itens.
        alert.success("Nota alterada!", "As alterações foram salvas com sucesso.");
      } else {
        // CREATE — usa NovoPedidoDto. A nota criada NÃO fecha a tela: quem
        // paga "depois de salvar" precisa da nota aberta para registrar o
        // pagamento na sequência. O id novo mantém a nota em modo edição.
        const payload: NovoPedidoDto = { clienteId, itensPedido: montarItens() };
        const criada = await NoteService.create(payload);

        const novoId = criada?.data?.data?.[0] as string | undefined;

        if (novoId) setPedidoId(novoId);
        setFocarPagamento(true);
        alert.success("Nota criada!", "A venda foi registrada. Agora registre o pagamento.");
      }

      // Pagamentos acumulados seguem gravados (update) ou prontos (create).
      // Só fecha a tela quando o usuário decide fechar — não ao salvar.
      if (id) onSaved?.();
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Erro ao salvar a nota. Tente novamente."));
    } finally {
      setSavingNote(false);
    }
  };

  /**
   * Cancela a nota — não apaga.
   *
   * Venda errada precisa sumir da operação, mas não da história: o cliente
   * lembra do pedido que fez e alguém vai ter que explicar o que aconteceu.
   * Apagar do banco não deixa o que explicar. Cancelada, a nota mantém itens,
   * valor e data, e some da lista de notas ativas.
   *
   * O servidor recusa cancelar nota paga (dinheiro que entrou sai pelo
   * financeiro, com estorno) — a mensagem dele chega pronta para o balcão.
   */
  const handleCancelar = async () => {
    if (!id) return;

    setCancelando(true);

    try {
      await NoteService.cancelar(id);
      setModalCancelar(false);
      alert.success("Nota cancelada!", "Ela sai das notas ativas, mas continua no histórico.");
      onSaved?.();
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível cancelar a nota."));
    } finally {
      setCancelando(false);
    }
  };

  /* Recebe valor e forma por parâmetro: o formulário compartilhado tem o
     próprio estado, e depender do estado desta tela criava um render de
     atraso — o primeiro clique lançava o valor anterior. */
  /**
   * Registra o pagamento e volta para a nota — uma etapa só.
   *
   * Antes eram duas: "Adicionar pagamento" empilhava numa lista de pendentes
   * e um segundo botão "Confirmar" é que gravava. A separação existia para
   * lançar "50 no Pix e 30 em dinheiro" como um recebimento só, mas cobrava
   * dois cliques de todo mundo para atender o caso raro — e deixava o caso
   * comum com um pagamento na tela que parecia gravado e não estava.
   *
   * Agora cada recebimento vai direto ao servidor. Pagamento misto continua
   * possível: são dois lançamentos em vez de um, o que é mais fiel ao que
   * aconteceu no balcão.
   */
  const handleAdicionarPagamento = async (valorRecebido?: number, formaRecebida?: string) => {
    const valorFinal = valorRecebido ?? valorPagamento;
    const tipoFinal = formaRecebida ?? tipoPagamento;

    if (!tipoFinal || valorFinal <= 0) return;
    if (!id) {
      alert.warning("Salve a nota primeiro", "A nota precisa ser salva antes de registrar pagamentos.");
      return;
    }

    setConfirmandoPagamento(true);

    try {
      await FinanceiroService.registrarPagamentoNota(id, valorFinal, tipoFinal);

      const pedidoAtualizado = await NoteService.getById(id);

      if (pedidoAtualizado) {
        setPedido(pedidoAtualizado);
        setValorPagoAnterior(Number(pedidoAtualizado.pedido.valorPago ?? 0));
      }

      setTipoPagamento("");
      setValorPagamento(0);
      /* O destaque "nota salva — registre o pagamento" já cumpriu o papel. */
      setFocarPagamento(false);

      alert.success("Pagamento registrado!", "O valor foi somado ao pagamento da nota.");

    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível registrar o pagamento."));
    } finally {
      setConfirmandoPagamento(false);
    }
  };

  const statusPedido = pedido?.pedido?.pedidoStatus;

  /*
   * O que trava o botão muda conforme o documento.
   *
   * Nota exige cliente CADASTRADO: ela vira pedido, e pedido sem cliente não
   * tem a quem cobrar. Orçamento não — ele é montado para nome livre, digitado
   * no PDV, justamente para propor a quem ainda não é cliente.
   *
   * Enquanto os dois compartilhavam a mesma regra, o "Gerar orçamento" nascia
   * desabilitado para sempre: o fluxo do PDV abre a proposta sem `clienteId`,
   * então a condição nunca era satisfeita e o clique não fazia nada. Era esse
   * o "não consigo cadastrar o orçamento".
   */
  const semDestinatario = modoOrcamento ? !(nome ?? "").trim() : !clienteId;

  const salvarDesabilitado = semDestinatario || itens.length === 0;

  /* ─── Classes repetidas ─── */
  const lblResumo = "block text-[11px] uppercase tracking-[0.08em] text-faint";
  const valResumo = "mt-1 block truncate text-sm text-ink";

  return (
    <div className="flex h-full flex-col">


      {/* ════════════ MODAL: PAGAMENTOS ════════════ */}

      {/* ════════════ MODAL: CANCELAR ════════════ */}
      <Modal open={modalCancelar} onClose={() => setModalCancelar(false)} title="Cancelar nota" subtitle="A nota sai da operação, mas fica no histórico" accent="rgb(var(--danger))" maxWidth="max-w-sm">
        <p className="text-sm leading-relaxed text-mist">
          A nota deixa de contar como venda ativa e passa a aparecer como <span className="text-danger">cancelada</span>. Itens, valores e data continuam registrados.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalCancelar(false)} className="h-10 rounded-xl bg-fg/[0.05] px-4 text-sm text-ink transition-colors hover:bg-fg/[0.1]">
            Voltar
          </button>
          <button
            onClick={handleCancelar}
            disabled={cancelando}
            className="flex h-10 items-center gap-2 rounded-xl bg-danger px-4 text-sm text-white transition-colors hover:brightness-110 disabled:opacity-50"
          >
            {cancelando && <Loader2 size={15} className="animate-spin" />}
            Cancelar nota
          </button>
        </div>
      </Modal>

      {/* ════════════ NOTA ════════════ */}
      <div className="flex h-full min-h-0 overflow-hidden rounded-2xl bg-surface ring-1 ring-fg/[0.06]">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fg/[0.05] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {loadingPedido ? (
              <Skeleton className="h-5 w-24 rounded-full" />
            ) : statusPedido ? (
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] tracking-wide ring-1 ${STATUS_STYLE[statusPedido] ?? "bg-fg/[0.05] text-mist"}`}>{statusPedido}</span>
            ) : modoOrcamento ? (
              <span className="inline-flex items-center rounded-full bg-warning/[0.15] px-3 py-1 text-[11px] text-warning ring-1 ring-warning/30">PROPOSTA</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-accent/[0.12] px-3 py-1 text-[11px] text-accent-soft ring-1 ring-accent/25">NOVA NOTA</span>
            )}
          </div>

          {/* Cancelar fica no canto oposto ao status: são as duas pontas da
              vida da nota — em que pé ela está, e como encerrá-la. Longe do
              "Salvar" do rodapé, também, para não errar o alvo com pressa. */}
          {!modoOrcamento && id && (
            <button
              title="Cancelar nota"
              aria-label="Cancelar nota"
              onClick={() => setModalCancelar(true)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-danger/20 hover:text-danger"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {/* Conteúdo da nota (capturado no PNG) */}
        <div className="flex-1 overflow-y-auto">
          {/* Largura limitada e centralizada.
              Sem teto, a nota acompanhava o monitor: em tela larga, o nome do
              cliente ficava a meia tela do valor, e a tabela de itens virava
              linhas com um vão enorme no meio. 900px é o suficiente para as
              cinco colunas de item sem espalhar. */}
          <div ref={notaRef} className="relative mx-auto flex w-full max-w-[900px] flex-col overflow-hidden bg-surface">
            {/* Wallpaper da nota: imagem de fundo com overlay translúcido —
                bonito e transparente, com o conteúdo legível por cima. Entra
                no PNG/PDF porque faz parte do nó rasterizado. */}
            <FundoNota imagem={enterprise?.notaBackground} />

            <div className="relative flex flex-col">
            {/* Cabeçalho */}
            <div className="border-b border-fg/[0.05] p-6">
              {loadingPedido ? (
                <SkeletonInvoiceHeader />
              ) : (
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <HeaderInterprise />
                  <div className="md:text-right">
                    <h2 className="text-xl leading-none text-ink md:text-2xl">{modoOrcamento ? "ORÇAMENTO" : "Nota de Venda"}</h2>
                    <p className="mt-1.5 text-sm text-mist">Data: {formatDate(pedido?.pedido?.dataPedido ?? new Date())}</p>
                  </div>
                </div>
              )}
            </div>

            {/*
             * Identificação empilhada à esquerda, QR à direita.
             *
             * Antes cliente e telefone dividiam a linha e o QR ficava lá
             * embaixo, no fim da nota. Quem recebe a foto pelo WhatsApp lê de
             * cima para baixo e para no primeiro bloco: pôr o código de
             * pagamento ao lado de para-quem-é resolve a nota num olhar.
             */}
            <div className="flex flex-col gap-6 px-6 pt-6 sm:flex-row sm:items-start sm:gap-8">
              {/*
               * Lista compacta, não três caixas de formulário.
               *
               * Eram campos de 44px com moldura e fundo — pareciam editáveis
               * sem ser, e sozinhos ocupavam mais altura que o QR ao lado. Numa
               * nota isto é dado impresso: rótulo pequeno, valor legível, uma
               * linha fina separando. Ganha-se metade da altura e a leitura
               * melhora.
               */}
              {/*
               * Sem moldura: o que separa as linhas é espaço, não borda.
               *
               * Caixa dentro de caixa dentro do cartão da nota empilha três
               * contornos na mesma região e faz a leitura pesar. Retirando a
               * borda e abrindo o respiro, os mesmos dados ocupam a mesma
               * largura e a nota fica mais limpa — que é o que uma nota deve
               * parecer: papel, não formulário.
               */}
              {/* Sem ícone. Numa nota, o que o cliente lê é o dado — o símbolo
                  ao lado do rótulo era ruído numa peça que já tem pouco espaço
                  e vai impressa. */}
              <dl className="flex min-w-0 flex-1 flex-col gap-3.5">
                {[
                  { rotulo: "Cliente", valor: pedido?.nomeCliente || nome || "—", extra: documentoCliente },
                  { rotulo: "Telefone", valor: telefoneCliente || "Não informado", extra: emailCliente },
                  { rotulo: "Vendedor", valor: vendedor, extra: dataEmissao },
                ].map((linha) => (
                  <div key={linha.rotulo} className="min-w-0">
                    <dt className="text-[10.5px] uppercase tracking-[0.1em] text-faint">{linha.rotulo}</dt>
                    <dd className="mt-0.5 min-w-0 truncate text-[14.5px] leading-snug text-ink">{loadingPedido ? <Skeleton className="h-4 w-40" /> : linha.valor}</dd>
                    {linha.extra && !loadingPedido && <dd className="truncate text-[11.5px] text-faint">{linha.extra}</dd>}
                  </div>
                ))}
              </dl>

              {/* Orçamento não cobra: a coluna do QR (e os controles de Pix)
                  só existe na nota de venda. */}
              {!modoOrcamento && (
              <>
              {/*
               * A coluna do QR existe sempre.
               *
               * Antes ela era condicionada ao `pixPayload`: sem chave Pix
               * cadastrada o bloco inteiro sumia, e quem abria a nota achava que
               * o QR tinha quebrado. Agora o espaço fica lá e diz o motivo — que
               * quase sempre é chave não configurada, coisa que só o usuário
               * master resolve.
               */}
              <div className="flex shrink-0 flex-col items-center gap-2 sm:w-[176px]">
                {pixPayload ? (
                  <>
                    <div className="overflow-hidden rounded-2xl border border-fg/[0.08] bg-white p-2.5">
                      {qrCodeNota ? <img src={qrCodeNota} alt="QR Code para pagamento via Pix" className="h-[144px] w-[144px] rounded-lg" /> : <div className="h-[144px] w-[144px] animate-pulse rounded-lg bg-fg/[0.06]" />}
                    </div>

                    <span className="text-[10.5px] text-faint">Pix · {formatCurrency(valorCobranca)}</span>
                  </>
                ) : (
                  /* Aviso de configuração é para quem atende, não para o cliente:
                     fica fora da foto. */
                  <div data-sem-foto className="flex h-[167px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-fg/[0.12] px-3 text-center">
                    <QrCode size={22} className="text-faint" />
                    <p className="text-[11px] leading-relaxed text-mist">
                      {pixConfig ? "O QR aparece quando a nota tiver valor." : "Chave Pix não cadastrada."}
                    </p>
                    {!pixConfig && <p className="text-[10.5px] leading-relaxed text-faint">Configurações → Empresa (só o usuário master).</p>}
                  </div>
                )}

                  {/*
                   * Atalhos de cobrança parcial.
                   *
                   * `data-sem-foto` mantém isto FORA do PNG: é ferramenta de
                   * quem atende, não informação do cliente. Na foto sai só o QR
                   * e o valor que ele deve pagar — ver o botão "50%" numa nota
                   * levantaria a pergunta errada na hora errada.
                   */}
                {pixPayload && (
                  /*
                   * Uma linha só, não um bloco empilhado.
                   *
                   * Eram dois botões numa linha e o campo livre em outra: isso
                   * esticava a coluna do QR muito além da altura dos detalhes
                   * ao lado, e a sobra virava o vazio que incomodava. Os três
                   * controles cabem lado a lado — são curtos por natureza.
                   *
                   * `data-sem-foto`: ferramenta de quem atende, fora do PNG.
                   */
                  <div data-sem-foto className="flex w-full items-stretch gap-1 text-[11px]">
                    {[100, 50].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setPercentual(p);
                          setPercentualLivre("");
                        }}
                        className={`flex-1 rounded-md border py-1 transition-colors ${
                          percentual === p && !percentualLivre ? "border-accent bg-accent text-white" : "border-fg/[0.1] text-mist hover:text-ink"
                        }`}
                      >
                        {p === 100 ? "Total" : "50%"}
                      </button>
                    ))}

                    <div className={`flex w-[52px] shrink-0 items-center rounded-md border px-1 ${percentualLivre ? "border-accent" : "border-fg/[0.1]"}`}>
                      <input
                        value={percentualLivre}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                          setPercentualLivre(v);

                          const n = Number(v);
                          if (n > 0 && n <= 100) setPercentual(n);
                          else if (!v) setPercentual(100);
                        }}
                        inputMode="numeric"
                        placeholder="—"
                        aria-label="Percentual personalizado"
                        className="w-full bg-transparent py-1 text-center text-ink outline-none placeholder:text-faint"
                      />
                      <span className="text-faint">%</span>
                    </div>
                  </div>
                )}
              </div>
              </>
              )}
            </div>

            {/*
              Busca logo acima da tabela, não dentro dela.

              Como célula, a lista de sugestões era engolida pelo
              `overflow-hidden` do quadro da tabela: as opções existiam no DOM e
              nunca apareciam na tela. Aqui a lista tem para onde crescer.

              Largura contida (`max-w-md`): o campo recebe um nome de produto,
              não um parágrafo — esticado na largura da nota ele virava uma
              faixa vazia atravessando a tela.

              `data-sem-foto`: é ferramenta de quem atende, não informação do
              cliente — fica de fora do PNG.
            */}
            <div data-sem-foto className="hidden px-6 pt-6 md:block">
              <div className="max-w-md">
                <BuscaProduto produtos={products} carregando={loadingProdutos} onAdicionar={adicionarProduto} />
              </div>
            </div>

            {/* Tabela de itens */}
            <div className="hidden px-6 pt-3 md:block">
              {/* Sem altura máxima e sem rolagem própria aqui. O teto de 42vh
                  cortava a tabela pela metade na tela e, no download, capturava
                  só a parte visível — nota com muitos itens saía truncada. Quem
                  rola é o container da nota, um nível acima. */}
              <div className="overflow-hidden rounded-xl border border-fg/[0.06]">
                <div>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-surface-raised">
                      <tr className="border-b border-fg/[0.06] text-[11px] uppercase tracking-[0.08em] text-faint">
                        <td className="px-3 py-2.5 text-left">Produto</td>
                        <td className="px-3 py-2.5 text-left">Qtde</td>
                        <td className="px-3 py-2.5 text-left">V. Unit</td>
                        <td className="px-3 py-2.5 text-left">Subtotal</td>
                        <td className="px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-fg/[0.05]">
                      {loadingPedido ? (
                        Array.from({ length: 4 }).map((_, i) => <SkeletonInvoiceRow key={i} />)
                      ) : itens.length > 0 ? (
                        itens.map((item) => (
                          <tr key={item.itemPedidoId} className="transition-colors hover:bg-fg/[0.03]">
                            <td className="max-w-[280px] p-2 align-middle">
                              <p className="truncate px-1 text-ink" title={item.produto.nomeProduto}>
                                {item.produto.nomeProduto}
                              </p>
                            </td>
                            <td className="p-2 align-middle">
                              <input
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={item.quantidadeItem}
                                onChange={(e) => atualizarLinha(item.itemPedidoId, { quantidadeItem: Math.max(0, Number(e.target.value) || 0) })}
                                /* Número menor que o texto da linha: a caixa continua
                                   com alvo de toque confortável, mas o valor para de
                                   competir com o nome do produto. */
                                className="h-9 w-16 rounded-lg border border-fg/[0.06] bg-fg/[0.03] px-2 text-center text-[12.5px] tabular-nums text-ink outline-none focus:border-accent/60"
                              />
                            </td>
                            <td className="p-2 align-middle">
                              <div className="flex items-center gap-1.5">
                                <MoneyInput value={item.valorVendaItem} onChange={(v) => atualizarLinha(item.itemPedidoId, { valorVendaItem: v })} className="h-9 w-24 rounded-lg border border-fg/[0.06] bg-fg/[0.03] px-2 text-center text-[12.5px] tabular-nums text-ink outline-none focus:border-accent/60" />
                                {item.valorVendaItem !== item.produto.valorProduto && <span className="text-[10px] text-mist line-through">{formatCurrency(item.produto.valorProduto)}</span>}
                              </div>
                            </td>
                            <td className="p-2 align-middle">
                              <p className="flex h-9 items-center rounded-lg bg-fg/[0.03] px-3 text-[12.5px] tabular-nums text-ink">{formatCurrency(item.valorVendaItem * item.quantidadeItem)}</p>
                            </td>
                            <td className="p-2 text-center align-middle">
                              <button title="Remover" onClick={() => removerProduto(item.itemPedidoId)} className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-danger/25 hover:text-danger">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-mist">
                            <p className="text-sm">Nenhum produto na nota</p>
                            <p className="mt-2 text-[12px] text-faint">Use a busca acima para adicionar produtos.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Mobile — busca de produtos, fora da foto da nota */}
            <div data-sem-foto className="px-6 pt-5 md:hidden">
              <BuscaProduto produtos={products} carregando={loadingProdutos} onAdicionar={adicionarProduto} />
            </div>

            {/* Mobile */}
            <div className="space-y-3 px-6 pt-6 md:hidden">
              {loadingPedido ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonInvoiceCard key={i} />)
              ) : itens.length > 0 ? (
                itens.map((item) => (
                  <div key={item.itemPedidoId} className="rounded-xl border border-fg/[0.06] bg-fg/[0.03] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-sm text-ink">{item.produto.nomeProduto}</p>
                      <button onClick={() => removerProduto(item.itemPedidoId)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-danger/20 text-danger">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-mist">Qtde</label>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={item.quantidadeItem}
                          onChange={(e) => atualizarLinha(item.itemPedidoId, { quantidadeItem: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-10 w-full rounded-lg border border-fg/[0.06] bg-fg/[0.03] px-2 text-center tabular-nums text-ink outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-mist">V. Unit</label>
                        <div className="flex items-center gap-1.5">
                          <MoneyInput value={item.valorVendaItem} onChange={(v) => atualizarLinha(item.itemPedidoId, { valorVendaItem: v })} className="h-10 w-full rounded-lg border border-fg/[0.06] bg-fg/[0.03] px-2 text-center tabular-nums text-ink outline-none" />
                          {item.valorVendaItem !== item.produto.valorProduto && <span className="text-[10px] text-mist line-through">{formatCurrency(item.produto.valorProduto)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-fg/[0.03] px-3 py-2">
                      <span className="text-xs text-mist">Subtotal</span>
                      <span className="text-sm tabular-nums text-ink">{formatCurrency(item.valorVendaItem * item.quantidadeItem)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-fg/[0.12] py-10 text-center text-sm text-mist">Nenhum produto</div>
              )}
              {!loadingPedido && itens.length === 0 && (
                <p className="py-2 text-center text-[12px] text-faint">Use a busca acima para adicionar produtos.</p>
              )}
            </div>

            {/* Resumo */}
            <div className="p-5">
              {loadingPedido ? (
                <SkeletonSummary />
              ) : (
                <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${modoOrcamento ? "" : "lg:grid-cols-6"}`}>
                  <div className="rounded-xl border border-fg/[0.06] bg-fg/[0.03] p-3">
                    <span className={lblResumo}>T. Bruto</span>
                    <span className={`${valResumo} tabular-nums`}>{formatCurrency(totalBruto)}</span>
                  </div>
                  <div className={`rounded-xl border p-3 ${temDesconto ? "border-warning/20 bg-warning/[0.12]" : "border-fg/[0.06] bg-fg/[0.03]"}`}>
                    <span className={`${lblResumo} ${temDesconto ? "text-warning" : "text-faint"}`}>Desconto</span>
                    <span className={`mt-1 block truncate text-sm tabular-nums ${temDesconto ? "text-warning" : "text-ink"}`}>{temDesconto ? `- ${formatCurrency(totalDesconto)}` : formatCurrency(0)}</span>
                  </div>
                  <div className="rounded-xl border border-fg/[0.06] bg-fg/[0.03] p-3">
                    <span className={lblResumo}>T. Líquido</span>
                    <span className={`${valResumo} tabular-nums`}>{formatCurrency(totalLiquido)}</span>
                  </div>

                  {/* Pagamento não existe em orçamento — só na nota de venda. */}
                  {!modoOrcamento && (
                    <>
                      <div className="rounded-xl border border-fg/[0.06] bg-fg/[0.03] p-3">
                        <span className={lblResumo}>T. Pago</span>
                        <span className={`${valResumo} tabular-nums`}>{formatCurrency(totalPago)}</span>
                      </div>
                      {/* Virou informação, não botão: o pagamento agora está sempre
                          visível na coluna ao lado — não há mais o que abrir. */}
                      <div className={`rounded-xl border p-3 ${pendente > 0 ? "border-warning/20 bg-warning/[0.12]" : "border-success/20 bg-success/[0.12]"}`}>
                        <span className={`${lblResumo} ${pendente > 0 ? "text-warning" : "text-success"}`}>Pendente</span>
                        <span className={`mt-1 block truncate text-sm tabular-nums ${pendente > 0 ? "text-warning" : "text-success"}`}>{formatCurrency(pendente)}</span>
                      </div>
                      <div className="rounded-xl border border-fg/[0.06] bg-fg/[0.03] p-3">
                        <span className={lblResumo}>F. Pagamento</span>
                        <span className={valResumo}>{formaPagamento}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* O copia-e-cola do Pix saiu daqui.
                Era um bloco largo com o código inteiro quebrado em várias
                linhas — ocupava mais altura que o resumo da venda para uma
                ação que quase ninguém usa: no balcão, o cliente aponta a câmera
                para o QR. Quem paga pelo computador escaneia pelo celular
                assim mesmo. */}
            </div>
          </div>
        </div>

        {/* Footer */}
        {/* No celular o total e os dois botões não cabiam lado a lado: "Pagamento"
            com o valor pendente mais "Gerar Nota" estouravam os 390px. Aqui o
            rodapé empilha — total em cima, botões dividindo a linha de baixo —
            e a partir de `sm` volta a ser uma linha só. */}
        <footer
          className="flex flex-col gap-3 border-t border-fg/[0.06] bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="min-w-0">
            <span className={lblResumo}>Total da nota</span>
            {loadingPedido ? <Skeleton className="mt-1 h-7 w-32" /> : <span className="block truncate text-xl tabular-nums text-ink md:text-2xl">{formatCurrency(total)}</span>}
          </div>

          <div className="flex items-center gap-2">
            {/* Download da nota (PNG ou PDF), com o nome da empresa no arquivo. */}
            <MenuDownloadNota refNota={notaRef} nomeEmpresa={enterprise?.nomeFantasia ?? "nota"} prefixo={modoOrcamento ? "orcamento" : "nota"} titulo={modoOrcamento ? "Baixar orçamento" : "Baixar nota"} />

            {/* Recibo: só depois de quitada. Antes disso não há o que
                comprovar, e um "recibo" de nota em aberto é um documento que
                afirma o que não aconteceu. */}
            {quitada && !modoOrcamento && (
              <BotaoRecibo
                dados={{
                  numero: String(pedido?.pedido?.pedidoId ?? id ?? "").slice(0, 8),
                  clienteNome: nome ?? "",
                  valor: totalPago,
                  formaPagamento,
                  pagoEm: pedido?.pedido?.dataPedido ? String(pedido.pedido.dataPedido) : null,
                }}
              />
            )}

            {/* Sem X aqui: o modal que envolve a nota já tem o próprio fechar
                no topo, e dois botões de fechar na mesma tela só criavam a
                dúvida de qual deles descarta a venda. Cancelar a nota mudou
                para a barra de cima, ao lado do status. */}

            {modoOrcamento ? (
              <button
                onClick={handleGerarOrcamento}
                disabled={salvarDesabilitado || savingNote || loadingPedido}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-warning px-5 text-sm text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 sm:flex-none"
              >
                {savingNote ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                {savingNote ? "Salvando..." : orcamentoId ? "Salvar orçamento" : "Gerar orçamento"}
              </button>
            ) : (
              <button
                onClick={handleSalvar}
                disabled={salvarDesabilitado || savingNote || loadingPedido}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm text-white transition-all hover:bg-accent-soft active:scale-[0.98] disabled:opacity-40 sm:flex-none"
              >
                {savingNote ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {savingNote ? "Salvando..." : !id ? "Gerar Nota" : "Salvar"}
              </button>
            )}
          </div>
        </footer>
        </div>

        {/*
         * Pagamentos na lateral, não em modal.
         *
         * Receber é conferência: quem lança olha o total da nota, o que já
         * entrou e o que falta ao mesmo tempo. O modal cobria justamente a nota
         * que se está conferindo, e obrigava a fechar e reabrir para checar um
         * item. Ao lado, os dois convivem.
         *
         * À ESQUERDA, com `order-first`: quem opera lê a nota da esquerda para
         * a direita e termina no total. Pôr o recebimento depois disso obrigava
         * o olho a voltar. Antes da nota, ele é o primeiro passo do fechamento.
         *
         * Some abaixo de `lg`: em tela estreita não há largura para duas
         * colunas, e lá o rodapé continua sendo o caminho.
         */}
        {/* Pagamento não existe em orçamento — a proposta não recebe. */}
        {!modoOrcamento && (
        <aside id="painel-pagamento" className={`order-first hidden w-[320px] shrink-0 flex-col border-r border-fg/[0.06] bg-fg/[0.02] lg:flex ${focarPagamento ? "ring-2 ring-inset ring-accent/50" : ""}`}>
          {/*
           * O cabeçalho mostra o que falta, em corpo grande.
           *
           * Era um rótulo de 12px dizendo "Recebimentos" — o nome da coluna, que
           * a pessoa já sabe por estar olhando para ela. O número que importa
           * é quanto ainda falta receber, e ele muda a cada lançamento: em
           * destaque, quem atende confere sem procurar.
           */}
          <header className="shrink-0 border-b border-fg/[0.06] px-4 py-4">
            <p className="text-[10.5px] uppercase tracking-[0.1em] text-faint">{pendente > 0 ? "Falta receber" : "Recebido"}</p>

            <motion.p
              key={pendente}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`mt-1 text-[26px] leading-none tracking-tight tabular-nums ${pendente > 0 ? "text-warning" : "text-success"}`}
            >
              {formatCurrency(pendente > 0 ? pendente : totalPago)}
            </motion.p>

            <p className="mt-1.5 text-[11px] text-faint">
              {statusPedido ? statusPedido.toLowerCase() : "nova nota"} · total {formatCurrency(total)}
            </p>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!id ? (
              <p className="rounded-xl border border-warning/30 bg-warning/[0.08] px-3.5 py-3 text-[12px] leading-relaxed text-warning">
                Salve a nota antes de registrar pagamentos.
              </p>
            ) : (
              <>
                {focarPagamento && (
                  <p className="mb-3 rounded-xl border border-accent/30 bg-accent/[0.1] px-3.5 py-2.5 text-[12px] leading-relaxed text-accent-soft">
                    Nota salva! Informe como o cliente pagou para quitar.
                  </p>
                )}

                <PagamentoForm
                  total={total}
                  jaPago={totalPago}
                  compacto
                  salvando={confirmandoPagamento}
                  textoConfirmar="Registrar pagamento"
                  onConfirmar={(valor, forma) => void handleAdicionarPagamento(valor, forma)}
                />
              </>
            )}

          </div>
        </aside>
        )}
      </div>
    </div>
  );
};

export default Invoice;
