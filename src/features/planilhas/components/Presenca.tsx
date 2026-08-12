import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { API_ORIGEM } from "@/shared/api/apiUrl";
import { lerToken } from "@/shared/api/sessao";
import { getInitials } from "@/shared/utils/format";
import useAuth from "@/features/auth/store/auth.store";

type Pessoa = { id: string; nome: string };

/**
 * Quem está olhando esta planilha agora.
 *
 * Existe pelo mesmo motivo que existe no Google Docs: em planilha compartilhada,
 * saber que outra pessoa está ali muda o comportamento — você não reescreve a
 * linha que alguém está preenchendo, e não pergunta no grupo "quem mexeu aqui".
 *
 * A lista vem do socket, não do banco: presença é estado de agora. Gravar em
 * disco criaria fantasmas de quem fechou a aba sem avisar.
 */
const Presenca = ({ planilhaId }: { planilhaId: string }) => {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const meuId = useAuth((s) => s.user?.id);

  useEffect(() => {
    if (!planilhaId) return;

    let socket: Socket | null = null;

    try {
      // Mesmo token das requisições HTTP, mandado em `auth.token`.
      // `polling` no fallback: presença é estado de agora, mas numa rede que
      // bloqueia websocket ainda vale mostrar quem está junto.
      socket = io(API_ORIGEM, {
        auth: { token: lerToken() ?? "" },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socket.on("connect_error", (erro) => {
        console.warn("Presença indisponível:", erro.message);
      });

      socket.on("connect", () => socket?.emit("planilha:entrar", planilhaId));
      socket.on("planilha:presenca", (lista: Pessoa[]) => setPessoas(Array.isArray(lista) ? lista : []));
    } catch {
      /* Sem realtime a planilha funciona igual — só não mostra quem está junto. */
    }

    return () => {
      socket?.emit("planilha:sair", planilhaId);
      socket?.disconnect();
    };
  }, [planilhaId]);

  if (pessoas.length === 0) return null;

  /* Eu primeiro, marcado como "você": ver o próprio avatar sem saber que é o
     seu faz a pessoa achar que há mais gente do que há. */
  const ordenadas = [...pessoas].sort((a) => (String(a.id) === String(meuId) ? -1 : 0));
  const visiveis = ordenadas.slice(0, 4);
  const resto = ordenadas.length - visiveis.length;

  return (
    <div className="flex items-center gap-2" title={ordenadas.map((p) => p.nome).join(", ")}>
      <div className="flex -space-x-2">
        {visiveis.map((p) => {
          const souEu = String(p.id) === String(meuId);

          return (
            <span
              key={p.id}
              className={`grid h-7 w-7 place-items-center rounded-full text-[10px] ring-2 ring-surface ${
                souEu ? "bg-accent text-white" : "bg-fg/[0.12] text-mist"
              }`}
              title={souEu ? `${p.nome} (você)` : p.nome}
            >
              {getInitials(p.nome)}
            </span>
          );
        })}

        {resto > 0 && <span className="grid h-7 w-7 place-items-center rounded-full bg-fg/[0.08] text-[10px] text-faint ring-2 ring-surface">+{resto}</span>}
      </div>

      <span className="hidden text-[11px] text-faint sm:inline">
        {pessoas.length === 1 ? "só você aqui" : `${pessoas.length} na planilha`}
      </span>
    </div>
  );
};

export default Presenca;
