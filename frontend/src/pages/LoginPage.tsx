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
  buttonRef: React.RefObject<HTMLDivElement | null>
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
    <div className="login-hero__mock" aria-hidden="true">
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

        <div className="login-tenant-panel" aria-hidden="true">
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
