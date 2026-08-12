/* Import dinâmico de propósito: o jsPDF (e o html2canvas que ele arrasta)
   pesam ~400 kB e só são necessários no clique de "Baixar PDF". Com o import
   estático o bundle principal cresceria além do limite do PWA e o service
   worker falharia. */

/**
 * Nome de arquivo a partir do nome da empresa: sem acentos, sem espaços
 * estranhos — "Loja da Maria" vira "loja-da-maria".
 */
const nomeArquivo = (nome: string) =>
  nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "nota";

/**
 * Gera o PDF da nota a partir do PNG já rasterizado.
 *
 * O PNG da nota (via `handleDownload`) já tem o visual completo — incluindo o
 * wallpaper e a logo. Aqui ele é colado numa página A4 e salvo como
 * `nota-<empresa>.pdf`.
 *
 * Nota longa demais para uma página vira várias: a cada página a imagem é
 * deslocada para cima, revelando a próxima fatia — o mesmo resultado de uma
 * nota que rolaria na tela.
 */
export async function baixarNotaPdf(blob: Blob, nomeEmpresa: string): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const data = new Date().toISOString().slice(0, 10);

  return new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();

    leitor.onerror = reject;

    leitor.onload = () => {
      const dataUrl = String(leitor.result);
      const img = new Image();

      img.onerror = () => reject(new Error("Falha ao ler a imagem da nota."));

      img.onload = () => {
        try {
          const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

          const paginaW = 210;
          const paginaH = 297;
          const margem = 8;
          const areaW = paginaW - margem * 2;
          const areaH = paginaH - margem * 2;

          const proporcao = img.height / img.width;
          const w = areaW;
          const h = w * proporcao;

          const paginas = Math.max(1, Math.ceil(h / areaH));

          for (let i = 0; i < paginas; i++) {
            if (i > 0) doc.addPage();
            // Desloca a imagem para cima a cada página — a fatia visível muda.
            doc.addImage(dataUrl, "PNG", margem, margem - i * areaH, w, h);
          }

          const arquivo = `nota-${nomeArquivo(nomeEmpresa)}-${data}.pdf`;
          doc.save(arquivo);
          resolve(arquivo);
        } catch (err) {
          reject(err);
        }
      };

      img.src = dataUrl;
    };

    leitor.readAsDataURL(blob);
  });
}
