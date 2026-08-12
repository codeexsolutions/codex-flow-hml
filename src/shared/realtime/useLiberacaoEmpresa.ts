import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";

import useAuth from "@/features/auth/store/auth.store";
import AssinaturaService from "@/features/assinatura/services/assinatura.service";
import { API_ORIGEM } from "@/shared/api/apiUrl";
import { lerToken } from "@/shared/api/sessao";

/**
 * Escuta a liberação da empresa e destrava o cliente sozinho.
 *
 * O problema que isto resolve: quando o dono confirma o pagamento, a empresa
 * é ativada no banco — mas o cliente continua com uma sessão montada com
 * `ativo: false` e ficaria preso no checkout até refazer o login. Não adianta
 * só recarregar a página: o cookie é o mesmo.
 *
 * Então, ao receber o aviso, pedimos a revalidação (`/assinatura/revalidar`),
 * que gira o cookie com `ativo: true` no servidor, e atualizamos o estado
 * local — aí o roteador já deixa entrar no sistema.
 *
 * O socket é o caminho normal. O `focus` é a rede de proteção para o caso de o
 * socket cair (aba dormindo, wi-fi trocando, proxy sem websocket).
 */
export function useLiberacaoEmpresa(aoLiberar: (dados: { planoNome?: string | null }) => void) {
  const { user, atualizarAtivo } = useAuth();

  const codigoEmpresa = user?.codigoEmpresa;
  const inativo = Boolean(user) && !user?.ativo;

  useEffect(() => {
    // Só faz sentido para quem está esperando liberação.
    if (!inativo || !codigoEmpresa) return;

    let vivo = true;

    /** Pede a revalidação; só avisa a tela se a empresa realmente foi liberada. */
    const revalidar = async () => {
      if (!vivo) return;

      try {
        const { ativo } = await AssinaturaService.revalidar();

        if (!vivo || !ativo) return;

        atualizarAtivo(true);
        aoLiberar({});
      } catch {
        /* Silencioso: é uma verificação de fundo, não uma ação do usuário. */
      }
    };

    // A API monta o socket na raiz do servidor, não no prefixo /v1.
    const origem = API_ORIGEM;

    let socket: Socket | null = null;

    try {
      socket = io(origem, {
        auth: { token: lerToken() ?? "" },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 5000,
      });

      socket.on("connect_error", (erro) => {
        console.warn("Canal de liberação indisponível:", erro.message);
      });

      socket.on("empresa:liberada", revalidar);
    } catch {
      /* Sem socket, o `focus` abaixo continua cobrindo. */
    }

    window.addEventListener("focus", revalidar);

    return () => {
      vivo = false;
      window.removeEventListener("focus", revalidar);
      socket?.off("empresa:liberada", revalidar);
      socket?.disconnect();
    };
  }, [inativo, codigoEmpresa, atualizarAtivo, aoLiberar]);
}
