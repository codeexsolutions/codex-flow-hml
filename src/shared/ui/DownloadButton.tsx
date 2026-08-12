import { toBlob } from "html-to-image";
import type { RefObject } from "react";
import { appInstalado } from "@/shared/pwa/appMode";

const resolveToken = (token: string, fallback: string): string => {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return raw ? `rgb(${raw})` : fallback;
};

/**
 * Converte uma imagem externa em data URI.
 *
 * `html-to-image` desenha tudo num canvas, e imagem de outro domínio sem CORS
 * "contamina" esse canvas — o navegador então proíbe exportar e o download
 * falha inteiro. Trazer os bytes para o próprio documento resolve.
 */
async function embutir(img: HTMLImageElement): Promise<boolean> {
  const src = img.getAttribute("src") ?? "";

  // Já é local ou já está embutida: nada a fazer.
  if (!src || src.startsWith("data:") || src.startsWith(window.location.origin) || src.startsWith("/")) return true;

  try {
    const resposta = await fetch(src, { mode: "cors" });

    if (!resposta.ok) return false;

    const blob = await resposta.blob();

    const dataUrl: string = await new Promise((ok, erro) => {
      const leitor = new FileReader();
      leitor.onload = () => ok(String(leitor.result));
      leitor.onerror = erro;
      leitor.readAsDataURL(blob);
    });

    img.setAttribute("data-src-original", src);
    img.setAttribute("src", dataUrl);

    return true;

  } catch {
    return false;
  }
}

/**
 * Rasteriza o nó da nota para um blob PNG.
 *
 * Fica separado do download: quem precisa do PNG (download) e quem precisa
 * dele para gerar um PDF usam o mesmo blob. Toda a preparação — rolar ao
 * topo, embutir imagens cross-origin, esconder `data-sem-foto` — e a limpeza
 * acontecem aqui.
 */
export const gerarBlobNota = async (ref: RefObject<HTMLDivElement>): Promise<Blob> => {
  const node = ref.current;
  if (!node) throw new Error("Nota não encontrada.");

  /* Qualquer elemento rolado — um scroller acima da nota ou aninhado dentro
     dela — mostra só um pedaço do conteúdo, e é esse pedaço que vai para o PNG.
     Zeramos todos antes de fotografar e devolvemos depois.

     Subir por TODOS os ancestrais, e não só pelo pai, é o que corrige a nota
     cortada pela metade: dentro de um modal a nota fica a dois ou três níveis
     do scroller de verdade (o corpo do modal), então olhar apenas
     `node.parentElement` acertava um `<div>` que nunca rola e deixava o
     scroller real intacto. Quem tivesse rolado até o total antes de clicar em
     baixar levava o topo da nota cortado. */
  const rolados: { el: HTMLElement; top: number; left: number }[] = [];

  const guardarERolarAoTopo = (el: HTMLElement | null) => {
    if (!el || (el.scrollTop === 0 && el.scrollLeft === 0)) return;

    rolados.push({ el, top: el.scrollTop, left: el.scrollLeft });
    el.scrollTop = 0;
    el.scrollLeft = 0;
  };

  for (let pai = node.parentElement; pai; pai = pai.parentElement) {
    guardarERolarAoTopo(pai);
  }

  node.querySelectorAll<HTMLElement>("*").forEach(guardarERolarAoTopo);

  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  const imgs = Array.from(node.querySelectorAll<HTMLImageElement>("img"));

  const embutidas = await Promise.all(imgs.map(embutir));

  /* Só some quem não deu para embutir — assim o resto da nota sai completo. */
  const escondidas: { el: HTMLImageElement; display: string }[] = [];

  imgs.forEach((img, i) => {
    if (embutidas[i]) return;

    escondidas.push({ el: img, display: img.style.display });
    img.style.display = "none";
  });

  try {
    const blob = await toBlob(node, {
      /*
       * Tudo marcado com `data-sem-foto` fica de fora do PNG.
       *
       * Existem controles que precisam estar na tela e não podem estar no
       * arquivo que o cliente recebe — os atalhos de pagamento parcial, por
       * exemplo. Filtrar na hora de rasterizar é mais seguro do que esconder e
       * mostrar por CSS: não há intervalo em que o elemento pisca, e não
       * depende de o `finally` conseguir devolver o estilo se algo falhar.
       */
      filter: (no) => !(no instanceof HTMLElement && no.dataset.semFoto !== undefined),
      backgroundColor: resolveToken("--surface", "#15132a"),
      width: node.scrollWidth,
      height: node.scrollHeight,
      pixelRatio: 2,
      cacheBust: true,
      style: {
        transform: "none",
        transformOrigin: "top left",
      },
    });

    if (!blob) throw new Error("Falha ao gerar a imagem da nota.");

    return blob;

  } finally {
    escondidas.forEach(({ el, display }) => {
      el.style.display = display;
    });

    // Devolve o `src` original: a nota continua na tela depois do download.
    imgs.forEach((img) => {
      const original = img.getAttribute("data-src-original");

      if (original) {
        img.setAttribute("src", original);
        img.removeAttribute("data-src-original");
      }
    });

    rolados.forEach(({ el, top, left }) => {
      el.scrollTop = top;
      el.scrollLeft = left;
    });
  }
};

/** Baixa o blob como PNG (nome padrão `nota-...png`). */
const baixarBlob = async (blob: Blob, filename: string) => {
  /**
   * App instalado (tela de início / standalone) é o único caso em que
   * `<a download>` está provadamente quebrado: essa janela roda numa
   * WKWebView (iOS) ou equivalente sem o gerenciador de downloads do
   * navegador — o clique simplesmente não tem pra onde salvar o arquivo.
   * No Safari/Chrome normais (aba de navegador), o link com blob URL abaixo
   * já baixa direto, então só entramos aqui no caso que exige outro caminho.
   *
   * A Web Share API entrega o arquivo pro sistema operacional, que mostra o
   * menu nativo de salvar/compartilhar — funciona dentro do app instalado
   * tanto no iOS quanto no Android.
   */
  if (appInstalado()) {
    const file = new File([blob], filename, { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        // Usuário cancelou o menu de compartilhamento: não é um erro de
        // download, então não cai no fallback nem loga nada.
        if (err instanceof Error && err.name === "AbortError") return;
        throw err;
      }
    }
  }

  /* Navegador comum (não instalado): blob URL em vez de data URI. Além de
     mais leve pra notas grandes, evita o limite de tamanho que o Safari
     impõe a data URIs — o link com blob URL baixa normalmente em qualquer
     navegador de aba, incluindo Safari iOS/macOS desde a versão 13. */
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/**
 * Baixa a nota como PNG (o fluxo de sempre).
 *
 * Antes daqui saía uma nota sem QR e sem logo: o código escondia **todas** as
 * `<img>` antes de rasterizar, para o download parar de falhar. O problema real
 * nunca foi a imagem existir — era ser de outro domínio. Agora cada imagem é
 * embutida como data URI e só é escondida a que não puder ser trazida, em vez
 * de sacrificar todas.
 */
export const handleDownload = async (ref: RefObject<HTMLDivElement>, filename = `nota-${Date.now()}.png`) => {
  try {
    const blob = await gerarBlobNota(ref);
    await baixarBlob(blob, filename);
  } catch (err) {
    console.error("Erro ao gerar imagem da nota:", err);
    throw err;
  }
};
