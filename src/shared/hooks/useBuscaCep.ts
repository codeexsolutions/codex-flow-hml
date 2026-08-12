import { useState } from "react";
import { onlyDigits } from "@/shared/utils/format";

export type EnderecoCep = {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

/**
 * Consulta de CEP no ViaCEP.
 *
 * O mesmo `fetch` estava copiado no cadastro da empresa e no de configurações,
 * cada um com o seu tratamento de erro. Aqui a busca é uma só: devolve o
 * endereço ou `null`, e quem chama decide o que fazer com o `null` — a tela é
 * que sabe se avisa por toast, por alerta ou em silêncio.
 *
 * Digitação parcial não busca: com menos de 8 dígitos não há o que consultar, e
 * disparar assim mesmo faria uma requisição por tecla.
 */
export function useBuscaCep() {
  const [buscando, setBuscando] = useState(false);

  const buscar = async (cepBruto: string): Promise<EnderecoCep | null> => {
    const cep = onlyDigits(cepBruto);
    if (cep.length !== 8) return null;

    setBuscando(true);

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();

      if (data?.erro) return null;

      return {
        logradouro: data.logradouro ?? "",
        bairro: data.bairro ?? "",
        cidade: data.localidade ?? "",
        uf: data.uf ?? "",
      };
    } catch {
      return null;
    } finally {
      setBuscando(false);
    }
  };

  return { buscar, buscando };
}
