import { useEffect, useMemo, useState } from "react";
import { Package, ClipboardList, Clock, CheckCircle2, MapPin, FileText, XCircle, Printer, Truck } from "lucide-react";

import CorreiosService from "@/features/correios/services/correios.service";
import type { PostagemType, PrePostagemDto, ServicoCorreio } from "@/features/correios/types/correios.types";

import { TabelaCard, TabelaHead, TabelaRow, TabelaVazia, type Coluna } from "@/shared/ui/DataTable";
import { Modal } from "@/shared/ui/Modal";
import { Form, FormSection, FormGrid, FormActions, TextField, SelectBox } from "@/shared/ui/form/FormKit";
import { useAlert } from "@/shared/ui/Alert";
import { extractErrorMessage, getErrorTitle } from "@/shared/utils/errorHandler";
import { money } from "@/shared/utils/currency";
import { brDate } from "@/shared/utils/date";
import { onlyDigits } from "@/shared/utils/format";
import { maskCep } from "@/shared/validation/masks";
import { unwrapList } from "@/shared/api/types";
import useEnterprise from "@/features/empresa/store/enterprise.store";
import { Selo, type TomSelo } from "@/shared/ui/StatusBadge";


const SWATCH: Record<string, { label: string; tom: TomSelo }> = {
  PENDENTE: { label: "Pendente", tom: "alerta" },
  POSTADO: { label: "Postado", tom: "sucesso" },
  CANCELADO: { label: "Cancelado", tom: "neutro" },
  EM_TRANSITO: { label: "Em trânsito", tom: "info" },
  ENTREGUE: { label: "Entregue", tom: "sucesso" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = SWATCH[status];
  return <Selo tom={s?.tom}>{s?.label ?? status}</Selo>;
};

const TOM_SERVICO: Record<string, TomSelo> = { SEDEX: "info", PAC: "alerta", SEDEX12: "sucesso" };

const ServicoBadge = ({ servico }: { servico: string }) => <Selo tom={TOM_SERVICO[servico]}>{servico}</Selo>;

type NovaPostagemForm = {
  servico: ServicoCorreio;
  cepDestino: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  peso: string;
};

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

const PostagemPage = () => {
  const { enterprise } = useEnterprise();
  const alert = useAlert();

  const [postagens, setPostagens] = useState<PostagemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"TODAS" | "PENDENTE" | "POSTADO">("TODAS");
  const [showNova, setShowNova] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState<NovaPostagemForm>({
    servico: "SEDEX",
    cepDestino: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    peso: "0.5",
  });

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await CorreiosService.listarPostagens();
      const lista = unwrapList<PostagemType>(res.data);
      setPostagens(lista);
    } catch {
      setPostagens([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const postagensFiltradas = useMemo(() => {
    if (filtro === "TODAS") return postagens;
    return postagens.filter((p) => p.status === filtro);
  }, [postagens, filtro]);

  const resumo = useMemo(() => ({
    total: postagens.length,
    pendentes: postagens.filter((p) => p.status === "PENDENTE").length,
    postadas: postagens.filter((p) => p.status === "POSTADO" || p.status === "EM_TRANSITO" || p.status === "ENTREGUE").length,
  }), [postagens]);

  const handleCriarPostagem = async () => {
    if (!enterprise) return;
    if (!form.cepDestino || !form.logradouro || !form.bairro || !form.cidade || !form.uf) {
      alert.warning("Campos obrigatórios", "Preencha o endereço de destino completo.");
      return;
    }

    setSalvando(true);
    try {
      const payload: PrePostagemDto = {
        contrato: enterprise.codigoEmpresa,
        servico: form.servico,
        remetente: {
          nome: enterprise.nomeFantasia,
          cpfCnpj: enterprise.cpfCnpj,
          logradouro: enterprise.endereco?.logradouro ?? "",
          numero: enterprise.endereco?.numero ?? "",
          complemento: enterprise.endereco?.complemento,
          bairro: enterprise.endereco?.bairro ?? "",
          cidade: enterprise.endereco?.cidade ?? "",
          uf: enterprise.endereco?.uf ?? "",
          cep: enterprise.endereco?.cep ?? "",
          telefone: enterprise.contato?.telefone,
          email: enterprise.contato?.email,
        },
        destinatario: {
          nome: "Cliente",
          cpfCnpj: "",
          logradouro: form.logradouro,
          numero: form.numero,
          complemento: form.complemento,
          bairro: form.bairro,
          cidade: form.cidade,
          uf: form.uf,
          cep: onlyDigits(form.cepDestino),
        },
        itensDeclaracao: [],
        peso: Number(form.peso) || 0.5,
        comprimento: 20,
        altura: 10,
        largura: 15,
      };

      await CorreiosService.solicitarPostagem(payload);
      alert.success("Postagem solicitada!", "O objeto foi registrado com sucesso.");
      setShowNova(false);
      await carregar();
    } catch (err) {

      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível solicitar a postagem."));
    } finally {
      setSalvando(false);
    }
  };

  const handleEmitirDAE = async (id: string) => {
    try {
      const res = await CorreiosService.emitirDAE(id);
      const daeUrl = res.data?.data?.[0]?.urlDAE;
      if (daeUrl) {
        window.open(daeUrl, "_blank");
        alert.success("DAE emitido!", "O Documento de Arrecadação foi aberto.");
      } else {
        alert.success("DAE emitido!", "Documento gerado com sucesso.");
      }
      await carregar();
    } catch (err) {

      alert.error(getErrorTitle(err), extractErrorMessage(err, "Falha ao emitir o DAE."));
    }
  };

  const handleCancelar = async (id: string) => {
    try {
      await CorreiosService.cancelarPostagem(id);
      alert.success("Cancelada", "A postagem foi cancelada.");
      await carregar();
    } catch (err) {

      alert.error(getErrorTitle(err), extractErrorMessage(err, "Falha ao cancelar a postagem."));
    }
  };

  /* Colunas da tabela — com definição que permite scroll horizontal em mobile */
  const colunas: Coluna<PostagemType>[] = [
    {
      id: "objeto",
      header: (
        <span className="flex items-center gap-1.5">
          <Package size={12} /> Objeto
        </span>
      ),
      cell: (p) => (
        <span className="block min-w-0">
          <span className="block font-mono text-[11px] text-accent-soft">{p.codigoObjeto || "—"}</span>
          <span className="block truncate text-[11px] text-faint">{p.cliente}</span>
        </span>
      ),
    },
    {
      id: "servico",
      header: "Serviço",
      cell: (p) => <ServicoBadge servico={p.servico} />,
    },
    {
      id: "valor",
      header: "Valor",
      align: "right",
      cell: (p) => <span className="nums text-ink">{money(p.valorFrete)}</span>,
    },
    {
      id: "data",
      header: "Data",
      align: "right",
      cell: (p) => <span className="nums text-mist text-[12px]">{brDate(p.dataPostagem)}</span>,
    },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (p) => <StatusBadge status={p.status} />,
    },
    {
      id: "acoes",
      header: "",
      align: "right",
      cell: (p) => (
        <span className="flex items-center justify-end gap-1">
          {p.status === "PENDENTE" && (
            <>
              <button onClick={() => handleEmitirDAE(p.id)} title="Emitir DAE" className="focus-ring rounded-lg bg-fg/[0.05] p-1.5 text-faint transition-colors hover:bg-success/20 hover:text-success">
                <FileText size={14} />
              </button>
              <button onClick={() => handleCancelar(p.id)} title="Cancelar" className="focus-ring rounded-lg bg-fg/[0.05] p-1.5 text-faint transition-colors hover:bg-danger/20 hover:text-danger">
                <XCircle size={14} />
              </button>
            </>
          )}
          {p.etiqueta && (
            <button
              onClick={() => window.open(`/api/correios/postagens/${p.id}/etiqueta`, "_blank")}
              title="Imprimir etiqueta"
              className="focus-ring rounded-lg bg-fg/[0.05] p-1.5 text-faint transition-colors hover:bg-accent/20 hover:text-accent-soft"
            >
              <Printer size={14} />
            </button>
          )}
        </span>
      ),
    },
  ];

  /* Grid responsivo: em mobile vira overflow-x-auto, em desktop mostra tudo */
  const COLS = "grid-cols-[1fr_100px_110px_110px_120px_110px]";

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo em cards */}
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card-interactive glass-sheen flex items-center gap-3 p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset bg-accent/[0.15] text-accent-soft ring-accent/20">
            <Package size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] text-faint">Total de postagens</p>
            <p className="nums truncate text-[15px] text-ink">{resumo.total}</p>
          </div>
        </div>
        <div className="card-interactive glass-sheen flex items-center gap-3 p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset bg-warning/15 text-warning ring-warning/20">
            <Clock size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] text-faint">Pendentes</p>
            <p className="nums truncate text-[15px] text-ink">{resumo.pendentes}</p>
          </div>
        </div>
        <div className="card-interactive glass-sheen flex items-center gap-3 p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset bg-success/15 text-success ring-success/20">
            <CheckCircle2 size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] text-faint">Postadas</p>
            <p className="nums truncate text-[15px] text-ink">{resumo.postadas}</p>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <TabelaCard
        title="Postagens"
        icon={<ClipboardList size={15} />}
        count={postagensFiltradas.length}
        countLabel={postagensFiltradas.length === 1 ? "postagem" : "postagens"}
        onAdd={() => setShowNova(true)}
        addLabel="Nova postagem"
        filters={
          <div className="flex items-center gap-1 rounded-lg border border-fg/[0.07] bg-fg/[0.03] p-1">
            {([["TODAS", "Todas"], ["PENDENTE", "Pendentes"], ["POSTADO", "Postadas"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setFiltro(id)} className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] transition-colors ${filtro === id ? "bg-accent text-white" : "text-mist hover:text-ink"}`}>
                {label}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-faint">Carregando...</div>
        ) : postagensFiltradas.length === 0 ? (
          <TabelaVazia icon={<Package size={20} />} title="Nenhuma postagem encontrada" description="Solicite uma pré-postagem para gerar etiqueta e DAE." />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <TabelaHead colunas={colunas} cols={COLS} />
              {postagensFiltradas.map((p) => (
                <TabelaRow key={p.id} colunas={colunas} cols={COLS} row={p} />
              ))}
            </div>
          </div>
        )}
      </TabelaCard>

      {/* Modal: Nova Postagem */}
      <Modal open={showNova} onClose={() => setShowNova(false)} title="Nova postagem" subtitle="Preencha os dados do destinatário" size="lg">
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            handleCriarPostagem();
          }}
        >
          <FormSection title="Serviço" icon={<Truck size={14} />}>
            <div className="flex gap-2">
              {(["SEDEX", "PAC"] as ServicoCorreio[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, servico: s })}
                  className={`focus-ring flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
                    form.servico === s ? "border-accent/50 bg-accent/15 text-accent-soft" : "border-fg/[0.1] text-faint hover:text-mist"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </FormSection>

          <FormSection title="Destinatário" icon={<MapPin size={14} />}>
            <FormGrid cols={2}>
              <TextField
                label="CEP"
                value={form.cepDestino}
                onChange={(e) => setForm({ ...form, cepDestino: maskCep(e.target.value) })}
                placeholder="00000-000"
                inputMode="numeric"
              />
              <TextField label="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="123" />
            </FormGrid>
            <TextField label="Logradouro" value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} placeholder="Rua, avenida..." />
            <FormGrid cols={2}>
              <TextField label="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} placeholder="Bairro" />
              <TextField label="Complemento" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} placeholder="Opcional" />
            </FormGrid>
            <FormGrid cols={2}>
              <TextField label="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Cidade" />
              <SelectBox label="UF" value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })}>
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </SelectBox>
            </FormGrid>
            <TextField
              label="Peso estimado (kg)"
              type="number"
              min={0}
              step="0.1"
              value={form.peso}
              onChange={(e) => setForm({ ...form, peso: e.target.value })}
            />
          </FormSection>

          <FormActions onCancel={() => setShowNova(false)} saving={salvando} submitText="Solicitar postagem" />
        </Form>
      </Modal>
    </div>
  );
};

export default PostagemPage;
