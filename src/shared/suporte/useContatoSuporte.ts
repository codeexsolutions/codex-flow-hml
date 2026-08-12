import { useEffect, useState } from "react";

import sysgrafix from "@/shared/api/sysgrafix";

export type ContatoSuporte = { whatsapp: string; email: string };

/**
 * Contato do suporte, vindo do painel da plataforma.
 *
 * Antes o número ficava cravado em dois arquivos do frontend — e foi assim que
 * um número pessoal acabou publicado no ar. Agora a fonte é a configuração da
 * CodEx Solutions: trocar o número no painel muda em todo lugar, sem build.
 *
 * O padrão é vazio, não um número de reserva: telefone errado é pior que
 * telefone nenhum. Sem valor configurado, quem consome esconde o canal.
 */
export function useContatoSuporte(): ContatoSuporte {
  const [contato, setContato] = useState<ContatoSuporte>({ whatsapp: "", email: "" });

  useEffect(() => {
    let vivo = true;

    sysgrafix
      .get("/admin/contato")
      .then((r) => {
        const d = r.data?.data?.[0];
        if (vivo && d) setContato({ whatsapp: String(d.whatsapp ?? ""), email: String(d.email ?? "") });
      })
      .catch(() => {});

    return () => {
      vivo = false;
    };
  }, []);

  return contato;
}

/** Só dígitos e com DDI — formato que o wa.me exige. */
export const linkWhatsapp = (numero: string, mensagem: string): string => {
  const digitos = numero.replace(/\D/g, "");
  const comDdi = digitos.length <= 11 ? `55${digitos}` : digitos;

  return `https://wa.me/${comDdi}?text=${encodeURIComponent(mensagem)}`;
};
