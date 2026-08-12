# CodEx Flow — Frontend · Guia para devs

Como o frontend é montado, onde cada coisa mora e as armadilhas que já custaram
horas. Leia antes de mexer em qualquer tela.

---

## Sumário

1. [Stack e comandos](#1-stack-e-comandos)
2. [Mapa da arquitetura](#2-mapa-da-arquitetura)
3. [Fluxo de autenticação e sessão](#3-fluxo-de-autenticação-e-sessão)
4. [Roteamento e controle de acesso](#4-roteamento-e-controle-de-acesso)
5. [Estado global (Zustand)](#5-estado-global-zustand)
6. [Camada de API (Axios)](#6-camada-de-api-axios)
7. [Planos e módulos pagos](#7-planos-e-módulos-pagos)
8. [O que é estético e o que é segurança](#8-o-que-é-estético-e-o-que-é-segurança)
9. [Temas e aparência](#9-temas-e-aparência)
10. [Convenções do código](#10-convenções-do-código)
11. [Armadilhas conhecidas](#11-armadilhas-conhecidas)
12. [Checklist de nova feature](#12-checklist-de-nova-feature)

---

## 1. Stack e comandos

| Item | Valor |
|---|---|
| Framework | **React 18** + TypeScript (strict) |
| Build | **Vite 5** + `vite-plugin-pwa` |
| Estado | **Zustand** (v5 rc) |
| Formulários | **react-hook-form** + **zod** |
| API | **Axios** (instância `sysgrafix`) |
| Rotas | **React Router v6** (`BrowserRouter`) |
| Realtime | **socket.io-client** |
| Estilo | **Tailwind CSS** v3 + CSS custom (`index.css`) |
| Gráficos | **recharts** · Planilhas export | **xlsx** · Animação | **framer-motion** |

```bash
npm install
npm run dev          # Vite, porta do .env (APPLICATION_PORT)
npm run build        # tsc -b && vite build
npm run lint         # eslint (só avisos no momento)
npm run icones       # gera os ícones a partir de public/logo.png
```

O frontend fala com a API do `codex-flow-api`. A base é decidida em
`src/shared/api/apiUrl.ts` (variável de ambiente ou fallback para produção).

---

## 2. Mapa da arquitetura

```
src/
├── app/
│   ├── routes/AppRoutes.tsx     ← roteador + TODA a lógica de guardas
│   └── layouts/MainLayout.tsx   ← sidebar + área de conteúdo (logado)
├── features/                    ← cada área de negócio é uma feature
│   ├── vendas/                  ← PDV, vendas, relatórios (páginas + components/)
│   ├── planilhas/               ← planilhas configuráveis
│   ├── correios/                ← frete, postagem, rastreio
│   ├── auth/  checkout/  clientes/  estoque/  financeiro/  …
│   └── … (20 no total)
└── shared/
    ├── api/        ← apiUrl.ts, sysgrafix.ts (axios), types.ts
    ├── ui/         ← componentes reutilizáveis (22)
    ├── hooks/      ← useDebounce, useIsMobile, useSwipeAbas…
    ├── plano/      ← plano.store.ts + RecursoDoPlano (gates de módulo)
    ├── session/    ← transicao, resetarLojas
    ├── realtime/   ← socket.io (liberação de empresa, sincronização)
    ├── theme/      ← tema claro/escuro + acentos
    └── utils/      ← currency, date, format, decodeToken, pix…
```

**Princípio das features**: cada feature é autocontida (`pages/`, `components/`,
`services/`, `types/`, `store/`). Uma tela nova não deve importar de outra
feature — só de `shared/`.

### O que cada pasta faz

| Pasta | Função |
|---|---|
| `features/*/pages/` | Uma tela completa (rota). Pode ter abas internas. |
| `features/*/components/` | Peças dessa tela, reutilizáveis **dentro** da feature. |
| `features/*/services/` | Chamadas HTTP da feature. **Sem JSX aqui.** |
| `features/*/types/` | Tipos das entidades + tipos dos services. |
| `features/*/store/` | Zustand store **daquela** feature (dados em cache da tela). |
| `shared/ui/` | Componentes sem negócio: botões, inputs, modais, badges. |
| `shared/api/` | A instância do axios e a resolução da URL. |
| `shared/plano/` | O plano vigente e o gate de módulo pago. |

---

## 3. Fluxo de autenticação e sessão

Tudo começa em `features/auth/store/auth.store.ts` (a store `useAuth`).

O JWT vive num **cookie httpOnly** (`codex_token`/`codex_refresh`): o navegador
o envia sozinho e o JS **nunca** o lê. Nada de `localStorage` para token — quem
valida a sessão é a API.

**Ao carregar o app** (`AppRoutes`):
1. `useAuth.initialize()` chama `GET /usuarios/me` (o cookie diz quem é).
2. Sucesso → marca logado, busca a empresa.
3. Sem sessão ou cookie vencido → `clearAuth()` (aviso só se a sessão existia).
4. Só depois `loading` cai para `false` e o roteador decide a tela.

**Ao logar** (`login()`):
1. Chama `AuthService.login` → o servidor seta os cookies e devolve **só o
   usuário** no corpo.
2. Como o cookie já está setado quando o login responde, a busca da empresa sai
   **em paralelo** com a animação de boas-vindas.
3. `Promise.all([animação, fetchEnterprise])` e só então `set({ isLogged })`.

**Ao sair** (`logout()`):
1. Toca a animação de transição (sobrevive ao desmonte da tela).
2. `clearAuth()` → chama `POST /auth/logout` (apaga o cookie, melhor esforço) +
   `resetarLojas()` (ver adiante).

> 🔒 **Deploy juntos:** o login não devolve mais token no corpo. API e frontend
> precisam ir ao ar no mesmo release — senão o frontend antigo não inicia a
> sessão.
>
> ⚠️ A coluna `root` do usuário é **opcional** no front (`root?: boolean`):
> usuários antigos não trazem. Sempre tratar com `Boolean(...)`.

---

## 4. Roteamento e controle de acesso

Toda a lógica está em **`src/app/routes/AppRoutes.tsx`** — não em middleware.
A ordem dos guardas importa:

```
1. Não logado + rota pública?   → deixa passar (/login, /cadastro, /planos, /page)
2. Não logado + rota privada?   → redireciona para /login
3. Logado + usuário INATIVO?    → só /checkout e /bem-vindo. O resto vai ao checkout
4. Logado + empresa não carregada? → tela de espera
5. Logado + ativo em /checkout ou /login? → redireciona para / (raiz)
6. Logado + ativo + NÃO-gestor em rota "só do dono"? → redireciona para /
```

**Rotas "só do dono"** (vendedor toma redirecionamento):
`/configuracoes/empresa`, `/configuracoes/faturas`, `/funcionarios` e
`/vendas/financeiro`. A lista é de **bloqueio**, não de liberação: tela nova
nasce acessível de propósito. Esconder do menu **não basta** — digitar a rota na
mão não pode abrir a tela.

**Rotas-atalho que redirecionam** (não quebre):
- `/financeiro` → `/vendas/financeiro`
- `/vendas/orcamentos` → `/pdv/orcamentos`
- `/producao` → `/planilhas`

O motivo em cada caso é manter link salvo / atalho funcionando.

> ⚠️ **Não há code-splitting.** As 52 rotas são importadas estáticas — o bundle
> sai em **1.8MB** num chunk só. Se for mexer em rotas, considere `React.lazy` +
> `Suspense`.

---

## 5. Estado global (Zustand)

Há **7 stores**, uma por área de dados:

| Store | Arquivo | Guarda |
|---|---|---|
| `useAuth` | `auth/store/auth.store.ts` | usuário, token, login/logout |
| `useEnterprise` | `empresa/store/enterprise.store.ts` | dados da empresa atual |
| `useClienteStore` | `clientes/store/cliente.store.ts` | lista de clientes (cache) |
| `useProdutoStore` | `estoque/store/produto.store.ts` | produtos (cache) |
| `useFinanceiroStore` | `financeiro/store/financeiro.store.ts` | financeiro (cache) |
| `useVendaStore` | `vendas/store/venda.store.ts` | venda em andamento no PDV |
| `usePlano` | `shared/plano/plano.store.ts` | plano vigente + `recurso()` |

### Regras de ouro

- **Seletores**: use `useStore((s) => s.campo)` e **nunca** desestruture a store
  inteira. Desestruturar `const { user } = useAuth()` faz o componente re-render
  a cada mudança de qualquer campo.
- **Stores de listas** (clientes, produtos, financeiro) são **cache** da tela:
  o refresh vem do service quando a tela monta. Não duplique o dado em
  componente local `useState` se a store já tem.
- **Não importe store de outra feature** — se precisar, refatore para `shared/`.

### `resetarLojas()` — por que existe

Em `shared/session/resetarLojas.ts`. Ao sair da conta, **zera** clientes,
produtos, vendas, financeiro e empresa para o estado inicial. Sem isso, os dados
de quem saiu ficariam visíveis para quem entrar em seguida (vazamento
multiempresa). O `setState(estado, true)` **substitui** o estado — um `true`
que impede chave suja sobreviver ao reset. `auth` não entra aqui de propósito
(evita ciclo de importação).

---

## 6. Camada de API (Axios)

`src/shared/api/sysgrafix.ts` é a **única** instância de axios do app. Toda
chamada passa por ela.

- **Credenciais**: `withCredentials: true` — o cookie httpOnly acompanha as
  chamadas cross-origin (site na Vercel, API na Railway).
- **Request**: não injeta nada; o cookie vai sozinho.
- **Response**: loga 401 (o refresh ainda não é automático — ver armadilha 11.1).
- **Envelope**: a API responde sempre `{ statusCode, message, data: [...] }`.
  O tipo `ApiEnvelope<T>` está em `shared/api/types.ts`.

### Padrão de service

Cada feature tem `services/*.service.ts`. Exemplo (`assinatura.service.ts`):

```ts
const AssinaturaService = {
  meuPlano: async (): Promise<MeuPlano> => {
    const res = await sysgrafix.get<RetornoPadrao<MeuPlano>>("/assinatura/meu-plano");
    const meu = res.data?.data?.[0];
    if (!meu) throw new Error(res.data?.message || "Não foi possível carregar seu plano.");
    return meu;
  },
};
```

- **Service nunca mexe em estado global** — retorna o dado, a store decide.
- Sem `JSX`, sem `navigate`, sem `alert` no service. Só HTTP.

---

## 7. Planos e módulos pagos

Dois mecanismos conversam com o backend:

### `shared/plano/plano.store.ts` (`usePlano`)
- `carregar()` busca o plano vigente **uma vez** quando a empresa ativa entra.
- `recurso("correios")` → `true/false` se o plano libera o módulo.
- `useRecurso("nome")` → hook atalho para uma flag só.

**Comportamento deliberado**: enquanto o plano **não carregou**, `recurso()`
devolve `true` (nada é escondido). Esconder primeiro e mostrar depois faz o
menu piscar a cada navegação.

### `shared/plano/RecursoDoPlano.tsx` (gate de rota)
Envolve a rota inteira: plano libera → mostra a tela; não libera → mostra a
**oferta** (não redireciona). Usado nas rotas `correios`, `relatorios` e
`vendas/financeiro`.

> 🔒 **Isto NÃO é segurança.** O `planoMiddleware` do backend responde 402 a
> quem digita a rota na mão. O front só decide o que mostrar.

---

## 8. O que é estético e o que é segurança

| Camada | Papel | É segurança? |
|---|---|---|
| Esconder menu na sidebar | UX | ❌ |
| `RecursoDoPlano` | UX (mostrar oferta) | ❌ |
| Guardas de rota no `AppRoutes` | UX + navegação | ❌ |
| `ehGestor()` / `root` | UX de navegação | ❌ |
| `planoMiddleware` (API) | Barra 402 módulo pago | ✅ |
| `authMiddleware` / `adminMiddleware` (API) | Barra rota sem token/escopo | ✅ |

Regra: **todo** controle que importa é no backend. O front esconde para a
pessoa não bater em porta trancada — mas bater não abre nada.

---

## 9. Temas e aparência

- `src/shared/theme/theme.store.ts` guarda tema (claro/escuro) e **acento**.
- O `AppRoutes` chama `useTheme()` no topo para aplicar o tema ao `data-*` do
  documento.
- `src/index.css` tem **956 linhas** de tokens: blocos `:root[data-accent=…]`
  para 9 acentos (roxo, azul, verde, rosa, laranja, teal, vinho, dourado, sepia).
- Classes custom do Tailwind: `bg-canvas`, `text-ink`, `text-mist`, `glass-liquid`,
  `accent`, `accent-soft`… Estão definidas no `tailwind.config.js` + `index.css`.

**Ao criar tela nova, use os tokens** (`bg-canvas`, `text-ink`, `accent`, …) em
vez de hex na mão — é o que mantém os 9 acentos funcionando de graça.

---

## 10. Convenções do código

- **Nomes em português** nos arquivos de tela (`ClientesPage`, `AjudaPage`).
  Services e types usam nomes de domínio ingleses (`customer.service`, `MeuPlano`).
- **Comentários**: o código é bem comentado. **Mantenha o que explica "porquê"**
  (regra de negócio, decisão de design) e **remova o que repete o óbvio**.
- **Tipos**: use `import type { … }` para importar só tipos (habilita
  `verbatimModuleSyntax`).
- **`any`**: proibido no `src/` (zero ocorrências hoje — mantenha assim).
- **Formulários**: `react-hook-form` + `zod` schema em `features/*/schema/`.
- **Alerta/toast**: use o `alert` de `shared/ui/Alert` (não `window.alert`).
- **Valores monetários**: use `shared/utils/currency` e `MoneyInput`.

---

## 11. Armadilhas conhecidas

1. **Refresh token morto.** O `codex_refresh` é setado no login mas nunca é
   usado: quando o access (12h) expira, o usuário toma 401 e volta ao login.
   Falta implementar o refresh (chamar o endpoint de refresh para girar o cookie
   `codex_token`). Com o cookie httpOnly o usuário nem percebe o 401 no meio — a
   sessão simplesmente morre no refresh da página.
2. **`react-is@19.2.7` com React 18.** Versões descasadas. Se mexer em deps,
   alinhe.
3. **`zustand@5.0.0-rc.2`.** É release candidate. Suba para a estável quando
   puder.
4. **Bundle de 1.8MB num chunk só.** Não há lazy-load. A app inteira (PDV,
   planilhas, recharts, xlsx) baixa no primeiro acesso.
5. **Deps mortas** que dão peso sem uso: `react-spinners`, `dom-to-image`,
   `dotenv`, `react-is` → nenhum arquivo importa.
6. **Desestruturar store** (`const { user } = useAuth()`) causa re-render de tudo.
   Use seletor.
7. **Esquecer `resetarLojas`** ao adicionar store nova: dados de quem saiu
   ficam na memória. Adicione a store à lista `LOJAS` de `resetarLojas.ts`.
8. **Importar de outra feature** cria acoplamento e às vezes ciclo. Só `shared/`.
9. **`/checkout` e `/bem-vindo`** são os únicos lugares para quem está inativo
   (sem pagamento). Não barre essas rotas para usuário inativo.

---

## 12. Checklist de nova feature

- [ ] Crie `src/features/<nome>/` com `pages/`, `components/`, `services/`,
      `types/`, e `store/` só se houver estado de tela.
- [ ] Rota em `AppRoutes.tsx` + **guarda** se for só do dono (lista de bloqueio).
- [ ] Se for módulo pago: envolva com `RecursoDoPlano` + flag em `recursos`
      **nos dois lados** (backend `planoMiddleware` + tipo `assinatura.types`).
- [ ] Menu na sidebar com o token `recurso()` da store de plano.
- [ ] Service usa `sysgrafix`, devolve `res.data?.data?.[0]`, lança erro com a
      mensagem da API.
- [ ] Store usa seletor no componente (`useStore((s) => s.x)`).
- [ ] Se a store guarda dado de empresa: adicione ao `resetarLojas`.
- [ ] Sem `any`, sem import de outra feature, use tokens de tema.
- [ ] `npm run lint` e `npm run build` limpos.
