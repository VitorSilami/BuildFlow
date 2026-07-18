# Design System v2 — substituir Mazer/Bootstrap por Tailwind + shadcn/ui

## Contexto

Este trabalho corresponde às Etapas 4-7 do "BuildFlow Product Blueprint"
(`docs/product-blueprint/01-descoberta-ia-ux-strategy.md`): Fluxos, Design System, Biblioteca de
Componentes e Arquitetura Frontend. O brief do Product Blueprint pede um produto no nível visual de
Linear/Stripe/Vercel, explicitamente rejeitando "aparência de template administrativo" — o que o
Mazer (template gratuito de admin dashboard Bootstrap, adotado na sessão anterior) é, por definição.
Esta é uma decisão consciente de substituir esse trabalho, não de evoluí-lo.

Nesta mesma sessão, redesenhamos a tela `/login` clonando a landing page do repositório
`github.com/VitorSilami/diario-em-obras` (um projeto Lovable: Tailwind CSS v4 + shadcn/ui + tokens
OKLCH + Space Grotesk/Inter/JetBrains Mono), mas reimplementada em SCSS próprio para não introduzir
Tailwind ao lado do Bootstrap que existia então. Agora que o Bootstrap está saindo, essa restrição
deixa de existir.

## Decisões

1. **Semente visual**: o Design System nasce da linguagem já validada no login (paleta ink/signal
   em OKLCH, tipografia Space Grotesk + Inter + JetBrains Mono) — não começa do zero. Os tokens do
   `diario-em-obras` (`src/styles.css`: `--background`, `--foreground`, `--card`, `--popover`,
   `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`,
   `--ring`, além de `--surface`, `--surface-strong`, `--ink`, `--signal` customizados) já estão no
   formato que o shadcn/ui espera — são a base direta dos tokens Tailwind `@theme` do app inteiro.
2. **Stack CSS**: Tailwind CSS v4 + shadcn/ui, substituindo Bootstrap 5 + SCSS do Mazer
   completamente. Componentes genéricos (Button, Input, Select, Checkbox, Switch, Badge, Card,
   Dialog, Drawer, Table, Tabs, Progress, Skeleton, DropdownMenu, Tooltip, Avatar, Command) portados
   do `diario-em-obras` (que já tem ~30 componentes shadcn scaffolded com o tema certo) em vez de
   rodar `shadcn add` do zero — mesma estratégia de clonagem usada na redesign do login.
3. **Login migra também**: `LoginPage.tsx` é reescrito de SCSS próprio para Tailwind + shadcn,
   mantendo o mesmo resultado visual e a mesma lógica de login real do Google (inalterada). Isso
   elimina ter 3 abordagens de CSS coexistindo (Bootstrap + SCSS custom do login + Tailwind novo).
4. **Tema**: claro como padrão (legibilidade sob sol em campo — Etapa 3 do blueprint, UX Strategy).
   Toggle escuro continua existindo via `ThemeContext` (`frontend/src/features/theme/ThemeContext.tsx`)
   — a API pública do hook (`useTheme(): { theme, toggleTheme }`) não muda, só o mecanismo CSS por
   baixo (de `data-bs-theme` para a convenção de dark mode do Tailwind/shadcn, `.dark` no `<html>`).
5. **Rollout**: big-bang. Todas as páginas existentes (Login, Projetos, Registros Diários
   lista/detalhe/form, Configurações) são migradas na mesma série de tarefas — não fica período
   prolongado com Bootstrap e Tailwind coexistindo.
6. **Isolamento de camadas (não muda)**: `features/`, `hooks/`, `services/`, `schemas/`, `types/`
   continuam exatamente como estão — nenhum hook, chamada de API, Zod schema ou rota é tocado. Só a
   camada de apresentação (`layouts/`, `components/ui/`, `pages/`, `styles/`) é reescrita.

## Arquitetura frontend (Etapa 7 do blueprint)

```
frontend/src/
  layouts/          # DashboardLayout, Sidebar, Topbar, Footer — reescritos em Tailwind/shadcn
  components/ui/    # camada shadcn (Button, Card, Dialog, Table, ...) + composites próprios
                     # (PageHeader, EmptyState, StatCard, DataTable-com-filtro)
  pages/            # mesma responsabilidade de hoje, JSX reescrito
  features/          # INALTERADO — AuthContext, ThemeContext, projetosApi, registrosDiariosApi,
                     # configuracaoApi
  hooks/            # INALTERADO
  services/         # INALTERADO — apiClient
  schemas/          # INALTERADO — validação Zod
  types/            # INALTERADO
  styles/           # substitui a árvore Mazer inteira por um único entry point Tailwind
                     # (`app.css` com `@theme` + poucas customizações; sem SCSS)
```

## Componentes (Etapa 6 do blueprint)

- **Genéricos (shadcn, portados de `diario-em-obras`)**: Button, Input, Select, Checkbox, Switch,
  Badge, Card, Dialog, Drawer, Table, Tabs, Progress, Skeleton, DropdownMenu, Tooltip, Avatar,
  Command, Label, Textarea.
- **Compostos próprios do BuildFlow**: `PageHeader` (título + breadcrumb, já existe, é reescrito
  em cima dos primitivos novos), `EmptyState` (novo, padroniza os "nenhum X ainda" hoje repetidos
  em cada página), `Stepper`/`Wizard` (para o RDO — ver Etapa 3 do blueprint, feedback de progresso
  no preenchimento), `StatCard` (para os futuros Dashboards da Etapa 2 do blueprint, não construído
  agora, só a base de componente fica pronta).

## Fluxos (Etapa 4 do blueprint) — validados nesta redesign

Login → Projetos → Criar Projeto → Selecionar Projeto → Registrar RDO → Consultar Histórico →
Editar → Duplicar → Relatórios → Configurações. As páginas/rotas e o comportamento de cada fluxo
não mudam nesta iniciativa (isso seria mudança de produto, não de design system) — o que muda é
inteiramente a camada visual que os representa. Melhorias de fluxo identificadas na Etapa 3 do
blueprint (pré-preencher RDO com dados do anterior, ação "Duplicar" no histórico) ficam registradas
como trabalho de produto futuro, fora do escopo desta troca de Design System.

## Testes

- `frontend/tests/e2e/*.spec.ts` continuam sendo o contrato: mesmos `aria-label`, `role`, texto de
  botão/link, sem enfraquecer nenhuma asserção.
- `npm run lint && npx tsc -b --noEmit && npm run build && npm run test && npm run test:e2e` (10
  testes) devem passar ao final.

## Fora de escopo

- Nenhuma mudança de lógica de negócio, hooks, API, rotas ou schemas.
- Nenhum módulo novo do Product Blueprint (Dashboard, RNC, Aprovação de RDO, EAP, Medição, Custos,
  Mapa Vivo) é construído aqui — só a fundação visual que os módulos futuros vão usar.
- Melhorias de fluxo (pré-preenchimento, duplicar RDO) não são implementadas nesta troca — ficam
  documentadas para uma iteração de produto separada.
