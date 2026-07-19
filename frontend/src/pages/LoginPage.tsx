import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import heroRoad from '../assets/hero-road.jpg'
import { Alert, Spinner } from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'

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
              navigate('/dashboard', { replace: true })
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
    <div className="min-h-screen bg-background text-foreground">
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
    <Tag className="flex items-center gap-2">
      <div className={`grid size-7 place-items-center rounded-sm ${onDark ? 'bg-background text-ink' : 'bg-ink text-background'}`}>
        <div className="size-3 rounded-[2px] bg-signal" />
      </div>
      <span className={`font-display text-lg font-bold tracking-tight ${onDark ? 'text-background' : 'text-ink'}`}>
        Build<span className="text-signal">Flow</span>
      </span>
    </Tag>
  )
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Logo as="h1" />
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#recursos" className="transition-colors hover:text-ink">Recursos</a>
          <a href="#isolamento" className="transition-colors hover:text-ink">Isolamento</a>
          <a href="#fluxo" className="transition-colors hover:text-ink">Fluxo</a>
          <a href="#faq" className="transition-colors hover:text-ink">FAQ</a>
        </nav>
        <a
          href="#entrar"
          className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-background transition-transform hover:-translate-y-px"
        >
          <GoogleMark />
          Entrar com Google
        </a>
      </div>
    </header>
  )
}

interface HeroProps {
  buttonRef: React.RefObject<HTMLDivElement | null>
  status: LoginStatus
  scriptError: string | null
  loginError: string | null
}

function Hero({ buttonRef, status, scriptError, loginError }: HeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="grid-blueprint absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="size-1.5 rounded-full bg-signal" />
            KM 0+000 · MVP em produção
          </div>
          <h2 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-ink md:text-6xl lg:text-7xl">
            Gestão diária de obras rodoviárias, do canteiro ao escritório.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Plataforma multitenant para RDO com produção por km, presença de equipe, apontamento de
            máquinas, ocorrências e fotos. Cada empresa em sua própria fronteira de dados.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <div className="inline-flex min-h-11 items-center" id="entrar" ref={buttonRef} aria-live="polite" />
            {status === 'loading' && <Spinner label="Carregando…" />}
            {status === 'authenticating' && <Spinner label="Entrando…" />}
            <a
              href="#recursos"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-3 text-sm font-semibold text-ink hover:bg-surface-strong"
            >
              Ver como funciona
            </a>
          </div>
          {(loginError || scriptError) && (
            <div className="mt-3">
              <Alert>{loginError ?? scriptError}</Alert>
            </div>
          )}
          <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
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
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-ink/10" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-signal" /> RDO · BR-365 · Lote 02 · 18/Mai
        </span>
        <span>#8842</span>
      </div>
      <div className="relative h-52 w-full overflow-hidden border-b border-border">
        <img src={heroRoad} alt="Trecho de rodovia em execução ao entardecer" width={1600} height={1200} className="h-full w-full object-cover" />
        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded bg-ink/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-background backdrop-blur">
          <span className="size-1.5 rounded-full bg-signal" />
          Foto · km 420+680
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        {stats.map(([k, v]) => (
          <div key={k} className="px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</p>
            <p className="mt-1 font-mono text-sm font-medium text-ink">{v}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3 p-4">
        <div className="rounded-md bg-surface p-3">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Produção do dia</span>
            <span className="rounded-sm bg-signal/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink">CBUQ · 145,2 t</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="text-ink">Capa asfáltica</span>
            <span>0+450</span>
            <span>0+900</span>
            <span className="text-ink">145,2 t</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-md border border-dashed border-border p-2">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</p>
              <p className="mt-0.5 text-xs font-semibold text-ink">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Marquee() {
  const items = [
    'RDO por km', 'Presença', 'Máquinas', 'Ocorrências', 'Fotos georreferenciadas',
    'Metas por disciplina', 'Frentes de trabalho', 'Multitenant',
  ]
  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        {items.map((it, i) => (
          <span key={it} className="flex items-center gap-8">
            {i > 0 && <span className="text-signal">/</span>}
            {it}
          </span>
        ))}
      </div>
    </div>
  )
}

function Features() {
  const rows = [
    { n: '01', title: 'RDO completo', body: 'Produção, presença, máquinas e ocorrências em um único fluxo. Autor e data/hora registrados automaticamente.' },
    { n: '02', title: 'Fotos por km', body: 'Anexe evidências ao registro do dia e associe a quilometragem quando disponível, sem sair do formulário.' },
    { n: '03', title: 'Cadastro ou avulso', body: 'Vincule pessoas e máquinas cadastradas na configuração do projeto — ou lance na hora, sem cadastro prévio.' },
    { n: '04', title: 'Configuração por projeto', body: 'Metas por disciplina, frentes de trabalho, valores de mão de obra e equipamento — tudo por projeto.' },
    { n: '05', title: 'Perfis controlados', body: 'Gerente e Auxiliar administrativo, criados pelo administrador da sua empresa. Sem cadastro público.' },
    { n: '06', title: 'Login Google', body: 'Autenticação exclusiva via Google OAuth 2.0. Validamos emissor, audiência e expiração antes de liberar acesso.' },
  ]
  return (
    <section id="recursos" className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-signal">Recursos</p>
        <h2 className="font-display text-4xl font-bold tracking-tight text-ink md:text-5xl">
          O suficiente para o dia. Preciso o bastante para a auditoria.
        </h2>
        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.n} className="group bg-background p-8 transition-colors hover:bg-surface">
              <div className="mb-6 flex items-center justify-between">
                <span className="font-mono text-xs font-medium text-signal">{r.n}</span>
                <span className="size-1.5 rounded-full bg-border transition-colors group-hover:bg-signal" />
              </div>
              <h3 className="font-display text-xl font-semibold text-ink">{r.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
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
    <section id="isolamento" className="border-b border-border bg-ink text-background">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 py-24 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-signal">Isolamento multitenant</p>
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            Sua empresa é a única fronteira que importa.
          </h2>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-background/70">
            Nenhum projeto, RDO ou configuração pode ser visto, alterado ou inferido por usuário de
            outra empresa. Tentativas de acesso cruzado respondem como se o recurso não existisse.
          </p>
          <ul className="mt-8 space-y-3 font-mono text-sm">
            {points.map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-1 text-signal">[✓]</span>
                <span className="text-background/85">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 rounded-2xl border border-background/10 bg-background/[0.03] p-6" aria-hidden="true">
          {rows.map((row) => (
            <div
              key={row.name}
              className={`flex items-center justify-between rounded-md border px-4 py-3 font-mono text-xs uppercase tracking-widest ${
                row.ok ? 'border-signal bg-signal/10 text-background' : 'border-background/10 bg-background/[0.02] text-background/40'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className={`size-1.5 rounded-full ${row.ok ? 'bg-signal' : 'bg-background/25'}`} />
                {row.name}
              </span>
              <span className={row.ok ? 'text-signal' : ''}>{row.ok ? 'autenticado' : 'acesso negado'}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Flow() {
  const steps = [
    { k: 'A', title: 'Administrador provisiona', body: 'Cria a empresa e cadastra usuários com perfil (Gerente ou Auxiliar) pelo Django Admin.' },
    { k: 'B', title: 'Usuário entra com Google', body: 'Login exclusivo via Google. E-mail sem cadastro, usuário inativo ou sem empresa é recusado.' },
    { k: 'C', title: 'Projeto e configuração', body: 'Crie o projeto da obra, defina metas por disciplina, frentes de trabalho e equipes.' },
    { k: 'D', title: 'RDO todo dia', body: 'Registro diário com produção, presença, máquinas, ocorrências e fotos por km.' },
  ]
  return (
    <section id="fluxo" className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-signal">Fluxo operacional</p>
        <h2 className="font-display text-4xl font-bold tracking-tight text-ink md:text-5xl">
          Do provisionamento ao registro do dia.
        </h2>
        <ol className="mt-16 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.k} className="bg-background p-8">
              <div className="mb-6 grid size-10 place-items-center rounded-sm bg-ink font-display font-bold text-background">{s.k}</div>
              <h3 className="font-display text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Faq() {
  const items = [
    { q: 'Preciso cadastrar minha empresa aqui?', a: 'Não. O provisionamento é feito pela administração — sua conta é criada pela sua empresa e vinculada ao seu e-mail Google.' },
    { q: 'Posso registrar duas RDOs no mesmo dia?', a: 'Sim. Turnos e frentes distintas podem gerar mais de um registro por dia; a interface deixa claro quando já existe RDO na data.' },
    { q: 'Preciso cadastrar todas as pessoas e máquinas antes?', a: 'Não. Você pode lançar avulso durante o RDO (nome ou código digitado na hora) ou vincular ao cadastro da configuração.' },
    { q: 'Uma empresa consegue ver dados da outra?', a: 'Não. O isolamento é aplicado em toda listagem, consulta, criação e atualização. Tentativas de acesso cruzado respondem como se o recurso não existisse.' },
  ]
  return (
    <section id="faq" className="border-b border-border">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 py-24 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-signal">Perguntas</p>
          <h2 className="font-display text-4xl font-bold tracking-tight text-ink md:text-5xl">Antes de entrar.</h2>
        </div>
        <dl className="divide-y divide-border border-y border-border">
          {items.map((it) => (
            <div key={it.q} className="grid gap-2 py-6 md:grid-cols-[1fr_1.5fr] md:gap-8">
              <dt className="font-display text-base font-semibold text-ink">{it.q}</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">{it.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function CtaFooter() {
  return (
    <section className="relative overflow-hidden bg-ink text-background">
      <div className="grid-blueprint absolute inset-0 opacity-20" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-6 py-24 text-center">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-signal">Acesso restrito</p>
        <h2 className="mx-auto max-w-3xl font-display text-4xl font-bold tracking-tight md:text-6xl">
          Sua obra já está esperando pelo RDO de hoje.
        </h2>
        <div className="mt-10 flex justify-center">
          <a
            href="#entrar"
            className="inline-flex items-center gap-3 rounded-md bg-background px-6 py-3.5 text-sm font-semibold text-ink shadow-xl transition-transform hover:-translate-y-px"
          >
            <GoogleMark />
            Fazer Login com o Google
          </a>
        </div>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-background/50">
          Somente contas Google previamente cadastradas
        </p>

        <div className="mt-24 flex flex-col items-center justify-between gap-6 border-t border-background/10 pt-8 md:flex-row">
          <Logo onDark />
          <div className="flex gap-6 font-mono text-[11px] uppercase tracking-widest text-background/50">
            <span>© 2026 BuildFlow</span>
            <a href="#" className="hover:text-background">Privacidade</a>
            <a href="#" className="hover:text-background">Termos</a>
          </div>
        </div>
      </div>
    </section>
  )
}
