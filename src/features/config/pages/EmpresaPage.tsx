import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, MessageCircle, MapPin, Save, CircleCheck } from "lucide-react";

import useEnterprise from "@/features/empresa/store/enterprise.store";
import { useAlert } from "@/shared/ui/Alert";
import { onlyDigits, formatDocument } from "@/shared/utils/format";
import { maskCep, maskPhone } from "@/shared/validation/masks";

import { SettingsCard } from "@/features/config/components/ConfigUI";
import { empresaSchema, identificacaoSchema, type EmpresaData, type EmpresaInput } from "@/features/config/schema/company.schema";
import EmpresaIdentificacao from "@/features/config/components/EmpresaIdentificacao";
import EmpresaContato from "@/features/config/components/EmpresaContato";
import EmpresaEndereco from "@/features/config/components/EmpresaEndereco";
import CorporateBadge from "@/features/config/components/CorporateBadge";
import PixEmpresa from "@/features/config/components/PixEmpresa";

type EnterpriseLike = {
  id?: string;
  nomeFantasia?: string;
  name?: string;
  nomeRepresentante?: string;
  cpfCnpj?: string;
  inscMunicipal?: string;
  urlLogo?: string;
  notaBackground?: string;
  contato?: { email?: string; celular?: string | number; telefone?: string | number; whatsapp?: string | number };
  endereco?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
};

type TabId = "identificacao" | "contato" | "endereco";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "identificacao", label: "Identificação", icon: <Building2 size={15} /> },
  { id: "contato", label: "Contato", icon: <MessageCircle size={15} /> },
  { id: "endereco", label: "Endereço", icon: <MapPin size={15} /> },
];

const EmpresaPage = () => {
  const { enterprise, updateEnterprise } = useEnterprise();
  const ent = (enterprise ?? {}) as EnterpriseLike;
  const alert = useAlert();
  const [tab, setTab] = useState<TabId>("identificacao");

  /* ─── Save states individuais ─── */
  const [saving, setSaving] = useState<TabId | null>(null);
  const [savedTab, setSavedTab] = useState<TabId | null>(null);

  const {
    register,
    control,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<EmpresaInput, unknown, EmpresaData>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nomeFantasia: ent.nomeFantasia ?? ent.name ?? "",
      nomeRepresentante: ent.nomeRepresentante ?? "",
      cpfCnpj: formatDocument(ent.cpfCnpj ?? ""),
      inscMunicipal: ent.inscMunicipal ?? "",
      urlLogo: ent.urlLogo ?? "",
      notaBackground: ent.notaBackground ?? "",
      email: ent.contato?.email ?? "",
      celular: maskPhone(String(ent.contato?.celular ?? "")),
      telefone: maskPhone(String(ent.contato?.telefone ?? "")),
      whatsapp: maskPhone(String(ent.contato?.whatsapp ?? "")),
      cep: maskCep(ent.endereco?.cep ?? ""),
      logradouro: ent.endereco?.logradouro ?? "",
      numero: ent.endereco?.numero ?? "",
      complemento: ent.endereco?.complemento ?? "",
      bairro: ent.endereco?.bairro ?? "",
      cidade: ent.endereco?.cidade ?? "",
      uf: ent.endereco?.uf ?? "",
    },
  });

  const allData = () => getValues() as EmpresaData;

  const buscarCep = async () => {
    const cep = onlyDigits(getValues("cep"));
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) return;
      if (data.logradouro) setValue("logradouro", data.logradouro);
      if (data.bairro) setValue("bairro", data.bairro);
      if (data.localidade) setValue("cidade", data.localidade);
      if (data.uf) setValue("uf", data.uf);
    } catch {
      /* silencioso */
    }
  };

  const doSave = async (tabId: TabId, saveFn: () => Promise<void>) => {
    setSaving(tabId);
    setSavedTab(null);
    try {
      await saveFn();
      setSavedTab(tabId);
      setTimeout(() => setSavedTab(null), 2500);
    } catch (err) {
      if (!(err instanceof Error && err.message === "VALIDATION_HANDLED")) {
        alert.error("Erro ao salvar", "Não foi possível salvar.");
      }
    } finally {
      setSaving(null);
    }
  };

  const salvarIdentificacao = async () => {
    const id = ent.id;
    if (!id) return;

    // Valida só os campos desta aba — usar o schema inteiro faria essa aba
    // falhar por causa de um campo obrigatório de Contato/Endereço (ex:
    // e-mail vazio) que nem está sendo editado agora.
    const parsed = identificacaoSchema.safeParse(getValues());
    if (!parsed.success) {
      alert.error("Campos inválidos", "Revise os campos de Identificação.");
      throw new Error("VALIDATION_HANDLED");
    }

    const data = parsed.data;
    await updateEnterprise(id, {
      nomeFantasia: data.nomeFantasia,
      nomeRepresentante: data.nomeRepresentante,
      cpfCnpj: onlyDigits(data.cpfCnpj),
      inscMunicipal: data.inscMunicipal,
      urlLogo: data.urlLogo,
      notaBackground: data.notaBackground,
    });
  };

  const salvarContato = async () => {
    if (!ent.id) return;
    const data = allData();
    await updateEnterprise(ent.id, {
      contato: {
        email: data.email,
        celular: onlyDigits(data.celular),
        telefone: onlyDigits(data.telefone),
        whatsapp: onlyDigits(data.whatsapp),
      },
    });
  };

  const salvarEndereco = async () => {
    if (!ent.id) return;
    const data = allData();
    await updateEnterprise(ent.id, {
      endereco: {
        cep: onlyDigits(data.cep),
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        cidade: data.cidade,
        uf: data.uf,
      },
    });
  };

  const SaveBtn = ({ tabId, onClick }: { tabId: TabId; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={saving === tabId}
      className={`flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
        savedTab === tabId ? "bg-success/20 text-success" : "bg-accent text-white shadow-[0_6px_20px_-6px_rgb(var(--accent))] hover:brightness-110"
      }`}
    >
      {saving === tabId ? (
        "Salvando..."
      ) : savedTab === tabId ? (
        <>
          <CircleCheck size={15} /> Salvo
        </>
      ) : (
        <>
          <Save size={15} /> Salvar
        </>
      )}
    </button>
  );

  return (
    /*
     * Grade única, alinhada à esquerda. Antes era uma aba por vez dentro de um
     * `overflow-y-auto` próprio — que rolava dentro da rolagem de Configurações.
     * Agora os três blocos ficam visíveis juntos e cada um salva o seu.
     * `items-start` impede que um card curto seja esticado até a altura do vizinho.
     */
    /*
     * As seções continuam separadas (Identificação / Contato / Endereço) —
     * cada uma salva o seu. O que mudou foi só o esqueleto: sem o
     * `overflow-y-auto` próprio, que rolava dentro da rolagem de Configurações.
     */
    <div className="grid grid-cols-1 items-start gap-4 pb-2 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
        <div className="flex w-fit items-center gap-1 rounded-lg border border-fg/[0.07] bg-fg/[0.03] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`focus-ring flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[12px] transition-all ${tab === t.id ? "bg-accent text-white shadow-glow" : "text-mist hover:bg-fg/[0.06] hover:text-ink"}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === "identificacao" && (
          <SettingsCard icon={<Building2 className="h-4 w-4" />} title="Identificação" desc="Dados principais da empresa" footer={<SaveBtn tabId="identificacao" onClick={() => doSave("identificacao", salvarIdentificacao)} />}>
            <EmpresaIdentificacao register={register} errors={errors} setValue={setValue} watch={watch} />
          </SettingsCard>
        )}

        {tab === "contato" && (
          <SettingsCard icon={<MessageCircle className="h-4 w-4" />} title="Contato" desc="Telefones e e-mail da empresa" footer={<SaveBtn tabId="contato" onClick={() => doSave("contato", salvarContato)} />}>
            <EmpresaContato register={register} errors={errors} />
          </SettingsCard>
        )}

        {tab === "endereco" && (
          <SettingsCard icon={<MapPin className="h-4 w-4" />} title="Endereço" desc="CEP e localização da empresa" footer={<SaveBtn tabId="endereco" onClick={() => doSave("endereco", salvarEndereco)} />}>
            <EmpresaEndereco register={register} control={control} errors={errors} onBuscarCep={buscarCep} />
          </SettingsCard>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-0">
        <CorporateBadge />
        {/* Chave Pix mora aqui: é cadastro da empresa, não assunto de nota. */}
        <PixEmpresa />
      </aside>
    </div>
  );
};

export default EmpresaPage;
