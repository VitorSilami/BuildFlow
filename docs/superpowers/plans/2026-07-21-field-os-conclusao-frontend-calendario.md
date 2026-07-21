# Field OS — Conclusão (Frontend Calendário de RDOs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a lista simples de Registros Diários por uma grade de calendário mensal
(estilo Google Agenda) — cada dia mostra se há RDO registrado, clique navega direto ou cria um novo
RDO já com a data preenchida.

**Architecture:** Um componente novo e puramente apresentacional (`CalendarioMensal`, matemática de
mês/semana com `Date` nativo, sem lib de calendário) substitui a `<ul>` de
`RegistrosDiariosListPage.tsx`. O hook `useRegistrosDiarios` ganha um parâmetro opcional `mes` que
usa o filtro de backend do plano `2026-07-21-field-os-conclusao-backend.md`. `RdoPage.tsx` ganha
suporte a pré-preencher a data via query param, usado quando o calendário navega para "Novo RDO" a
partir de um dia vazio. Depende do backend desse mesmo plano já estar mesclado.

**Tech Stack:** React 19, TypeScript, TanStack Query, react-router-dom (`useSearchParams`),
Tailwind v4, Playwright.

## Global Constraints

- **Gotcha de glob do Playwright** (já descoberto e documentado nesta sessão em outros planos): um
  único `*` num glob de rota não cruza `/` **nem inclui query string** — `'**/api/v1/projetos/*/registros-diarios/'`
  não intercepta `.../registros-diarios/?mes=2026-07`. Todo glob de rota que mira nesse endpoint
  neste plano usa `'**/api/v1/projetos/*/registros-diarios/**'` (com `**` no final).
- Data local sempre construída com getters locais (`getFullYear()`/`getMonth()`/`getDate()`),
  **nunca** `.toISOString()` para derivar uma data de calendário — `toISOString()` converte pra UTC
  e pode virar o dia errado dependendo do fuso horário do navegador. Usar o helper
  `formatarDataLocal` em todo lugar que precisar de uma data `YYYY-MM-DD` a partir de um objeto
  `Date`.
- Não há restrição de unicidade de 1 RDO por dia no backend (turno diurno + noturno podem gerar 2
  no mesmo dia) — o calendário precisa lidar com 0, 1 ou N RDOs por célula.
- Testes e2e que dependem de "hoje" usam `page.clock.setFixedTime(...)` para fixar a data do
  navegador antes de `page.goto` — sem isso, o mês inicial exibido pelo calendário muda conforme o
  dia em que a suíte rodar, tornando o teste não-determinístico.
- Nunca usar `--no-verify`; commits novos ao invés de amend.

---

### Task 1: Componente `CalendarioMensal`

**Files:**
- Create: `frontend/src/features/registros-diarios/CalendarioMensal.tsx`

**Interfaces:**
- Produces: `MesAno { ano: number; mes: number }` (mes 1–12), `DiaCalendario { data: string;
  numeroDia: number; doMesCorrente: boolean; hoje: boolean; registros: RegistroDiario[] }`,
  componente `CalendarioMensal({ mesAno, registros, onMesAnteriorClick, onMesSeguinteClick,
  onHojeClick, onDiaClick })`.

- [ ] **Step 1: Criar o componente**

```tsx
import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../components/ui'
import { cn } from '../../lib/utils'
import type { RegistroDiario } from '../../types/registroDiario'

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DIAS_POR_SEMANA = 7

export interface MesAno {
  ano: number
  mes: number
}

export interface DiaCalendario {
  data: string
  numeroDia: number
  doMesCorrente: boolean
  hoje: boolean
  registros: RegistroDiario[]
}

function formatarDataLocal(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function construirGrade(mesAno: MesAno, registros: RegistroDiario[]): DiaCalendario[] {
  const primeiroDoMes = new Date(mesAno.ano, mesAno.mes - 1, 1)
  const offsetInicial = primeiroDoMes.getDay()
  const ultimoDiaDoMes = new Date(mesAno.ano, mesAno.mes, 0).getDate()
  const hojeIso = formatarDataLocal(new Date())

  const registrosPorDia = new Map<string, RegistroDiario[]>()
  for (const registro of registros) {
    const lista = registrosPorDia.get(registro.data_referencia) ?? []
    lista.push(registro)
    registrosPorDia.set(registro.data_referencia, lista)
  }

  const totalCelulas = Math.ceil((offsetInicial + ultimoDiaDoMes) / DIAS_POR_SEMANA) * DIAS_POR_SEMANA

  return Array.from({ length: totalCelulas }, (_, indice) => {
    const numeroDia = indice - offsetInicial + 1
    const data = new Date(mesAno.ano, mesAno.mes - 1, numeroDia)
    const iso = formatarDataLocal(data)
    return {
      data: iso,
      numeroDia: data.getDate(),
      doMesCorrente: numeroDia >= 1 && numeroDia <= ultimoDiaDoMes,
      hoje: iso === hojeIso,
      registros: registrosPorDia.get(iso) ?? [],
    }
  })
}

interface CalendarioMensalProps {
  mesAno: MesAno
  registros: RegistroDiario[]
  onMesAnteriorClick: () => void
  onMesSeguinteClick: () => void
  onHojeClick: () => void
  onDiaClick: (dia: DiaCalendario) => void
}

export function CalendarioMensal({
  mesAno,
  registros,
  onMesAnteriorClick,
  onMesSeguinteClick,
  onHojeClick,
  onDiaClick,
}: CalendarioMensalProps) {
  const dias = useMemo(() => construirGrade(mesAno, registros), [mesAno, registros])

  return (
    <div aria-label="Calendário de registros diários">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={onMesAnteriorClick}>
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Mês seguinte" onClick={onMesSeguinteClick}>
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
        <h2 className="font-display text-lg font-semibold text-ink">
          {NOMES_MESES[mesAno.mes - 1]} {mesAno.ano}
        </h2>
        <Button variant="outline" onClick={onHojeClick}>
          Hoje
        </Button>
      </div>

      <div
        className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase text-muted-foreground"
        aria-hidden="true"
      >
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="py-2">{dia}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dias.map((dia) => (
          <button
            key={dia.data}
            type="button"
            disabled={!dia.doMesCorrente}
            onClick={() => onDiaClick(dia)}
            aria-label={
              dia.registros.length > 0
                ? `Dia ${dia.numeroDia}, ${dia.registros.length} registro(s)`
                : `Dia ${dia.numeroDia}, sem registro`
            }
            className={cn(
              'flex h-20 flex-col items-start gap-1 rounded-md border border-border p-2 text-left text-sm transition-colors',
              dia.doMesCorrente
                ? 'hover:bg-surface'
                : 'cursor-default border-transparent text-muted-foreground/40',
              dia.hoje && 'border-primary',
            )}
          >
            <span className={dia.hoje ? 'font-semibold text-primary' : 'text-ink'}>{dia.numeroDia}</span>
            {dia.registros.length > 0 && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {dia.registros.length > 1 ? `${dia.registros.length} RDOs` : '1 RDO'}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rodar o build**

Run: `cd frontend && npm run build`
Expected: exit 0. (Componente ainda não é consumido por nenhuma página — dead code temporário,
igual ao padrão já usado no plano do wizard de RDO para os componentes de passo.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/registros-diarios/CalendarioMensal.tsx
git commit -m "feat: adiciona componente CalendarioMensal para registros diarios"
```

---

### Task 2: Substituir a lista pelo calendário + pré-preencher data no wizard

**Files:**
- Modify: `frontend/src/features/registros-diarios/registrosDiariosApi.ts`
- Modify: `frontend/src/pages/RegistrosDiariosListPage.tsx`
- Modify: `frontend/src/pages/RdoPage.tsx`
- Modify: `frontend/tests/e2e/registros-list.spec.ts`
- Modify: `frontend/tests/e2e/rdo.spec.ts`

**Interfaces:**
- Consumes: `CalendarioMensal`, `MesAno`, `DiaCalendario` (Task 1); filtro `?mes=` do backend
  (`2026-07-21-field-os-conclusao-backend.md`).
- Produces: `useRegistrosDiarios(projetoId, { mes }?)` — com `mes`, sempre normaliza a resposta do
  backend (lista plana) de volta pro formato `{ results: RegistroDiario[] }` que os consumidores já
  esperam (inclusive "duplicar dia anterior" do wizard, que continua chamando sem `mes` e sem
  nenhuma mudança de comportamento).

- [ ] **Step 1: `useRegistrosDiarios` ganha o parâmetro `mes`**

Em `frontend/src/features/registros-diarios/registrosDiariosApi.ts`, substituir a função:

```typescript
interface UseRegistrosDiariosOptions {
  mes?: string
}

export function useRegistrosDiarios(
  projetoId: string,
  options: UseRegistrosDiariosOptions = {},
) {
  const { mes } = options
  return useQuery({
    queryKey: ['registros-diarios', projetoId, mes ?? null],
    queryFn: async () => {
      if (mes) {
        const resultados = await apiClient.get<RegistroDiario[]>(
          `/api/v1/projetos/${projetoId}/registros-diarios/?mes=${mes}`,
        )
        return { results: resultados }
      }
      return apiClient.get<{ results: RegistroDiario[] }>(
        `/api/v1/projetos/${projetoId}/registros-diarios/`,
      )
    },
  })
}
```

(Sem o parâmetro `mes`, o comportamento é idêntico ao de hoje — mesma URL, mesma resposta paginada.
Com `mes`, o backend responde uma lista plana e o hook a envolve em `{ results }` pra manter a
mesma interface pros consumidores.)

- [ ] **Step 2: Reescrever `RegistrosDiariosListPage.tsx`**

```tsx
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, ErrorRetry, PageHeader, Spinner } from '../components/ui'
import {
  CalendarioMensal,
  type DiaCalendario,
  type MesAno,
} from '../features/registros-diarios/CalendarioMensal'
import { useRegistrosDiarios } from '../features/registros-diarios/registrosDiariosApi'

function mesAnoAtual(): MesAno {
  const hoje = new Date()
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }
}

function mesAnterior(mesAno: MesAno): MesAno {
  return mesAno.mes === 1
    ? { ano: mesAno.ano - 1, mes: 12 }
    : { ano: mesAno.ano, mes: mesAno.mes - 1 }
}

function mesSeguinte(mesAno: MesAno): MesAno {
  return mesAno.mes === 12
    ? { ano: mesAno.ano + 1, mes: 1 }
    : { ano: mesAno.ano, mes: mesAno.mes + 1 }
}

function formatarMesParaFiltro(mesAno: MesAno): string {
  return `${mesAno.ano}-${String(mesAno.mes).padStart(2, '0')}`
}

export function RegistrosDiariosListPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const navigate = useNavigate()
  const [mesAno, setMesAno] = useState<MesAno>(mesAnoAtual)
  const [diaSelecionado, setDiaSelecionado] = useState<DiaCalendario | null>(null)

  const { data, isLoading, isError, refetch } = useRegistrosDiarios(projetoId ?? '', {
    mes: formatarMesParaFiltro(mesAno),
  })

  function irParaMes(novoMesAno: MesAno) {
    setDiaSelecionado(null)
    setMesAno(novoMesAno)
  }

  function handleDiaClick(dia: DiaCalendario) {
    if (dia.registros.length === 0) {
      navigate(`/projetos/${projetoId}/registros-diarios/novo?data=${dia.data}`)
      return
    }
    if (dia.registros.length === 1) {
      navigate(`/projetos/${projetoId}/registros-diarios/${dia.registros[0].id}`)
      return
    }
    setDiaSelecionado(dia)
  }

  return (
    <main aria-label="Registros diários">
      <PageHeader
        title="Registros diários"
        breadcrumbs={[{ label: 'Projetos', to: '/projetos' }, { label: 'Registros diários' }]}
        actions={
          <Button asChild className="gap-2">
            <Link to={`/projetos/${projetoId}/registros-diarios/novo`}>
              <Plus size={16} aria-hidden="true" />
              Novo registro diário
            </Link>
          </Button>
        }
      />

      {isLoading && <Spinner label="Carregando registros…" />}

      {isError && (
        <ErrorRetry
          message="Não foi possível carregar os registros diários."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && data && (
        <>
          <Card>
            <CalendarioMensal
              mesAno={mesAno}
              registros={data.results}
              onMesAnteriorClick={() => irParaMes(mesAnterior(mesAno))}
              onMesSeguinteClick={() => irParaMes(mesSeguinte(mesAno))}
              onHojeClick={() => irParaMes(mesAnoAtual())}
              onDiaClick={handleDiaClick}
            />
          </Card>

          {diaSelecionado && (
            <Card title={`Registros de ${diaSelecionado.data}`}>
              <ul className="flex flex-col gap-2" aria-label="Registros do dia selecionado">
                {diaSelecionado.registros.map((registro) => (
                  <li key={registro.id}>
                    <Link
                      to={`/projetos/${projetoId}/registros-diarios/${registro.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {registro.data_referencia} — {registro.turno} — {registro.clima}
                    </Link>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="mt-4" onClick={() => setDiaSelecionado(null)}>
                Fechar
              </Button>
            </Card>
          )}
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 3: `RdoPage.tsx` pré-preenche a data via query param**

Em `frontend/src/pages/RdoPage.tsx`, trocar o import de `react-router-dom` (linha 2) para incluir
`useSearchParams`:

```tsx
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
```

E dentro de `RdoPage()`, adicionar a leitura do query param e trocar o `useState` inicial de
`dataReferencia`:

```tsx
  const [searchParams] = useSearchParams()
  ...
  const [dataReferencia, setDataReferencia] = useState(() => searchParams.get('data') ?? '')
```

(Sem o query param `?data=`, `searchParams.get('data')` retorna `null` → `''`, comportamento
idêntico ao de hoje.)

- [ ] **Step 4: Reescrever `registros-list.spec.ts`**

```typescript
import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const LIST_URL = '**/api/v1/projetos/*/registros-diarios/**'
const DETAIL_URL = '**/api/v1/registros-diarios/rdo-1/'

const USUARIO = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

const HOJE_FIXO = new Date('2026-07-17T10:00:00')

async function mockAuthenticated(page: import('@playwright/test').Page) {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
}

test('mes vazio mostra a grade sem indicadores e permite criar RDO num dia', async ({ page }) => {
  await page.clock.setFixedTime(HOJE_FIXO)
  await mockAuthenticated(page)
  await page.route(LIST_URL, (route) => route.fulfill({ json: [] }))

  await page.goto('/projetos/projeto-1/registros-diarios')

  await expect(page.getByLabel('Calendário de registros diários')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Julho 2026' })).toBeVisible()

  await page.getByRole('button', { name: 'Dia 20, sem registro' }).click()

  await expect(page).toHaveURL(/\/registros-diarios\/novo\?data=2026-07-20$/)
})

test('dia com 1 RDO navega direto para o detalhe', async ({ page }) => {
  await page.clock.setFixedTime(HOJE_FIXO)
  await mockAuthenticated(page)
  await page.route(LIST_URL, (route) =>
    route.fulfill({
      json: [{ id: 'rdo-1', data_referencia: '2026-07-17', turno: 'diurno', clima: 'sol' }],
    }),
  )
  await page.route(DETAIL_URL, (route) =>
    route.fulfill({
      json: {
        id: 'rdo-1',
        data_referencia: '2026-07-17',
        turno: 'diurno',
        clima: 'sol',
        producoes: [{ rodovia: 'BR-365', km_inicial: '10.000', km_final: '10.500', quantidade: '500' }],
        presencas: [],
        maquinas: [],
        ocorrencias: [],
        fotos: [],
      },
    }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  await page.getByRole('button', { name: 'Dia 17, 1 registro(s)' }).click()

  await expect(page).toHaveURL(/\/registros-diarios\/rdo-1$/)
  await expect(page.getByText('BR-365')).toBeVisible()
})

test('dia com 2+ RDOs mostra lista inline em vez de navegar direto', async ({ page }) => {
  await page.clock.setFixedTime(HOJE_FIXO)
  await mockAuthenticated(page)
  await page.route(LIST_URL, (route) =>
    route.fulfill({
      json: [
        { id: 'rdo-1', data_referencia: '2026-07-17', turno: 'diurno', clima: 'sol' },
        { id: 'rdo-2', data_referencia: '2026-07-17', turno: 'noturno', clima: 'nublado' },
      ],
    }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  await page.getByRole('button', { name: 'Dia 17, 2 registro(s)' }).click()

  await expect(page).toHaveURL(/\/registros-diarios$/)
  await expect(page.getByRole('link', { name: /diurno — sol/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /noturno — nublado/ })).toBeVisible()
})

test('navegar para o mes seguinte refaz a busca com o novo filtro', async ({ page }) => {
  await page.clock.setFixedTime(HOJE_FIXO)
  await mockAuthenticated(page)

  let ultimaUrlRequisitada = ''
  await page.route(LIST_URL, (route) => {
    ultimaUrlRequisitada = route.request().url()
    return route.fulfill({ json: [] })
  })

  await page.goto('/projetos/projeto-1/registros-diarios')
  await expect(page.getByRole('heading', { name: 'Julho 2026' })).toBeVisible()

  await page.getByRole('button', { name: 'Mês seguinte' }).click()

  await expect(page.getByRole('heading', { name: 'Agosto 2026' })).toBeVisible()
  expect(ultimaUrlRequisitada).toContain('mes=2026-08')
})
```

- [ ] **Step 5: Novo teste em `rdo.spec.ts` — pré-preenchimento via query param**

Adicionar ao final de `frontend/tests/e2e/rdo.spec.ts` (reaproveitando `mockRotasBasicas` já
existente do plano do wizard):

```typescript
test('data vem pre-preenchida quando a URL tem o parametro data', async ({ page }) => {
  await mockRotasBasicas(page)

  await page.goto('/projetos/projeto-1/registros-diarios/novo?data=2026-07-20')

  await expect(page.getByLabel('Data')).toHaveValue('2026-07-20')
})
```

- [ ] **Step 6: Rodar o build e os testes**

Run: `cd frontend && npm run build && npx playwright test tests/e2e/registros-list.spec.ts tests/e2e/rdo.spec.ts`
Expected: build exit 0; 4/4 testes de `registros-list.spec.ts` passando; 5/5 testes de
`rdo.spec.ts` passando (4 já existentes + o novo).

- [ ] **Step 7: Rodar a suíte completa (regressão)**

Run: `cd frontend && npx playwright test`
Expected: todos os specs passando (nenhuma outra página consome `useRegistrosDiarios` de um jeito
que quebre com a mudança de assinatura — verificar `RdoPage.tsx`'s "duplicar dia anterior" continua
funcionando, já coberto pelos testes de `rdo.spec.ts`).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/registros-diarios/registrosDiariosApi.ts frontend/src/pages/RegistrosDiariosListPage.tsx frontend/src/pages/RdoPage.tsx frontend/tests/e2e/registros-list.spec.ts frontend/tests/e2e/rdo.spec.ts
git commit -m "feat: substitui lista de registros diarios por calendario mensal"
```

---

### Task 3: Verificação final

**Files:** none esperado além de possíveis pequenos ajustes achados na verificação.

- [ ] **Step 1: Suíte completa**

```bash
cd frontend
npm run build
npm run lint
npm run test
npx playwright test
```
Expected: build exit 0, lint exit 0 (só warnings pré-existentes de fast-refresh), `npm run test`
reporta 0 testes (convenção já estabelecida), suíte Playwright completa passando.

- [ ] **Step 2: Atualizar `specs/001-mvp-gestao-diaria/tasks.md`**

Adicionar ao final do arquivo:

```markdown

**Frontend do "Field OS" — Calendário de RDOs (2026-07-21)**: `RegistrosDiariosListPage` substitui
a lista simples por uma grade de calendário mensal (`CalendarioMensal`, matemática de `Date`
nativo, sem lib de calendário). Cada dia mostra quantos RDOs existem; clique num dia vazio cria um
RDO com a data pré-preenchida (`RdoPage` agora lê `?data=YYYY-MM-DD` da URL), clique num dia com 1
RDO vai direto pro detalhe, clique num dia com 2+ RDOs (diurno + noturno no mesmo dia, por exemplo)
abre uma lista inline pra escolher qual. `useRegistrosDiarios` ganha parâmetro opcional `mes`
consumindo o filtro `?mes=` do backend, normalizando a resposta pro mesmo formato `{ results }` já
usado no resto do app.

**Verificado**: build + lint limpos, suíte E2E completa passando.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra calendario de RDOs do Field OS frontend em tasks.md"
```
