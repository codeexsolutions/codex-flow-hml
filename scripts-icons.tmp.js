const sharp = require("sharp");
const fs = require("fs");

const SRC = "public/logo.png";
const FUNDO = { r: 14, g: 13, b: 26, alpha: 1 }; // #0e0d1a — mesmo background_color do manifest

const saidas = [
  { arq: "public/pwa-192.png", size: 192, pad: 0, fundo: null },
  { arq: "public/pwa-512.png", size: 512, pad: 0, fundo: null },
  // Maskable: o Android recorta um círculo/squircle. Sem margem de segurança
  // (~20% de cada lado) a logo é cortada. Fundo opaco porque a área recortada
  // não pode ficar transparente.
  { arq: "public/pwa-maskable-512.png", size: 512, pad: 0.2, fundo: FUNDO },
  // iOS não respeita transparência no ícone da home: fundo sólido.
  { arq: "public/apple-touch-icon.png", size: 180, pad: 0.1, fundo: FUNDO },
  { arq: "public/favicon-32.png", size: 32, pad: 0, fundo: null },
];

(async () => {
  for (const { arq, size, pad, fundo } of saidas) {
    const interno = Math.round(size * (1 - pad * 2));
    const margem = Math.round((size - interno) / 2);

    let img = sharp(SRC).resize(interno, interno, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });

    if (margem > 0 || fundo) {
      img = img.extend({
        top: margem, bottom: size - interno - margem,
        left: margem, right: size - interno - margem,
        background: fundo ?? { r: 0, g: 0, b: 0, alpha: 0 },
      });
      if (fundo) img = img.flatten({ background: fundo });
    }

    await img.png({ compressionLevel: 9 }).toFile(arq);
    const kb = (fs.statSync(arq).size / 1024).toFixed(1);
    console.log(`${arq.padEnd(34)} ${size}x${size}  ${kb} KB`);
  }
})();
