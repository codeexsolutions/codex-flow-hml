import { execSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Identidade do build, carimbada no código.
 *
 * Sem ela, "o app está desatualizado?" é uma sensação: ninguém consegue olhar
 * a tela e dizer qual versão está rodando, nem comparar com o que foi
 * publicado. Com o carimbo, a pergunta vira uma conferência de dez segundos.
 *
 * Na Vercel o commit vem em `VERCEL_GIT_COMMIT_SHA`; fora dela, o git local
 * responde. Sem git (um tarball baixado), sobra a data — que ainda distingue
 * um build do outro.
 */
function identidadeDoBuild(): string {
  const data = new Date().toISOString().slice(0, 16).replace("T", " ");

  const commit = (() => {
    if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);

    try {
      return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      return "";
    }
  })();

  return commit ? `${data} · ${commit}` : data;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  console.log(`Ambiente: ${env.ENVIRONMENT_CONSOLE}`);
  console.log(`Produção: ${env.PRODUCTION}`);

  return {
    /* Substituído em tempo de build — vira uma string literal no bundle. */
    define: {
      __BUILD_ID__: JSON.stringify(identidadeDoBuild()),
    },

    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },

    plugins: [
      react(),

      VitePWA({
        // "autoUpdate": a versão nova entra sozinha, sem depender de clique.
        //
        // Era "prompt", e o aviso podia ser dispensado no X — o worker ficava
        // parado em `waiting` e o aviso não voltava para aquela versão, então um
        // clique acidental prendia o cliente na versão antiga para sempre. O
        // preço conhecido desta troca é a versão poder mudar durante o uso;
        // ver a proteção do PDV em `PwaPrompts`.
        registerType: "autoUpdate",
        injectRegister: "auto",

        includeAssets: ["apple-touch-icon.png", "favicon-32.png", "offline.html"],

        manifest: {
          name: "CodeEx Flow",
          short_name: "CodeEx Flow",
          description: "Sistema de gestão para o seu negócio: PDV, estoque, clientes e financeiro.",
          lang: "pt-BR",
          theme_color: "#0e0d1a",
          background_color: "#0e0d1a",
          display: "standalone",
          // Sem travar em "portrait": em tablet e desktop instalado o app
          // precisa acompanhar a rotação da tela.
          orientation: "any",
          start_url: "/",
          scope: "/",
          categories: ["business", "productivity", "finance"],

          icons: [
            { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            // Maskable é um arquivo PRÓPRIO, com margem de segurança: o Android
            // recorta o ícone e, sem a margem, comia a logo.
            { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],

          shortcuts: [
            { name: "Ponto de Venda", short_name: "PDV", url: "/pdv" },
            { name: "Vendas", short_name: "Vendas", url: "/vendas" },
          ],
        },

        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          // Ligado junto com o `autoUpdate`: sem ele o worker novo instala mas
          // fica esperando todas as abas fecharem, e num PWA que passa o dia
          // aberto isso é o mesmo que não atualizar.
          skipWaiting: true,

          // Sem isto, abrir o app offline dava tela de erro do navegador.
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api/, /^\/v1/, /^\/socket\.io/],

          runtimeCaching: [
            {
              // Fontes do Google: imutáveis, cache longo.
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "fontes-google",
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Imagens (logos de empresa, QR): serve do cache e atualiza atrás.
              urlPattern: ({ request }) => request.destination === "image",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "imagens",
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Leituras da API: rede primeiro, cache como rede de segurança.
              // Dá ao app uma última versão dos dados quando a conexão cai.
              //
              // Sessão e status da empresa ficam FORA: a API responde 200 para
              // empresa inativa, e um 200 é cacheável. O efeito era cruel —
              // empresa que pagava e era reativada continuava vendo a tela de
              // bloqueio por até 24h, servida do cache, sem jeito de forçar.
              // Estado de autorização não pode vir de cache.
              //
              // A lista vai inline de propósito: o Workbox serializa esta
              // função para dentro do sw.js, e uma constante de fora do escopo
              // não existiria lá — viraria erro em tempo de execução.
              urlPattern: ({ url, request }) =>
                request.method === "GET" &&
                url.pathname.startsWith("/v1") &&
                !["/v1/auth", "/v1/usuarios/me", "/v1/assinatura"].some((rota) =>
                  url.pathname.startsWith(rota),
                ),
              handler: "NetworkFirst",
              options: {
                cacheName: "api-leitura",
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },

        devOptions: {
          enabled: true,
          type: "module",
        },
      }),
    ],

    server: {
      host: env.APPLICATION_ENVIRONMENT,
      port: Number(env.APPLICATION_PORT),
    },

    preview: {
      host: env.APPLICATION_ENVIRONMENT,
      port: Number(env.APPLICATION_PORT),
    },
  };
});
