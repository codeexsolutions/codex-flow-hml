/**
 * Wallpaper da nota: imagem de fundo com overlay translúcido, com o conteúdo
 * por cima. Usado na nota de venda, no resumo da tabela e no orçamento — o
 * mesmo visual nos três downloads.
 *
 * A imagem faz parte do nó rasterizado (`html-to-image`), então sai no PNG e
 * no PDF automaticamente.
 */
type Props = {
  /** URL ou data URI da imagem de fundo. Vazio = sem fundo. */
  imagem?: string | null;
};

const FundoNota = ({ imagem }: Props) => {
  if (!imagem) return null;

  return (
    <>
      <img src={imagem} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.18 }} />
      <div className="pointer-events-none absolute inset-0 bg-surface/80" />
    </>
  );
};

export default FundoNota;
