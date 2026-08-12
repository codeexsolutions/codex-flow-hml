import { useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Mail, Phone, Briefcase, Camera, Trash2, Lock, Shield, CalendarDays, Loader2 } from "lucide-react";
import useAuth from "@/features/auth/store/auth.store";
import { useAlert } from "@/shared/ui/Alert";
import Field from "@/shared/ui/inputs/Field";

import { maskPhone } from "@/shared/validation/masks";
import sysgrafix from "@/shared/api/sysgrafix";
import { SettingsCard, SaveRow, PasswordField, useSaver } from "@/features/config/components/ConfigUI";
import { profileSchema, type ProfileData, type ProfileInput, passwordSchema, type PasswordData } from "@/features/config/schema/profile.schema";
import ProfileService from "@/features/config/services/profile.service";

/*
 * A foto vai para o STORAGE, não para dentro do JSON.
 *
 * Ela era lida como data URL (base64) e enviada no corpo do PATCH. Duas
 * coisas quebravam nisso, e a primeira sozinha já impedia qualquer foto de
 * funcionar: `express.json()` recusa corpo acima de 100 kB, e base64 engorda
 * o arquivo em ~33% — uma foto de 100 kB vira 133 kB de texto e o servidor
 * responde 413 antes de olhar o conteúdo. A segunda é que, mesmo passando,
 * a imagem inteira ficaria guardada como texto na linha do usuário e viajaria
 * junto em toda leitura de perfil.
 *
 * O endpoint `/upload/usuario` já existia, já converte para WebP de 256px e
 * já guarda no Supabase. O que se salva no usuário passa a ser a URL.
 */
const MAX_PHOTO = 10 * 1024 * 1024;

const ProfilePage = () => {
  const { user } = useAuth();
  const alert = useAlert();
  const profileSaver = useSaver(async () => {
    const data = watchProfile();
    await ProfileService.updateProfile({
      nome: data.name,
      cargo: data.role ?? "",
      /* `""` e não `undefined` ao remover: `undefined` some no
         `JSON.stringify` e o servidor só sobrescreve o que chega — a foto
         antiga voltaria na próxima carga da tela. */
      imagem: photo ?? "",
    });
  });
  const pwdSaver = useSaver();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(user?.image ?? null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const {
    register: regProfile,
    handleSubmit: submitProfile,
    watch: watchProfile,
  } = useForm<ProfileInput, unknown, ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.nome ?? "",
      email: user?.email ?? "",
      phone: maskPhone(String(user?.phone ?? "")),
      role: user?.cargo ?? "",
    },
  });

  const {
    control,
    handleSubmit: submitPwd,
    reset: resetPwd,
    watch: watchPwd,
    formState: { errors: pwdErrors },
  } = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: "", next: "", confirm: "" },
  });

  const nameValue = watchProfile("name");
  const initials = useMemo(
    () =>
      nameValue
        ?.split("")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || "U",
    [nameValue],
  );

  const pwdValues = watchPwd();
  const canUpdatePwd = Boolean(pwdValues.current && pwdValues.next && pwdValues.next === pwdValues.confirm);

  const onPick = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];

    /* Limpa o input antes de sair: sem isso, escolher o MESMO arquivo depois
       de um erro não dispara `change` de novo, e a tela parece travada. */
    ev.target.value = "";

    if (!file) return;

    if (file.size > MAX_PHOTO) {
      alert.warning("Imagem muito grande", "Escolha uma imagem de até 10 MB.");
      return;
    }

    setEnviandoFoto(true);

    try {
      const corpo = new FormData();
      corpo.append("imagem", file);

      /* Sem `Content-Type` à mão: o browser precisa montar o `boundary` do
         multipart sozinho. */
      const { data } = await sysgrafix.post("/upload/usuario", corpo);
      const url = data?.data?.[0]?.url;

      if (!url) throw new Error(data?.message || "Falha ao enviar a foto.");

      /* A URL entra na tela na hora; o PATCH que a grava no usuário é o
         "Salvar" do cartão — o mesmo botão que salva nome e cargo. */
      setPhoto(url);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      alert.error("Não foi possível enviar a foto", err?.response?.data?.message ?? err?.message ?? "Tente de novo em instantes.");
    } finally {
      setEnviandoFoto(false);
    }
  };

  const regPhone = regProfile("phone");

  const onProfileValid = async () => {
    await profileSaver.save();
    alert.success("Perfil atualizado", "Suas informações foram salvas.");
  };

  const onPwdValid = async () => {
    await pwdSaver.save();
    alert.success("Senha atualizada", "Sua senha foi alterada com sucesso.");
    resetPwd({ current: "", next: "", confirm: "" });
  };

  const onInvalid = () => alert.error("Campos inválidos", "Revise os campos destacados.");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto xl:grid-cols-2">
        {/* Perfil */}
        <SettingsCard icon={<User className="h-4 w-4" />} title="Meu perfil" desc="Foto e informações pessoais." footer={<SaveRow {...profileSaver} onSave={submitProfile(onProfileValid, onInvalid)} savedLabel="Perfil atualizado" />}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div className="relative h-24 w-24 shrink-0">
                {photo ? (
                  <img
                    src={photo}
                    alt="Foto do perfil"
                    className="h-24 w-24 rounded-2xl border border-accent/40 object-cover"
                    /* Foto apagada do storage por fora não pode virar ícone
                       quebrado: volta para as iniciais. */
                    onError={() => setPhoto(null)}
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-accent/40 bg-gradient-to-br from-accent-strong to-accent-soft text-2xl text-white">{initials}</div>
                )}

                {enviandoFoto && (
                  <span className="absolute inset-0 grid place-items-center rounded-2xl bg-surface/80">
                    <Loader2 size={20} className="animate-spin text-accent" />
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                <input ref={fileRef} type="file" accept="image/*" onChange={(ev) => void onPick(ev)} className="hidden" />
                <button type="button" disabled={enviandoFoto} onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-fg/[0.1] bg-fg/[0.06] px-3 py-1.5 text-[12px] text-accent-soft transition-colors hover:bg-fg/[0.12] disabled:cursor-not-allowed disabled:opacity-50">
                  <Camera size={14} /> {enviandoFoto ? "Enviando…" : "Trocar"}
                </button>
                {photo && (
                  <button type="button" onClick={() => setPhoto(null)} className="flex items-center gap-1.5 rounded-lg border border-danger/25 bg-danger/20 px-3 py-1.5 text-[12px] text-danger hover:bg-danger/30">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              <Field label="Nome completo" icon={<User size={15} />} {...regProfile("name")} />
              <Field label="E-mail" icon={<Mail size={15} />} type="email" {...regProfile("email")} />
              <Field
                label="Telefone"
                icon={<Phone size={15} />}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                {...regPhone}
                onChange={(e) => {
                  e.target.value = maskPhone(e.target.value);
                  regPhone.onChange(e);
                }}
              />
              <Field label="Cargo" icon={<Briefcase size={15} />} hint="Definido pela empresa" disabled readOnly {...regProfile("role")} />
            </div>
          </div>
        </SettingsCard>

        {/* Senha + Info da conta */}
        <div className="flex min-w-0 flex-col gap-5">
          <SettingsCard
            icon={<Lock className="h-4 w-4" />}
            title="Alterar senha"
            desc="Use uma senha forte e única."
            footer={<SaveRow {...pwdSaver} onSave={submitPwd(onPwdValid, onInvalid)} label="Atualizar senha" savedLabel="Senha atualizada" icon={<Shield className="h-4 w-4" />} variant="secondary" disabled={!canUpdatePwd} />}
          >
            <div className="grid grid-cols-1 gap-4">
              <Controller control={control} name="current" render={({ field }) => <PasswordField label="Senha atual" {...field} show={showPwd} onToggle={() => setShowPwd((v) => !v)} error={pwdErrors.current?.message} />} />
              <Controller control={control} name="next" render={({ field }) => <PasswordField label="Nova senha" {...field} show={showPwd} onToggle={() => setShowPwd((v) => !v)} error={pwdErrors.next?.message} />} />
              <Controller control={control} name="confirm" render={({ field }) => <PasswordField label="Confirmar nova senha" {...field} show={showPwd} onToggle={() => setShowPwd((v) => !v)} error={pwdErrors.confirm?.message} />} />
            </div>
          </SettingsCard>

          <SettingsCard icon={<CalendarDays className="h-4 w-4" />} title="Conta" desc="Informações da sua conta no CodeEx Flow">
            <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/[0.08] px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/25">
                <Shield size={15} className="text-success" />
              </div>
              <div>
                <p className="text-sm text-ink">Conta ativa</p>
                <p className="text-[11px] text-faint">Membro desde {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
              </div>
            </div>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
