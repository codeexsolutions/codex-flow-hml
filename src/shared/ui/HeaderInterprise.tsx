import useEnterprise from "@/features/empresa/store/enterprise.store";
import { MapPin, Building2, Phone, BadgeCheck } from "lucide-react";
import { formatDocument } from "@/shared/utils/format";
import { maskPhone } from "@/shared/validation/masks";

const HeaderInterprise = () => {
  const { enterprise } = useEnterprise();

  if (!enterprise) return null;

  const endereco = enterprise.endereco;
  const contato = enterprise.contato;

  return (
    <div className="flex items-start gap-5">
      {/*
        Logo — quadrada 24x24.

        Dois defeitos moravam nesta linha. O arquivo padrão era `logo.jpg`,
        que não existe em `public/` (o que existe é `logo.png`), e o caminho
        vinha SEM a barra inicial: em `/pdv/orcamentos` o browser procurava
        `/pdv/logo.jpg`. Ou seja, quem ainda não subiu logo via um ícone
        quebrado na própria nota que manda para o cliente.

        `object-contain`, e não `cover`: logo é marca, não foto de capa —
        `cover` cortava as bordas de qualquer logo que não fosse quadrada.
      */}
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-fg/10 bg-fg/5">
        <img
          src={enterprise.urlLogo || "/logo.png"}
          alt={enterprise.nomeFantasia ? `Logo de ${enterprise.nomeFantasia}` : "Logo da empresa"}
          className="h-full w-full object-contain p-1.5"
          /* Logo de storage pode ter sido apagada por fora; o padrão evita o
             ícone de imagem quebrada dentro da nota. */
          onError={(ev) => {
            const img = ev.currentTarget;
            if (img.src.endsWith("/logo.png")) return;
            img.src = "/logo.png";
          }}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h1 className="m-0 text-2xl leading-none text-ink">{enterprise.nomeFantasia}</h1>
          <BadgeCheck size={20} className="shrink-0 text-success" />
        </div>

        <div className="flex flex-col gap-2">
          {endereco && (
            <div className="flex items-center gap-3 text-sm text-mist">
              <MapPin size={16} className="shrink-0 text-muted" />
              <span>
                {endereco.logradouro}, {endereco.numero}
                {endereco.complemento && ` - ${endereco.complemento}`}
              </span>
            </div>
          )}

          {endereco && (
            <div className="flex items-center gap-3 text-sm text-mist">
              <Building2 size={16} className="shrink-0 text-muted" />
              <span>
                {endereco.bairro} • {endereco.cidade}/{endereco.uf}
                {endereco.cep && ` • CEP ${endereco.cep}`}
              </span>
            </div>
          )}

          {(contato?.telefone || enterprise.cpfCnpj) && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-mist">
              <Phone size={16} className="shrink-0 text-muted" />
              {contato?.telefone && <span>{maskPhone(String(contato.telefone))}</span>}
              {enterprise.cpfCnpj && <span className="text-muted">• CNPJ {formatDocument(enterprise.cpfCnpj)}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HeaderInterprise;
