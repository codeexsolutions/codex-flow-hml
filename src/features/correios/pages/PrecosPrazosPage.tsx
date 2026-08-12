import { useMemo, useState } from "react";
import { Calculator, MapPin, Weight, Ruler, Timer, AlertTriangle, RotateCw, CheckCircle2, TrendingUp } from "lucide-react";

import useEnterprise from "@/features/empresa/store/enterprise.store";
import CorreiosService from "@/features/correios/services/correios.service";
import type { CalcFreteDto, FreteResultado, ServicoCorreio } from "@/features/correios/types/correios.types";

import { money } from "@/shared/utils/currency";
import { onlyDigits } from "@/shared/utils/format";
import { maskCep } from "@/shared/validation/masks";
import { unwrapList } from "@/shared/api/types";
import { useAlert } from "@/shared/ui/Alert";
import { extractErrorMessage, getErrorTitle } from "@/shared/utils/errorHandler";


const SERVICO_CORES: Record<string, string> = {
  SEDEX: "border-accent/40 bg-accent/15 text-accent-soft ring-accent/20",
  PAC: "border-warning/40 bg-warning/15 text-warning ring-warning/20",
  SEDEX12: "border-success/40 bg-success/15 text-success ring-success/20",
  SEDEX10: "border-danger/40 bg-danger/15 text-danger ring-danger/20",
};

const campoBase = "h-11 w-full rounded-xl border border-fg/[0.08] bg-fg/[0.04] px-3 text-sm text-ink placeholder-mist outline-none transition-colors focus:border-accent/60 focus:bg-fg/[0.06]";

const PrecosPrazosPage = () => {
  const { enterprise } = useEnterprise();
  const alert = useAlert();

  const [cepDestino, setCepDestino] = useState("");
  const [peso, setPeso] = useState("0.5");
  const [comprimento, setComprimento] = useState("20");
  const [altura, setAltura] = useState("10");
  const [largura, setLargura] = useState("15");
  const [servico, setServico] = useState<ServicoCorreio | "TODOS">("TODOS");
  const [carregando, setCarregando] = useState(false);
  const [resultados, setResultados] = useState<FreteResultado[]>([]);
  const [jaConsultou, setJaConsultou] = useState(false);

  const cepOrigem = enterprise?.endereco?.cep ? maskCep(enterprise.endereco.cep) : "";
  const endereco = enterprise?.endereco;

  const handleCalcular = async () => {
    if (cepDestino.length < 9) {
      alert.warning("CEP incompleto", "Informe o CEP de destino completo.");
      return;
    }
    if (!enterprise?.endereco?.cep) {
      alert.warning("Endereço da empresa", "Configure o endereço da empresa em Configurações.");
      return;
    }

    setCarregando(true);
    setResultados([]);

    const servicos: ServicoCorreio[] = servico === "TODOS" ? ["SEDEX", "PAC", "SEDEX12"] : [servico];

    try {
      const promises = servicos.map((s) =>
        CorreiosService.calcularFrete({
          cepOrigem: onlyDigits(cepOrigem),
          cepDestino: onlyDigits(cepDestino),
          peso: Number(peso) || 0.5,
          comprimento: Number(comprimento) || 20,
          altura: Number(altura) || 10,
          largura: Number(largura) || 15,
          servico: s,
        } as CalcFreteDto),
      );

      const responses = await Promise.all(promises);
      const todos = responses.flatMap((r) => {
        const lista = unwrapList<FreteResultado>(r.data);
        return lista.length > 0 ? lista : [];
      });

      if (todos.length === 0) {
        alert.warning("Sem resposta", "Não foi possível calcular o frete. Verifique os dados.");
      }
      setResultados(todos);
    } catch (err) {

      alert.error(getErrorTitle(err), extractErrorMessage(err, "Falha na comunicação com os Correios."));
    } finally {
      setCarregando(false);
      setJaConsultou(true);
    }
  };

  const melhorResultado = useMemo(() => {
    if (resultados.length === 0) return null;
    return resultados.reduce((best, r) => (r.valor < best.valor ? r : best), resultados[0]);
  }, [resultados]);

  return (
    <div className="flex flex-col gap-5">
      {/* Formulário */}
      <div className="card glass-sheen rounded-xl p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm text-ink">
          <Calculator size={16} className="text-accent-soft" /> Dados da encomenda
        </h2>
        <p className="mb-5 text-[12px] text-faint">Informe os dados para calcular preços e prazos de entrega</p>

        {/* Grid principal do formulário */}
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Origem — ocupa 2 colunas no LG */}
          <div className="flex flex-col sm:col-span-2">
            <label className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-faint">Origem (sua empresa)</label>
            <div className={`${campoBase} flex items-center gap-2 cursor-default`}>
              <MapPin size={15} className="shrink-0 text-accent-soft" />
              <span className="truncate text-ink text-[13px]">
                {endereco ? `${endereco.cidade}/${endereco.uf} · ${maskCep(endereco.cep)}` : "Configure o endereço da empresa"}
              </span>
            </div>
          </div>

          {/* CEP destino */}
          <div className="flex flex-col">
            <label className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-faint">CEP de destino</label>
            <div className={`${campoBase} flex items-center`}>
              <MapPin size={15} className="shrink-0 text-muted" />
              <input
                value={cepDestino}
                onChange={(e) => setCepDestino(maskCep(e.target.value))}
                placeholder="00000-000"
                inputMode="numeric"
                maxLength={9}
                className="w-full bg-transparent outline-none text-ink placeholder-mist"
              />
            </div>
          </div>

          {/* Peso */}
          <div className="flex flex-col">
            <label className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-faint">Peso (kg)</label>
            <div className={`${campoBase} flex items-center`}>
              <Weight size={15} className="shrink-0 text-muted" />
              <input value={peso} onChange={(e) => setPeso(e.target.value)} type="number" min={0} step="0.1" className="w-full bg-transparent outline-none text-ink" />
            </div>
          </div>

          {/* Serviço */}
          <div className="flex flex-col">
            <label className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-faint">Serviço</label>
            <select
              value={servico}
              onChange={(e) => setServico(e.target.value as ServicoCorreio | "TODOS")}
              className={`${campoBase} appearance-none cursor-pointer`}
            >
              <option value="TODOS">Comparar todos</option>
              <option value="SEDEX">SEDEX</option>
              <option value="PAC">PAC</option>
              <option value="SEDEX12">SEDEX 12</option>
              <option value="SEDEX10">SEDEX 10</option>
            </select>
          </div>
        </div>

        {/* Dimensões */}
        <div className="mt-4 grid grid-cols-2 gap-x-5 sm:grid-cols-5 lg:grid-cols-3">
          <div className="flex flex-col">
            <label className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-faint">Comprimento (cm)</label>
            <div className={`${campoBase} flex items-center`}>
              <Ruler size={15} className="shrink-0 text-muted" />
              <input value={comprimento} onChange={(e) => setComprimento(e.target.value)} type="number" min={0} className="w-full bg-transparent outline-none text-ink" />
            </div>
          </div>
          <div className="flex flex-col">
            <label className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-faint">Altura (cm)</label>
            <div className={`${campoBase} flex items-center`}>
              <Ruler size={15} className="shrink-0 text-muted" />
              <input value={altura} onChange={(e) => setAltura(e.target.value)} type="number" min={0} className="w-full bg-transparent outline-none text-ink" />
            </div>
          </div>
          <div className="flex flex-col">
            <label className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-faint">Largura (cm)</label>
            <div className={`${campoBase} flex items-center`}>
              <Ruler size={15} className="shrink-0 text-muted" />
              <input value={largura} onChange={(e) => setLargura(e.target.value)} type="number" min={0} className="w-full bg-transparent outline-none text-ink" />
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleCalcular}
            disabled={carregando}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm text-white shadow-lg shadow-accent/25 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {carregando ? <RotateCw size={16} className="animate-spin" /> : <Calculator size={16} />}
            {carregando ? "Calculando..." : "Calcular frete"}
          </button>
        </div>
      </div>

      {/* Resultados */}
      {jaConsultou && (
        <div className="flex flex-col gap-4">
          {resultados.length > 0 ? (
            <>
              <div className="flex items-center gap-2 text-[12px] text-faint">
                <CheckCircle2 size={15} className="text-success" />
                {resultados.length} {resultados.length === 1 ? "serviço disponível" : "serviços disponíveis"} para o CEP informado
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {resultados.map((r) => {
                  const isMelhor = melhorResultado && r.valor === melhorResultado.valor;
                  const cor = SERVICO_CORES[r.servico] ?? "border-fg/10 bg-fg/[0.04] text-mist ring-fg/10";
                  return (
                    <div
                      key={r.servico}
                      className={`relative overflow-hidden rounded-xl border p-5 transition-all hover:shadow-md ${
                        isMelhor ? "border-accent/40 bg-gradient-to-br from-accent/[0.08] to-transparent ring-1 ring-accent/20" : "border-fg/[0.07] bg-surface"
                      }`}
                    >
                      {isMelhor && (
                        <div className="absolute right-0 top-0">
                          <span className="inline-flex items-center gap-1 rounded-bl-lg bg-accent px-2.5 py-0.5 text-[9px] text-white shadow-sm">
                            <TrendingUp size={10} /> Melhor preço
                          </span>
                        </div>
                      )}

                      <div className="mb-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${cor}`}>{r.servico}</span>
                      </div>

                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.08em] text-faint">Valor</p>
                          <p className="mt-0.5 text-3xl tracking-tight text-ink">{money(r.valor)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-[0.08em] text-faint">Prazo</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-mist">
                            <Timer size={14} className="text-accent-soft" />
                            {r.prazo} {r.prazo === 1 ? "dia útil" : "dias úteis"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/[0.08] px-5 py-4 text-sm text-warning">
              <AlertTriangle size={18} />
              Nenhum serviço disponível para os dados informados. Verifique o CEP e as dimensões.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PrecosPrazosPage;
