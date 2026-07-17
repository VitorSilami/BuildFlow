# Refatoração do frontend com design system Mazer

## Contexto

O frontend do BuildFlow (React 18 + TypeScript + Vite) hoje não tem nenhuma camada de
layout nem biblioteca de componentes de UI — cada página em `src/pages/*.tsx` monta seu
próprio HTML/CSS inline. `mazer-main/` é o template open-source "Mazer" (Bootstrap 5,
sem jQuery, SCSS próprio com tema claro/escuro, fonte Nunito, ícones Bootstrap Icons +
Iconly). O objetivo é adotar esse design system no frontend, preservando 100% da
funcionalidade e dos testes existentes (70 testes backend, E2E Playwright), e introduzir
isolamento real de layout/componentes.

## Decisões

1. **CSS**: Bootstrap 5 + SCSS do Mazer, copiado para `frontend/src/styles/` e ajustado.
   Build via plugin sass nativo do Vite. Rejeitada a alternativa de extrair só tokens e
   reconstruir do zero (mais trabalho, menor fidelidade visual).
2. **Dark mode**: incluído nesta refatoração (toggle claro/escuro), reaproveitando
   `themes/dark/app-dark.scss` do Mazer via um `ThemeContext` que aplica atributo/classe
   no `<html>` e persiste a preferência em `localStorage`.
3. **Ícones**: `lucide-react` como única biblioteca de ícones (substitui tanto
   `bi bi-*` do Bootstrap Icons quanto a fonte Iconly), mapeando cada ícone usado no
   design de referência para o equivalente visual mais próximo em lucide.

## Arquitetura de pastas (novo)

```
frontend/src/
  layouts/
    DashboardLayout.tsx   # sidebar + topbar + <Outlet/> + footer
    AuthLayout.tsx         # split-screen para /login
    Sidebar.tsx
    Topbar.tsx
    Footer.tsx
  components/ui/
    Card.tsx
    Button.tsx
    Badge.tsx
    Table.tsx
    FormField.tsx
    PageHeader.tsx          # título + breadcrumb, como layout-default.html
    Spinner.tsx
  styles/
    _variables.scss
    app.scss
    themes/dark/...
  features/...              # inalterado (hooks, API clients, schemas Zod)
  pages/...                  # reescritas para compor layout + components/ui
```

- `features/`, `hooks/`, `schemas/`, `services/`, `types/` mantêm-se como estão — nenhuma
  lógica de negócio, chamada de API, validação ou rota muda.
- `DashboardLayout` substitui a estrutura de `master.html` do Mazer usando
  `<Outlet/>` do React Router em vez de includes Nunjucks; itens de menu são um array
  tipado (`Projetos`, `Registros Diários`, `Configurações`) com item ativo calculado via
  `useLocation`.
- `LoginPage` passa a usar `AuthLayout`, replicando o layout split-screen de
  `auth-login.html`, com o botão "Entrar com Google" estilizado como `btn btn-primary
  btn-lg`.
- Todas as páginas existentes (`ProjetosListPage`, `RdoPage`,
  `RegistrosDiariosListPage`, `RegistroDiarioDetailPage`, `ConfiguracaoPage`) passam a
  usar `PageHeader`/`Card`/`Table`/`FormField` de `components/ui/` — só a camada visual
  muda, mantendo os mesmos textos/labels/roles usados pelos testes E2E existentes.

## Dependências novas

- `bootstrap@5` (runtime)
- `sass` (devDependency, build SCSS)
- `lucide-react` (runtime, ícones)

## Testes

- Nenhum teste de backend é afetado.
- Testes unitários/integração do frontend (`vitest`) e E2E (`playwright`) são mantidos;
  seletores por texto/label/role são preservados. Onde a estrutura DOM mudar
  (ex.: `<div>` vira `<table>` semântica), os testes são ajustados para refletir a nova
  estrutura, nunca enfraquecidos.
- Rodar `npm run test`, `npm run test:e2e`, `npm run lint`, `tsc -b` ao final de cada
  página migrada (não só no final de tudo).

## Fora de escopo

- Qualquer mudança de lógica de negócio, hooks, API, autenticação ou schemas.
- Novas funcionalidades de produto (RNC, medição de contratos, painéis de custo — já
  fora do MVP).
- Testes de acessibilidade formais além do que os componentes Bootstrap já oferecem.

## Observação

O repositório BuildFlow ainda não está inicializado como git (`git init` pendente) —
este spec não pôde ser commitado; fica apenas registrado em
`docs/superpowers/specs/`.
