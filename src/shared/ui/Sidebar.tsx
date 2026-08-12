import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Package, Users, DollarSign, Settings, LogOut, ShoppingCart, BarChart3, LayoutDashboard, Truck, UserCog, Wallet, LifeBuoy, Lock, MessageCircle, Table2, Building2, Headset, RefreshCw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import useAuth from "@/features/auth/store/auth.store";
import useEnterprise from "@/features/empresa/store/enterprise.store";
import { ehGestor } from "@/features/vendas/components/TabsVendas";
import SinoNotificacoes from "@/features/notificacoes/components/SinoNotificacoes";
import { getInitials } from "@/shared/utils/format";
import { tocarNavegacao } from "@/shared/session/somSessao";
import useEquipeStore, { planoTemEquipe } from "@/features/funcionarios/store/equipe.store";
import usePlano from "@/shared/plano/plano.store";
import { BUILD_ID, forcarAtualizacao } from "@/shared/pwa/versao";
import BotaoInstalar from "@/shared/pwa/BotaoInstalar";

type AbaId = "gerenciamento" | "atendimento";

const ABAS: { id: AbaId; titulo: string; icone: typeof Users }[] = [
  { id: "gerenciamento", titulo: "Gerenciamento", icone: Building2 },
  { id: "atendimento", titulo: "Atendimento", icone: Headset },
];

/**
 * De que aba cada rota é.
 *
 * Existe para a aba acompanhar a navegação: abrir `/estoque` por link salvo,
 * pelo celular ou pelo botão "voltar" tem de acender "Gerenciamento" sozinho.
 * Sem isto, a pessoa veria a tela do estoque com a aba de Atendimento marcada —
 * e concluiria, com razão, que o menu está quebrado.
 *
 * Rota que não está aqui não troca a aba: é o caso de `/`, `/pdv` e
 * `/configuracoes`, que são de todo mundo, e o de `/clientes`, que aparece de
 * propósito nas duas listas. Trocar a aba ao abrir Clientes moveria o menu
 * sob os olhos de quem clicou — e pelo caminho que a pessoa NÃO usou.
 */
const ABA_DA_ROTA: [string, AbaId][] = [
  ["/funcionarios", "gerenciamento"],
  ["/estoque", "gerenciamento"],
  ["/correios", "gerenciamento"],
  ["/vendas", "gerenciamento"],
  ["/relatorios", "gerenciamento"],
  ["/planilhas", "atendimento"],
  ["/whatsapp", "atendimento"],
  ["/pdv/orcamentos", "atendimento"],
];

/** `/pdv/orcamentos` é de Atendimento e `/pdv` não é de ninguém: o mais
    específico tem de casar primeiro, por isso a lista é varrida por tamanho. */
const abaDaRota = (pathname: string): AbaId | null =>
  [...ABA_DA_ROTA]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([rota]) => pathname === rota || pathname.startsWith(`${rota}/`))?.[1] ?? null;

const CHAVE_ABA = "cf:sidebar-aba";

const Sidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { enterprise } = useEnterprise();

  const userInitials = getInitials(user?.nome, "U");
  const companyInitial = (enterprise?.nomeFantasia || "E").trim().charAt(0).toUpperCase();
  const companyImage = enterprise?.urlLogo || "";

  /** Dono ou administrador promovido: vê o sistema inteiro. */
  const gestor = ehGestor(user);

  /** Módulo que o plano não cobre continua no menu, com cadeado. */
  const temRecurso = usePlano((s) => s.recurso);

  /*
   * A aba aberta.
   *
   * Começa pela rota atual (recarregar em `/estoque` tem de abrir na loja) e,
   * quando a rota não é de nenhuma das duas, pela última escolha guardada.
   * `localStorage` pode falhar em navegação privada — daí o `try`, porque
   * ficar sem sidebar por causa de uma preferência cosmética não se paga.
   */
  const [aba, setAba] = useState<AbaId>(() => {
    const daRota = abaDaRota(pathname);
    if (daRota) return daRota;

    try {
      const salva = localStorage.getItem(CHAVE_ABA);
      if (salva === "gerenciamento" || salva === "atendimento") return salva;
    } catch {
      /* sem preferência salva: cai no padrão */
    }

    return "gerenciamento";
  });

  /*
   * A aba acompanha a NAVEGAÇÃO — e só ela.
   *
   * A primeira versão deste efeito dependia de `[pathname, aba]` e prendia a
   * pessoa: estando em `/estoque` e clicando na outra aba, o `setAba` do
   * clique disparava o próprio efeito, que via `/estoque` pertencer a
   * Gerenciamento e devolvia a aba na hora. O menu era introcável em
   * qualquer tela — só obedecia no PDV, que não pertence a aba nenhuma, e
   * por isso o defeito passava por manha do PDV.
   *
   * Guardar a última rota separa as duas causas: trocar de tela move a aba,
   * trocar de aba não move nada. Olhar a outra aba sem sair da tela em que se
   * está é justamente o que se faz para achar o próximo destino.
   */
  const ultimaRota = useRef(pathname);

  useEffect(() => {
    if (ultimaRota.current === pathname) return;

    ultimaRota.current = pathname;

    const daRota = abaDaRota(pathname);
    if (daRota) setAba(daRota);
  }, [pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_ABA, aba);
    } catch {
      /* preferência não guardada — a aba continua funcionando na sessão */
    }
  }, [aba]);

  /* Só o gestor pergunta: a API recusa para vendedor, e uma chamada que sempre
     falha em toda navegação é ruído no log e na rede. */
  const equipe = useEquipeStore((s) => s.equipe);
  const buscarEquipe = useEquipeStore((s) => s.buscar);

  useEffect(() => {
    if (gestor) buscarEquipe();
  }, [gestor, buscarEquipe]);

  /**
   * Rotas que são filhas de outra no menu. Sem esta lista, estar em
   * `/vendas/orcamentos` acenderia "Vendas" **e** "Orçamentos" ao mesmo tempo,
   * porque Vendas casa por prefixo.
   */
  const FILHAS_COM_ITEM_PROPRIO = ["/vendas/orcamentos"];

  const isActive = (route: string) => {
    if (route === "") return pathname === "/";

    const alvo = `/${route}`;

    if (pathname === alvo) return true;
    if (!pathname.startsWith(`${alvo}/`)) return false;

    // O pai não acende quando a filha tem item próprio no menu.
    return !FILHAS_COM_ITEM_PROPRIO.some((f) => f !== alvo && pathname.startsWith(f));
  };

  const reduzir = useReducedMotion();

  const goto = (route: string) => {
    // Não toca ao clicar onde já se está: som sem mudança confunde.
    if (!isActive(route)) tocarNavegacao();

    navigate(route);
  };

  const handleLogout = () => {
    Promise.resolve(logout()).catch(() => {});
  };

  /* Busca a versão mais recente na marra — ver `forcarAtualizacao`. */
  const [atualizando, setAtualizando] = useState(false);

  const atualizarAgora = () => {
    setAtualizando(true);
    void forcarAtualizacao();
  };

  /**
   * `bloqueado` é diferente de `disabled`, mas os dois são inertes.
   *
   * "Em breve" é tela que ainda não existe. "Plano" é módulo que existe e não
   * foi contratado. A distinção continua valendo no rótulo — são notícias
   * diferentes e a segunda tem conserto —, mas nenhum dos dois recebe clique.
   *
   * Chegar a uma oferta é o clique de quem procurou a oferta. Quem clica em
   * "Correios" quer despachar uma encomenda, e receber uma tela de venda no
   * lugar é uma troca que a pessoa não pediu; feita todo dia, no mesmo item,
   * vira ruído no menu. O cadeado já diz o que precisa ser dito, e o `title`
   * explica no hover — sem cobrar nada por isso.
   *
   * A tela de oferta (`RecursoDoPlano`) continua de pé para quem chega pela
   * URL, pelo celular ou por link salvo. O que deixou de existir é o convite
   * disfarçado de destino.
   */
  const item = (route: string, icon: ReactNode, label: string, disabled = false, bloqueado = false) => {
    if (bloqueado && !disabled) {
      return (
        <div
          className="mb-1 flex cursor-not-allowed items-center gap-3 rounded-xl px-2.5 py-2 opacity-55"
          title={`${label} não está incluído no seu plano. Veja as opções em Configurações › Faturas.`}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fg/[0.04] text-faint">{icon}</span>
          <span className="flex-1 text-[13.5px] text-mist">{label}</span>
          <span className="flex items-center gap-1 rounded-full border border-accent/20 bg-accent/[0.08] px-2 py-0.5 text-[9px] uppercase tracking-wider text-accent-soft">
            <Lock size={9} />
            Plano
          </span>
        </div>
      );
    }

    if (disabled) {
      return (
        <div className="mb-1 flex cursor-not-allowed items-center gap-3 rounded-xl px-2.5 py-2 opacity-45">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fg/[0.04] text-faint">{icon}</span>
          <span className="flex-1 text-[13.5px] text-mist">{label}</span>
          <span className="rounded-full border border-fg/[0.08] bg-fg/[0.03] px-2 py-0.5 text-[9px] uppercase tracking-wider text-faint">Em breve</span>
        </div>
      );
    }

    const active = isActive(route);
    return (
      <button
        type="button"
        onClick={() => goto(route)}
        aria-current={active ? "page" : undefined}
        className={`group focus-ring relative mb-1 flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13.5px] transition-colors duration-200 ${active ? " text-ink" : "text-mist hover:bg-fg/[0.05] hover:text-ink"}`}
      >
        {/*
         * Sem `layoutId` aqui, de propósito.
         *
         * A pílula deslizante distorcia: animação de layout precisa medir o
         * elemento em pixels reais, e a sidebar vive dentro de um contêiner que
         * o `MainLayout` anima com `scale`. O framer mede na escala errada e o
         * resultado é a borda esticada, atravessando os itens vizinhos.
         *
         * A troca aqui é rápida e curta — quem clica no menu já está olhando
         * para o item que clicou. Um surgimento firme com o traço lateral
         * crescendo comunica a mesma coisa, e nunca quebra.
         */}
        {active && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-xl border border-accent/25 bg-gradient-to-r from-accent/[0.22] via-accent/[0.10] to-transparent"
            style={{ boxShadow: "inset 0 1px 0 rgb(var(--glass-highlight) / 0.14)" }}
            initial={reduzir ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />
        )}

        {active && (
          <motion.span
            aria-hidden
            className="absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-accent-soft to-accent"
            style={{ boxShadow: "0 0 12px rgb(var(--accent) / calc(0.8 * var(--fx-glow, 1)))" }}
            /* Só a altura anima: é uma propriedade que não depende de medir o
               elemento contra a viewport, então a escala do pai não a afeta. */
            initial={reduzir ? { height: 28 } : { height: 0 }}
            animate={{ height: 28 }}
            transition={{ type: "spring", stiffness: 480, damping: 30 }}
          />
        )}

        {/* O ícone dá um pulinho ao virar ativo: confirma o clique sem precisar
            de outro elemento na tela. `scale` num filho é seguro — o que não
            funciona é medir posição dentro de um pai escalado. */}
        <motion.span
          className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200 ${active ? "bg-accent/25 text-accent-soft" : "bg-fg/[0.04] text-faint group-hover:bg-fg/[0.08] group-hover:text-accent-soft"}`}
          animate={reduzir ? {} : { scale: active ? 1.06 : 1 }}
          transition={{ type: "spring", stiffness: 460, damping: 22 }}
        >
          {icon}
        </motion.span>

        <span className="relative flex-1">{label}</span>
      </button>
    );
  };

  const cat = (label: string) => <p className="px-2.5 pb-2 pt-5 text-[10px] uppercase tracking-[0.18em] text-muted first:pt-1">{label}</p>;

  return (
    <>
      {/* `relative` é obrigatório: o brilho do topo é `absolute` e, sem um
          ancestral posicionado, ele se prende à viewport e cobre a tela toda. */}
      <aside
        className="glass-strong relative hidden w-72 flex-shrink-0 flex-col overflow-hidden border-y-0 border-l-0 border-r md:flex"
        style={{ borderColor: "rgb(var(--glass-border) / calc(var(--glass-border-alpha) + 0.03))" }}
      >
        {/* Brilho ambiente no topo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-52"
          style={{
            opacity: "var(--fx-aurora, 1)",
            background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgb(var(--accent) / 0.18), transparent 70%)",
          }}
        />

        {/* Marca da empresa */}
        <div className="relative flex items-center gap-3.5 border-b border-fg/[0.07] px-5 py-4">
          <div className="relative h-11 w-11 shrink-0">
            <div aria-hidden className="absolute -inset-1 rounded-2xl bg-accent/30 blur-md" style={{ opacity: "calc(0.6 * var(--fx-glow, 1))" }} />
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-surface-raised to-surface ring-1 ring-fg/10">
              {companyImage ? (
                <img
                  src={companyImage}
                  alt={enterprise?.nomeFantasia || "Logo"}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span className="text-base text-accent-soft">{companyInitial}</span>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] tracking-tight text-ink">{enterprise?.nomeFantasia || "Sua Empresa"}</p>
            <p className="truncate text-[11.5px] text-faint">Painel de gestão</p>
          </div>

        </div>

        {/*
         * Duas abas: o ERP de um lado, o CRM do outro.
         *
         * O sistema virou duas coisas com lógicas diferentes — administrar a
         * empresa e tocar o trabalho do dia — e uma lista corrida misturava as
         * duas. Empilhar dez itens fazia "Relatórios" e "Acompanhamento"
         * parecerem o mesmo tipo de coisa, quando nem acontecem no mesmo
         * momento do dia.
         *
         * As abas NÃO se chamam CRM e ERP: essa é a sigla do fornecedor, não a
         * palavra do lojista. Ele não pensa "vou abrir o CRM", pensa "vou ver
         * como está o pedido". Daí "Gerenciamento" e "Atendimento".
         *
         * Clientes aparece nas duas — é o único item repetido, e é o mais
         * visitado do sistema. Nos dois contextos ele é a resposta certa: no
         * Gerenciamento é cadastro, no Atendimento é quem está sendo atendido.
         *
         * O seletor fica ACIMA de tudo, colado na marca da empresa: ele não é
         * um item de menu, é o interruptor que decide qual menu você está
         * vendo. Embaixo dos atalhos ele se lia como mais uma linha da lista —
         * e um controle que muda o conteúdo inteiro não pode parecer parte do
         * conteúdo que ele muda.
         *
         * Início e PDV ficam FORA das abas: são o que se abre dez vezes por
         * dia, e esconder metade deles atrás de uma troca de aba cobraria um
         * clique a mais na tarefa mais frequente do sistema.
         */}
        <div className="relative border-b border-fg/[0.07] px-3 py-3">
          <div
            role="tablist"
            aria-label="Áreas do sistema"
            className="flex gap-1 rounded-xl border border-fg/[0.07] bg-fg/[0.03] p-1"
          >
            {ABAS.map((a) => {
              const on = aba === a.id;

              return (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setAba(a.id)}
                  className={`focus-ring relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] transition-colors duration-200 ${
                    on ? "text-ink" : "text-mist hover:text-ink"
                  }`}
                >
                  {/*
                   * Sem `layoutId` aqui, pelo mesmo motivo documentado nos
                   * itens do menu: a sidebar vive dentro de um contêiner que o
                   * MainLayout anima com `scale`, e animação de layout mede em
                   * pixels reais — na escala errada, a pílula sai deformada e
                   * atravessa a aba vizinha. Opacidade não depende de medição.
                   */}
                  {on && (
                    <motion.span
                      aria-hidden
                      className="absolute inset-0 rounded-lg border border-accent/25 bg-accent/[0.14]"
                      style={{ boxShadow: "inset 0 1px 0 rgb(var(--glass-highlight) / 0.12)" }}
                      initial={reduzir ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                    />
                  )}

                  <span className={`relative ${on ? "text-accent-soft" : "text-faint"}`}>
                    <a.icone size={13} />
                  </span>
                  <span className="relative">{a.titulo}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative px-3 pt-3">
          {cat("Meu dia")}
          {item("", <LayoutDashboard size={17} />, "Início")}
          {/* "PDV" fica: não é jargão de software, é o nome que o lojista já
              usa, e é como a tela se chama no tour e na barra do celular. */}
          {/* Orçamento NÃO tem item próprio: ele já é uma aba dentro do PDV,
              que é de onde a proposta nasce. Duplicar no menu daria dois
              caminhos para a mesma tela e a dúvida de qual é o certo. */}
          {item("pdv", <ShoppingCart size={17} />, "PDV")}
        </div>

        <nav className="relative flex-1 overflow-y-auto px-3 pb-3 pt-2" role="tabpanel">
          {/* A troca é só um fade curto. Deslizar lateralmente seria a leitura
              certa para abas, mas é de novo animação de layout dentro do pai
              escalado — o mesmo problema da pílula. */}
          <motion.div
            key={aba}
            initial={reduzir ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {aba === "gerenciamento" ? (
              <>
                {/* Clientes está NAS DUAS abas, de propósito.
                    A mesma tela por dois caminhos: aqui é o cadastro que se
                    administra, no Atendimento é a pessoa que se atende. Obrigar a
                    trocar de aba para chegar no lugar mais visitado do sistema
                    seria economizar uma linha e cobrar um clique. */}
                {cat("Cadastros")}
                {item("clientes", <Users size={17} />, "Clientes")}
                {/* Equipe só existe em plano que comporta mais de um usuário:
                    mostrar para quem tem uma vaga só seria oferecer porta que
                    não abre. */}
                {gestor && planoTemEquipe(equipe) && item("funcionarios", <UserCog size={17} />, "Minha equipe")}
                {/* "e serviços" no rótulo: é a mesma tela de sempre, mas quem
                    presta serviço cadastra serviço nela, e sem isso metade dos
                    clientes procurava um menu que não existe. */}
                {item("estoque", <Package size={17} />, "Estoque/Serviços")}

                {cat("Dinheiro")}
                {/*
                 * Um item só para o assunto "dinheiro". Ter "Vendas" e
                 * "Financeiro" lado a lado era redundante — são a mesma tela, e
                 * a lista de vendas fica a uma aba de distância. O vendedor não
                 * entra aqui: para ele o menu leva direto às vendas dele, que é
                 * tudo o que pode ver.
                 */}
                {gestor
                  ? item("vendas/financeiro", <Wallet size={17} />, "Caixa e contas", false, !temRecurso("financeiro"))
                  : item("vendas/lista", <DollarSign size={17} />, "Minhas vendas")}
                {item("relatorios", <BarChart3 size={17} />, "Relatórios", false, !temRecurso("relatorios"))}

                {cat("Entregas")}
                {/* Correios volta para "Em breve" enquanto o módulo é
                    finalizado. Não é "Plano": o cadeado promete uma tela que
                    o upgrade destrava hoje, e essa ainda não está de pé. */}
                {item("correios", <Truck size={17} />, "Correios", true)}
              </>
            ) : (
              <>
                {/*
                  * Uma ferramenta só para a produção: a planilha.
                  *
                  * O quadro de etapas saiu. Ter as duas coisas obrigava a
                  * equipe a decidir onde registrar cada avanço, e resposta
                  * dividida em dois lugares é resposta que ninguém confia —
                  * sempre falta a metade que está no outro. A planilha faz o
                  * mesmo trabalho e é configurável pelo dono.
                  *
                  * Entra a partir do Standard, com teto de quantidade — por
                  * isso o cadeado depende da flag, e não da existência da tela.
                  */}
                {cat("Produção")}
                {item("planilhas", <Table2 size={17} />, "Planilhas", false, !temRecurso("planilhas"))}

                {cat("Relacionamento")}
                {item("clientes", <Users size={17} />, "Clientes")}

                {cat("Comunicação")}
                {/* Sem tela ainda. Fica visível e cinza em vez de escondido:
                    quem não sabe que existe não pergunta, e o item apagado é o
                    que faz o dono querer saber quando chegar. */}
                {item("whatsapp", <MessageCircle size={17} />, "WhatsApp", true)}
              </>
            )}
          </motion.div>
        </nav>

        {/* Ajuda — fica fora da navegação, junto do rodapé: não é lugar que se
            visita no fluxo de trabalho, é a saída para quando algo trava. */}
        <div className="relative px-3 pb-1 pt-2">
          <button
            type="button"
            onClick={() => goto("ajuda")}
            aria-current={isActive("ajuda") ? "page" : undefined}
            className={`group focus-ring relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13.5px] transition-colors duration-200 ${
              isActive("ajuda") ? "text-ink" : "text-mist hover:bg-fg/[0.05] hover:text-ink"
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fg/[0.04] text-faint transition-colors group-hover:bg-fg/[0.08] group-hover:text-accent-soft">
              <LifeBuoy size={17} />
            </span>
            <span className="flex-1">Ajuda e suporte</span>
          </button>

          {/* Instalar o app: some sozinho quando já está instalado ou quando o
              navegador não instala PWA — ver `BotaoInstalar`. */}
          <BotaoInstalar variante="menu" />
        </div>

        {/* Usuário */}
        <div className="relative p-3">
          <div className="glass-subtle flex items-center gap-3 rounded-2xl p-2.5">
            {user?.image ? (
              <img src={user.image} alt="" className="h-9 w-9 flex-shrink-0 rounded-full object-cover ring-1 ring-fg/10" />
            ) : (
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-soft to-accent text-xs text-white ring-1 ring-fg/10">{userInitials}</div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-ink">{user?.nome || "Usuário"}</p>
              <p className="truncate text-[11px] text-faint">{user?.cargo || "Conectado"}</p>
            </div>

            {/* Mural da equipe — só gestor recebe (a API responde 403 ao vendedor). */}
            {gestor && <SinoNotificacoes />}

            <button
              type="button"
              onClick={() => goto("/configuracoes")}
              aria-label="Configurações"
              className={`focus-ring flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-200 hover:rotate-45 hover:bg-fg/[0.08] ${isActive("configuracoes") ? "text-accent-soft" : "text-faint hover:text-accent-soft"}`}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="relative flex items-center justify-between gap-2 border-t border-fg/[0.07] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/logo.png" width={22} height={22} alt="" className="rounded" />

            <div className="min-w-0">
              <p className="truncate text-[13px] leading-tight text-mist">CodeEx Flow</p>

              {/* A versão fica visível de propósito: "meu app está atualizado?"
                  precisa ter resposta olhando a tela, não sensação. Clicar
                  limpa o cache e recarrega — a saída para o worker que travou
                  numa versão antiga. */}
              <button
                type="button"
                onClick={atualizarAgora}
                disabled={atualizando}
                title="Clique para buscar a versão mais recente"
                className="focus-ring flex max-w-full items-center gap-1 rounded text-[10px] leading-tight text-faint transition-colors hover:text-accent-soft disabled:opacity-60"
              >
                <RefreshCw size={9} className={atualizando ? "animate-spin" : ""} />
                <span className="truncate">{BUILD_ID}</span>
              </button>
            </div>
          </div>

          <button type="button" onClick={handleLogout} className="focus-ring flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-mist transition-colors hover:bg-danger/10 hover:text-danger">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
