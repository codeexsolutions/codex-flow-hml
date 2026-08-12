import { useMemo, useState } from "react";
import { CalendarDays, Loader2, Repeat, Save, X } from "lucide-react";

import { Modal } from "@/shared/ui/Modal";
import { formatCurrency } from "@/shared/utils/currency";
import type { NovaConta, Recorrencia, TipoConta } from "@/features/financeiro/services/conta.service";

/**
 * Nova conta a pagar ou a receber.
 *
 * O formulário mostra as parcelas ANTES de salvar. Foi a única forma de a
 * pessoa conferir o que está criando: "6x mensal a partir de 10/09" é uma
 * regra, e regra não se confere lendo — se confere vendo as seis datas.
 * Descobrir que a 4ª caiu num domingo depois de gravar custa desfazer tudo.
 */

const RECORRENCIAS: { id: Recorrencia; label: string }[] = [
  { id: "MENSAL", label: "Mensal" },
  { id: "QUINZENAL", label: "Quinzenal" },
  { id: "SEMANAL", label: "Semanal" },
];

const hojeIso = () => new Date().toISOString().slice(0, 10);

/** Mesma regra do servidor — ver `ContaService.vencimentoDa`. */
const vencimentoDa = (primeiro: string, indice: number, recorrencia: Recorrencia): string => {
  const [a, m, d] = primeiro.split("-").map(Number);
  const base = new Date(a, (m ?? 1) - 1, d ?? 1);

  if (indice === 0) return primeiro;

  if (recorrencia === "SEMANAL" || recorrencia === "QUINZENAL") {
    base.setDate(base.getDate() + (recorrencia === "SEMANAL" ? 7 : 15) * indice);
  } else {
    const dia = base.getDate();
    const alvo = new Date(base.getFullYear(), base.getMonth() + indice, 1);
    const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
    base.setFullYear(alvo.getFullYear(), alvo.getMonth(), Math.min(dia, ultimo));
  }

  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
};

/** Divide sem perder centavo — a sobra vai para a primeira, como no comércio. */
const dividir = (total: number, n: number): number[] => {
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / n);
  const resto = centavos - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? resto : 0)) / 100);
};

const campo =
  "w-full rounded-lg border border-fg/[0.09] bg-fg/[0.03] px-3 py-2 text-[13px] text-ink outline-none transition-colors focus:border-accent/60";
const rotulo = "mb-1 block text-[11px] uppercase tracking-[0.08em] text-faint";

type Props = {
  tipo: TipoConta;
  salvando?: boolean;
  onFechar: () => void;
  onSalvar: (dados: NovaConta) => void | Promise<void>;
};

const ContaForm = ({ tipo, salvando = false, onFechar, onSalvar }: Props) => {
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [quem, setQuem] = useState("");
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState(1);
  const [recorrencia, setRecorrencia] = useState<Recorrencia>("MENSAL");
  const [primeiro, setPrimeiro] = useState(hojeIso());
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");

  const total = Number(String(valor).replace(/\./g, "").replace(",", ".")) || 0;

  const previa = useMemo(() => {
    if (!(total > 0) || parcelas < 1) return [];

    const valores = dividir(total, parcelas);

    return valores.map((v, i) => ({
      numero: i + 1,
      valor: v,
      vencimento: vencimentoDa(primeiro, i, parcelas > 1 ? recorrencia : "UNICA"),
    }));
  }, [total, parcelas, primeiro, recorrencia]);

  const enviar = async () => {
    if (!descricao.trim()) return setErro("Informe a descrição.");
    if (!(total > 0)) return setErro("Informe um valor maior que zero.");

    setErro("");

    await onSalvar({
      tipo,
      descricao: descricao.trim(),
      categoria: categoria.trim() || null,
      valorTotal: total,
      fornecedor: tipo === "PAGAR" ? quem.trim() || null : null,
      observacao: observacao.trim() || null,
      parcelas,
      recorrencia: parcelas > 1 ? recorrencia : "UNICA",
      primeiroVencimento: primeiro,
    });
  };

  const aPagar = tipo === "PAGAR";

  return (
    <Modal
      open
      onClose={() => !salvando && onFechar()}
      title={aPagar ? "Nova conta a pagar" : "Nova conta a receber"}
      subtitle={aPagar ? "Aluguel, fornecedor, guia de imposto…" : "Acordo de recebimento"}
      size="lg"
      maxWidth="sm:max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={rotulo}>Descrição</label>
            <input autoFocus value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={aPagar ? "Aluguel da loja" : "Acordo com o cliente"} className={campo} />
          </div>

          <div>
            <label className={rotulo}>{aPagar ? "Para quem" : "Categoria"}</label>
            <input
              value={aPagar ? quem : categoria}
              onChange={(e) => (aPagar ? setQuem(e.target.value) : setCategoria(e.target.value))}
              placeholder={aPagar ? "Fornecedor, imobiliária…" : "Serviço, produto…"}
              className={campo}
            />
          </div>

          <div>
            <label className={rotulo}>Valor total</label>
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${campo} tabular-nums`} />
          </div>
        </div>

        {/* ---- A regra do parcelamento ---- */}
        <div className="rounded-xl border border-fg/[0.07] bg-fg/[0.02] p-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={rotulo}>Parcelas</label>
              <input
                type="number"
                min={1}
                max={120}
                value={parcelas}
                onChange={(e) => setParcelas(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
                className={`${campo} tabular-nums`}
              />
            </div>

            <div>
              <label className={rotulo}>1º vencimento</label>
              <input type="date" value={primeiro} onChange={(e) => setPrimeiro(e.target.value)} className={campo} />
            </div>

            <div>
              <label className={rotulo}>A cada</label>
              <select
                value={recorrencia}
                onChange={(e) => setRecorrencia(e.target.value as Recorrencia)}
                disabled={parcelas < 2}
                className={`${campo} disabled:opacity-40`}
              >
                {RECORRENCIAS.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* A prévia: as datas de verdade, antes de gravar. */}
          {previa.length > 0 && (
            <div className="mt-3 border-t border-fg/[0.06] pt-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] text-faint">
                <Repeat size={12} className="text-accent-soft" />
                {previa.length === 1 ? "Vence uma vez" : `${previa.length}x ${RECORRENCIAS.find((r) => r.id === recorrencia)?.label.toLowerCase()}`}
              </p>

              <div className="flex max-h-[132px] flex-wrap gap-1.5 overflow-y-auto">
                {previa.map((p) => (
                  <span key={p.numero} className="flex items-center gap-1.5 rounded-lg border border-fg/[0.08] bg-surface px-2 py-1 text-[11.5px] text-mist">
                    <CalendarDays size={11} className="text-faint" />
                    <span className="tabular-nums">{p.vencimento.split("-").reverse().join("/")}</span>
                    <span className="tabular-nums text-ink">{formatCurrency(p.valor)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className={rotulo}>Observação</label>
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" className={campo} />
        </div>

        {erro && <p className="text-[12px] text-danger">{erro}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-fg/[0.07] pt-3.5">
          <button type="button" onClick={onFechar} disabled={salvando} className="focus-ring inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12.5px] text-mist transition-colors hover:bg-fg/[0.05] hover:text-ink disabled:opacity-50">
            <X size={14} /> Cancelar
          </button>

          <button
            type="button"
            onClick={() => void enviar()}
            disabled={salvando}
            className="focus-ring inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-br from-accent-soft to-accent px-4 text-[12.5px] text-white shadow-glow transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {salvando ? "Salvando…" : "Criar conta"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ContaForm;
