import { Copy } from "lucide-react";
import { useAlert } from "@/shared/ui/Alert";

type PixSectionProps = {
  pixPayload: string;
};

const PixSection = ({ pixPayload }: PixSectionProps) => {
  const alert = useAlert();
  if (!pixPayload) return null;

  return (
    <div className="border-t border-fg/[0.05] px-5 py-5">
      <div className="flex flex-col gap-5">
        {/* Copia-e-cola */}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.08em] text-faint">Pagamento via PIX</p>
          <p className="mt-0.5 text-sm text-ink">Escaneie o QR Code ou copie o código abaixo</p>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-fg/[0.08] bg-fg/[0.03] p-3">
            <code className="min-w-0 flex-1 select-all break-all text-[11px] text-mist">{pixPayload}</code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(pixPayload);
                  alert.toast("success", "Código PIX copiado!", undefined, { position: "bottom-right", timer: 2000 });
                } catch {
                  alert.toast("error", "Falha ao copiar. Copie manualmente.", undefined, { position: "bottom-right", timer: 3000 });
                }
              }}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[11px] text-white transition-colors hover:bg-accent-soft active:scale-95"
            >
              <Copy size={13} /> Copiar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PixSection;
