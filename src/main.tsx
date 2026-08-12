import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
/*
 * As fontes vêm do pacote, não do Google Fonts.
 *
 * Com `@import` de CDN, quem abre o app sem rede — ou antes da fonte chegar —
 * caía na `system-ui`, que é San Francisco no iPhone e Roboto no Android: a
 * mesma tela com duas larguras de texto, duas alturas de linha e quebras
 * diferentes. Empacotadas, o desenho é byte a byte o mesmo nos dois, e continua
 * o mesmo offline, que é requisito de PWA instalado.
 */
import "@fontsource-variable/inter";
import "@fontsource-variable/sora";

import "./index.css";

import AppRoutes from "@/app/routes/AppRoutes";
import { AlertProvider } from "@/shared/ui/Alert";
import PwaPrompts from "@/shared/pwa/PwaPrompts";
import CamadaTransicao from "@/shared/session/CamadaTransicao";
import { aplicarModoApp, observarModoApp } from "@/shared/pwa/appMode";

// Antes de pintar: define se o zoom fica livre (navegador) ou travado (app).
aplicarModoApp();
observarModoApp();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AlertProvider>
      <AppRoutes />
      {/* Entrada e saída da sessão — acima do roteador, para sobreviver à troca de rota. */}
      <CamadaTransicao />
      {/* Nova versão, convite de instalação e aviso de offline. */}
      <PwaPrompts />
    </AlertProvider>
  </StrictMode>,
);
