import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PackageSearch, Plus, Loader2, CornerDownLeft } from "lucide-react";

import ProductType from "@/shared/domain/produto";
import { formatCurrency } from "@/shared/utils/currency";

/**
 * Busca de produtos, logo acima da tabela de itens da nota (e do orçamento).
 *
 * Substitui o modal de "Adicionar produto": quem opera digita e vê o produto na
 * hora, sem trocar de tela.
 *
 * Fica FORA da tabela de propósito. Como célula, a lista de sugestões era
 * recortada pelo `overflow-hidden` do quadro da tabela — as opções existiam no
 * DOM e simplesmente não apareciam. Acima da tabela, a lista tem para onde
 * crescer.
 *
 * Teclado é o caminho principal: quem atende no balcão digita, desce até o
 * produto e aperta Enter, sem soltar o teclado para pegar o mouse.
 */
type Props = {
  produtos: ProductType[];
  carregando?: boolean;
  onAdicionar: (produto: ProductType) => void;
};

/**
 * Espera antes de mostrar o resultado.
 *
 * O filtro é local e instantâneo — as opções apareceriam no mesmo quadro da
 * tecla. Sem uma pausa curta, a lista pisca e se reordena a cada letra, e o
 * olho não acompanha. Este intervalo dá tempo de a pessoa terminar a palavra e
 * transforma a busca num movimento só: digita, carrega, aparece.
 */
const ESPERA_MS = 180;

const BuscaProduto = ({ produtos, carregando = false, onAdicionar }: Props) => {
  const [busca, setBusca] = useState("");
  const [procurando, setProcurando] = useState(false);
  /* Qual sugestão está sob o cursor do teclado. */
  const [indice, setIndice] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  const termo = busca.trim().toLowerCase();

  /* Enquanto `procurando`, a lista não é calculada: é o que faz a animação de
     carregamento aparecer em vez de o resultado saltar pronto. */
  const sugestoes = useMemo(() => {
    if (!termo || procurando) return [];
    return produtos.filter((p) => p.nome?.toLowerCase().includes(termo)).slice(0, 8);
  }, [produtos, termo, procurando]);

  /* Cada tecla reinicia a espera — só para de "procurar" quando a digitação
     para. */
  useEffect(() => {
    if (!termo) {
      setProcurando(false);
      return;
    }

    setProcurando(true);
    const t = setTimeout(() => setProcurando(false), ESPERA_MS);

    return () => clearTimeout(t);
  }, [termo]);

  /* Termo novo, cursor de volta ao topo: manter o índice antigo deixaria o
     destaque num item que não existe mais na lista. */
  useEffect(() => setIndice(0), [termo]);

  /* Mantém o item destacado visível quando se desce além do que cabe. */
  useEffect(() => {
    listaRef.current?.querySelectorAll("li")[indice]?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  /**
   * Adiciona e zera a busca.
   *
   * Zerar devolve o cursor pronto para o próximo produto, que é o passo
   * seguinte na esmagadora maioria das vezes. Para lançar o mesmo item de
   * novo, a quantidade na linha resolve — e é menos trabalho que redigitar.
   */
  const adicionar = (produto: ProductType) => {
    onAdicionar(produto);
    setBusca("");
    setIndice(0);
    inputRef.current?.focus();
  };

  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setBusca("");
      return;
    }

    if (sugestoes.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => (i + 1) % sugestoes.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => (i - 1 + sugestoes.length) % sugestoes.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const escolhido = sugestoes[indice] ?? sugestoes[0];
      if (escolhido) adicionar(escolhido);
    }
  };

  const mostrarLista = Boolean(termo) && !procurando && !carregando && sugestoes.length > 0;
  const semResultado = Boolean(termo) && !procurando && !carregando && sugestoes.length === 0;

  return (
    <div className="relative">
      <div className="flex items-center gap-2.5 rounded-xl border border-fg/[0.08] bg-fg/[0.03] py-0 pl-3 pr-1.5 transition-colors focus-within:border-accent/60">
        {/* O ícone vira spinner enquanto procura: o mesmo lugar responde pela
            busca parada e pela busca em andamento, sem a linha pular de
            largura. */}
        <span className="grid h-4 w-4 shrink-0 place-items-center">
          <AnimatePresence mode="wait" initial={false}>
            {procurando || carregando ? (
              <motion.span key="load" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.12 }}>
                <Loader2 size={15} className="animate-spin text-accent-soft" />
              </motion.span>
            ) : (
              <motion.span key="lupa" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.12 }}>
                <PackageSearch size={15} className="text-muted" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        <input
          ref={inputRef}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={aoTeclar}
          placeholder="Digite o produto…"
          aria-label="Buscar produto para adicionar"
          className="w-full flex-1 bg-transparent py-2.5 text-[13px] text-ink outline-none placeholder:text-faint"
        />

        {/* A dica de teclado só aparece quando há o que escolher. */}
        {mostrarLista && (
          <span className="hidden shrink-0 items-center gap-1 text-[10.5px] text-faint sm:flex">
            <CornerDownLeft size={11} /> adiciona
          </span>
        )}

        {busca && (
          <button type="button" onClick={() => setBusca("")} className="shrink-0 text-[11px] text-faint hover:text-ink">
            Limpar
          </button>
        )}

        {/*
         * O "+" ao lado do campo.
         *
         * Até aqui só havia dois caminhos para lançar um produto: apertar
         * Enter ou clicar na sugestão certa da lista suspensa. Os dois exigem
         * saber que a lista existe e mirar dentro dela — quem opera com mouse,
         * com a tela em pé no balcão ou com leitor de tela não tem um alvo
         * fixo para "adicionar".
         *
         * Este botão é esse alvo: fica sempre no mesmo lugar, tem 34px e
         * adiciona o produto em destaque (o mesmo que o Enter adicionaria), o
         * que mantém teclado e toque respondendo à mesma regra.
         *
         * Desabilitado enquanto não há escolha — em vez de escondido: um botão
         * que aparece e some ao lado de um campo de digitação faz a linha
         * pular de largura a cada letra.
         */}
        <button
          type="button"
          onClick={() => {
            const escolhido = sugestoes[indice] ?? sugestoes[0];
            if (escolhido) adicionar(escolhido);
          }}
          disabled={!mostrarLista}
          title={mostrarLista ? `Adicionar ${(sugestoes[indice] ?? sugestoes[0])?.nome ?? "produto"}` : "Digite para encontrar o produto"}
          aria-label={mostrarLista ? `Adicionar ${(sugestoes[indice] ?? sugestoes[0])?.nome ?? "produto"} à nota` : "Adicionar produto à nota"}
          className="focus-ring my-1.5 grid h-[34px] w-[34px] shrink-0 cursor-pointer place-items-center rounded-lg bg-success text-white transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:bg-fg/[0.06] disabled:text-faint"
        >
          <Plus size={17} />
        </button>
      </div>

      {/* Barra de progresso fina sob o campo — o "puxando os produtos". */}
      <AnimatePresence>
        {(procurando || carregando) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-3 top-full h-[2px] overflow-hidden rounded-full bg-fg/[0.06]"
          >
            <motion.div
              className="h-full w-1/3 rounded-full bg-accent"
              animate={{ x: ["-100%", "300%"] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {semResultado && <p className="mt-2 px-3 text-[12px] text-faint">Nenhum produto encontrado.</p>}

      <AnimatePresence>
        {mostrarLista && (
          <motion.ul
            ref={listaRef}
            initial={{ opacity: 0, y: -6, scaleY: 0.92 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.96 }}
            transition={{ type: "spring", stiffness: 500, damping: 34, mass: 0.6 }}
            className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-[280px] origin-top overflow-y-auto rounded-xl border border-fg/[0.1] bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]"
          >
            {sugestoes.map((p, i) => (
              <motion.li
                key={String(p.id)}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.025 * i, duration: 0.15, ease: "easeOut" }}
              >
                <button
                  type="button"
                  onClick={() => adicionar(p)}
                  onMouseEnter={() => setIndice(i)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${
                    i === indice ? "bg-accent/[0.12]" : "hover:bg-fg/[0.06]"
                  }`}
                >
                  <span className="min-w-0 truncate text-[13px] text-ink">{p.nome}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-[12px] tabular-nums text-mist">{formatCurrency(Number(p.valorVenda) || 0)}</span>
                    <span className={`grid h-6 w-6 place-items-center rounded-md transition-colors ${i === indice ? "bg-success text-white" : "bg-success/15 text-success"}`}>
                      <Plus size={13} />
                    </span>
                  </span>
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BuscaProduto;
