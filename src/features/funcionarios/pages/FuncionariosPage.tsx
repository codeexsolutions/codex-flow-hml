import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, ShieldCheck, UserPlus, KeyRound, Power, Crown, Loader2, AlertTriangle, Pencil, UserCog } from "lucide-react";

import { TabelaCard, TabelaHead, TabelaRow, TabelaVazia, type Coluna } from "@/shared/ui/DataTable";
import { Modal } from "@/shared/ui/Modal";
import { useAlert } from "@/shared/ui/Alert";
import useAuth from "@/features/auth/store/auth.store";
import FuncionarioService, { type Equipe, type Funcionario, type PermissaoFuncionario } from "@/features/funcionarios/services/funcionario.service";
import useEquipeStore from "@/features/funcionarios/store/equipe.store";
import { PageScreen } from "@/shared/ui/PageShell";
import { Selo } from "@/shared/ui/StatusBadge";

const COLS = "grid-cols-[1.4fr_1fr_110px_100px_112px]";

const VAZIO = { nome: "", email: "", cargo: "", senha: "", permissao: "USUARIO" as PermissaoFuncionario };

/** Nível de acesso com rótulo — nunca só a cor. */
function AcessoBadge({ f }: { f: Funcionario }) {
  if (f.root) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent-soft ring-1 ring-accent/25">
        <Crown size={11} /> Master
      </span>
    );
  }

  return f.permissao === "ADMIN" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/[0.1] px-2 py-0.5 text-[11px] text-accent-soft ring-1 ring-accent/20">
      <ShieldCheck size={11} /> Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-fg/[0.06] px-2 py-0.5 text-[11px] text-mist ring-1 ring-fg/[0.08]">
      Vendedor
    </span>
  );
}

function StatusBadge({ status }: { status: Funcionario["status"] }) {
  const ativo = status === "ATIVO";

  return <Selo tom={ativo ? "sucesso" : "neutro"}>{ativo ? "Ativo" : "Inativo"}</Selo>;
}

const FuncionariosPage = () => {
  const alert = useAlert();
  const { user } = useAuth();

  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [novo, setNovo] = useState(VAZIO);
  const [showNovo, setShowNovo] = useState(false);

  const [editando, setEditando] = useState<Funcionario | null>(null);
  const [edicao, setEdicao] = useState({ nome: "", cargo: "", permissao: "USUARIO" as PermissaoFuncionario });

  const [senhaDe, setSenhaDe] = useState<Funcionario | null>(null);
  const [novaSenha, setNovaSenha] = useState("");

  const ehRoot = Boolean(user?.root);

  const carregar = useCallback(async () => {
    try {
      const nova = await FuncionarioService.listar();

      setEquipe(nova);
      // A sidebar usa o mesmo dado para decidir se mostra "Funcionários".
      useEquipeStore.getState().definir(nova);
      setErro("");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const funcionarios = equipe?.funcionarios ?? [];

  const vagas = useMemo(() => {
    if (!equipe) return "";
    if (equipe.limiteUsuarios === null) return `${equipe.usados} de ilimitados`;
    return `${equipe.usados} de ${equipe.limiteUsuarios}`;
  }, [equipe]);

  /* ------------------------------ Ações ------------------------------ */

  const cadastrar = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      await FuncionarioService.cadastrar(novo);
      setShowNovo(false);
      setNovo(VAZIO);
      await carregar();
      alert.success("Funcionário cadastrado", "Ele já pode entrar com o e-mail e a senha definidos.");
    } catch (e) {
      alert.error("Não foi possível cadastrar", (e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicao = (f: Funcionario) => {
    setEditando(f);
    setEdicao({ nome: f.nome, cargo: f.cargo, permissao: f.permissao });
  };

  const salvarEdicao = async () => {
    if (!editando || salvando) return;
    setSalvando(true);
    try {
      await FuncionarioService.alterar(editando.id, edicao);
      setEditando(null);
      await carregar();
      alert.success("Alterações salvas", `Os dados de ${editando.nome} foram atualizados.`);
    } catch (e) {
      alert.error("Não foi possível atualizar", (e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const alternarStatus = async (f: Funcionario) => {
    const ativando = f.status !== "ATIVO";

    if (!ativando) {
      const resposta = await alert.confirm("Desativar acesso?", `${f.nome} não conseguirá mais entrar no sistema até ser reativado.`);
      if (!resposta.confirmed) return;
    }

    try {
      await FuncionarioService.alterarStatus(f.id, ativando);
      await carregar();
      alert.success(ativando ? "Acesso liberado" : "Acesso desativado", `${f.nome} ${ativando ? "já pode entrar no sistema." : "não consegue mais entrar."}`);
    } catch (e) {
      alert.error("As alterações não foram salvas", (e as Error).message);
    }
  };

  const redefinirSenha = async () => {
    if (!senhaDe || salvando) return;
    setSalvando(true);
    try {
      await FuncionarioService.redefinirSenha(senhaDe.id, novaSenha);
      setSenhaDe(null);
      setNovaSenha("");
      alert.success("Senha redefinida", "Passe a nova senha para o funcionário.");
    } catch (e) {
      alert.error("Não foi possível redefinir", (e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  /* ----------------------------- Colunas ----------------------------- */

  const colunas: Coluna<Funcionario>[] = [
    {
      id: "nome",
      header: "Funcionário",
      cell: (f) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-ink">{f.nome}</span>
          <span className="truncate text-[11px] text-faint">{f.cargo}</span>
        </span>
      ),
    },
    { id: "email", header: "E-mail", cell: (f) => <span className="truncate text-mist">{f.email}</span> },
    { id: "acesso", header: "Acesso", cell: (f) => <AcessoBadge f={f} /> },
    { id: "status", header: "Status", cell: (f) => <StatusBadge status={f.status} /> },
    {
      id: "acoes",
      header: "Ações",
      align: "right",
      cell: (f) => (
        <span className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => abrirEdicao(f)}
            title="Editar"
            className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border border-fg/[0.08] text-mist transition hover:bg-fg/[0.05] hover:text-ink"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={() => {
              setSenhaDe(f);
              setNovaSenha("");
            }}
            title="Redefinir senha"
            className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border border-fg/[0.08] text-mist transition hover:bg-fg/[0.05] hover:text-ink"
          >
            <KeyRound size={13} />
          </button>
          {/* O usuário master não se desativa: sobraria empresa sem administrador. */}
          {!f.root && (
            <button
              type="button"
              onClick={() => alternarStatus(f)}
              title={f.status === "ATIVO" ? "Desativar" : "Ativar"}
              className={`focus-ring flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                f.status === "ATIVO" ? "border-fg/[0.08] text-mist hover:bg-danger/10 hover:text-danger" : "border-success/30 text-success hover:bg-success/10"
              }`}
            >
              <Power size={13} />
            </button>
          )}
        </span>
      ),
    },
  ];

  /* ------------------------------ Render ------------------------------ */

  const campo = "w-full rounded-lg border border-fg/[0.08] bg-fg/[0.035] px-3 py-2.5 text-[13px] text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15";
  const rotulo = "mb-1 block text-[10px] uppercase tracking-[0.7px] text-faint";

  if (carregando) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-mist">
        <Loader2 className="h-4 w-4 animate-spin text-accent" /> Carregando equipe...
      </div>
    );
  }

  // Vendedor não abre esta aba — a API responde 403 e a mensagem vem dela.
  if (erro) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertTriangle className="h-7 w-7 text-warning" />
        <p className="max-w-md text-[13px] text-mist">{erro}</p>
      </div>
    );
  }

  return (
    /* Tela própria: deixou de ser aba de Vendas, então traz a própria moldura. */
    <PageScreen
      icon={<UserCog className="h-5 w-5" />}
      title="Funcionários"
      subtitle="Cadastro e acesso de quem trabalha na loja"
    >
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Vagas do plano — é a regra que limita o cadastro */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fg/[0.07] bg-fg/[0.02] px-4 py-3">
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/[0.14] text-accent-soft ring-1 ring-inset ring-accent/20">
            <Users size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] text-ink">
              {vagas} {equipe?.limiteUsuarios === 1 ? "usuário" : "usuários"}
            </span>
            <span className="block text-[11px] text-faint">Plano {equipe?.planoNome ?? "—"}</span>
          </span>
        </span>

        {!equipe?.podeAdicionar && (
          <span className="rounded-full bg-warning/15 px-2.5 py-1 text-[11px] text-warning ring-1 ring-warning/25">
            Limite do plano atingido — faça upgrade para cadastrar mais
          </span>
        )}
      </div>

      <TabelaCard
        title="Funcionários"
        icon={<Users size={15} />}
        count={funcionarios.length}
        countLabel={funcionarios.length === 1 ? "pessoa" : "pessoas"}
        onAdd={equipe?.podeAdicionar ? () => setShowNovo(true) : undefined}
        addLabel="Novo funcionário"
        minWidth={640}
      >
        <TabelaHead colunas={colunas} cols={COLS} />
        {funcionarios.length === 0 ? (
          <TabelaVazia icon={<UserPlus size={20} />} title="Nenhum funcionário cadastrado" description="Cadastre seus vendedores para que cada um acesse o PDV com o próprio login." />
        ) : (
          funcionarios.map((f) => <TabelaRow key={f.id} colunas={colunas} cols={COLS} row={f} />)
        )}
      </TabelaCard>

      {/* -------------------- Modal: novo funcionário -------------------- */}
      <Modal open={showNovo} onClose={() => setShowNovo(false)} title="Novo funcionário" subtitle="Ele entra com o e-mail e a senha definidos aqui." size="sm">
        <div className="flex flex-col gap-3">
          <div>
            <label className={rotulo}>Nome</label>
            <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome do vendedor" className={campo} />
          </div>

          <div>
            <label className={rotulo}>E-mail</label>
            <input value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} type="email" placeholder="vendedor@empresa.com" className={campo} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rotulo}>Cargo</label>
              <input value={novo.cargo} onChange={(e) => setNovo({ ...novo, cargo: e.target.value })} placeholder="Vendedor" className={campo} />
            </div>
            <div>
              <label className={rotulo}>Senha inicial</label>
              <input value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} type="text" placeholder="Mínimo 6 caracteres" className={campo} />
            </div>
          </div>

          {/* Promover a admin é privilégio do dono. */}
          {ehRoot && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-fg/[0.07] bg-fg/[0.02] px-3 py-2.5">
              <input
                type="checkbox"
                checked={novo.permissao === "ADMIN"}
                onChange={(e) => setNovo({ ...novo, permissao: e.target.checked ? "ADMIN" : "USUARIO" })}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[rgb(var(--accent))]"
              />
              <span className="text-[12px] leading-relaxed text-mist">
                <span className="text-ink">Administrador</span> — além de vender, gerencia funcionários e vê o financeiro e todas as vendas.
              </span>
            </label>
          )}

          <button
            type="button"
            onClick={cadastrar}
            disabled={salvando}
            className="focus-ring mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-[13px] text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            Cadastrar funcionário
          </button>
        </div>
      </Modal>

      {/* -------------------- Modal: editar -------------------- */}
      <Modal open={!!editando} onClose={() => setEditando(null)} title="Editar funcionário" subtitle={editando?.email} size="sm">
        <div className="flex flex-col gap-3">
          <div>
            <label className={rotulo}>Nome</label>
            <input value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} className={campo} />
          </div>

          <div>
            <label className={rotulo}>Cargo</label>
            <input value={edicao.cargo} onChange={(e) => setEdicao({ ...edicao, cargo: e.target.value })} className={campo} />
          </div>

          {ehRoot && !editando?.root && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-fg/[0.07] bg-fg/[0.02] px-3 py-2.5">
              <input
                type="checkbox"
                checked={edicao.permissao === "ADMIN"}
                onChange={(e) => setEdicao({ ...edicao, permissao: e.target.checked ? "ADMIN" : "USUARIO" })}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[rgb(var(--accent))]"
              />
              <span className="text-[12px] leading-relaxed text-mist">
                <span className="text-ink">Administrador</span> — gerencia funcionários e vê o financeiro.
              </span>
            </label>
          )}

          <button
            type="button"
            onClick={salvarEdicao}
            disabled={salvando}
            className="focus-ring mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-[13px] text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : null}
            Salvar alterações
          </button>
        </div>
      </Modal>

      {/* -------------------- Modal: redefinir senha -------------------- */}
      <Modal open={!!senhaDe} onClose={() => setSenhaDe(null)} title="Redefinir senha" subtitle={senhaDe?.nome} size="sm">
        <div className="flex flex-col gap-3">
          <div>
            <label className={rotulo}>Nova senha</label>
            <input value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} type="text" placeholder="Mínimo 6 caracteres" className={campo} />
          </div>

          <p className="text-[11px] leading-relaxed text-faint">A senha aparece em texto para você conseguir passá-la ao funcionário. Peça que ele troque no primeiro acesso.</p>

          <button
            type="button"
            onClick={redefinirSenha}
            disabled={salvando}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-[13px] text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            Redefinir senha
          </button>
        </div>
      </Modal>
    </div>
    </PageScreen>
  );
};

export default FuncionariosPage;
