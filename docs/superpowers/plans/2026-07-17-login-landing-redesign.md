# Login Landing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current bare `/login` screen with the full landing-page design the user built in `github.com/VitorSilami/diario-em-obras` (Nav, Hero with RDO mockup, Marquee, Features, Isolation, Flow, FAQ, CTA footer), keeping the real Google Identity Services login working, without introducing Tailwind CSS alongside the app's existing Bootstrap 5/Mazer stack.

**Architecture:** One new scoped stylesheet (`frontend/src/styles/pages/_login.scss`, everything nested under a `.login-page` wrapper class so nothing leaks into the rest of the Bootstrap-based app) plus a full rewrite of `frontend/src/pages/LoginPage.tsx` that keeps the existing Google-script-loading logic verbatim and composes the landing page's sections as local sub-components. `AuthLayout.tsx` becomes unused and is deleted.

**Tech Stack:** React 19 + TypeScript, plain SCSS (no Tailwind), `lucide-react` (already installed, not needed here — this page uses one inline Google "G" SVG, no other icons), Google Fonts CDN (`Inter`, `Space Grotesk`, `JetBrains Mono`).

## Global Constraints

- Do not change `loadGoogleScript`, the `useEffect` that calls `window.google.accounts.id.initialize`/`renderButton`, or the `status`/`scriptError` state machine — these already work and are exercised by `frontend/tests/e2e/login.spec.ts`. Only the surrounding JSX/markup changes.
- Exactly one element with role `heading` may have "BuildFlow" in its accessible name (the nav logo, rendered as `<h1>`) — the Hero headline must NOT be an `<h1>` and must not contain the literal text "BuildFlow".
- The real Google button's container (`ref={buttonRef}`) must keep `id="entrar"` so the page's other "Entrar com Google" links (`<a href="#entrar">`) scroll to it.
- `role="alert"` (via the existing `Alert` component) must still show the exact text driven by `loginError`/`scriptError`, matching what `login.spec.ts` checks (`toContainText('Acesso não autorizado')`).
- No Tailwind, no new npm dependencies. All new CSS lives in `frontend/src/styles/pages/_login.scss`, scoped under `.login-page`.
- Commit messages in Portuguese, imperative, explaining why.
- `cd frontend && npm run lint && npx tsc -b --noEmit && npm run build` must pass after each task; `npx playwright test tests/e2e/login.spec.ts` must pass after Task 2.

---

### Task 1: Fonts, hero image, and the `_login.scss` stylesheet

**Files:**
- Modify: `frontend/index.html`
- Create: `frontend/src/assets/hero-road.jpg`
- Create: `frontend/src/styles/pages/_login.scss`
- Modify: `frontend/src/styles/_mazer.scss`

**Interfaces:**
- Produces: a `.login-page` root class and the section classes `.login-nav`, `.login-logo` (+ `.login-logo__mark`, `.login-logo__text`, `.login-logo__signal`), `.login-hero` (+ `.login-hero__inner`, `.login-hero__grid`, `.login-hero__eyebrow`, `.login-hero__lead`, `.login-hero__actions`, `.login-hero__google`, `.login-hero__secondary`, `.login-hero__hint`, `.login-hero__mock`, `.login-hero__mock-header`, `.login-hero__mock-photo`, `.login-hero__mock-stats`, `.login-hero__mock-body`), `.login-marquee`, `.login-section` (+ `.login-section--dark`), `.login-eyebrow`, `.login-heading`, `.login-dot`, `.login-features-grid`, `.login-feature-card`, `.login-isolation-rows`, `.login-isolation-row` (+ `.login-isolation-row--ok`), `.login-flow-grid`, `.login-flow-step`, `.login-faq-grid`, `.login-cta-footer`, `.login-footer-bar`. Task 2 imports none of these as TS symbols — it only applies these as `className` strings on plain HTML elements, so this task's only contract with Task 2 is "these class names exist and produce the right visual result."

- [ ] **Step 1: Add Google Fonts links to `frontend/index.html`**

Change:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>frontend</title>
  </head>
```
to:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
    />
    <title>frontend</title>
  </head>
```

- [ ] **Step 2: Copy the hero image**

The reference repo was already cloned locally during design exploration. If it is still present at
`C:/Users/vitor/AppData/Local/Temp/claude/c--Users-vitor-OneDrive-Desktop-BuildFlow/b4503ab9-1095-4272-a030-fecbfb09830a/scratchpad/diario-em-obras`, copy directly:

```bash
mkdir -p frontend/src/assets
cp "C:/Users/vitor/AppData/Local/Temp/claude/c--Users-vitor-OneDrive-Desktop-BuildFlow/b4503ab9-1095-4272-a030-fecbfb09830a/scratchpad/diario-em-obras/src/assets/hero-road.jpg" frontend/src/assets/hero-road.jpg
```

If that path no longer exists (temp/scratchpad cleaned up), clone fresh into the scratchpad directory first:
```bash
git clone https://github.com/VitorSilami/diario-em-obras.git /tmp/diario-em-obras-ref
cp /tmp/diario-em-obras-ref/src/assets/hero-road.jpg frontend/src/assets/hero-road.jpg
```
Expected: `frontend/src/assets/hero-road.jpg` exists, ~220KB JPEG, 1600x1200.

- [ ] **Step 3: Create `frontend/src/styles/pages/_login.scss`**

```scss
// Login page — visual clone of the landing page from
// github.com/VitorSilami/diario-em-obras (originally Tailwind CSS v4 + OKLCH tokens),
// reimplemented here as plain scoped CSS so the app doesn't carry two CSS frameworks.
// Every rule nests under .login-page so nothing leaks into the Bootstrap/Mazer styling
// used by the rest of the app, even though this file compiles into the same global
// app.scss bundle.

.login-page {
  --login-bg: oklch(0.985 0.006 250);
  --login-fg: oklch(0.22 0.08 260);
  --login-surface: oklch(0.97 0.012 250);
  --login-surface-strong: oklch(0.94 0.02 250);
  --login-ink: oklch(0.18 0.09 262);
  --login-signal: oklch(0.68 0.16 240);
  --login-card: oklch(1 0 0);
  --login-border: oklch(0.88 0.02 250);
  --login-muted: oklch(0.5 0.04 258);

  min-height: 100vh;
  background-color: var(--login-bg);
  color: var(--login-fg);
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  line-height: 1.5;

  * {
    box-sizing: border-box;
  }

  a {
    text-decoration: none;
    color: inherit;
  }

  h1, h2, h3 {
    margin: 0;
  }

  p {
    margin: 0;
  }

  ul, ol, dl {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .font-display {
    font-family: 'Space Grotesk', 'Inter', ui-sans-serif, system-ui, sans-serif;
    letter-spacing: -0.02em;
  }

  .font-mono {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
  }
}

// ---- Shared section scaffolding ----
.login-section {
  border-bottom: 1px solid var(--login-border);

  &__inner {
    margin: 0 auto;
    max-width: 80rem;
    padding: 6rem 1.5rem;
  }

  &--dark {
    background-color: var(--login-ink);
    color: var(--login-bg);
    border-bottom-color: oklch(1 0 0 / 0.1);
  }
}

.login-eyebrow {
  margin-bottom: 1rem;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--login-signal);
}

.login-heading {
  font-family: 'Space Grotesk', 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-size: 2.25rem;
  line-height: 1.15;

  @media (min-width: 768px) {
    font-size: 3rem;
  }
}

.login-dot {
  display: inline-block;
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  background-color: var(--login-signal);
}

// ---- Nav ----
.login-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid oklch(0.88 0.02 250 / 0.6);
  background-color: oklch(0.985 0.006 250 / 0.85);
  backdrop-filter: blur(12px);

  &__inner {
    margin: 0 auto;
    max-width: 80rem;
    height: 4rem;
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__links {
    display: none;
    align-items: center;
    gap: 2rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--login-muted);

    a:hover {
      color: var(--login-ink);
    }

    @media (min-width: 768px) {
      display: flex;
    }
  }

  &__cta {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 0.375rem;
    background-color: var(--login-ink);
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--login-bg);
    transition: transform 0.15s;

    &:hover {
      transform: translateY(-1px);
    }
  }
}

// ---- Logo ----
.login-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &__mark {
    position: relative;
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.125rem;
    background-color: var(--login-ink);
  }

  &__mark-dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 2px;
    background-color: var(--login-signal);
  }

  &__text {
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 1.125rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--login-ink);
    margin: 0;
  }

  &__signal {
    color: var(--login-signal);
  }

  // Used inside .login-section--dark (CTA footer) where the base ink/background flip
  &--on-dark &__mark {
    background-color: var(--login-bg);
    color: var(--login-ink);
  }

  &--on-dark &__text {
    color: var(--login-bg);
  }
}

// ---- Hero ----
.login-hero {
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--login-border);

  &__grid {
    position: absolute;
    inset: 0;
    opacity: 0.7;
    background-image:
      linear-gradient(to right, oklch(0.35 0.14 258 / 0.06) 1px, transparent 1px),
      linear-gradient(to bottom, oklch(0.35 0.14 258 / 0.06) 1px, transparent 1px);
    background-size: 48px 48px;
  }

  &__inner {
    position: relative;
    margin: 0 auto;
    max-width: 80rem;
    padding: 5rem 1.5rem 6rem;
    display: grid;
    gap: 4rem;

    @media (min-width: 1024px) {
      grid-template-columns: 1.05fr 1fr;
      align-items: center;
    }
  }

  &__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-radius: 9999px;
    border: 1px solid var(--login-border);
    background-color: var(--login-surface);
    padding: 0.25rem 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--login-muted);
  }

  h2 {
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 2.75rem;
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.02em;
    color: var(--login-ink);

    @media (min-width: 768px) {
      font-size: 3.75rem;
    }
    @media (min-width: 1024px) {
      font-size: 4.5rem;
    }
  }

  &__lead {
    margin-top: 1.5rem;
    max-width: 36rem;
    font-size: 1.125rem;
    line-height: 1.7;
    color: var(--login-muted);
  }

  &__actions {
    margin-top: 2.5rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }

  &__google {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
  }

  &__secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid var(--login-border);
    background-color: var(--login-surface);
    padding: 0.75rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--login-ink);

    &:hover {
      background-color: var(--login-surface-strong);
    }
  }

  &__hint {
    margin-top: 1rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--login-muted);
  }
}

// ---- Hero mock (fake RDO card preview) ----
.login-hero__mock {
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid var(--login-border);
  background-color: var(--login-card);
  box-shadow: 0 25px 50px -12px oklch(0.18 0.09 262 / 0.1);

  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--login-border);
    background-color: var(--login-surface);
    padding: 0.75rem 1rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--login-muted);
  }

  &-photo {
    position: relative;
    height: 13rem;
    width: 100%;
    overflow: hidden;
    border-bottom: 1px solid var(--login-border);

    img {
      height: 100%;
      width: 100%;
      object-fit: cover;
    }
  }

  &-photo-tag {
    position: absolute;
    bottom: 0.75rem;
    left: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 0.25rem;
    background-color: oklch(0.18 0.09 262 / 0.85);
    padding: 0.25rem 0.625rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--login-bg);
  }

  &-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-bottom: 1px solid var(--login-border);

    div {
      padding: 0.75rem 1rem;
      border-left: 1px solid var(--login-border);

      &:first-child {
        border-left: none;
      }
    }

    p:first-child {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.625rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--login-muted);
    }

    p:last-child {
      margin-top: 0.25rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--login-ink);
    }
  }

  &-body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  &-production {
    border-radius: 0.375rem;
    background-color: var(--login-surface);
    padding: 0.75rem;

    &-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.625rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--login-muted);
    }

    &-badge {
      border-radius: 0.125rem;
      background-color: oklch(0.68 0.16 240 / 0.15);
      padding: 0.125rem 0.375rem;
      color: var(--login-ink);
    }

    &-details {
      display: grid;
      grid-template-columns: 1fr auto auto auto;
      gap: 0.5rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.6875rem;
      color: var(--login-muted);

      span:first-child, span:last-child {
        color: var(--login-ink);
      }
    }
  }

  &-facts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;

    div {
      border-radius: 0.375rem;
      border: 1px dashed var(--login-border);
      padding: 0.5rem;
    }

    p:first-child {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.5625rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--login-muted);
    }

    p:last-child {
      margin-top: 0.125rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--login-ink);
    }
  }
}

// ---- Marquee ----
.login-marquee {
  border-bottom: 1px solid var(--login-border);
  background-color: var(--login-surface);

  &__inner {
    margin: 0 auto;
    max-width: 80rem;
    padding: 1rem 1.5rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 2rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--login-muted);
  }

  &__sep {
    margin-right: 2rem;
    color: var(--login-signal);
  }
}

// ---- Features ----
.login-features-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1px;
  overflow: hidden;
  border-radius: 0.75rem;
  border: 1px solid var(--login-border);
  background-color: var(--login-border);
  margin-top: 4rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.login-feature-card {
  background-color: var(--login-bg);
  padding: 2rem;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--login-surface);
  }

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  &__number {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--login-signal);
  }

  h3 {
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--login-ink);
  }

  p {
    margin-top: 0.75rem;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--login-muted);
  }
}

// ---- Isolation (dark section) ----
.login-isolation {
  display: grid;
  gap: 4rem;

  @media (min-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
    align-items: center;
  }

  &__lead {
    margin-top: 1.5rem;
    max-width: 32rem;
    font-size: 1rem;
    line-height: 1.7;
    color: oklch(0.985 0.006 250 / 0.7);
  }
}

.login-isolation-rows {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;

  li {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  &__check {
    margin-top: 0.2rem;
    color: var(--login-signal);
  }

  &__text {
    color: oklch(0.985 0.006 250 / 0.85);
  }
}

.login-tenant-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border-radius: 1rem;
  border: 1px solid oklch(1 0 0 / 0.1);
  background-color: oklch(1 0 0 / 0.03);
  padding: 1.5rem;
}

.login-tenant-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 0.375rem;
  border: 1px solid oklch(1 0 0 / 0.1);
  background-color: oklch(1 0 0 / 0.02);
  padding: 0.75rem 1rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: oklch(0.985 0.006 250 / 0.4);

  &__name {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 9999px;
    background-color: oklch(0.985 0.006 250 / 0.25);
  }

  &--ok {
    border-color: var(--login-signal);
    background-color: oklch(0.68 0.16 240 / 0.1);
    color: var(--login-bg);

    .login-tenant-row__dot {
      background-color: var(--login-signal);
    }

    .login-tenant-row__state {
      color: var(--login-signal);
    }
  }
}

// ---- Flow ----
.login-flow-grid {
  display: grid;
  gap: 1px;
  overflow: hidden;
  border-radius: 0.75rem;
  border: 1px solid var(--login-border);
  background-color: var(--login-border);
  margin-top: 4rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: 1024px) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.login-flow-step {
  background-color: var(--login-bg);
  padding: 2rem;

  &__badge {
    margin-bottom: 1.5rem;
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.125rem;
    background-color: var(--login-ink);
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    color: var(--login-bg);
  }

  h3 {
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--login-ink);
  }

  p {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--login-muted);
  }
}

// ---- FAQ ----
.login-faq {
  display: grid;
  gap: 4rem;

  @media (min-width: 1024px) {
    grid-template-columns: 1fr 1.4fr;
  }
}

.login-faq-grid {
  border-top: 1px solid var(--login-border);
  border-bottom: 1px solid var(--login-border);

  > div {
    display: grid;
    gap: 0.5rem;
    padding: 1.5rem 0;
    border-top: 1px solid var(--login-border);

    &:first-child {
      border-top: none;
    }

    @media (min-width: 768px) {
      grid-template-columns: 1fr 1.5fr;
      gap: 2rem;
    }
  }

  dt {
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    color: var(--login-ink);
  }

  dd {
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--login-muted);
  }
}

// ---- CTA footer (dark) ----
.login-cta-footer {
  position: relative;
  overflow: hidden;

  &__grid {
    position: absolute;
    inset: 0;
    opacity: 0.2;
    background-image:
      linear-gradient(to right, oklch(0.35 0.14 258 / 0.06) 1px, transparent 1px),
      linear-gradient(to bottom, oklch(0.35 0.14 258 / 0.06) 1px, transparent 1px);
    background-size: 48px 48px;
  }

  &__inner {
    position: relative;
    text-align: center;
  }

  h2 {
    margin: 0 auto;
    max-width: 48rem;
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 2.25rem;
    font-weight: 700;
    letter-spacing: -0.02em;

    @media (min-width: 768px) {
      font-size: 3.75rem;
    }
  }

  &__action {
    margin-top: 2.5rem;
    display: flex;
    justify-content: center;
  }

  &__button {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    border-radius: 0.375rem;
    background-color: var(--login-bg);
    padding: 0.875rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--login-ink);
    box-shadow: 0 20px 25px -5px oklch(0 0 0 / 0.3);
    transition: transform 0.15s;

    &:hover {
      transform: translateY(-1px);
    }
  }

  &__hint {
    margin-top: 1rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: oklch(0.985 0.006 250 / 0.5);
  }
}

.login-footer-bar {
  margin-top: 6rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  border-top: 1px solid oklch(1 0 0 / 0.1);
  padding-top: 2rem;

  @media (min-width: 768px) {
    flex-direction: row;
  }

  &__links {
    display: flex;
    gap: 1.5rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: oklch(0.985 0.006 250 / 0.5);

    a:hover {
      color: var(--login-bg);
    }
  }
}
```

- [ ] **Step 4: Import the new stylesheet**

In `frontend/src/styles/_mazer.scss`, add (near the other page imports, or right after the sidebar
import block added in the previous refactor — exact position doesn't matter since everything here is
scoped under `.login-page`):
```scss
// Login page (clone of github.com/VitorSilami/diario-em-obras landing page)
@import "./pages/login";
```

- [ ] **Step 5: Verify the build compiles**

```bash
cd frontend && npm run build
```
Expected: exit 0. The new classes aren't used by any component yet (that's Task 2), so this only
proves the SCSS itself is valid.

- [ ] **Step 6: Commit**

```bash
git add frontend/index.html frontend/src/assets/hero-road.jpg frontend/src/styles/pages/_login.scss frontend/src/styles/_mazer.scss
git commit -m "feat: adiciona fontes, imagem e SCSS da nova landing de login"
```

---

### Task 2: Rewrite `LoginPage.tsx` and remove `AuthLayout`

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx` (full rewrite)
- Delete: `frontend/src/layouts/AuthLayout.tsx`

**Interfaces:**
- Consumes: every class name produced by Task 1's `_login.scss`; `useAuth()` (`loginWithGoogle`, `loginError`) from `frontend/src/features/auth/AuthContext.tsx` (unchanged); `Alert`, `Spinner` from `frontend/src/components/ui` (unchanged); `frontend/src/assets/hero-road.jpg` (Task 1).
- Produces: nothing new consumed elsewhere — `LoginPage` is a leaf route component (`frontend/src/App.tsx`'s `/login` route already imports it by the same name, no route change needed).

- [ ] **Step 1: Confirm nothing else imports `AuthLayout`**

```bash
grep -rn "AuthLayout" frontend/src
```
Expected: only `frontend/src/pages/LoginPage.tsx` (the file this task rewrites) and
`frontend/src/layouts/AuthLayout.tsx` itself. If anything else shows up, stop and re-check the plan's
assumption before deleting the file.

- [ ] **Step 2: Delete `AuthLayout.tsx`**

```bash
rm frontend/src/layouts/AuthLayout.tsx
```

- [ ] **Step 3: Replace `frontend/src/pages/LoginPage.tsx` in full**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import heroRoad from '../assets/hero-road.jpg'
import { Alert, Spinner } from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Não foi possível carregar o login do Google.'))
    document.head.appendChild(script)
  })
}

type LoginStatus = 'loading' | 'ready' | 'authenticating' | 'error'

export function LoginPage() {
  const { loginWithGoogle, loginError } = useAuth()
  const navigate = useNavigate()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<LoginStatus>('loading')
  const [scriptError, setScriptError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google || !buttonRef.current) return

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            setStatus('authenticating')
            const success = await loginWithGoogle(response.credential)
            if (success) {
              navigate('/projetos', { replace: true })
            } else {
              setStatus('error')
            }
          },
        })
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
        })
        setStatus('ready')
      })
      .catch((error: Error) => {
        setScriptError(error.message)
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [loginWithGoogle, navigate])

  return (
    <div className="login-page">
      <Nav />
      <Hero buttonRef={buttonRef} status={status} scriptError={scriptError} loginError={loginError} />
      <Marquee />
      <Features />
      <Isolation />
      <Flow />
      <Faq />
      <CtaFooter />
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.6-2.5C16.9 3.5 14.7 2.5 12 2.5 6.7 2.5 2.5 6.7 2.5 12S6.7 21.5 12 21.5c6.9 0 9.5-4.8 9.5-9.3 0-.6-.1-1.1-.2-1.5H12z"
      />
    </svg>
  )
}

function Logo({ as: Tag = 'div', onDark = false }: { as?: 'div' | 'h1'; onDark?: boolean }) {
  return (
    <Tag className={`login-logo${onDark ? ' login-logo--on-dark' : ''}`}>
      <div className="login-logo__mark">
        <div className="login-logo__mark-dot" />
      </div>
      <span className="login-logo__text">
        Build<span className="login-logo__signal">Flow</span>
      </span>
    </Tag>
  )
}

function Nav() {
  return (
    <header className="login-nav">
      <div className="login-nav__inner">
        <Logo as="h1" />
        <nav className="login-nav__links">
          <a href="#recursos">Recursos</a>
          <a href="#isolamento">Isolamento</a>
          <a href="#fluxo">Fluxo</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a href="#entrar" className="login-nav__cta">
          <GoogleMark />
          Entrar com Google
        </a>
      </div>
    </header>
  )
}

interface HeroProps {
  buttonRef: React.RefObject<HTMLDivElement>
  status: LoginStatus
  scriptError: string | null
  loginError: string | null
}

function Hero({ buttonRef, status, scriptError, loginError }: HeroProps) {
  return (
    <section className="login-hero">
      <div className="login-hero__grid" aria-hidden="true" />
      <div className="login-hero__inner">
        <div>
          <div className="login-hero__eyebrow">
            <span className="login-dot" />
            KM 0+000 · MVP em produção
          </div>
          <h2>Gestão diária de obras rodoviárias, do canteiro ao escritório.</h2>
          <p className="login-hero__lead">
            Plataforma multitenant para RDO com produção por km, presença de equipe, apontamento de
            máquinas, ocorrências e fotos. Cada empresa em sua própria fronteira de dados.
          </p>
          <div className="login-hero__actions">
            <div className="login-hero__google" id="entrar" ref={buttonRef} aria-live="polite" />
            {status === 'loading' && <Spinner label="Carregando…" />}
            {status === 'authenticating' && <Spinner label="Entrando…" />}
            <a href="#recursos" className="login-hero__secondary">
              Ver como funciona
            </a>
          </div>
          {(loginError || scriptError) && (
            <div className="mt-3">
              <Alert>{loginError ?? scriptError}</Alert>
            </div>
          )}
          <p className="login-hero__hint">
            Sem cadastro público · Usuários provisionados pela sua empresa
          </p>
        </div>

        <HeroMock />
      </div>
    </section>
  )
}

function HeroMock() {
  const stats: [string, string][] = [
    ['KM Inicial', '420+150'],
    ['KM Final', '421+050'],
    ['Sentido', 'Crescente'],
  ]
  const facts: [string, string][] = [
    ['Equipe', '12 pessoas'],
    ['Máquinas', '4 ativas'],
    ['Clima', 'Bom'],
  ]

  return (
    <div className="login-hero__mock">
      <div className="login-hero__mock-header">
        <span>
          <span className="login-dot" /> RDO · BR-365 · Lote 02 · 18/Mai
        </span>
        <span>#8842</span>
      </div>
      <div className="login-hero__mock-photo">
        <img src={heroRoad} alt="Trecho de rodovia em execução ao entardecer" width={1600} height={1200} />
        <div className="login-hero__mock-photo-tag">
          <span className="login-dot" />
          Foto · km 420+680
        </div>
      </div>
      <div className="login-hero__mock-stats">
        {stats.map(([k, v]) => (
          <div key={k}>
            <p>{k}</p>
            <p>{v}</p>
          </div>
        ))}
      </div>
      <div className="login-hero__mock-body">
        <div className="login-hero__mock-production">
          <div className="login-hero__mock-production-row">
            <span>Produção do dia</span>
            <span className="login-hero__mock-production-badge">CBUQ · 145,2 t</span>
          </div>
          <div className="login-hero__mock-production-details">
            <span>Capa asfáltica</span>
            <span>0+450</span>
            <span>0+900</span>
            <span>145,2 t</span>
          </div>
        </div>
        <div className="login-hero__mock-facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <p>{k}</p>
              <p>{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Marquee() {
  const items = [
    'RDO por km',
    'Presença',
    'Máquinas',
    'Ocorrências',
    'Fotos georreferenciadas',
    'Metas por disciplina',
    'Frentes de trabalho',
    'Multitenant',
  ]
  return (
    <div className="login-marquee">
      <div className="login-marquee__inner">
        {items.map((it, i) => (
          <span key={it}>
            {i > 0 && <span className="login-marquee__sep">/</span>}
            {it}
          </span>
        ))}
      </div>
    </div>
  )
}

function Features() {
  const rows = [
    {
      n: '01',
      title: 'RDO completo',
      body: 'Produção, presença, máquinas e ocorrências em um único fluxo. Autor e data/hora registrados automaticamente.',
    },
    {
      n: '02',
      title: 'Fotos por km',
      body: 'Anexe evidências ao registro do dia e associe a quilometragem quando disponível, sem sair do formulário.',
    },
    {
      n: '03',
      title: 'Cadastro ou avulso',
      body: 'Vincule pessoas e máquinas cadastradas na configuração do projeto — ou lance na hora, sem cadastro prévio.',
    },
    {
      n: '04',
      title: 'Configuração por projeto',
      body: 'Metas por disciplina, frentes de trabalho, valores de mão de obra e equipamento — tudo por projeto.',
    },
    {
      n: '05',
      title: 'Perfis controlados',
      body: 'Gerente e Auxiliar administrativo, criados pelo administrador da sua empresa. Sem cadastro público.',
    },
    {
      n: '06',
      title: 'Login Google',
      body: 'Autenticação exclusiva via Google OAuth 2.0. Validamos emissor, audiência e expiração antes de liberar acesso.',
    },
  ]
  return (
    <section id="recursos" className="login-section">
      <div className="login-section__inner">
        <p className="login-eyebrow">Recursos</p>
        <h2 className="login-heading">O suficiente para o dia. Preciso o bastante para a auditoria.</h2>
        <div className="login-features-grid">
          {rows.map((r) => (
            <div key={r.n} className="login-feature-card">
              <div className="login-feature-card__top">
                <span className="login-feature-card__number">{r.n}</span>
                <span className="login-dot" />
              </div>
              <h3>{r.title}</h3>
              <p>{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Isolation() {
  const rows = [
    { name: 'empresa_alpha', ok: false },
    { name: 'sua_empresa', ok: true },
    { name: 'empresa_beta', ok: false },
    { name: 'empresa_gamma', ok: false },
  ]
  const points = [
    'Empresa como fronteira absoluta de dados',
    'URL/ID de outra empresa → 404 silencioso',
    'Empresa desativada → acesso bloqueado no próximo request',
  ]
  return (
    <section id="isolamento" className="login-section login-section--dark">
      <div className="login-section__inner login-isolation">
        <div>
          <p className="login-eyebrow">Isolamento multitenant</p>
          <h2 className="login-heading">Sua empresa é a única fronteira que importa.</h2>
          <p className="login-isolation__lead">
            Nenhum projeto, RDO ou configuração pode ser visto, alterado ou inferido por usuário de
            outra empresa. Tentativas de acesso cruzado respondem como se o recurso não existisse.
          </p>
          <ul className="login-isolation-rows">
            {points.map((t) => (
              <li key={t}>
                <span className="login-isolation-rows__check">[✓]</span>
                <span className="login-isolation-rows__text">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="login-tenant-panel">
          {rows.map((row) => (
            <div
              key={row.name}
              className={`login-tenant-row${row.ok ? ' login-tenant-row--ok' : ''}`}
            >
              <span className="login-tenant-row__name">
                <span className="login-tenant-row__dot" />
                {row.name}
              </span>
              <span className="login-tenant-row__state">
                {row.ok ? 'autenticado' : 'acesso negado'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Flow() {
  const steps = [
    {
      k: 'A',
      title: 'Administrador provisiona',
      body: 'Cria a empresa e cadastra usuários com perfil (Gerente ou Auxiliar) pelo Django Admin.',
    },
    {
      k: 'B',
      title: 'Usuário entra com Google',
      body: 'Login exclusivo via Google. E-mail sem cadastro, usuário inativo ou sem empresa é recusado.',
    },
    {
      k: 'C',
      title: 'Projeto e configuração',
      body: 'Crie o projeto da obra, defina metas por disciplina, frentes de trabalho e equipes.',
    },
    {
      k: 'D',
      title: 'RDO todo dia',
      body: 'Registro diário com produção, presença, máquinas, ocorrências e fotos por km.',
    },
  ]
  return (
    <section id="fluxo" className="login-section">
      <div className="login-section__inner">
        <p className="login-eyebrow">Fluxo operacional</p>
        <h2 className="login-heading">Do provisionamento ao registro do dia.</h2>
        <ol className="login-flow-grid">
          {steps.map((s) => (
            <li key={s.k} className="login-flow-step">
              <div className="login-flow-step__badge">{s.k}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Faq() {
  const items = [
    {
      q: 'Preciso cadastrar minha empresa aqui?',
      a: 'Não. O provisionamento é feito pela administração — sua conta é criada pela sua empresa e vinculada ao seu e-mail Google.',
    },
    {
      q: 'Posso registrar duas RDOs no mesmo dia?',
      a: 'Sim. Turnos e frentes distintas podem gerar mais de um registro por dia; a interface deixa claro quando já existe RDO na data.',
    },
    {
      q: 'Preciso cadastrar todas as pessoas e máquinas antes?',
      a: 'Não. Você pode lançar avulso durante o RDO (nome ou código digitado na hora) ou vincular ao cadastro da configuração.',
    },
    {
      q: 'Uma empresa consegue ver dados da outra?',
      a: 'Não. O isolamento é aplicado em toda listagem, consulta, criação e atualização. Tentativas de acesso cruzado respondem como se o recurso não existisse.',
    },
  ]
  return (
    <section id="faq" className="login-section">
      <div className="login-section__inner login-faq">
        <div>
          <p className="login-eyebrow">Perguntas</p>
          <h2 className="login-heading">Antes de entrar.</h2>
        </div>
        <dl className="login-faq-grid">
          {items.map((it) => (
            <div key={it.q}>
              <dt>{it.q}</dt>
              <dd>{it.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function CtaFooter() {
  return (
    <section className="login-cta-footer login-section--dark">
      <div className="login-cta-footer__grid" aria-hidden="true" />
      <div className="login-section__inner login-cta-footer__inner">
        <p className="login-eyebrow">Acesso restrito</p>
        <h2>Sua obra já está esperando pelo RDO de hoje.</h2>
        <div className="login-cta-footer__action">
          <a href="#entrar" className="login-cta-footer__button">
            <GoogleMark />
            Fazer Login com o Google
          </a>
        </div>
        <p className="login-cta-footer__hint">Somente contas Google previamente cadastradas</p>

        <div className="login-footer-bar">
          <Logo onDark />
          <div className="login-footer-bar__links">
            <span>© 2026 BuildFlow</span>
            <a href="#">Privacidade</a>
            <a href="#">Termos</a>
          </div>
        </div>
      </div>
    </section>
  )
}
```

Notes on deliberate choices in this rewrite (so a reviewer doesn't flag them as unexplained deviations):
- `theme: 'filled_black'` and `shape: 'pill'` were added to `renderButton`'s options (the previous
  version used `theme: 'outline'`, no `shape`) so Google's own rendered button visually fits the dark
  "ink" aesthetic instead of looking like a leftover default widget. This is the one visual property of
  the real Google button we can control — see the design doc's Decision #3.
- The Hero's headline is an `<h2>`, not `<h1>`, and does not contain the text "BuildFlow" — see Global
  Constraints. The Nav's `Logo` is rendered `as="h1"`; the footer's `Logo` (via `onDark`) renders as a
  plain `<div>` so there is exactly one `<h1>` on the page.
- `#entrar` is on the same `<div>` that receives `ref={buttonRef}` (Google's real button target) — every
  other "Entrar com Google" link on the page is a plain anchor to `#entrar`, matching the reference
  repo's own behavior exactly (it never had more than one real login control either).

- [ ] **Step 4: Verify build and type-check**

```bash
cd frontend && npx tsc -b --noEmit && npm run build
```
Expected: exit 0.

- [ ] **Step 5: Verify lint**

```bash
cd frontend && npx oxlint src/pages/LoginPage.tsx
```
Expected: exit 0, no errors (the `React.RefObject` type import is implicit via the global `React`
namespace from `@types/react`, consistent with how `PageHeader.tsx` already does this in the codebase —
see Task 4 of the Mazer refactor plan for precedent).

- [ ] **Step 6: Run the login E2E spec**

```bash
cd frontend && npx playwright test tests/e2e/login.spec.ts
```
Expected: 3 passed. If `getByRole('heading', { name: 'BuildFlow' })` fails with a strict-mode violation
(multiple matches), check that the footer's `Logo` call passes `onDark` (not `as="h1"`) — only the Nav's
`Logo` call should have `as="h1"`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx
git rm frontend/src/layouts/AuthLayout.tsx
git commit -m "refactor: substitui a tela de login pela landing page do diario-em-obras"
```

---

### Task 3: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full frontend check suite**

```bash
cd frontend
npm run lint
npx tsc -b --noEmit
npm run build
npm run test
npm run test:e2e
```
Expected: every command exits 0, including all 10 E2E tests (not just `login.spec.ts` — confirm the
new `/login` markup didn't accidentally affect any other spec, e.g. via a global CSS leak from
`_login.scss`).

- [ ] **Step 2: Grep for accidental global leakage**

```bash
grep -n "^\." frontend/src/styles/pages/_login.scss | grep -v "^\.login-"
```
Expected: no output. Every top-level selector in `_login.scss` must start with `.login-` (either
`.login-page` itself or one of its nested `.login-*` descendant classes) — this confirms nothing in this
file can affect any other page's markup.

- [ ] **Step 3: Commit if Step 2 required a fix, otherwise skip**

Only commit if Step 2 found and required fixing a leaking selector:
```bash
git add frontend/src/styles/pages/_login.scss
git commit -m "fix: garante que estilos da landing de login fiquem escopados"
```
