/**
 * Gera o jogo de ícones do PWA a partir de `public/logo.png`.
 *
 *   npm run icones
 *
 * Rode sempre que a logo mudar. Antes, o manifest apontava o MESMO arquivo de
 * 1254×1254 (1,4 MB) como 192, como 512 e como maskable — o Android recortava a
 * logo e o navegador baixava 1,4 MB para desenhar um ícone de 192 px.
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const ORIGEM = path.join(RAIZ, "public/logo.png");

/** Mesmo `background_color` do manifest — o recorte não pode ficar transparente. */
const FUNDO = { r: 14, g: 13, b: 26, alpha: 1 };

const SAIDAS = [
  { arquivo: "pwa-192.png", tamanho: 192, margem: 0, fundo: null },
  { arquivo: "pwa-512.png", tamanho: 512, margem: 0, fundo: null },
  // 20% de margem de cada lado: é a "safe area" que o Android exige do maskable.
  { arquivo: "pwa-maskable-512.png", tamanho: 512, margem: 0.2, fundo: FUNDO },
  // iOS ignora transparência no ícone da tela de início.
  { arquivo: "apple-touch-icon.png", tamanho: 180, margem: 0.1, fundo: FUNDO },
  { arquivo: "favicon-32.png", tamanho: 32, margem: 0, fundo: null },
];

(async () => {
  if (!fs.existsSync(ORIGEM)) {
    console.error("Não encontrei public/logo.png");
    process.exit(1);
  }

  for (const { arquivo, tamanho, margem, fundo } of SAIDAS) {
    const destino = path.join(RAIZ, "public", arquivo);

    const interno = Math.round(tamanho * (1 - margem * 2));
    const borda = Math.round((tamanho - interno) / 2);

    let img = sharp(ORIGEM).resize(interno, interno, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });

    if (borda > 0 || fundo) {
      img = img.extend({
        top: borda,
        bottom: tamanho - interno - borda,
        left: borda,
        right: tamanho - interno - borda,
        background: fundo ?? { r: 0, g: 0, b: 0, alpha: 0 },
      });

      if (fundo) img = img.flatten({ background: fundo });
    }

    await img.png({ compressionLevel: 9 }).toFile(destino);

    console.log(`${arquivo.padEnd(24)} ${tamanho}x${tamanho}  ${(fs.statSync(destino).size / 1024).toFixed(1)} KB`);
  }
})();
