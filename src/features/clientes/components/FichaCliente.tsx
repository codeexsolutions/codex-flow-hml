import ClientType, { camposDeLead } from "@/shared/domain/cliente";

/**
 * Régua da ficha: cinco traços, um por dado de relacionamento.
 *
 * Com o CPF deixando de ser obrigatório, "cadastrado" virou um estado com
 * graus — tem cliente que é só um nome e tem cliente com ficha inteira. Um
 * número de porcentagem por linha seria ruído; cinco traços dizem a mesma coisa
 * de relance e ainda mostram **o que** falta no `title`.
 *
 * A cor não trabalha sozinha: o que falta aparece escrito na dica, e o rótulo
 * de acessibilidade diz "3 de 5".
 */
const FichaCliente = ({ cliente, className = "" }: { cliente: ClientType; className?: string }) => {
  const campos = camposDeLead(cliente);
  const preenchidos = campos.filter((c) => c.ok);
  const faltando = campos.filter((c) => !c.ok).map((c) => c.label);

  const dica = faltando.length === 0 ? "Ficha completa" : `Falta: ${faltando.join(", ").toLowerCase()}`;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={dica} aria-label={`Ficha ${preenchidos.length} de ${campos.length}. ${dica}`}>
      {campos.map((c) => (
        <span
          key={c.chave}
          aria-hidden
          className={`h-3 w-[3px] rounded-full transition-colors ${c.ok ? "bg-accent-soft" : "bg-fg/[0.14]"}`}
        />
      ))}
    </span>
  );
};

export default FichaCliente;
