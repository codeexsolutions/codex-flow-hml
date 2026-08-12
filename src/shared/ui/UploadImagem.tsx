import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import sysgrafix from "@/shared/api/sysgrafix";

/**
 * Envio de imagem — escolher arquivo, não colar link.
 *
 * Até aqui a logo da empresa era uma URL digitada à mão, e o que estava lá em
 * produção era link de CDN do WhatsApp e do imgur. O do WhatsApp EXPIRA: a
 * logo some da nota sozinha, e o cliente descobre pelo PDF que já mandou pro
 * comprador. Agora o arquivo vira WebP no servidor e mora no nosso storage.
 *
 * O campo de URL continua aceito para quem já tem uma imagem hospedada — o
 * upload é o caminho fácil, não uma parede.
 */

export type TipoImagem = "logo" | "wallpaper" | "produto" | "usuario";

type Props = {
  tipo: TipoImagem;
  valor: string | null | undefined;
  onChange: (url: string | null) => void;
  rotulo?: string;
  /** Quadrada para logo e foto; larga para o fundo da nota. */
  formato?: "quadrado" | "largo";
};

const UploadImagem = ({ tipo, valor, onChange, rotulo = "Imagem", formato = "quadrado" }: Props) => {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const enviar = async (arquivo: File) => {
    setErro("");
    setEnviando(true);

    try {
      const corpo = new FormData();
      corpo.append("imagem", arquivo);

      /* Sem `Content-Type` no cabeçalho de propósito: o browser precisa
         montar o `boundary` do multipart sozinho, e defini-lo à mão faz o
         multer não achar o arquivo. */
      const { data } = await sysgrafix.post(`/upload/${tipo}`, corpo);
      const salva = data?.data?.[0];

      if (!salva?.url) throw new Error(data?.message || "Falha ao enviar.");

      onChange(salva.url);

    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setErro(err?.response?.data?.message ?? err?.message ?? "Não foi possível enviar a imagem.");
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const molde = formato === "largo" ? "aspect-[16/6] w-full" : "h-24 w-24";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] uppercase tracking-[0.08em] text-faint">{rotulo}</label>

      <div className="flex flex-wrap items-center gap-3">
        {/* A prévia é o próprio botão: clicar na imagem troca a imagem, que é
            o que a pessoa tenta fazer antes de procurar um botão. */}
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={enviando}
          className={`focus-ring group relative shrink-0 overflow-hidden rounded-xl border border-dashed border-fg/[0.16] bg-fg/[0.03] transition-colors hover:border-accent/50 disabled:opacity-60 ${molde}`}
        >
          {valor ? (
            <img src={valor} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-faint">
              <ImagePlus size={18} />
              <span className="text-[10.5px]">Escolher</span>
            </span>
          )}

          {enviando && (
            <span className="absolute inset-0 grid place-items-center bg-surface/80">
              <Loader2 size={18} className="animate-spin text-accent" />
            </span>
          )}
        </button>

        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              disabled={enviando}
              className="focus-ring rounded-lg border border-fg/[0.1] px-3 py-1.5 text-[12px] text-mist transition-colors hover:text-ink disabled:opacity-50"
            >
              {valor ? "Trocar" : "Enviar imagem"}
            </button>

            {valor && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="focus-ring flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-muted transition-colors hover:text-danger"
              >
                <Trash2 size={13} /> Remover
              </button>
            )}
          </div>

          {/* Sem placar de compressão.
              O "de 4,2 MB para 180 kB" era informação sobre o SISTEMA, não
              sobre a imagem: quem sobe a logo quer ver a logo. A conversão
              para WebP continua acontecendo — calada. */}
          {erro && <p className="text-[11px] text-danger">{erro}</p>}
        </div>
      </div>

      {/*
        `image/*`, e não uma lista de extensões.

        A lista fixa que estava aqui deixava arquivos CINZAS no seletor do
        sistema: a foto do iPhone (HEIC) e a logo do designer (SVG) apareciam
        sem poder ser escolhidas, sem nenhuma explicação do porquê. O servidor
        aceita tudo que sabe converter, então o seletor não pode ser mais
        restrito que ele.
      */}
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) void enviar(arquivo);
        }}
      />
    </div>
  );
};

export default UploadImagem;
