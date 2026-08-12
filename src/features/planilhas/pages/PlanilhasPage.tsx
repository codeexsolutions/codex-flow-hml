import { useCallback, useEffect, useMemo, useState } from "react";

import useSincronizacao from "@/shared/realtime/useSincronizacao";
import { Table2, Plus, ChevronLeft, ChevronRight, Settings2, Trash2, X, Loader2, ArrowLeft, Copy, History } from "lucide-react";

import PlanilhaService, { type Alteracao, type Coluna, type Modelo, type Pagina, type Periodicidade, type Periodo, type TipoColuna } from "@/features/planilhas/services/planilha.service";
import { PageScreen } from "@/shared/ui/PageShell";
import { Modal } from "@/shared/ui/Modal";
import { useAlert } from "@/shared/ui/Alert";
import { extractErrorMessage, getErrorTitle } from "@/shared/utils/errorHandler";
import { ehGestor } from "@/features/vendas/components/TabsVendas";
import useAuth from "@/features/auth/store/auth.store";
import { SkeletonListaPainel } from "@/shared/ui/skeleton";
import Celula from "@/features/planilhas/components/Celula";
import useEquipeStore from "@/features/funcionarios/store/equipe.store";
import Presenca from "@/features/planilhas/components/Presenca";

const TIPOS: { id: TipoColuna; label: string }[] = [
  { id: "TEXTO", label: "Texto" },
  { id: "TEXTO_LONGO", label: "Texto longo" },
  { id: "NUMERO", label: "Número" },
  { id: "MOEDA", label: "Moeda" },
  { id: "DATA", label: "Data" },
  { id: "SELECAO", label: "Seleção" },
  { id: "CHECKBOX", label: "Sim/Não" },
  { id: "IMAGEM", label: "Imagem" },
  /* Coluna que puxa o cadastro de clientes em vez de aceitar texto livre.
     Digitado à mão, o mesmo cliente vira "Maria", "maria silva" e "Maria S." em
     três linhas, e a planilha deixa de somar por cliente. */
  { id: "CLIENTE", label: "Cliente" },
];

const PERIODICIDADES: { id: Periodicidade; label: string }[] = [
  { id: "DIARIA", label: "Diária" },
  { id: "SEMANAL", label: "Semanal" },
  { id: "MENSAL", label: "Mensal" },
];

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * Como cada evento do histórico se lê.
 *
 * O painel mostrava só "coluna: antes → depois", que serve para célula
 * alterada e fica sem sentido em "linha excluída" (sem coluna, sem valores) ou
 * "planilha renomeada" (sem linha). Cada ação ganha a frase que descreve o que
 * de fato aconteceu.
 */
function descreverEvento(h: Alteracao): { titulo: string; detalhe: string | null } {
  const de = h.valor_antes || "vazio";
  const para = h.valor_depois || "vazio";

  switch (h.acao) {
    case "LINHA_CRIADA":
      return { titulo: "Linha criada", detalhe: null };
    case "LINHAS_CRIADAS":
      return { titulo: `${h.valor_depois ?? ""} linhas criadas`.trim(), detalhe: null };
    case "LINHA_EXCLUIDA":
      return { titulo: "Linha excluída", detalhe: null };
    case "COLUNA_CRIADA":
      return { titulo: `Coluna criada: ${h.coluna_nome ?? ""}`.trim(), detalhe: h.valor_depois };
    case "COLUNA_REMOVIDA":
      return { titulo: `Coluna removida: ${h.coluna_nome ?? ""}`.trim(), detalhe: null };
    case "PLANILHA_RENOMEADA":
      return { titulo: "Planilha renomeada", detalhe: `${de} → ${para}` };
    case "PAGINA_RENOMEADA":
      return { titulo: "Página renomeada", detalhe: para };
    default:
      return { titulo: h.coluna_nome ?? "Alteração", detalhe: `${de} → ${para}` };
  }
}

/** Rótulo curto para a aba do rodapé: "3/8", "3–9/8", "agosto". */
function rotuloAba(de: string, periodicidade: Periodicidade | undefined): string {
  const d = new Date(`${de}T12:00:00`);

  if (periodicidade === "MENSAL") return MESES[d.getMonth()];
  if (periodicidade === "SEMANAL") return `sem. ${d.getDate()}/${d.getMonth() + 1}`;

  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Texto do servidor vira Date.
 *
 * Corta em 10 caracteres antes de montar: se algum campo voltar com carimbo
 * de hora ("2026-08-01T00:00:00.000Z"), concatenar "T12:00:00" produziria
 * Invalid Date — e o `iso()` dessa data gera a string "NaN-NaN-NaN", que segue
 * viagem até o banco e derruba a consulta com "invalid input syntax for type
 * date". Foi exatamente esse o caminho do erro. O meio-dia continua ali para a
 * data não escorregar um dia por causa de fuso.
 */
const doIso = (s: string) => new Date(`${String(s ?? "").slice(0, 10)}T12:00:00`);

/** Data inválida não pode virar parâmetro: cai para hoje. */
const isoSeguro = (d: Date) => (Number.isNaN(d.getTime()) ? iso(new Date()) : iso(d));

/** "3 de agosto", "semana de 3 a 9 de agosto", "agosto de 2026". */
function rotuloPeriodo(p: Pagina | null): string {
  if (!p) return "";

  const de = doIso(p.de);
  const ate = doIso(p.ate);

  if (p.periodicidade === "DIARIA") return `${de.getDate()} de ${MESES[de.getMonth()]}`;
  if (p.periodicidade === "MENSAL") return `${MESES[de.getMonth()]} de ${de.getFullYear()}`;

  return `${de.getDate()} a ${ate.getDate()} de ${MESES[ate.getMonth()]}`;
}

/**
 * Planilhas configuráveis.
 *
 * Duas telas em uma, por escolha: a lista de modelos e a planilha aberta. São
 * o mesmo assunto em zoom diferente, e separá-las em rotas obrigaria a voltar
 * e reabrir a cada troca de planilha.
 *
 * O que o administrador desenha é o MODELO — quais colunas, de que tipo, com
 * que periodicidade. O que a equipe preenche é o período: a planilha de hoje,
 * desta semana ou deste mês, conforme o modelo diz.
 */
const PlanilhasPage = () => {
  const alert = useAlert();
  const { user } = useAuth();
  const gestor = ehGestor(user);

  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [aberta, setAberta] = useState<Modelo | null>(null);
  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [dataAtual, setDataAtual] = useState(() => iso(new Date()));
  const [carregando, setCarregando] = useState(true);

  const [novaAberta, setNovaAberta] = useState(false);
  const [configAberta, setConfigAberta] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [formModelo, setFormModelo] = useState<{ nome: string; periodicidade: Periodicidade }>({ nome: "", periodicidade: "DIARIA" });
  const [formColuna, setFormColuna] = useState<{ nome: string; tipo: TipoColuna; opcoes: string; valorPadrao: string }>({ nome: "", tipo: "TEXTO", opcoes: "", valorPadrao: "" });

  const equipe = useEquipeStore((s) => s.equipe);
  const buscarEquipe = useEquipeStore((s) => s.buscar);

  useEffect(() => {
    if (gestor) buscarEquipe();
  }, [gestor, buscarEquipe]);

  const funcionarios = useMemo(() => (equipe?.funcionarios ?? []).filter((f) => f.status === "ATIVO"), [equipe]);

  /* A trava de plano saiu daqui junto com a das rotas: a planilha é a
     ferramenta de produção de todo mundo, e o pacote comercial ainda vai ser
     reorganizado. */

  /** Quem pode editar a coluna. Lista vazia = todos; gestor sempre pode. */
  const podeEditar = (c: Coluna) => gestor || !c.permissoes?.length || c.permissoes.includes(String(user?.id));

  const alternarPermissao = async (c: Coluna, funcionarioId: string) => {
    const atual = c.permissoes ?? [];
    const nova = atual.includes(funcionarioId) ? atual.filter((x) => x !== funcionarioId) : [...atual, funcionarioId];

    setColunas((prev) => prev.map((x) => (x.id === c.id ? { ...x, permissoes: nova } : x)));
    await PlanilhaService.alterarColuna(c.id, { permissoes: nova });
  };

  /* Cor livre, do seletor do sistema operacional. A paleta fixa de seis que
     havia antes economizava um clique e tirava a decisão de quem conhece a
     própria operação — verde para "pronto" e vermelho para "atrasado" são
     convenções da casa, não do sistema. */
  const definirCor = async (c: Coluna, indice: number, cor: string) => {
    const opcoes = c.opcoes.map((op, i) => (i === indice ? { ...op, cor } : op));

    setColunas((prev) => prev.map((x) => (x.id === c.id ? { ...x, opcoes } : x)));
    await PlanilhaService.alterarColuna(c.id, { opcoes });
  };

  const removerOpcao = async (c: Coluna, indice: number) => {
    const opcoes = c.opcoes.filter((_, i) => i !== indice);

    setColunas((prev) => prev.map((x) => (x.id === c.id ? { ...x, opcoes } : x)));
    await PlanilhaService.alterarColuna(c.id, { opcoes });
  };

  const definirPadrao = async (c: Coluna, valor: string) => {
    setColunas((prev) => prev.map((x) => (x.id === c.id ? { ...x, valor_padrao: valor } : x)));
    await PlanilhaService.alterarColuna(c.id, { valorPadrao: valor });
  };

  const carregarModelos = useCallback(async () => {
    setCarregando(true);

    try {
      setModelos(await PlanilhaService.modelos());
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível carregar as planilhas."));
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregarModelos();
  }, [carregarModelos]);

  const carregarPlanilha = useCallback(async (modelo: Modelo, data: string) => {
    setCarregando(true);

    try {
      const [cols, pag] = await Promise.all([PlanilhaService.colunas(modelo.id), PlanilhaService.registros(modelo.id, data)]);

      /* Período novo nasce com um bloco de linhas em branco: planilha vazia não
         convida a escrever, e criar a primeira linha manualmente é um passo que
         ninguém deveria precisar dar. Só quando já há colunas — sem elas, as
         linhas não teriam onde ser preenchidas. */
      if (cols.length > 0 && pag.registros.length === 0) {
        await PlanilhaService.criarLote(modelo.id, 10, pag.de);
        setPagina(await PlanilhaService.registros(modelo.id, data));
      } else {
        setPagina(pag);
      }

      setColunas(cols);
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível abrir a planilha."));
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (aberta) carregarPlanilha(aberta, dataAtual);
  }, [aberta, dataAtual, carregarPlanilha]);

  /* Mesma fila do quadro de produção, em linhas: o que muda de um lado tem de
     aparecer do outro sem ninguém apertar atualizar. Só com planilha aberta —
     sem ela não há o que recarregar. */
  useSincronizacao(["planilhas", "producao"], () => {
    if (aberta) carregarPlanilha(aberta, dataAtual);
  }, Boolean(aberta));

  /** Anda um período inteiro para frente ou para trás. */
  const navegar = (passo: 1 | -1) => {
    const d = doIso(dataAtual);

    if (pagina?.periodicidade === "MENSAL") d.setMonth(d.getMonth() + passo);
    else if (pagina?.periodicidade === "SEMANAL") d.setDate(d.getDate() + 7 * passo);
    else d.setDate(d.getDate() + passo);

    setDataAtual(isoSeguro(d));
  };

  const criarModelo = async () => {
    if (!formModelo.nome.trim()) return;

    setSalvando(true);

    try {
      await PlanilhaService.criarModelo({ nome: formModelo.nome.trim(), periodicidade: formModelo.periodicidade });
      setNovaAberta(false);
      setFormModelo({ nome: "", periodicidade: "DIARIA" });
      carregarModelos();
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível criar."));
    } finally {
      setSalvando(false);
    }
  };

  const criarColuna = async () => {
    if (!aberta || !formColuna.nome.trim()) return;

    setSalvando(true);

    try {
      /* Opções digitadas separadas por vírgula: pedir um formulário por
         alternativa transformaria "criar um seletor" numa tarefa de minutos. */
      const opcoes = formColuna.opcoes
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((valor) => ({ valor }));

      await PlanilhaService.criarColuna(aberta.id, { nome: formColuna.nome.trim(), tipo: formColuna.tipo, opcoes, valorPadrao: formColuna.valorPadrao.trim() || null });
      setFormColuna({ nome: "", tipo: "TEXTO", opcoes: "", valorPadrao: "" });
      carregarPlanilha(aberta, dataAtual);
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível criar a coluna."));
    } finally {
      setSalvando(false);
    }
  };

  const removerColuna = async (c: Coluna) => {
    if (!aberta) return;

    try {
      await PlanilhaService.removerColuna(c.id);
      carregarPlanilha(aberta, dataAtual);
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível remover."));
    }
  };

  const novaLinha = async () => {
    if (!aberta || !pagina) return;

    try {
      /* A linha nasce dentro do período aberto: criar em "hoje" enquanto se
         olha o mês que vem faria a linha sumir na frente de quem a criou.
         Em bloco de dez, porque quem clica em "adicionar" quase nunca quer
         só uma. */
      await PlanilhaService.criarLote(aberta.id, 10, pagina.de);
      carregarPlanilha(aberta, dataAtual);
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível criar a linha."));
    }
  };

  /* Grava a célula e atualiza só ela na memória — recarregar a planilha
     inteira a cada tecla seria lento e faria o cursor pular. */
  const salvarCelula = async (registroId: string, colunaId: string, valor: unknown) => {
    setPagina((p) =>
      p ? { ...p, registros: p.registros.map((r) => (r.id === registroId ? { ...r, valores: { ...r.valores, [colunaId]: valor } } : r)) } : p,
    );

    try {
      await PlanilhaService.alterarRegistro(registroId, { valores: { [colunaId]: valor } });
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível salvar."));
      if (aberta) carregarPlanilha(aberta, dataAtual);
    }
  };

  const excluirLinha = async (id: string) => {
    setPagina((p) => (p ? { ...p, registros: p.registros.filter((r) => r.id !== id) } : p));

    try {
      await PlanilhaService.excluirRegistro(id);
    } catch {
      if (aberta) carregarPlanilha(aberta, dataAtual);
    }
  };

  /*
   * As páginas desta planilha, para o rodapé.
   *
   * Recarrega junto com a planilha porque criar linhas num período novo faz
   * uma página nascer — e a aba tem de aparecer sem exigir F5.
   */
  const [periodos, setPeriodos] = useState<Periodo[]>([]);

  useEffect(() => {
    if (!aberta) {
      setPeriodos([]);
      return;
    }

    let vivo = true;

    PlanilhaService.periodos(aberta.id)
      .then((lista) => vivo && setPeriodos(lista))
      .catch(() => vivo && setPeriodos([]));

    return () => {
      vivo = false;
    };
  }, [aberta, pagina]);

  /*
   * Histórico de alterações.
   *
   * A planilha salva sozinha, célula a célula, sem botão nenhum — ótimo para
   * o ritmo do trabalho e péssimo para a pergunta que vem depois: "esse prazo
   * era dia 12, quem mudou para 20?". Sem trilha, o valor antigo simplesmente
   * deixa de existir e a conversa vira a palavra de um contra a do outro.
   *
   * Carrega só quando o painel abre: é consulta de exceção, não custa nada
   * ficar fora do carregamento da tela.
   */
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [historico, setHistorico] = useState<Alteracao[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  useEffect(() => {
    if (!historicoAberto || !aberta) return;

    let vivo = true;

    setCarregandoHistorico(true);

    PlanilhaService.historico(aberta.id)
      .then((lista) => vivo && setHistorico(lista))
      .catch(() => vivo && setHistorico([]))
      .finally(() => vivo && setCarregandoHistorico(false));

    return () => {
      vivo = false;
    };
  }, [historicoAberto, aberta]);

  /*
   * Renomear por duplo clique, na própria célula do nome.
   *
   * Um lápis ao lado do título ocuparia espaço permanente para uma ação que
   * se usa duas vezes por ano; um item em menu de contexto ninguém encontra.
   * Duplo clique é o gesto que qualquer pessoa já tenta primeiro num nome de
   * aba de planilha — não custa pixel nenhum e não precisa ser ensinado.
   */
  const [renomeando, setRenomeando] = useState<null | { alvo: "planilha" | "pagina"; chave: string; valor: string }>(null);

  const confirmarRenome = async () => {
    if (!renomeando || !aberta) return;

    const { alvo, chave, valor } = renomeando;

    setRenomeando(null);

    try {
      if (alvo === "planilha") {
        const nome = valor.trim();
        if (!nome || nome === aberta.nome) return;

        /* Local primeiro: o nome está no cabeçalho e na lista, e esperar a
           rede para ver a própria digitação é o tipo de atraso que faz a
           pessoa clicar de novo achando que não salvou. */
        setAberta({ ...aberta, nome });
        setModelos((ms) => ms.map((m) => (m.id === aberta.id ? { ...m, nome } : m)));

        await PlanilhaService.alterarModelo(aberta.id, { nome });
        return;
      }

      setPeriodos((ps) => ps.map((p) => (p.de === chave ? { ...p, nome: valor.trim() || null } : p)));

      await PlanilhaService.renomearPagina(aberta.id, chave, valor);
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível renomear."));
      carregarModelos();
      if (aberta) carregarPlanilha(aberta, dataAtual);
    }
  };

  /** Campo de edição inline — mesmo comportamento nos dois lugares. */
  const campoRenome = (largura: string) => (
    <input
      autoFocus
      value={renomeando?.valor ?? ""}
      onChange={(e) => setRenomeando((r) => (r ? { ...r, valor: e.target.value } : r))}
      onBlur={confirmarRenome}
      onKeyDown={(e) => {
        if (e.key === "Enter") confirmarRenome();
        if (e.key === "Escape") setRenomeando(null);
      }}
      className={`${largura} rounded-lg border border-accent/60 bg-fg/[0.04] px-2 py-1 text-ink outline-none`}
    />
  );

  /**
   * Abre o período seguinte ao mais recente que já existe, em branco.
   *
   * Anda a partir da página MAIS NOVA, e não da que está aberta: quem está
   * consultando agosto e clica em "+ Página" quer a próxima da planilha, não
   * criar setembro de novo por cima do que já existe.
   */
  const proximaPagina = () => {
    const maisRecente = periodos[0]?.de ?? pagina?.de ?? dataAtual;
    const d = doIso(maisRecente);

    if (pagina?.periodicidade === "MENSAL") d.setMonth(d.getMonth() + 1);
    else if (pagina?.periodicidade === "SEMANAL") d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);

    setDataAtual(isoSeguro(d));
  };

  /** Copia a planilha aberta e já entra na cópia — é o que se quer em seguida. */
  const duplicarAtual = async () => {
    if (!aberta) return;

    setSalvando(true);

    try {
      const novoId = await PlanilhaService.duplicarModelo(aberta.id);
      const lista = await PlanilhaService.modelos();

      setModelos(lista);

      const nova = lista.find((m) => m.id === novoId);
      if (nova) setAberta(nova);
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível duplicar a planilha."));
    } finally {
      setSalvando(false);
    }
  };

  const larguraTotal = useMemo(() => colunas.reduce((soma, c) => soma + (c.largura ?? 180), 56), [colunas]);

  /* ------------------------- Fora do plano ------------------------- */


  /* ---------------------------- Lista ---------------------------- */

  if (!aberta) {
    return (
      <PageScreen icon={<Table2 className="h-5 w-5" />} title="Planilhas" subtitle="Modelos que a sua operação usa">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <span className="text-[11.5px] text-faint">
            {modelos.length} {modelos.length === 1 ? "planilha" : "planilhas"}
          </span>

          {gestor && (
            <button onClick={() => setNovaAberta(true)} className="focus-ring flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[12.5px] text-white transition-all hover:brightness-110">
              <Plus size={15} /> Nova planilha
            </button>
          )}
        </div>

        <div className="card glass-sheen min-h-0 flex-1 overflow-y-auto">
          {carregando ? (
            <SkeletonListaPainel linhas={4} />
          ) : modelos.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-fg/[0.08] bg-fg/[0.03] text-faint">
                <Table2 size={22} />
              </span>
              <p className="text-[14px] text-ink">Nenhuma planilha ainda</p>
              <p className="max-w-sm text-[12.5px] leading-relaxed text-faint">
                Crie um modelo, escolha as colunas que a sua operação usa e diga se ele é diário, semanal ou mensal. A partir daí é só preencher.
              </p>
            </div>
          ) : (
            modelos.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setAberta(m);
                  setDataAtual(iso(new Date()));
                }}
                className="flex w-full items-center gap-3 border-b border-fg/[0.04] px-4 py-3 text-left transition-colors last:border-0 hover:bg-fg/[0.03]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/[0.14] text-accent-soft">
                  <Table2 size={16} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ink">{m.nome}</span>
                  <span className="block truncate text-[11.5px] text-faint">
                    {PERIODICIDADES.find((p) => p.id === m.periodicidade)?.label} · {m.total_colunas} {m.total_colunas === 1 ? "coluna" : "colunas"} · {m.total_registros} {m.total_registros === 1 ? "linha" : "linhas"}
                  </span>
                </span>

                <ChevronRight size={16} className="shrink-0 text-muted" />
              </button>
            ))
          )}
        </div>

        <Modal open={novaAberta} onClose={() => setNovaAberta(false)} title="Nova planilha" subtitle="Você define as colunas depois">
          <div className="flex flex-col gap-3">
            <input
              autoFocus
              value={formModelo.nome}
              onChange={(e) => setFormModelo({ ...formModelo, nome: e.target.value })}
              placeholder="Nome (ex.: Produção camisaria)"
              className="w-full rounded-xl border border-fg/[0.08] bg-fg/[0.03] px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-accent/60"
            />

            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-faint">Período</p>
              <div className="flex gap-2">
                {PERIODICIDADES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setFormModelo({ ...formModelo, periodicidade: p.id })}
                    className={`flex-1 rounded-xl border py-2 text-[12.5px] transition-colors ${formModelo.periodicidade === p.id ? "border-accent bg-accent/[0.12] text-accent-soft" : "border-fg/[0.1] text-mist"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">Define o recorte: a planilha mostra o dia, a semana ou o mês de cada vez.</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setNovaAberta(false)} className="min-h-[42px] rounded-xl border border-fg/[0.1] px-4 text-[13px] text-mist">
                Cancelar
              </button>
              <button onClick={criarModelo} disabled={salvando || !formModelo.nome.trim()} className="flex min-h-[42px] items-center gap-2 rounded-xl bg-accent px-5 text-[13px] text-white disabled:opacity-40">
                {salvando && <Loader2 size={14} className="animate-spin" />}
                Criar
              </button>
            </div>
          </div>
        </Modal>
      </PageScreen>
    );
  }

  /* -------------------------- Planilha aberta -------------------------- */

  return (
    <PageScreen icon={<Table2 className="h-5 w-5" />} title="Planilhas" subtitle={rotuloPeriodo(pagina)}>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {/* O nome da planilha vive aqui, e não no título da tela: o título diz
            em que módulo você está ("Planilhas"), o nome diz qual delas — e é
            o nome que se renomeia, com duplo clique. */}
        {renomeando?.alvo === "planilha" ? (
          campoRenome("w-56 text-[15px]")
        ) : (
          <button
            onDoubleClick={() => setRenomeando({ alvo: "planilha", chave: aberta.id, valor: aberta.nome })}
            title="Clique duas vezes para renomear"
            className="focus-ring flex items-center gap-2 rounded-lg px-2 py-1 text-[15px] text-ink transition-colors hover:bg-fg/[0.05]"
          >
            {aberta.nome}
          </button>
        )}

        <button
          onClick={() => setAberta(null)}
          aria-label="Ver todas as planilhas"
          title="Ver todas as planilhas"
          className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-fg/[0.1] text-mist hover:text-ink"
        >
          <ArrowLeft size={14} />
        </button>

        {/* "Voltar para Planilhas" e "Hoje" saíram daqui: o primeiro virou o
            próprio cabeçalho da página, e o segundo era um atalho para um
            período que o rodapé agora mostra por nome. Sobraram as setas, para
            quem anda de um em um. */}
        <div className="flex items-center gap-1">
          <button onClick={() => navegar(-1)} aria-label="Período anterior" className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-fg/[0.1] text-mist hover:text-ink">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => navegar(1)} aria-label="Próximo período" className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-fg/[0.1] text-mist hover:text-ink">
            <ChevronRight size={15} />
          </button>
        </div>

        <button
          onClick={() => setHistoricoAberto(true)}
          title="Quem mudou o quê nesta planilha"
          className="focus-ring flex items-center gap-1.5 rounded-lg border border-fg/[0.1] px-3 py-2 text-[11.5px] text-mist transition-colors hover:text-ink"
        >
          <History size={14} />
          Histórico
        </button>

        <span className="text-[11.5px] text-faint">
          {pagina?.registros.length ?? 0} {(pagina?.registros.length ?? 0) === 1 ? "linha" : "linhas"}
        </span>

        {/* Presença no canto: quem mais está com esta planilha aberta. */}
        <div className="ml-auto flex items-center gap-3">
          <Presenca planilhaId={aberta.id} />

          {gestor && (
            <button onClick={() => setConfigAberta(true)} className="focus-ring flex items-center gap-1.5 rounded-xl border border-fg/[0.1] px-3 py-2 text-[12px] text-mist transition-colors hover:text-ink">
              <Settings2 size={14} /> Colunas
            </button>
          )}

        </div>
      </div>

      {/* A planilha ocupa todo o espaço restante do outlet. */}
      <div className="card glass-sheen min-h-0 flex-1 overflow-auto">
        {colunas.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-[14px] text-ink">Esta planilha ainda não tem colunas</p>
            <p className="max-w-sm text-[12.5px] leading-relaxed text-faint">Defina o que cada coluna representa e de que tipo ela é — texto, seleção, data, imagem.</p>
            {gestor && (
              <button onClick={() => setConfigAberta(true)} className="mt-1 rounded-xl bg-accent px-5 py-2 text-[13px] text-white">
                Criar colunas
              </button>
            )}
          </div>
        ) : (
          <table className="border-separate border-spacing-0 text-left" style={{ minWidth: larguraTotal }}>
            <thead className="sticky top-0 z-20">
              <tr>
                {/* Número da linha, como em planilha de verdade. Gruda na
                    esquerda para não se perder o eixo ao rolar na horizontal. */}
                <th className="sticky left-0 z-30 w-14 border-b border-r border-fg/[0.07] bg-surface px-2 py-2 text-center text-[10.5px] text-faint">#</th>

                {colunas.map((c) => (
                  <th
                    key={c.id}
                    style={{ minWidth: c.largura ?? 180 }}
                    className="border-b border-r border-fg/[0.07] bg-surface px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-faint"
                  >
                    {c.nome}
                  </th>
                ))}

                <th className="w-10 border-b border-fg/[0.07] bg-surface" />
              </tr>
            </thead>

            <tbody>
              {(pagina?.registros ?? []).map((r, i) => (
                <tr key={r.id} className="group">
                  <td className="sticky left-0 z-10 border-b border-r border-fg/[0.05] bg-surface px-2 py-1 text-center text-[11px] tabular-nums text-faint">{i + 1}</td>

                  {colunas.map((c) => (
                    <td key={c.id} className="border-b border-r border-fg/[0.05] p-0 align-top">
                      <Celula coluna={c} valor={r.valores[c.id]} editavel={podeEditar(c)} onSalvar={(v) => salvarCelula(r.id, c.id, v)} />
                    </td>
                  ))}

                  <td className="border-b border-fg/[0.05] px-1 text-center">
                    <button
                      onClick={() => excluirLinha(r.id)}
                      aria-label={`Excluir linha ${i + 1}`}
                      className="text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}

              {/* A última linha É o botão — como em planilha de verdade, onde se
                  desce até o fim e continua escrevendo. Sem teto: cada clique
                  acrescenta mais dez. */}
              <tr>
                <td colSpan={colunas.length + 2} className="border-b border-fg/[0.05] p-0">
                  <button
                    onClick={novaLinha}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[12.5px] text-faint transition-colors hover:bg-fg/[0.03] hover:text-accent-soft"
                  >
                    <Plus size={14} />
                    Adicionar linha
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/*
        * Rodapé: as PÁGINAS desta planilha — Agosto, Setembro, Outubro.
        *
        * Não são as outras planilhas: Camisaria e Estamparia são coisas
        * separadas, e trocar entre elas é sair desta tela. O que se troca aqui
        * é o período dentro da mesma planilha, que é exatamente o papel das
        * abas de baixo em qualquer planilha do mundo.
        *
        * Antes só existiam as setas "← Hoje →", que respondem um passo por
        * clique e às cegas: achar um mês de três atrás custava seis cliques
        * sem saber se havia algo lá. A lista vem do banco já agrupada pela
        * periodicidade do modelo — na Estamparia, que é diária, cada dia é uma
        * aba; na Camisaria, mensal, cada mês é uma.
        */}
      <div className="mt-2 flex shrink-0 items-center gap-1 overflow-x-auto border-t border-fg/[0.07] pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 pr-1 text-[10px] uppercase tracking-[0.12em] text-faint">Páginas</span>

        {periodos.map((p) => {
          const atual = pagina?.de === p.de;

          if (renomeando?.alvo === "pagina" && renomeando.chave === p.de) {
            return <span key={p.de}>{campoRenome("w-32 text-[12px]")}</span>;
          }

          return (
            <button
              key={p.de}
              onClick={() => setDataAtual(p.de)}
              /* Renomear a página só depois de abri-la seria um clique a mais
                 para uma ação que já custa dois. O duplo clique funciona em
                 qualquer aba, aberta ou não. */
              onDoubleClick={() => setRenomeando({ alvo: "pagina", chave: p.de, valor: p.nome ?? "" })}
              title={`${p.linhas} ${p.linhas === 1 ? "linha" : "linhas"} · clique duas vezes para renomear`}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] transition-colors ${p.nome ? "" : "capitalize"} ${
                atual ? "bg-accent/[0.14] text-accent-soft ring-1 ring-inset ring-accent/25" : "text-mist hover:bg-fg/[0.05] hover:text-ink"
              }`}
            >
              {p.nome || rotuloAba(p.de, pagina?.periodicidade)}
            </button>
          );
        })}

        {/* O período aberto ainda sem nenhuma linha não está na lista do banco
            — mas a pessoa está olhando para ele, então ele precisa de aba. */}
        {pagina && !periodos.some((p) => p.de === pagina.de) && (
          <span className="shrink-0 rounded-lg bg-accent/[0.14] px-3 py-1.5 text-[12px] capitalize text-accent-soft ring-1 ring-inset ring-accent/25">
            {rotuloAba(pagina.de, pagina.periodicidade)}
          </span>
        )}

        <span className="mx-1 h-4 w-px shrink-0 bg-fg/[0.1]" />

        {/* "+" abre o período SEGUINTE ao mais recente, em branco. É como a
            página de setembro nasce quando agosto acaba. */}
        <button
          onClick={proximaPagina}
          title="Abrir o próximo período em branco"
          className="focus-ring flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-mist transition-colors hover:text-ink"
        >
          <Plus size={13} />
          Página
        </button>

        <button
          onClick={duplicarAtual}
          disabled={salvando}
          title={`Criar outra planilha com as mesmas colunas de ${aberta.nome}`}
          aria-label="Duplicar planilha"
          className="focus-ring ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg text-mist transition-colors hover:bg-fg/[0.05] hover:text-ink disabled:opacity-40"
        >
          <Copy size={13} />
        </button>
      </div>

      {/* Histórico — leitura, sem ação: a planilha não desfaz mudança, ela
          responde quem fez. Voltar o valor é digitar de novo, e isso a pessoa
          já sabe fazer. */}
      <Modal open={historicoAberto} onClose={() => setHistoricoAberto(false)} title="Histórico" subtitle={aberta.nome} size="lg">
        {carregandoHistorico ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-mist">
            <Loader2 size={15} className="animate-spin text-accent" />
            Carregando...
          </div>
        ) : historico.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-faint">Nenhuma alteração registrada ainda.</p>
        ) : (
          <div className="flex flex-col divide-y divide-fg/[0.06]">
            {historico.map((h) => {
              const { titulo, detalhe } = descreverEvento(h);
              const celula = h.acao === "CELULA_ALTERADA";

              return (
                <div key={h.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2.5">
                  <span className="text-[12.5px] text-ink">{titulo}</span>

                  {detalhe &&
                    (celula ? (
                      <span className="flex items-baseline gap-1.5 text-[12px]">
                        <span className="text-mist line-through decoration-fg/25">{h.valor_antes || "vazio"}</span>
                        <span className="text-faint">→</span>
                        <span className="text-accent-soft">{h.valor_depois || "vazio"}</span>
                      </span>
                    ) : (
                      <span className="text-[12px] text-mist">{detalhe}</span>
                    ))}

                  <span className="ml-auto text-[11px] text-faint">
                    {h.usuario_nome ?? "—"} · {new Date(h.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Configuração das colunas */}
      <Modal open={configAberta} onClose={() => setConfigAberta(false)} title="Colunas da planilha" subtitle={aberta.nome}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            {colunas.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-xl border border-fg/[0.07] px-3 py-2 text-[13px] text-ink">
                <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                <span className="shrink-0 rounded-full bg-fg/[0.06] px-2 py-0.5 text-[10.5px] text-mist">{TIPOS.find((t) => t.id === c.tipo)?.label ?? c.tipo}</span>

                {/* Marcar a coluna de prazo aqui: é ela que o sistema usa para
                    saber o que está atrasado, com o nome que você deu. */}
                {c.tipo === "DATA" && (
                  <button
                    onClick={async () => {
                      await PlanilhaService.alterarModelo(aberta.id, { colunaPrazoId: c.id });
                      setAberta({ ...aberta, coluna_prazo_fk: c.id });
                    }}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] transition-colors ${aberta.coluna_prazo_fk === c.id ? "bg-accent/20 text-accent-soft" : "text-muted hover:text-mist"}`}
                  >
                    {aberta.coluna_prazo_fk === c.id ? "é o prazo" : "usar como prazo"}
                  </button>
                )}

                <button onClick={() => removerColuna(c)} aria-label={`Remover ${c.nome}`} className="shrink-0 text-muted transition-colors hover:text-danger">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Detalhe de cada coluna: alternativas com cor e quem pode editar. */}
          {colunas.map((c) => (
            <div key={"cfg-" + c.id} className="flex flex-col gap-2 rounded-xl border border-fg/[0.06] bg-fg/[0.02] p-3">
              <p className="text-[11.5px] text-ink">{c.nome}</p>

              {c.tipo === "SELECAO" && c.opcoes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {c.opcoes.map((op, i) => (
                    <span key={op.valor} className="inline-flex items-center gap-1 rounded-full border border-fg/[0.1] px-2 py-0.5 text-[11px] text-mist">
                      {/* `type="color"` abre o seletor nativo — qualquer cor,
                          sem componente extra no bundle. */}
                      <label className="relative h-3 w-3 shrink-0 cursor-pointer rounded-full ring-1 ring-fg/20" style={{ background: op.cor ?? "transparent" }} title={"Cor de " + op.valor}>
                        <input
                          type="color"
                          value={op.cor ?? "#8d70ff"}
                          onChange={(e) => definirCor(c, i, e.target.value)}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          aria-label={"Cor de " + op.valor}
                        />
                      </label>
                      {op.valor}
                      <button onClick={() => definirPadrao(c, op.valor)} title="Definir como padrao" className={c.valor_padrao === op.valor ? "text-accent-soft" : "text-muted hover:text-accent-soft"}>
                        &#9733;
                      </button>
                      <button onClick={() => removerOpcao(c, i)} aria-label={"Remover " + op.valor} className="text-muted hover:text-danger">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {funcionarios.length > 0 && (
                <div>
                  <p className="mb-1 text-[10.5px] text-faint">
                    {c.permissoes?.length ? "So estas pessoas editam:" : "Todos podem editar. Marque para restringir:"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {funcionarios.map((f) => {
                      const on = c.permissoes?.includes(String(f.id));

                      return (
                        <button
                          key={f.id}
                          onClick={() => alternarPermissao(c, String(f.id))}
                          className={"rounded-full border px-2 py-0.5 text-[11px] transition-colors " + (on ? "border-accent bg-accent/[0.14] text-accent-soft" : "border-fg/[0.1] text-mist")}
                        >
                          {f.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-col gap-2 border-t border-fg/[0.07] pt-3">
            <input
              value={formColuna.nome}
              onChange={(e) => setFormColuna({ ...formColuna, nome: e.target.value })}
              placeholder="Nome da coluna (ex.: Etapa)"
              className="w-full rounded-xl border border-fg/[0.08] bg-fg/[0.03] px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-accent/60"
            />

            <div className="grid grid-cols-4 gap-1.5">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setFormColuna({ ...formColuna, tipo: t.id })}
                  className={`rounded-lg border py-1.5 text-[11px] transition-colors ${formColuna.tipo === t.id ? "border-accent bg-accent/[0.12] text-accent-soft" : "border-fg/[0.1] text-mist"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {formColuna.tipo === "SELECAO" && (
              <input
                value={formColuna.opcoes}
                onChange={(e) => setFormColuna({ ...formColuna, opcoes: e.target.value })}
                placeholder="Alternativas separadas por vírgula"
                className="w-full rounded-xl border border-fg/[0.08] bg-fg/[0.03] px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-accent/60"
              />
            )}

            <input
              value={formColuna.valorPadrao}
              onChange={(e) => setFormColuna({ ...formColuna, valorPadrao: e.target.value })}
              placeholder="Valor padrao (opcional) - ja vem preenchido na linha nova"
              className="w-full rounded-xl border border-fg/[0.08] bg-fg/[0.03] px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-accent/60"
            />

            <button onClick={criarColuna} disabled={salvando || !formColuna.nome.trim()} className="min-h-[42px] self-start rounded-xl bg-accent px-5 text-[13px] text-white disabled:opacity-40">
              Adicionar coluna
            </button>
          </div>
        </div>
      </Modal>
    </PageScreen>
  );
};

export default PlanilhasPage;
