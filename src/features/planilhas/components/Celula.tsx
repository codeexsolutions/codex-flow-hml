import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus } from "lucide-react";

import type { Coluna } from "@/features/planilhas/services/planilha.service";
import { formatCurrency } from "@/shared/utils/currency";
import useClienteStore from "@/features/clientes/store/cliente.store";

type Props = {
  coluna: Coluna;
  valor: unknown;
  onSalvar: (valor: unknown) => void;
  /** Falso quando a coluna é restrita e esta pessoa não está na lista. */
  editavel?: boolean;
};

const base = "h-full w-full bg-transparent px-3 py-2 text-[12.5px] text-ink outline-none";

/**
 * Uma célula da planilha.
 *
 * O tipo da coluna decide o editor: texto vira campo, seleção vira lista,
 * sim/não vira caixa, imagem vira miniatura. É o que faz a planilha parecer
 * planilha em vez de formulário — você digita e sai, sem botão de salvar.
 *
 * A gravação acontece ao SAIR do campo, não a cada tecla. Salvar por tecla
 * geraria uma requisição por letra; salvar por botão obrigaria um clique a
 * mais em cada célula.
 */
const Celula = ({ coluna, valor, onSalvar, editavel = true }: Props) => {
  const [rascunho, setRascunho] = useState(() => (valor == null ? "" : String(valor)));
  const original = useRef(rascunho);

  /* A lista vem da store, que só busca uma vez por sessão — sem isso, uma
     planilha de cem linhas dispararia cem buscas de clientes iguais. */
  const clientes = useClienteStore((s) => s.clientes);
  const buscarClientes = useClienteStore((s) => s.fetchClientes);

  useEffect(() => {
    if (coluna.tipo === "CLIENTE") buscarClientes();
  }, [coluna.tipo, buscarClientes]);

  /* Valor mudou por fora (recarga, outra pessoa editando): acompanha, desde
     que o usuário não esteja no meio de uma edição. */
  useEffect(() => {
    const novo = valor == null ? "" : String(valor);

    if (document.activeElement?.getAttribute("data-celula") !== coluna.id) {
      setRascunho(novo);
      original.current = novo;
    }
  }, [valor, coluna.id]);

  /* Célula sem permissão mostra o valor e recusa o foco: apagar da tela
     esconderia informação que a pessoa pode ver, só não pode mudar. */
  if (!editavel) {
    return <div className={`${base} cursor-not-allowed truncate text-mist/70`}>{rascunho || "—"}</div>;
  }

  const confirmar = (v: string) => {
    if (v === original.current) return; // nada mudou: não gasta requisição

    original.current = v;
    onSalvar(v === "" ? null : v);
  };

  if (coluna.tipo === "CHECKBOX") {
    const marcado = valor === true || valor === "true";

    return (
      <button
        onClick={() => onSalvar(!marcado)}
        className="flex h-full w-full items-center justify-center py-2 transition-colors hover:bg-fg/[0.03]"
        aria-pressed={marcado}
      >
        <span className={`grid h-4 w-4 place-items-center rounded border ${marcado ? "border-accent bg-accent text-white" : "border-fg/[0.2]"}`}>
          {marcado && <Check size={11} />}
        </span>
      </button>
    );
  }

  if (coluna.tipo === "SELECAO") {
    const escolhida = coluna.opcoes.find((o) => o.valor === rascunho);

    return (
      /* A cor fica num ponto ao lado, não no fundo do `<select>`: fundo colorido
         em célula de planilha vira mancha e come a legibilidade do texto. */
      <div className="relative flex h-full items-center">
        {escolhida?.cor && <span className="pointer-events-none absolute left-2.5 h-2 w-2 rounded-full" style={{ background: escolhida.cor }} />}

        <select
          data-celula={coluna.id}
          value={rascunho}
          disabled={!editavel}
          onChange={(e) => {
            setRascunho(e.target.value);
            confirmar(e.target.value);
          }}
          className={`${base} cursor-pointer disabled:cursor-not-allowed ${escolhida?.cor ? "pl-6" : ""}`}
        >
          <option value="">—</option>
          {coluna.opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.valor}
            </option>
          ))}
        </select>
      </div>
    );
  }

  /*
   * Coluna de cliente: escolhe do cadastro, não digita.
   *
   * Em texto livre o mesmo cliente entra como "Maria", "maria silva" e
   * "Maria S." em três linhas diferentes, e a planilha perde a capacidade de
   * agrupar por cliente — que costuma ser a única pergunta que se faz a ela
   * no fim do mês.
   *
   * Guardamos o NOME e não o id: a planilha é lida por gente, e uma célula
   * que mostra um UUID quando o cadastro some não ajuda ninguém. O vínculo
   * forte fica para quando existir relatório cruzando as duas coisas.
   */
  if (coluna.tipo === "CLIENTE") {
    return (
      <select
        data-celula={coluna.id}
        value={rascunho}
        onChange={(e) => {
          setRascunho(e.target.value);
          confirmar(e.target.value);
        }}
        className={`${base} cursor-pointer`}
      >
        <option value="">—</option>
        {/* Nome já gravado que não está mais no cadastro continua aparecendo:
            cliente excluído não pode apagar o histórico da planilha. */}
        {rascunho && !clientes.some((c) => c.nome === rascunho) && <option value={rascunho}>{rascunho}</option>}
        {clientes.map((c) => (
          <option key={c.id} value={c.nome}>
            {c.nome}
          </option>
        ))}
      </select>
    );
  }

  if (coluna.tipo === "IMAGEM") {
    return (
      <div className="flex h-full items-center gap-2 px-2 py-1">
        {rascunho ? (
          <img src={rascunho} alt="" className="h-8 w-8 shrink-0 rounded object-cover ring-1 ring-fg/10" />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-fg/[0.05] text-muted">
            <ImagePlus size={13} />
          </span>
        )}

        {/* Endereço da imagem, não upload: o sistema ainda não tem onde
            guardar arquivo, e prometer envio que não funciona é pior. */}
        <input
          data-celula={coluna.id}
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          onBlur={(e) => confirmar(e.target.value)}
          placeholder="Link da imagem"
          className="min-w-0 flex-1 bg-transparent text-[11.5px] text-ink outline-none placeholder:text-faint"
        />
      </div>
    );
  }

  if (coluna.tipo === "TEXTO_LONGO") {
    return (
      <textarea
        data-celula={coluna.id}
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={(e) => confirmar(e.target.value)}
        rows={1}
        className={`${base} resize-none`}
      />
    );
  }

  const tipoHtml = coluna.tipo === "DATA" ? "date" : coluna.tipo === "NUMERO" || coluna.tipo === "MOEDA" ? "number" : "text";

  return (
    <input
      data-celula={coluna.id}
      type={tipoHtml}
      value={rascunho}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={(e) => confirmar(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setRascunho(original.current);
          (e.target as HTMLInputElement).blur();
        }
      }}
      /* Moeda mostra formatado quando não está em edição — na edição, o número
         cru, senão o cursor briga com a máscara. */
      title={coluna.tipo === "MOEDA" && rascunho ? formatCurrency(Number(rascunho) || 0) : undefined}
      className={`${base} ${coluna.tipo === "NUMERO" || coluna.tipo === "MOEDA" ? "text-right tabular-nums" : ""}`}
    />
  );
};

export default Celula;
