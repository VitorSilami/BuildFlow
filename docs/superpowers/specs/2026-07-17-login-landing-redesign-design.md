# Restilizar /login com a landing page do diario-em-obras

## Contexto

O usuário desenvolveu, em um repositório separado (`github.com/VitorSilami/diario-em-obras`), uma landing
page completa para o BuildFlow (Tailwind CSS v4 + tokens de cor OKLCH, tipografia Space Grotesk/Inter/
JetBrains Mono, estética "blueprint/ink"). Esse repo não tem nenhum formulário de login funcional — todos os
botões "Entrar com Google" são apenas âncoras (`href="#entrar"`) que rolam a página até o Hero. O pedido é
clonar esse visual e usar como a nova tela `/login` do BuildFlow, mantendo o login real do Google
funcionando.

O restante do BuildFlow acabou de ser migrado (sessão anterior) para Bootstrap 5 + SCSS do Mazer. Este
trabalho é isolado a `/login` e não introduz Tailwind nem conflita com o Bootstrap já instalado.

## Decisões

1. **Escopo**: só a rota `/login`. Todas as seções da landing (Nav, Hero, Marquee, Features, Isolamento,
   Fluxo, FAQ, CTA final) viram conteúdo de uma única tela de login — não há rota `/` pública nova.
2. **CSS**: reprodução com CSS/SCSS próprio, sem instalar Tailwind. Cores OKLCH do reference repo convertidas
   para hex/CSS custom properties; tipografia via Google Fonts (`<link>` em `index.html`, mesma abordagem do
   reference repo — sem self-host). Um arquivo novo `frontend/src/styles/pages/_login.scss`, importado em
   `_mazer.scss`, cobre só essa tela.
3. **Botão real do Google**: Google Identity Services renderiza seu próprio widget visual (não é
   restilizável como um `<button>` arbitrário). Mantém-se **um único** `<div ref={buttonRef} id="entrar">`
   no meio do Hero recebendo o botão real; todo outro CTA "Entrar com Google" (Nav, CTA final) é um
   `<a href="#entrar">` que rola até ele — replicando o comportamento exato que o reference repo já tem.
   Nenhuma mudança na lógica de `loadGoogleScript`/`useAuth`/`useEffect` de `LoginPage.tsx`.
4. **Acessibilidade/testes**: o teste E2E (`login.spec.ts`) espera `getByRole('heading', {name:
   'BuildFlow'})`. O logo do Nav vira um `<h1>BuildFlow</h1>` (visualmente idêntico ao logo atual, só a tag
   muda), e o headline do Hero vira `<h2>` (tamanho visual grande via CSS, não pela tag) — evita dois `<h1>`
   na página e mantém exatamente um heading com "BuildFlow" no texto. `getByRole('button', {name: 'Entrar
   com Google (stub)'})` e o `role="alert"` com "Acesso não autorizado" continuam funcionando sem mudança,
   pois dependem só do conteúdo injetado dentro do `buttonRef`/do componente `Alert` já existente.

## Arquivos afetados

- `frontend/src/pages/LoginPage.tsx` — reescrito: mantém toda a lógica existente (linhas do
  `loadGoogleScript`, `useEffect`, estados `status`/`scriptError`) intacta; só o `return` (JSX) muda,
  compondo os sub-componentes locais `Nav`, `Hero`, `Marquee`, `Features`, `Isolation`, `Flow`, `Faq`,
  `CtaFooter` (adaptados do reference repo, em Bootstrap-friendly HTML + classes do novo `_login.scss`, não
  Tailwind).
- `frontend/src/styles/pages/_login.scss` — novo. Cores (`--login-ink`, `--login-signal`, `--login-surface`,
  etc.), grid-blueprint de fundo, tipografia (`.font-display`, `.font-mono`), estilos dos cards/seções.
- `frontend/src/styles/_mazer.scss` — adiciona `@import "./pages/login";`.
- `frontend/index.html` — adiciona `<link>` de preconnect + stylesheet do Google Fonts (Inter, Space
  Grotesk, JetBrains Mono).
- `frontend/src/assets/hero-road.jpg` — copiado do reference repo (220KB, imagem de rodovia usada no
  mockup do Hero).
- `frontend/src/layouts/AuthLayout.tsx` — **não é mais usado por `LoginPage`** (a nova tela é full-page, sem
  o split-screen do Mazer). Verificar se algum outro ponto do app ainda referencia `AuthLayout`; se não,
  removê-lo nesta mesma tarefa (arquivo morto).

## Fora de escopo

- Nenhuma rota nova (`/`, marketing pública) é criada.
- Nenhuma mudança em `useAuth`, `AuthContext`, backend, ou nos outros componentes de `components/ui/`.
- Conteúdo de copy (textos de Features/Isolamento/Fluxo/FAQ) é reaproveitado do reference repo tal como
  está — são texto de marketing já escrito pelo usuário, não precisa de revisão editorial aqui.

## Testes

- `frontend/tests/e2e/login.spec.ts` continua passando sem alteração: `getByRole('heading', {name:
  'BuildFlow'})`, `getByRole('button', {name: 'Entrar com Google (stub)'})`,
  `getByRole('alert')` contendo "Acesso não autorizado".
- Rodar `npm run lint && npx tsc -b --noEmit && npm run build && npx playwright test
  tests/e2e/login.spec.ts` ao final.
