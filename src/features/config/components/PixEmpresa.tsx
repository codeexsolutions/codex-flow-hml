import { useEffect, useState } from "react";
import { QrCode, Loader2, Check, ShieldAlert } from "lucide-react";

import PixService, { pixConfigurado, type ConfigPix, type PixKeyType } from "@/features/config/services/pix.service";
import { useAlert } from "@/shared/ui/Alert";
import { extractErrorMessage, getErrorTitle } from "@/shared/utils/errorHandler";
import useAuth from "@/features/auth/store/auth.store";

const TIPOS: { id: PixKeyType; label: string }[] = [
  { id: "cpf", label: "CPF" },
  { id: "cnpj", label: "CNPJ" },
  { id: "phone", label: "Telefone" },
  { id: "email", label: "E-mail" },
  { id: "random", label: "Chave aleatória" },
];

const campo = "w-full rounded-xl border border-fg/[0.08] bg-fg/[0.03] px-3.5 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-accent/60";

/**
 * Chave Pix da empresa — o lugar certo dela.
 *
 * Antes isto era um modal dentro da nota, gravando em `localStorage`. Duas
 * coisas erradas: chave Pix não é assunto de nota (é cadastro da empresa,
 * configurado uma vez), e no navegador cada vendedor tinha a sua cópia, editável
 * pelo DevTools.
 *
 * Só o usuário master vê o formulário. Quem não é vê o estado e o motivo —
 * esconder sem explicar faz a pessoa achar que é defeito. E a recusa de verdade
 * é da API: a tela some, mas quem barra é o servidor.
 */
const PixEmpresa = () => {
  const alert = useAlert();
  const { user } = useAuth();

  /* `root`, não "gestor": trocar a chave é redirecionar o dinheiro do cliente.
     Nem um administrador promovido pelo dono pode fazer isso. */
  const ehMaster = Boolean(user?.root);

  const [dados, setDados] = useState<ConfigPix>({ chave: "", tipoChave: "cpf", beneficiario: "", cidade: "" });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    PixService.consultar()
      .then(setDados)
      .finally(() => setCarregando(false));
  }, []);

  const salvar = async () => {
    setSalvando(true);

    try {
      await PixService.salvar(dados);
      alert.success("Chave Pix salva!", "As próximas notas já saem com o QR desta chave.");
    } catch (err) {
      alert.error(getErrorTitle(err), extractErrorMessage(err, "Não foi possível salvar a chave Pix."));
    } finally {
      setSalvando(false);
    }
  };

  const configurado = pixConfigurado(dados);

  return (
    <section className="card glass-sheen flex flex-col gap-4 p-5">
      <header className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/[0.14] text-accent-soft ring-1 ring-inset ring-accent/20">
          <QrCode size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-[13.5px] leading-none text-ink">Chave Pix</h2>
          <p className="mt-1 text-[11.5px] text-faint">É com ela que o QR das notas é gerado</p>
        </div>

        {!carregando && configurado && (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] text-success">
            <Check size={11} /> Configurada
          </span>
        )}
      </header>

      {!ehMaster ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-fg/[0.07] bg-fg/[0.02] px-4 py-3">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-faint" />
          <p className="text-[12px] leading-relaxed text-mist">
            {configurado ? "A chave Pix está configurada e as notas saem com QR." : "Ainda não há chave Pix configurada."}{" "}
            <span className="text-ink">Só o usuário master pode alterá-la</span> — é ela que define para onde vai o dinheiro dos clientes.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.08em] text-faint">Tipo da chave</span>
              <select value={dados.tipoChave} onChange={(e) => setDados({ ...dados, tipoChave: e.target.value as PixKeyType })} className={campo}>
                {TIPOS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.08em] text-faint">Chave</span>
              <input value={dados.chave} onChange={(e) => setDados({ ...dados, chave: e.target.value })} placeholder="A chave que recebe o pagamento" className={campo} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.08em] text-faint">Beneficiário</span>
              <input value={dados.beneficiario} onChange={(e) => setDados({ ...dados, beneficiario: e.target.value })} placeholder="Nome que aparece para quem paga" className={campo} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.08em] text-faint">Cidade</span>
              <input value={dados.cidade} onChange={(e) => setDados({ ...dados, cidade: e.target.value })} placeholder="Cidade do beneficiário" className={campo} />
            </label>
          </div>

          <button
            onClick={salvar}
            disabled={salvando || carregando}
            className="flex min-h-[42px] items-center justify-center gap-2 self-start rounded-xl bg-accent px-5 text-[13px] text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Salvar chave Pix
          </button>
        </>
      )}
    </section>
  );
};

export default PixEmpresa;
