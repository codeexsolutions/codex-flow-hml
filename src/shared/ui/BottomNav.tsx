import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, DollarSign, Package, Users, Wallet, BarChart3, MoreHorizontal, Settings, LogOut, UserCircle, Truck, Lock, Table2 } from "lucide-react";

import useAuth from "@/features/auth/store/auth.store";
import { ehGestor } from "@/features/vendas/components/TabsVendas";
import useEquipeStore, { planoTemEquipe } from "@/features/funcionarios/store/equipe.store";
import Sheet from "@/shared/ui/Sheet";
import { tocarNavegacao } from "@/shared/session/somSessao";
import { ABAS_SWIPE } from "@/shared/hooks/useSwipeAbas";
import usePlano from "@/shared/plano/plano.store";

/**
 * `familia` só vem preenchida no primeiro item de cada grupo — é ela que
 * imprime o título na folha "Mais".
 *
 * `recurso` é a flag do plano que o item exige. Sem ela no plano, o item
 * aparece apagado e não recebe toque: no celular o alvo é o dedo, e um
 * destino que só leva a uma tela de venda é pior aqui do que no computador.
 */
type Item = {
  rota: string;
  label: string;
  icon: React.ReactNode;
  familia?: string;
  recurso?: string;
  /** Tela que ainda não existe — diferente de módulo fora do plano. */
  emBreve?: boolean;
};

/**
 * Navegação do celular — dock flutuante, com a aba ativa expandida.
 *
 * A barra anterior era colada na borda, ocupando a largura toda, com ícone em
 * cima e rótulo embaixo nos quatro itens. Dois problemas nisso: quatro rótulos
 * de 10px competindo entre si o tempo todo — e nenhum deles é lido depois da
 * primeira semana de uso — e uma faixa cheia encostada na base, que fazia a
 * tela terminar num degrau.
 *
 * O desenho novo inverte a lógica: **só a aba em que você está mostra o nome**,
 * deitado ao lado do ícone dentro de uma pílula lavada; as outras ficam em
 * ícone puro. Quem está no PDV não precisa que a tela repita "PDV" — precisa
 * saber onde está e enxergar os outros destinos. E o nome aparecendo só ali dá
 * ao item ativo um peso que cor nenhuma sozinha daria.
 *
 * A dock solta do chão, com margem e cantos arredondados, é o que tira o
 * degrau: a tela continua atrás dela e o conteúdo respira até embaixo.
 *
 * Cuidados que o desenho exige:
 *
 * - **Rótulo escondido não é rótulo removido**: todo botão carrega `aria-label`,
 *   então leitor de tela anuncia o destino igual, ativo ou não.
 * - **A pílula desliza** (`layoutId`) e o nome abre junto, na mesma mola. Dois
 *   movimentos na mesma direção lêem como um só.
 * - **A dock não estica.** Ela tem a largura do próprio conteúdo (`w-fit`), e
 *   a aba ativa cresce só o que o nome precisa. Com `flex-1` ela engolia toda a
 *   sobra da barra e virava um bloco do tamanho de três botões.
 * - **52px de altura + 10 de margem** ficam abaixo dos 72px que o corpo das
 *   telas já reserva no rodapé — nenhuma tela precisou de ajuste.
 * - **Arrastar a tela troca de aba.** A ordem das abas mora em `ABAS_SWIPE`
 *   (em `useSwipeAbas`) e é lida daqui — uma fonte só para o gesto e a dock.
 */
const BottomNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [maisAberto, setMaisAberto] = useState(false);
  const reduzir = useReducedMotion();

  const gestor = ehGestor(user);

  /** Item fora do plano aparece apagado e sem toque. */
  const temRecurso = usePlano((s) => s.recurso);

  /* No celular a sidebar não existe, então a busca precisa acontecer aqui —
     senão "Funcionários" nunca apareceria no menu "Mais". */
  const equipe = useEquipeStore((s) => s.equipe);
  const buscarEquipe = useEquipeStore((s) => s.buscar);

  useEffect(() => {
    if (gestor) buscarEquipe();
  }, [gestor, buscarEquipe]);

  /*
   * A barra é a mesma para todos: o funcionário opera a loja inteira.
   *
   * A ORDEM vem de `ABAS_SWIPE`, não daqui: o gesto de arrastar navega por
   * aquela lista, e se as duas divergissem o dedo iria para um lado e a pílula
   * para outro. Aqui ficam só o rótulo e o ícone de cada rota.
   */
  const APARENCIA: Record<string, { label: string; icon: React.ReactNode }> = {
    "/": { label: "Início", icon: <LayoutDashboard size={18} /> },
    "/pdv": { label: "PDV", icon: <ShoppingCart size={18} /> },
    // Direto na lista: a "Visão geral" é o que o Início já mostra.
    "/vendas/lista": { label: gestor ? "Vendas" : "Minhas vendas", icon: <DollarSign size={18} /> },
  };

  const principais: Item[] = ABAS_SWIPE.map((rota) => ({ rota, ...APARENCIA[rota] }));

  /*
   * O resto vai para a folha "Mais" — não cabe e não é de uso constante.
   *
   * Os grupos e a ordem acompanham a sidebar — Meu dia, Cadastros,
   * Dinheiro, Entregas, Produção, Relacionamento. O que muda é a moldura: lá os dois
   * grandes blocos são abas, aqui tudo desce numa lista. Numa folha que já
   * custou um toque para abrir, esconder metade dos destinos atrás de uma
   * segunda troca cobraria caro demais; os títulos separam o suficiente, e a
   * sequência idêntica faz quem usou o computador achar o item no celular
   * sem procurar.
   *
   * Clientes aparece uma vez só, e não duas como na sidebar: lá a repetição
   * evita uma troca de aba, aqui não há aba nenhuma para evitar — o mesmo
   * nome duas vezes numa lista corrida só pareceria engano.
   */
  const secundarios: Item[] = [
    { rota: "/clientes", label: "Clientes", icon: <Users size={18} />, familia: "Cadastros" },
    // Equipe é do dono e só existe em plano que comporta mais de um usuário.
    ...(gestor && planoTemEquipe(equipe) ? [{ rota: "/funcionarios", label: "Minha equipe", icon: <UserCircle size={18} /> }] : []),
    /* O mesmo rótulo da sidebar: quem usou o computador precisa achar o item
       pelo nome que já conhece quando abrir no celular. */
    { rota: "/estoque", label: "Estoque/Serviços", icon: <Package size={18} /> },

    // Financeiro virou aba de Vendas — deixou de ser destino próprio.
    ...(gestor ? [{ rota: "/vendas/financeiro", label: "Caixa e contas", icon: <Wallet size={18} />, recurso: "financeiro", familia: "Dinheiro" }] : []),
    { rota: "/relatorios", label: "Relatórios", icon: <BarChart3 size={18} />, recurso: "relatorios" },

    // Correios voltou para "em breve" enquanto o módulo é finalizado. Fica na
    // folha, apagado: some do menu e ninguém descobre que existe. O selo é
    // "Em breve", não o cadeado de plano — o cadeado promete uma tela que o
    // upgrade destrava hoje, e essa ainda não está de pé.
    { rota: "/correios", label: "Correios", icon: <Truck size={18} />, emBreve: true, familia: "Entregas" },

    // Uma ferramenta só para a produção — o quadro de etapas saiu.
    { rota: "/planilhas", label: "Planilhas", icon: <Table2 size={18} />, familia: "Produção" },

    { rota: "/configuracoes", label: "Configurações", icon: <Settings size={18} />, familia: "Conta" },
  ];

  const ativo = (rota: string) => (rota === "/" ? pathname === "/" : pathname === rota || pathname.startsWith(`${rota}/`));

  const ir = (rota: string) => {
    // Mesmo critério da sidebar: sem som quando já se está no destino.
    if (!ativo(rota)) tocarNavegacao();

    setMaisAberto(false);
    navigate(rota);
  };

  const mola = reduzir ? { duration: 0 } : ({ type: "spring", stiffness: 440, damping: 36 } as const);

  return (
    <>
      {/* A moldura cobre a largura toda só para centralizar a dock e respeitar a
          área segura; ela não recebe toque, então a tela continua clicável em
          volta dela. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] px-3 md:hidden" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}>
        <motion.nav
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={reduzir ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
          className="glass-strong pointer-events-auto mx-auto flex h-[52px] w-fit max-w-full items-center gap-0.5 rounded-full border px-1.5"
          style={{
            borderColor: "rgb(var(--glass-border) / calc(var(--glass-border-alpha) + 0.06))",
            boxShadow: "0 14px 32px -16px rgb(0 0 0 / 0.45)",
          }}
        >
          {principais.map((it) => {
            const on = ativo(it.rota);

            return (
              <motion.button
                key={it.rota}
                type="button"
                layout
                onClick={() => ir(it.rota)}
                aria-label={it.label}
                aria-current={on ? "page" : undefined}
                whileTap={reduzir ? undefined : { scale: 0.94 }}
                transition={mola}
                /* `w-auto`, não `flex-1`: com flex-1 a aba ativa engolia toda a
                   sobra da barra e virava um bloco do tamanho de três botões.
                   Agora ela cresce só o que o nome precisa. */
                className={`focus-ring relative flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[14px] transition-colors ${on ? "px-3 text-accent-soft" : "w-10 text-faint"}`}
              >
                {/* A pílula é um irmão posicionado, não o fundo do botão: assim
                    ela desliza entre os itens em vez de piscar no destino. */}
                {on && (
                  <motion.span
                    layoutId="dock-ativo"
                    transition={mola}
                    /* Fundo lavado com anel, no lugar do accent chapado: a aba
                       fica marcada sem virar o objeto mais pesado da tela. */
                    className="absolute inset-0 rounded-[14px] bg-accent/[0.14] ring-1 ring-inset ring-accent/25"
                  />
                )}

                <span className="relative shrink-0">{it.icon}</span>

                {/* O nome abre em largura, não em opacidade: surgir por cima dos
                    vizinhos e só depois empurrá-los seriam dois tempos. */}
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.span
                      key="rotulo"
                      initial={reduzir ? false : { opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={reduzir ? undefined : { opacity: 0, width: 0 }}
                      transition={mola}
                      className="relative overflow-hidden whitespace-nowrap text-[11.5px] leading-none tracking-tight"
                    >
                      {it.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}

          {/* Divisória: "Mais" abre uma folha, não navega. O fio separa as duas
              naturezas sem precisar de um rótulo explicando. */}
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-fg/10" />

          <motion.button
            type="button"
            layout
            onClick={() => setMaisAberto(true)}
            aria-label="Mais opções"
            aria-expanded={maisAberto}
            whileTap={reduzir ? undefined : { scale: 0.94 }}
            transition={mola}
            className={`focus-ring relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] transition-colors ${maisAberto ? "text-accent-soft" : "text-faint"}`}
          >
            {maisAberto && (
              <motion.span
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 480, damping: 30 }}
                className="absolute inset-0 rounded-[14px] bg-accent/[0.14] ring-1 ring-inset ring-accent/25"
              />
            )}

            <motion.span className="relative" animate={reduzir ? {} : { rotate: maisAberto ? 90 : 0 }} transition={{ type: "spring", stiffness: 420, damping: 28 }}>
              <MoreHorizontal size={18} />
            </motion.span>
          </motion.button>
        </motion.nav>
      </div>

      <Sheet open={maisAberto} onClose={() => setMaisAberto(false)} title="Mais" subtitle={user?.nome ? `Conectado como ${user.nome}` : undefined}>
        <div className="flex flex-col gap-1 pb-2">
          {secundarios.map((it) => (
            <div key={it.rota}>
              {/* O mesmo corte da sidebar: Atendimento primeiro, Minha loja
                  depois. Aqui os títulos são uma linha de 10px e não uma aba —
                  numa folha que rola, trocar de aba esconderia metade dos
                  destinos atrás de um toque, e no celular a folha "Mais" já é
                  o segundo toque. Separar basta; dividir atrapalharia. */}
              {it.familia && (
                <p className="px-3 pb-1.5 pt-4 text-[10px] uppercase tracking-[0.18em] text-muted first:pt-1">
                  {it.familia}
                </p>
              )}

              {it.emBreve ? (
                <div className="flex min-h-[48px] w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 text-left text-[14px] text-mist opacity-45">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fg/[0.05] text-faint">{it.icon}</span>
                  <span className="flex-1">{it.label}</span>
                  <span className="rounded-full border border-fg/[0.08] bg-fg/[0.03] px-2 py-0.5 text-[9px] uppercase tracking-wider text-faint">
                    Em breve
                  </span>
                </div>
              ) : it.recurso && !temRecurso(it.recurso) ? (
                <div className="flex min-h-[48px] w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 text-left text-[14px] text-mist opacity-55">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fg/[0.05] text-faint">{it.icon}</span>
                  <span className="flex-1">{it.label}</span>
                  <span className="flex items-center gap-1 rounded-full border border-accent/20 bg-accent/[0.08] px-2 py-0.5 text-[9px] uppercase tracking-wider text-accent-soft">
                    <Lock size={9} />
                    Plano
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => ir(it.rota)}
                  className="focus-ring flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-[14px] text-ink transition-colors hover:bg-fg/[0.05]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fg/[0.05] text-mist">{it.icon}</span>
                  {it.label}
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              setMaisAberto(false);
              Promise.resolve(logout()).catch(() => {});
            }}
            className="focus-ring mt-1 flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-left text-[14px] text-danger transition-colors hover:bg-danger/10"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger/10">
              <LogOut size={18} />
            </span>
            Sair
          </button>
        </div>
      </Sheet>
    </>
  );
};

export default BottomNav;
