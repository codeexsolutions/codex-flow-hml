import { Building2, Hash, FileText, User, MapPin, Phone, Smartphone, MessageCircle, Mail, ShieldCheck } from "lucide-react";
import useEnterprise from "@/features/empresa/store/enterprise.store";
import { formatDocument } from "@/shared/utils/format";
import { maskPhone as maskPhoneFn } from "@/shared/validation/masks";

const CorporateBadge = () => {
  const { enterprise } = useEnterprise();

  if (!enterprise) return null;

  const end = enterprise.endereco;
  const cont = enterprise.contato;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-fg/[0.08] bg-gradient-to-b from-surface-raised to-surface p-5">
      {/* Brilho decorativo */}
      <div className="pointer-events-none absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />

      <div className="relative flex flex-col items-center gap-4 text-center">
        {/* Logo */}
        <div className="relative">
          <div className="absolute -inset-2 rounded-3xl bg-accent/20 blur-lg" />
          <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-accent/30 bg-canvas shadow-[0_12px_40px_-16px_rgb(var(--accent)/0.7)]">
            {enterprise.urlLogo ? (
              <img src={enterprise.urlLogo} alt={enterprise.nomeFantasia} className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-8 w-8 text-accent-soft" />
            )}
          </div>
        </div>

        {/* Nome + status */}
        <div className="min-w-0">
          <h2 className="text-base text-ink">{enterprise.nomeFantasia}</h2>
          <div className="mt-1 flex items-center justify-center gap-2">
            <ShieldCheck size={14} className={enterprise.ativo ? "text-success" : "text-danger"} />
            <span className={`text-[11px] ${enterprise.ativo ? "text-success" : "text-danger"}`}>
              {enterprise.ativo ? "Conta ativa" : "Conta inativa"}
            </span>
          </div>
        </div>

        {/* Código da empresa */}
        {enterprise.codigoEmpresa && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/[0.08] px-3 py-1">
            <Hash size={11} className="text-accent-soft" />
            <span className="font-mono text-[11px] text-accent-soft">#{enterprise.codigoEmpresa}</span>
          </div>
        )}
      </div>

      {/* Documentos */}
      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-fg/[0.06] bg-fg/[0.03] p-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="flex items-center gap-1.5 text-mist">
            <FileText size={13} className="text-faint" /> CNPJ
          </span>
          <span className="tabular-nums text-ink">{enterprise.cpfCnpj ? formatDocument(enterprise.cpfCnpj) : "—"}</span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="flex items-center gap-1.5 text-mist">
            <User size={13} className="text-faint" /> Representante
          </span>
          <span className="truncate text-ink">{enterprise.nomeRepresentante || "—"}</span>
        </div>
        {enterprise.inscMunicipal && (
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-1.5 text-mist">
              <FileText size={13} className="text-faint" /> Insc. Municipal
            </span>
            <span className="tabular-nums text-ink">{enterprise.inscMunicipal}</span>
          </div>
        )}
      </div>

      {/* Endereço */}
      {end && (
        <div className="mt-3 rounded-xl border border-fg/[0.06] bg-fg/[0.03] p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-faint">
            <MapPin size={12} /> Endereço
          </p>
          <p className="text-[12px] leading-relaxed text-mist">
            {end.logradouro}, {end.numero}
            {end.complemento ? ` — ${end.complemento}` : ""}
            <br />
            {end.bairro} · {end.cidade}/{end.uf}
            <br />
            <span className="text-faint">CEP {end.cep}</span>
          </p>
        </div>
      )}

      {/* Contato */}
      {cont && (cont.email || cont.celular || cont.telefone || cont.whatsapp) && (
        <div className="mt-3 rounded-xl border border-fg/[0.06] bg-fg/[0.03] p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-faint">
            <Mail size={12} /> Contato
          </p>
          <div className="flex flex-col gap-1.5">
            {cont.email && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5 text-mist">
                  <Mail size={12} className="text-faint" /> Email
                </span>
                <span className="text-ink">{cont.email}</span>
              </div>
            )}
            {cont.celular && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5 text-mist">
                  <Smartphone size={12} className="text-faint" /> Celular
                </span>
                <span className="tabular-nums text-ink">{maskPhoneFn(String(cont.celular))}</span>
              </div>
            )}
            {cont.telefone && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5 text-mist">
                  <Phone size={12} className="text-faint" /> Telefone
                </span>
                <span className="tabular-nums text-ink">{maskPhoneFn(String(cont.telefone))}</span>
              </div>
            )}
            {cont.whatsapp && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5 text-mist">
                  <MessageCircle size={12} className="text-faint" /> WhatsApp
                </span>
                <span className="tabular-nums text-ink">{maskPhoneFn(String(cont.whatsapp))}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CorporateBadge;
