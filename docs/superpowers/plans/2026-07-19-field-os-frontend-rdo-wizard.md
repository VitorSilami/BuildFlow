# Field OS Frontend — RDO Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `RdoPage` (today one long single-page form, ~500 lines) into a real 6-step
wizard (Gerais/Produção/Equipe/Máquinas/Ocorrências/Revisão) with Anterior/Próximo navigation,
"duplicar dia anterior" (pre-fills only Equipe+Fiscal), and Turno/Clima as button groups instead of
dropdowns — per `docs/superpowers/specs/2026-07-18-field-os-dashboard-design.md` decisions 4-6, the
largest remaining piece of the "Field OS" redesign.

**Architecture:** `RdoPage.tsx` becomes a thin orchestrator: it owns all form state (unchanged
shape from today) and step-navigation state, and renders exactly one step component at a time. Each
step's JSX is extracted verbatim from the current monolithic file into its own component under
`frontend/src/features/registros-diarios/wizard/`, converted to accept the relevant slice of state
as props instead of closing over local variables. Shared pieces (the "vazio" initial-value
constants, the native-`<select>` className, a new button-group composite, the step
navigation/indicator bar) move to small shared files in that same directory so no step duplicates
them. **Per-step validation is explicitly out of scope** — the existing `registroDiarioFormSchema`
Zod validation still runs only once, on final submit from the Revisão step, exactly as today;
"Próximo" never blocks on incomplete fields.

**Fotos handling (resolved with the user before writing this plan):** photo upload
(`FotoUpload`/`useEnviarFoto`) requires an existing RDO id — it cannot happen before the record is
saved. The wizard's 6th step is **not** a real upload step; it's called "Revisão", shows a summary
of what's about to be saved, and explicitly tells the user photos are attached on the next screen.
The existing post-creation photo flow (`RegistroDiarioDetailPage`/`FotoUpload`) is completely
unchanged by this plan.

**Tech Stack:** React 19 + TypeScript, Zod, Tailwind CSS v4 + shadcn/ui. Testing: zero Vitest unit
tests (established convention) — Playwright E2E is the test layer.

## Global Constraints

- No backend changes, no new endpoints — `useCriarRegistroDiario`, `useConfiguracaoRdo`,
  `useRegistrosDiarios` are all pre-existing hooks, reused as-is.
- Validation happens once, at final submit (Revisão step) — do not add per-step Zod validation or
  block "Próximo" on field completeness.
- "Duplicar dia anterior" pre-fills **only** `equipe` and `fiscal` — never turno, clima, producoes,
  presencas, maquinas, or ocorrencias (these change daily / risk introducing real data errors if
  copied). It reads from `useRegistrosDiarios(projetoId)`, which the backend already returns sorted
  by `-data_referencia` — the first item in `.results` is the most recent RDO.
- The `<select>`-vs-`SelectField` split that exists today in `RdoPage.tsx` must be preserved exactly
  per-field when extracting into step components — `tests/e2e/rdo.spec.ts` drives 6 specific fields
  (Equipe, Fiscal, Disciplina, Serviço, Unidade, Pessoa cadastrada) via Playwright's
  `.selectOption(...)`, which requires a real native `<select>` element; Radix `Select` (rendered by
  `SelectField`) does not support this. Do not convert any of these 6 fields to `SelectField`.
- `Alert` (`components/ui/app-alert.tsx`) only accepts `{ children }` — no `className` prop — and is
  hardcoded to `variant="destructive"`. Do not use it for the Revisão step's informational note
  about photos (that would render an error-red box around a normal informational message); use a
  plain styled element instead.
- `npm run build`, `npm run lint` (oxlint), and `npm run test:e2e` (Playwright) must all pass
  cleanly after every task.
- Do not touch `ConfiguracaoPage.tsx`, `ProjetosListPage.tsx`, `DashboardPage.tsx`,
  `RegistroDiarioDetailPage.tsx`, or `FotoUpload.tsx` — out of scope for this plan.

---

### Task 1: Tipos, constantes compartilhadas, grupo de botões e navegação do wizard

**Files:**
- Modify: `frontend/src/types/registroDiario.ts`
- Create: `frontend/src/features/registros-diarios/wizard/valoresVazios.ts`
- Create: `frontend/src/features/registros-diarios/wizard/nativeSelectClassName.ts`
- Create: `frontend/src/features/registros-diarios/wizard/GrupoBotoes.tsx`
- Create: `frontend/src/features/registros-diarios/wizard/RdoWizardNav.tsx`

**Interfaces:**
- Produces: `Turno`/`Clima` type aliases (exported from `types/registroDiario.ts`);
  `PRODUCAO_VAZIA`/`PRESENCA_VAZIA`/`MAQUINA_VAZIA`/`OCORRENCIA_VAZIA` constants;
  `NATIVE_SELECT_CLASSNAME` constant; `GrupoBotoes<T extends string>` component; `RdoWizardNav`
  component (`{ passoAtual: number; onAnterior: () => void; onProximo: () => void }`). Tasks 2-7
  import all of these.

- [ ] **Step 1: Add `Turno`/`Clima` type aliases**

The current `frontend/src/types/registroDiario.ts` reads (relevant part):
```typescript
export interface RegistroDiarioInput {
  data_referencia: string
  turno: 'diurno' | 'noturno'
  clima: 'sol' | 'nublado' | 'chuva' | 'chuva_forte'
  equipe: string
  fiscal: number
  producoes: ProducaoDiariaInput[]
  presencas: PresencaInput[]
  maquinas: ApontamentoMaquinaInput[]
  ocorrencias: OcorrenciaInput[]
}
```
Change it to:
```typescript
export type Turno = 'diurno' | 'noturno'
export type Clima = 'sol' | 'nublado' | 'chuva' | 'chuva_forte'

export interface RegistroDiarioInput {
  data_referencia: string
  turno: Turno
  clima: Clima
  equipe: string
  fiscal: number
  producoes: ProducaoDiariaInput[]
  presencas: PresencaInput[]
  maquinas: ApontamentoMaquinaInput[]
  ocorrencias: OcorrenciaInput[]
}
```
(Nothing else in the file changes — every other interface stays exactly as it is.)

- [ ] **Step 2: Create the shared "vazio" constants**

Create `frontend/src/features/registros-diarios/wizard/valoresVazios.ts`:
```typescript
import type {
  ApontamentoMaquinaInput,
  OcorrenciaInput,
  PresencaInput,
  ProducaoDiariaInput,
} from '../../../types/registroDiario'

export const PRODUCAO_VAZIA: ProducaoDiariaInput = {
  rodovia: '',
  sentido: 'crescente',
  disciplina: '',
  servico: '',
  km_inicial: '',
  km_final: '',
  quantidade: '',
  unidade: 0,
}

export const PRESENCA_VAZIA: PresencaInput = { nome_avulso: '', funcao: '', status: 'presente' }

export const MAQUINA_VAZIA: ApontamentoMaquinaInput = {
  identificacao_avulsa: '',
  horas_produtivas: '',
  horas_paradas: '0',
}

export const OCORRENCIA_VAZIA: OcorrenciaInput = { tipo: 'outro', recurso_afetado: 'outro', descricao: '' }
```
(Extracted verbatim from the top of the current `frontend/src/pages/RdoPage.tsx` — values are
unchanged, only the location moves so every step component and `RdoPage.tsx` itself can import from
one place instead of duplicating them.)

- [ ] **Step 3: Create the shared native-select className**

Create `frontend/src/features/registros-diarios/wizard/nativeSelectClassName.ts`:
```typescript
// `<select>` nativo (não SelectField/Radix) propositalmente para os campos que
// tests/e2e/rdo.spec.ts aciona via `.selectOption(...)` — esse metodo do
// Playwright exige um <select> real (`Element is not a <select> element` ao
// tentar num Radix Select, que renderiza um <button role="combobox">, ja que
// getByLabel resolve para o elemento com o id do <label for>, que e o trigger,
// nao um <select> nativo escondido). Confirmado rodando o spec (nao pode ser
// alterado) contra a versao com SelectField em todos os campos.
export const NATIVE_SELECT_CLASSNAME =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'
```
(Extracted verbatim, including the comment — the comment documents a real, already-debugged
constraint from a previous plan this session and must not be lost.)

- [ ] **Step 4: Create the button-group composite**

Create `frontend/src/features/registros-diarios/wizard/GrupoBotoes.tsx`:
```tsx
import { Button } from '../../../components/ui'

interface GrupoBotoesOption<T extends string> {
  value: T
  label: string
}

interface GrupoBotoesProps<T extends string> {
  id: string
  label: string
  value: T
  onChange: (value: T) => void
  options: GrupoBotoesOption<T>[]
}

export function GrupoBotoes<T extends string>({ id, label, value, onChange, options }: GrupoBotoesProps<T>) {
  return (
    <div>
      <p id={`${id}-label`} className="mb-1.5 text-sm font-medium text-ink">
        {label}
      </p>
      <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? 'default' : 'outline'}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
```
(A set of real `<button>` elements — larger touch targets than a dropdown, easier to hit reliably
in the field/under sun/with gloves, per the design doc's Fitts's Law rationale for this change. Each
option's selected state is shown via `variant="default"` vs `"outline"`, matching the existing
`Button` component's visual language elsewhere in the app.)

- [ ] **Step 5: Create the wizard navigation bar**

Create `frontend/src/features/registros-diarios/wizard/RdoWizardNav.tsx`:
```tsx
import { Button } from '../../../components/ui'

export const NOMES_PASSOS = ['Gerais', 'Produção', 'Equipe', 'Máquinas', 'Ocorrências', 'Revisão'] as const

interface RdoWizardNavProps {
  passoAtual: number
  onAnterior: () => void
  onProximo: () => void
}

export function RdoWizardNav({ passoAtual, onAnterior, onProximo }: RdoWizardNavProps) {
  const ultimoPasso = passoAtual === NOMES_PASSOS.length - 1

  return (
    <div className="mb-6">
      <ol
        className="mb-4 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground"
        aria-label="Passos do registro diário"
      >
        {NOMES_PASSOS.map((nome, index) => (
          <li
            key={nome}
            className={index === passoAtual ? 'font-semibold text-ink' : undefined}
            aria-current={index === passoAtual ? 'step' : undefined}
          >
            {index + 1}. {nome}
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between">
        {passoAtual > 0 ? (
          <Button type="button" variant="outline" onClick={onAnterior}>
            Anterior
          </Button>
        ) : (
          <span />
        )}
        {!ultimoPasso && (
          <Button type="button" onClick={onProximo}>
            Próximo
          </Button>
        )}
      </div>
    </div>
  )
}
```
(`NOMES_PASSOS` is exported because Task 7's `RdoPage.tsx` needs the same list — both to label each
`Card` by the current step's name and to know the total step count for its own navigation-index
math. The `<span />` on the first step keeps the `justify-between` layout balanced when "Anterior"
is hidden, rather than "Próximo" jumping to the left edge.)

- [ ] **Step 6: Verify the build**

```bash
cd frontend
npm run build
```
Expected: exits 0. (No behavior to test yet — these files aren't imported by any page until Tasks
2-7; `tsc -b` catching a type error is the only applicable check here.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/registroDiario.ts frontend/src/features/registros-diarios/wizard/valoresVazios.ts frontend/src/features/registros-diarios/wizard/nativeSelectClassName.ts frontend/src/features/registros-diarios/wizard/GrupoBotoes.tsx frontend/src/features/registros-diarios/wizard/RdoWizardNav.tsx
git commit -m "feat: adiciona tipos, constantes e componentes compartilhados do wizard de RDO"
```

---

### Task 2: Extrair o passo "Gerais" (com grupos de botões e duplicar dia anterior)

**Files:**
- Create: `frontend/src/features/registros-diarios/wizard/RdoStepGerais.tsx`

**Interfaces:**
- Consumes: `GrupoBotoes`, `NATIVE_SELECT_CLASSNAME` (Task 1), `Turno`/`Clima`/`Equipe`/`Fiscal`
  types (existing/Task 1).
- Produces: `RdoStepGerais` component. Task 7 is its only consumer.

- [ ] **Step 1: Create the component**

Create `frontend/src/features/registros-diarios/wizard/RdoStepGerais.tsx`:
```tsx
import { Button, FormField, Input } from '../../../components/ui'
import type { Clima, Equipe, Fiscal, Turno } from '../../../types/registroDiario'
import { GrupoBotoes } from './GrupoBotoes'
import { NATIVE_SELECT_CLASSNAME } from './nativeSelectClassName'

interface RdoStepGeraisProps {
  dataReferencia: string
  onDataReferenciaChange: (value: string) => void
  turno: Turno
  onTurnoChange: (value: Turno) => void
  clima: Clima
  onClimaChange: (value: Clima) => void
  equipe: string
  onEquipeChange: (value: string) => void
  fiscal: string
  onFiscalChange: (value: string) => void
  equipes: Equipe[]
  fiscais: Fiscal[]
  podeDuplicarDiaAnterior: boolean
  onDuplicarDiaAnterior: () => void
}

export function RdoStepGerais({
  dataReferencia,
  onDataReferenciaChange,
  turno,
  onTurnoChange,
  clima,
  onClimaChange,
  equipe,
  onEquipeChange,
  fiscal,
  onFiscalChange,
  equipes,
  fiscais,
  podeDuplicarDiaAnterior,
  onDuplicarDiaAnterior,
}: RdoStepGeraisProps) {
  return (
    <div aria-label="Dados gerais">
      {podeDuplicarDiaAnterior && (
        <Button type="button" variant="outline" className="mb-4" onClick={onDuplicarDiaAnterior}>
          Duplicar dia anterior
        </Button>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField id="rdo-data" label="Data">
          <Input
            id="rdo-data"
            type="date"
            value={dataReferencia}
            onChange={(event) => onDataReferenciaChange(event.target.value)}
          />
        </FormField>
        <FormField id="rdo-equipe" label="Equipe">
          <select
            id="rdo-equipe"
            className={NATIVE_SELECT_CLASSNAME}
            value={equipe}
            onChange={(event) => onEquipeChange(event.target.value)}
          >
            <option value="">Selecione…</option>
            {equipes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="rdo-fiscal" label="Fiscal">
          <select
            id="rdo-fiscal"
            className={NATIVE_SELECT_CLASSNAME}
            value={fiscal}
            onChange={(event) => onFiscalChange(event.target.value)}
          >
            <option value="">Selecione…</option>
            {fiscais.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.nome} ({item.email})
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <GrupoBotoes
          id="rdo-turno"
          label="Turno"
          value={turno}
          onChange={onTurnoChange}
          options={[
            { value: 'diurno', label: 'Diurno' },
            { value: 'noturno', label: 'Noturno' },
          ]}
        />
        <GrupoBotoes
          id="rdo-clima"
          label="Clima"
          value={clima}
          onChange={onClimaChange}
          options={[
            { value: 'sol', label: 'Sol' },
            { value: 'nublado', label: 'Nublado' },
            { value: 'chuva', label: 'Chuva' },
            { value: 'chuva_forte', label: 'Chuva forte' },
          ]}
        />
      </div>
    </div>
  )
}
```
(Data/Equipe/Fiscal fields are extracted verbatim from the current `RdoPage.tsx` — same ids, same
native `<select>`s for Equipe/Fiscal, matching the Playwright constraint. Turno/Clima are the only
part that changes shape, from `SelectField` to `GrupoBotoes`, per the plan's goal. "Duplicar dia
anterior" is a plain `Button` whose click handler is owned by the parent — this component has no
knowledge of `useRegistrosDiarios`, it just renders the button when told to via
`podeDuplicarDiaAnterior` and forwards the click.)

- [ ] **Step 2: Verify the build**

```bash
cd frontend
npm run build
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/registros-diarios/wizard/RdoStepGerais.tsx
git commit -m "feat: extrai passo Gerais do wizard de RDO com grupos de botoes"
```

---

### Task 3: Extrair o passo "Produção"

**Files:**
- Create: `frontend/src/features/registros-diarios/wizard/RdoStepProducao.tsx`

**Interfaces:**
- Consumes: `NATIVE_SELECT_CLASSNAME` (Task 1), `Disciplina`/`Unidade`/`ProducaoDiariaInput` types
  (existing).
- Produces: `RdoStepProducao` component. Task 7 is its only consumer.

- [ ] **Step 1: Create the component**

Create `frontend/src/features/registros-diarios/wizard/RdoStepProducao.tsx`:
```tsx
import type { Dispatch, SetStateAction } from 'react'
import { Button, FormField, Input } from '../../../components/ui'
import type { Disciplina, ProducaoDiariaInput, Unidade } from '../../../types/registroDiario'
import { NATIVE_SELECT_CLASSNAME } from './nativeSelectClassName'
import { PRODUCAO_VAZIA } from './valoresVazios'

interface RdoStepProducaoProps {
  producoes: ProducaoDiariaInput[]
  onProducoesChange: Dispatch<SetStateAction<ProducaoDiariaInput[]>>
  disciplinas: Disciplina[]
  unidades: Unidade[]
}

export function RdoStepProducao({ producoes, onProducoesChange, disciplinas, unidades }: RdoStepProducaoProps) {
  return (
    <div aria-label="Produção do dia">
      {producoes.map((producao, index) => (
        <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField id={`producao-rodovia-${index}`} label="Rodovia">
              <Input
                id={`producao-rodovia-${index}`}
                value={producao.rodovia}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, rodovia: event.target.value } : item)),
                  )
                }
              />
            </FormField>
            <FormField id={`producao-disciplina-${index}`} label="Disciplina">
              <select
                id={`producao-disciplina-${index}`}
                className={NATIVE_SELECT_CLASSNAME}
                value={producao.disciplina}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, disciplina: event.target.value, servico: '' } : item,
                    ),
                  )
                }
              >
                <option value="">Selecione…</option>
                {disciplinas.map((disciplina) => (
                  <option key={disciplina.id} value={disciplina.id}>
                    {disciplina.nome}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id={`producao-servico-${index}`} label="Serviço">
              <select
                id={`producao-servico-${index}`}
                className={NATIVE_SELECT_CLASSNAME}
                value={producao.servico}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, servico: event.target.value } : item)),
                  )
                }
              >
                <option value="">Selecione…</option>
                {(disciplinas.find((d) => d.id === producao.disciplina)?.servicos ?? []).map((servico) => (
                  <option key={servico.id} value={servico.id}>
                    {servico.nome}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id={`producao-km-inicial-${index}`} label="Km inicial">
              <Input
                id={`producao-km-inicial-${index}`}
                value={producao.km_inicial}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, km_inicial: event.target.value } : item)),
                  )
                }
              />
            </FormField>
            <FormField id={`producao-km-final-${index}`} label="Km final">
              <Input
                id={`producao-km-final-${index}`}
                value={producao.km_final}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, km_final: event.target.value } : item)),
                  )
                }
              />
            </FormField>
            <FormField id={`producao-quantidade-${index}`} label="Quantidade">
              <Input
                id={`producao-quantidade-${index}`}
                value={producao.quantidade}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, quantidade: event.target.value } : item)),
                  )
                }
              />
            </FormField>
            <FormField id={`producao-unidade-${index}`} label="Unidade">
              <select
                id={`producao-unidade-${index}`}
                className={NATIVE_SELECT_CLASSNAME}
                value={producao.unidade ? String(producao.unidade) : ''}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, unidade: Number(event.target.value) } : item,
                    ),
                  )
                }
              >
                <option value="">Selecione…</option>
                {unidades.map((unidade) => (
                  <option key={unidade.id} value={String(unidade.id)}>
                    {unidade.sigla}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onProducoesChange((current) => [...current, PRODUCAO_VAZIA])}
      >
        + Adicionar produção
      </Button>
    </div>
  )
}
```
(Extracted verbatim from the current "Produção" `Card` in `RdoPage.tsx` — same field ids, same
native `<select>`s for Disciplina/Serviço/Unidade. Only the surrounding `Card`/state ownership move
to the parent; every `onChange` handler's logic is unchanged.)

- [ ] **Step 2: Verify the build**

```bash
cd frontend
npm run build
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/registros-diarios/wizard/RdoStepProducao.tsx
git commit -m "feat: extrai passo Producao do wizard de RDO"
```

---

### Task 4: Extrair o passo "Equipe" (presenças)

**Files:**
- Create: `frontend/src/features/registros-diarios/wizard/RdoStepEquipe.tsx`

**Interfaces:**
- Consumes: `NATIVE_SELECT_CLASSNAME` (Task 1), `Equipe`/`PresencaInput` types (existing).
- Produces: `RdoStepEquipe` component. Task 7 is its only consumer.

- [ ] **Step 1: Create the component**

Create `frontend/src/features/registros-diarios/wizard/RdoStepEquipe.tsx`:
```tsx
import type { Dispatch, SetStateAction } from 'react'
import { Button, FormField, Input, SelectField } from '../../../components/ui'
import type { Equipe, PresencaInput } from '../../../types/registroDiario'
import { NATIVE_SELECT_CLASSNAME } from './nativeSelectClassName'
import { PRESENCA_VAZIA } from './valoresVazios'

interface RdoStepEquipeProps {
  presencas: PresencaInput[]
  onPresencasChange: Dispatch<SetStateAction<PresencaInput[]>>
  equipeSelecionada: Equipe | undefined
}

export function RdoStepEquipe({ presencas, onPresencasChange, equipeSelecionada }: RdoStepEquipeProps) {
  return (
    <div aria-label="Equipe / presença">
      {presencas.map((presenca, index) => (
        <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField id={`presenca-pessoa-${index}`} label="Pessoa cadastrada">
              <select
                id={`presenca-pessoa-${index}`}
                className={NATIVE_SELECT_CLASSNAME}
                value={presenca.pessoa ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  onPresencasChange((current) =>
                    current.map((item, i) =>
                      i === index
                        ? { ...item, pessoa: value || undefined, nome_avulso: value ? '' : item.nome_avulso }
                        : item,
                    ),
                  )
                }}
              >
                <option value="">Avulso (digitar nome)</option>
                {(equipeSelecionada?.pessoas ?? []).map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                  </option>
                ))}
              </select>
            </FormField>
            {!presenca.pessoa && (
              <FormField id={`presenca-nome-avulso-${index}`} label="Nome (avulso)">
                <Input
                  id={`presenca-nome-avulso-${index}`}
                  value={presenca.nome_avulso ?? ''}
                  onChange={(event) =>
                    onPresencasChange((current) =>
                      current.map((item, i) => (i === index ? { ...item, nome_avulso: event.target.value } : item)),
                    )
                  }
                />
              </FormField>
            )}
            <FormField id={`presenca-funcao-${index}`} label="Função">
              <Input
                id={`presenca-funcao-${index}`}
                value={presenca.funcao}
                onChange={(event) =>
                  onPresencasChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, funcao: event.target.value } : item)),
                  )
                }
              />
            </FormField>
            <SelectField
              id={`presenca-status-${index}`}
              label="Status"
              value={presenca.status}
              onChange={(value) =>
                onPresencasChange((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, status: value as PresencaInput['status'] } : item,
                  ),
                )
              }
              options={[
                { value: 'presente', label: 'Presente' },
                { value: 'falta', label: 'Falta' },
                { value: 'atestado', label: 'Atestado' },
              ]}
            />
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onPresencasChange((current) => [...current, PRESENCA_VAZIA])}
      >
        + Adicionar pessoa
      </Button>
    </div>
  )
}
```
(Extracted verbatim from the current "Equipe" `Card` — "Pessoa cadastrada" stays a native
`<select>` per the Playwright constraint; "Status" stays `SelectField` since it isn't one of the 6
fields the E2E spec drives via `.selectOption(...)`.)

- [ ] **Step 2: Verify the build**

```bash
cd frontend
npm run build
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/registros-diarios/wizard/RdoStepEquipe.tsx
git commit -m "feat: extrai passo Equipe do wizard de RDO"
```

---

### Task 5: Extrair o passo "Máquinas"

**Files:**
- Create: `frontend/src/features/registros-diarios/wizard/RdoStepMaquinas.tsx`

**Interfaces:**
- Consumes: `Equipe`/`MotivoParada`/`ApontamentoMaquinaInput` types (existing).
- Produces: `RdoStepMaquinas` component. Task 7 is its only consumer.

- [ ] **Step 1: Create the component**

Create `frontend/src/features/registros-diarios/wizard/RdoStepMaquinas.tsx`:
```tsx
import type { Dispatch, SetStateAction } from 'react'
import { Button, FormField, Input, SelectField } from '../../../components/ui'
import type { ApontamentoMaquinaInput, Equipe, MotivoParada } from '../../../types/registroDiario'
import { MAQUINA_VAZIA } from './valoresVazios'

interface RdoStepMaquinasProps {
  maquinas: ApontamentoMaquinaInput[]
  onMaquinasChange: Dispatch<SetStateAction<ApontamentoMaquinaInput[]>>
  equipeSelecionada: Equipe | undefined
  motivosParada: MotivoParada[]
}

export function RdoStepMaquinas({
  maquinas,
  onMaquinasChange,
  equipeSelecionada,
  motivosParada,
}: RdoStepMaquinasProps) {
  return (
    <div aria-label="Máquinas">
      {maquinas.map((maquina, index) => (
        <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SelectField
              id={`maquina-maquina-${index}`}
              label="Máquina cadastrada"
              value={maquina.maquina ?? ''}
              onChange={(value) => {
                onMaquinasChange((current) =>
                  current.map((item, i) =>
                    i === index
                      ? {
                          ...item,
                          maquina: value || undefined,
                          identificacao_avulsa: value ? '' : item.identificacao_avulsa,
                        }
                      : item,
                  ),
                )
              }}
              placeholder="Avulso (digitar identificação)"
              options={(equipeSelecionada?.maquinas ?? []).map((maq) => ({ value: maq.id, label: maq.nome }))}
            />
            {!maquina.maquina && (
              <FormField id={`maquina-identificacao-${index}`} label="Identificação (avulsa)">
                <Input
                  id={`maquina-identificacao-${index}`}
                  value={maquina.identificacao_avulsa ?? ''}
                  onChange={(event) =>
                    onMaquinasChange((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, identificacao_avulsa: event.target.value } : item,
                      ),
                    )
                  }
                />
              </FormField>
            )}
            <FormField id={`maquina-horas-produtivas-${index}`} label="Horas produtivas">
              <Input
                id={`maquina-horas-produtivas-${index}`}
                value={maquina.horas_produtivas}
                onChange={(event) =>
                  onMaquinasChange((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, horas_produtivas: event.target.value } : item,
                    ),
                  )
                }
              />
            </FormField>
            <FormField id={`maquina-horas-paradas-${index}`} label="Horas paradas">
              <Input
                id={`maquina-horas-paradas-${index}`}
                value={maquina.horas_paradas}
                onChange={(event) =>
                  onMaquinasChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, horas_paradas: event.target.value } : item)),
                  )
                }
              />
            </FormField>
            {Number(maquina.horas_paradas) > 0 && (
              <SelectField
                id={`maquina-motivo-parada-${index}`}
                label="Motivo da parada"
                value={maquina.motivo_parada ? String(maquina.motivo_parada) : ''}
                onChange={(value) =>
                  onMaquinasChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, motivo_parada: Number(value) } : item)),
                  )
                }
                options={motivosParada.map((motivo) => ({ value: String(motivo.id), label: motivo.descricao }))}
              />
            )}
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onMaquinasChange((current) => [...current, MAQUINA_VAZIA])}
      >
        + Adicionar máquina
      </Button>
    </div>
  )
}
```
(Extracted verbatim from the current "Máquinas" `Card` — "Máquina cadastrada" and "Motivo da
parada" stay `SelectField` (neither is one of the 6 Playwright-constrained fields).)

- [ ] **Step 2: Verify the build**

```bash
cd frontend
npm run build
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/registros-diarios/wizard/RdoStepMaquinas.tsx
git commit -m "feat: extrai passo Maquinas do wizard de RDO"
```

---

### Task 6: Extrair os passos "Ocorrências" e "Revisão"

**Files:**
- Create: `frontend/src/features/registros-diarios/wizard/RdoStepOcorrencias.tsx`
- Create: `frontend/src/features/registros-diarios/wizard/RdoStepRevisao.tsx`

**Interfaces:**
- Consumes: `OcorrenciaInput`/`Equipe`/`Fiscal`/`ProducaoDiariaInput`/`PresencaInput`/
  `ApontamentoMaquinaInput` types (existing).
- Produces: `RdoStepOcorrencias`, `RdoStepRevisao` components. Task 7 is their only consumer.

- [ ] **Step 1: Create the Ocorrências step**

Create `frontend/src/features/registros-diarios/wizard/RdoStepOcorrencias.tsx`:
```tsx
import type { Dispatch, SetStateAction } from 'react'
import { Button, FormField, Textarea } from '../../../components/ui'
import type { OcorrenciaInput } from '../../../types/registroDiario'
import { OCORRENCIA_VAZIA } from './valoresVazios'

interface RdoStepOcorrenciasProps {
  ocorrencias: OcorrenciaInput[]
  onOcorrenciasChange: Dispatch<SetStateAction<OcorrenciaInput[]>>
}

export function RdoStepOcorrencias({ ocorrencias, onOcorrenciasChange }: RdoStepOcorrenciasProps) {
  return (
    <div aria-label="Ocorrências">
      {ocorrencias.map((ocorrencia, index) => (
        <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
          <FormField id={`ocorrencia-descricao-${index}`} label="Descrição">
            <Textarea
              id={`ocorrencia-descricao-${index}`}
              value={ocorrencia.descricao}
              onChange={(event) =>
                onOcorrenciasChange((current) =>
                  current.map((item, i) => (i === index ? { ...item, descricao: event.target.value } : item)),
                )
              }
            />
          </FormField>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onOcorrenciasChange((current) => [...current, OCORRENCIA_VAZIA])}
      >
        + Adicionar ocorrência
      </Button>
    </div>
  )
}
```
(Extracted verbatim from the current "Ocorrências" `Card`.)

- [ ] **Step 2: Create the Revisão step**

Create `frontend/src/features/registros-diarios/wizard/RdoStepRevisao.tsx`:
```tsx
import { Alert, Button } from '../../../components/ui'
import type {
  ApontamentoMaquinaInput,
  Equipe,
  Fiscal,
  OcorrenciaInput,
  PresencaInput,
  ProducaoDiariaInput,
} from '../../../types/registroDiario'

interface RdoStepRevisaoProps {
  dataReferencia: string
  equipeSelecionada: Equipe | undefined
  fiscalSelecionado: Fiscal | undefined
  producoes: ProducaoDiariaInput[]
  presencas: PresencaInput[]
  maquinas: ApontamentoMaquinaInput[]
  ocorrencias: OcorrenciaInput[]
  erro: string | null
  salvando: boolean
  onSalvar: () => void
}

export function RdoStepRevisao({
  dataReferencia,
  equipeSelecionada,
  fiscalSelecionado,
  producoes,
  presencas,
  maquinas,
  ocorrencias,
  erro,
  salvando,
  onSalvar,
}: RdoStepRevisaoProps) {
  return (
    <div aria-label="Revisão">
      <dl className="mb-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Data</dt>
          <dd className="font-medium text-ink">{dataReferencia || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Equipe</dt>
          <dd className="font-medium text-ink">{equipeSelecionada?.nome ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fiscal</dt>
          <dd className="font-medium text-ink">{fiscalSelecionado?.nome ?? '—'}</dd>
        </div>
      </dl>

      <ul className="mb-4 flex flex-col gap-1 text-sm text-muted-foreground" aria-label="Resumo do registro">
        <li>{producoes.length} produção(ões) lançada(s)</li>
        <li>{presencas.length} pessoa(s) na equipe</li>
        <li>{maquinas.length} máquina(s) apontada(s)</li>
        <li>{ocorrencias.length} ocorrência(s)</li>
      </ul>

      <p className="mb-4 rounded-md border border-border bg-surface p-3 text-sm text-muted-foreground">
        Fotos podem ser anexadas na próxima tela, depois de salvar este registro diário.
      </p>

      {erro && <Alert>{erro}</Alert>}

      <Button size="lg" onClick={onSalvar} disabled={salvando}>
        {salvando ? 'Salvando…' : 'Salvar registro diário'}
      </Button>
    </div>
  )
}
```
(A plain styled `<p>` for the photos note — not `Alert`, which only accepts `{ children }` and is
hardcoded to `variant="destructive"`; using it here would render an informational note inside a red
error box.)

- [ ] **Step 3: Verify the build**

```bash
cd frontend
npm run build
```
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/registros-diarios/wizard/RdoStepOcorrencias.tsx frontend/src/features/registros-diarios/wizard/RdoStepRevisao.tsx
git commit -m "feat: extrai passo Ocorrencias e cria passo Revisao do wizard de RDO"
```

---

### Task 7: Reescrever `RdoPage` como orquestrador do wizard e atualizar os testes E2E

**Files:**
- Modify: `frontend/src/pages/RdoPage.tsx`
- Modify: `frontend/tests/e2e/rdo.spec.ts`

**Interfaces:**
- Consumes: every component/constant from Tasks 1-6 (`RdoWizardNav`, `NOMES_PASSOS`,
  `RdoStepGerais`, `RdoStepProducao`, `RdoStepEquipe`, `RdoStepMaquinas`, `RdoStepOcorrencias`,
  `RdoStepRevisao`, the "vazio" constants), plus the existing `useRegistrosDiarios` hook (already
  used elsewhere in the app, e.g. `RegistrosDiariosListPage`).
- Produces: no new exports — `RdoPage` stays a default page component with the same route.

- [ ] **Step 1: Rewrite `RdoPage.tsx`**

The current `frontend/src/pages/RdoPage.tsx` is the ~500-line monolithic file (already read in
full during planning — every field it contains has been extracted verbatim into Tasks 2-6's step
components). Replace its entire contents with:
```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import {
  useConfiguracaoRdo,
  useCriarRegistroDiario,
  useRegistrosDiarios,
} from '../features/registros-diarios/registrosDiariosApi'
import { RdoStepEquipe } from '../features/registros-diarios/wizard/RdoStepEquipe'
import { RdoStepGerais } from '../features/registros-diarios/wizard/RdoStepGerais'
import { RdoStepMaquinas } from '../features/registros-diarios/wizard/RdoStepMaquinas'
import { RdoStepOcorrencias } from '../features/registros-diarios/wizard/RdoStepOcorrencias'
import { RdoStepProducao } from '../features/registros-diarios/wizard/RdoStepProducao'
import { RdoStepRevisao } from '../features/registros-diarios/wizard/RdoStepRevisao'
import { NOMES_PASSOS, RdoWizardNav } from '../features/registros-diarios/wizard/RdoWizardNav'
import {
  MAQUINA_VAZIA,
  OCORRENCIA_VAZIA,
  PRESENCA_VAZIA,
  PRODUCAO_VAZIA,
} from '../features/registros-diarios/wizard/valoresVazios'
import { registroDiarioFormSchema } from '../schemas/registroDiario'
import type {
  ApontamentoMaquinaInput,
  Clima,
  OcorrenciaInput,
  PresencaInput,
  ProducaoDiariaInput,
  Turno,
} from '../types/registroDiario'
import { Alert, Card, PageHeader, Spinner } from '../components/ui'

export function RdoPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const configuracao = useConfiguracaoRdo(projetoId ?? '')
  const registrosAnteriores = useRegistrosDiarios(projetoId ?? '')
  const criarRegistro = useCriarRegistroDiario(projetoId ?? '')

  const [passoAtual, setPassoAtual] = useState(0)

  const [dataReferencia, setDataReferencia] = useState('')
  const [turno, setTurno] = useState<Turno>('diurno')
  const [clima, setClima] = useState<Clima>('sol')
  const [equipe, setEquipe] = useState('')
  const [fiscal, setFiscal] = useState('')

  // Pre-preenche com o proprio usuario autenticado — antes exigia digitar um
  // ID de usuario a mao, sem forma de descobri-lo na UI (bug real encontrado
  // em teste manual).
  useEffect(() => {
    if (!fiscal && user) {
      setFiscal(String(user.id))
    }
  }, [user, fiscal])

  const [producoes, setProducoes] = useState<ProducaoDiariaInput[]>([PRODUCAO_VAZIA])
  const [presencas, setPresencas] = useState<PresencaInput[]>([PRESENCA_VAZIA])
  const [maquinas, setMaquinas] = useState<ApontamentoMaquinaInput[]>([MAQUINA_VAZIA])
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaInput[]>([])

  const [erro, setErro] = useState<string | null>(null)

  if (configuracao.isLoading) return <Spinner label="Carregando…" />
  if (configuracao.isError || !configuracao.data) {
    return <Alert>Não foi possível carregar os cadastros do projeto.</Alert>
  }

  const {
    disciplinas,
    unidades,
    equipes,
    motivos_parada: motivosParada,
    fiscais,
  } = configuracao.data
  const equipeSelecionada = equipes.find((item) => item.id === equipe)
  const fiscalSelecionado = fiscais.find((item) => String(item.id) === fiscal)

  function duplicarDiaAnterior() {
    const ultimo = registrosAnteriores.data?.results[0]
    if (!ultimo) return
    setEquipe(ultimo.equipe)
    setFiscal(String(ultimo.fiscal))
  }

  function handleSubmit() {
    setErro(null)

    const result = registroDiarioFormSchema.safeParse({
      data_referencia: dataReferencia,
      turno,
      clima,
      equipe,
      fiscal: Number(fiscal),
      producoes,
      presencas,
      maquinas,
      ocorrencias,
    })

    if (!result.success) {
      setErro(result.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    criarRegistro.mutate(result.data, {
      onSuccess: (registro) =>
        navigate(`/projetos/${projetoId}/registros-diarios/${registro.id}`),
      onError: () => setErro('Não foi possível salvar o registro diário. Tente novamente.'),
    })
  }

  return (
    <main aria-label="Novo registro diário">
      <PageHeader
        title="Novo Registro Diário"
        breadcrumbs={[
          { label: 'Projetos', to: '/projetos' },
          { label: 'Registros diários', to: `/projetos/${projetoId}/registros-diarios` },
          { label: 'Novo' },
        ]}
      />

      <RdoWizardNav
        passoAtual={passoAtual}
        onAnterior={() => setPassoAtual((atual) => Math.max(0, atual - 1))}
        onProximo={() => setPassoAtual((atual) => Math.min(NOMES_PASSOS.length - 1, atual + 1))}
      />

      <Card title={NOMES_PASSOS[passoAtual]}>
        {passoAtual === 0 && (
          <RdoStepGerais
            dataReferencia={dataReferencia}
            onDataReferenciaChange={setDataReferencia}
            turno={turno}
            onTurnoChange={setTurno}
            clima={clima}
            onClimaChange={setClima}
            equipe={equipe}
            onEquipeChange={setEquipe}
            fiscal={fiscal}
            onFiscalChange={setFiscal}
            equipes={equipes}
            fiscais={fiscais}
            podeDuplicarDiaAnterior={Boolean(registrosAnteriores.data?.results.length)}
            onDuplicarDiaAnterior={duplicarDiaAnterior}
          />
        )}
        {passoAtual === 1 && (
          <RdoStepProducao
            producoes={producoes}
            onProducoesChange={setProducoes}
            disciplinas={disciplinas}
            unidades={unidades}
          />
        )}
        {passoAtual === 2 && (
          <RdoStepEquipe
            presencas={presencas}
            onPresencasChange={setPresencas}
            equipeSelecionada={equipeSelecionada}
          />
        )}
        {passoAtual === 3 && (
          <RdoStepMaquinas
            maquinas={maquinas}
            onMaquinasChange={setMaquinas}
            equipeSelecionada={equipeSelecionada}
            motivosParada={motivosParada}
          />
        )}
        {passoAtual === 4 && (
          <RdoStepOcorrencias ocorrencias={ocorrencias} onOcorrenciasChange={setOcorrencias} />
        )}
        {passoAtual === 5 && (
          <RdoStepRevisao
            dataReferencia={dataReferencia}
            equipeSelecionada={equipeSelecionada}
            fiscalSelecionado={fiscalSelecionado}
            producoes={producoes}
            presencas={presencas}
            maquinas={maquinas}
            ocorrencias={ocorrencias}
            erro={erro}
            salvando={criarRegistro.isPending}
            onSalvar={handleSubmit}
          />
        )}
      </Card>
    </main>
  )
}
```
(`onProducoesChange={setProducoes}` and the three siblings pass the `useState` setter directly —
each step component's prop is typed `Dispatch<SetStateAction<T[]>>`, which a plain setter satisfies
exactly, so no wrapper function is needed. `duplicarDiaAnterior` only ever touches `equipe`/`fiscal`,
matching the global constraint. `handleSubmit`'s validation/mutation logic is byte-for-byte the same
as before — only its trigger moved from a page-bottom button to the Revisão step's "Salvar" button.)

- [ ] **Step 2: Update `rdo.spec.ts` for step navigation**

The current `frontend/tests/e2e/rdo.spec.ts` reads:
```typescript
import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const CONFIG_URL = '**/api/v1/projetos/*/configuracao-rdo/'
const RDO_CREATE_URL = '**/api/v1/projetos/*/registros-diarios/'
const RDO_DETAIL_URL = '**/api/v1/registros-diarios/rdo-1/'
const FOTO_URL = '**/api/v1/registros-diarios/*/fotos/'

const USUARIO = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

const CONFIGURACAO = {
  disciplinas: [
    { id: 'disc-1', nome: 'Terraplenagem', servicos: [{ id: 'serv-1', nome: 'Corte', unidade: 1 }] },
  ],
  unidades: [{ id: 1, sigla: 'm³', descricao: 'metro cúbico' }],
  equipes: [
    {
      id: 'equipe-1',
      nome: 'Equipe A',
      pessoas: [{ id: 'pessoa-1', nome: 'João', funcao: 'Ajudante' }],
      maquinas: [{ id: 'maquina-1', codigo: 'ESC-01', nome: 'Escavadeira' }],
    },
  ],
  motivos_parada: [{ id: 1, descricao: 'Chuva' }],
  fiscais: [{ id: 1, nome: 'Gerente Empresa A', email: 'gerente@empresaA.example.com' }],
}

const RDO_CRIADO = {
  id: 'rdo-1',
  data_referencia: '2026-07-17',
  turno: 'diurno',
  clima: 'sol',
  producoes: [
    { rodovia: 'BR-365', km_inicial: '10.000', km_final: '10.500', quantidade: '500' },
  ],
  presencas: [{ nome_avulso: 'João Ajudante', funcao: 'Ajudante', status: 'presente' }],
  maquinas: [
    { identificacao_avulsa: 'Escavadeira 01', horas_produtivas: '6', horas_paradas: '0' },
  ],
  ocorrencias: [],
  fotos: [],
}

test('preencher wizard completo de RDO, ver o detalhe e anexar foto', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) => route.fulfill({ json: CONFIGURACAO }))
  await page.route(RDO_CREATE_URL, (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    return route.fulfill({ status: 201, json: RDO_CRIADO })
  })
  await page.route(RDO_DETAIL_URL, (route) => route.fulfill({ json: RDO_CRIADO }))
  await page.route(FOTO_URL, (route) =>
    route.fulfill({ status: 201, json: { id: 'foto-1', arquivo: '/media/foto.png', km: '10.250', created_at: '2026-07-17T00:00:00Z' } }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios/novo')

  await page.getByLabel('Data').fill('2026-07-17')
  await page.getByLabel('Equipe', { exact: true }).selectOption('equipe-1')
  await page.getByLabel('Fiscal').selectOption('1')

  await page.getByLabel('Rodovia').fill('BR-365')
  await page.getByLabel('Disciplina').selectOption('disc-1')
  await page.getByLabel('Serviço').selectOption('serv-1')
  await page.getByLabel('Km inicial').fill('10.000')
  await page.getByLabel('Km final').fill('10.500')
  await page.getByLabel('Quantidade').fill('500')
  await page.getByLabel('Unidade').selectOption('1')

  await page.getByLabel('Nome (avulso)').fill('João Ajudante')
  await page.getByLabel('Função').fill('Ajudante')

  await page.getByLabel('Identificação (avulsa)').fill('Escavadeira 01')
  await page.getByLabel('Horas produtivas').fill('6')

  await page.getByRole('button', { name: 'Salvar registro diário' }).click()

  // Apos salvar, navega para a tela de detalhe do RDO (nao fica so numa
  // mensagem solta — o registro fica de fato visivel/consultavel).
  await expect(page).toHaveURL(/\/registros-diarios\/rdo-1$/)
  await expect(page.getByRole('heading', { name: /Registro diário/ })).toBeVisible()

  const fileInput = page.locator('#foto-arquivo')
  await fileInput.setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
        '1f15c4890000000a4944415478da630001000005000105e2ff' +
        '000000004945454e44ae426082',
      'hex',
    ),
  })
  await page.getByRole('button', { name: 'Anexar foto' }).click()
})

test('trocar de nome avulso para pessoa cadastrada limpa o campo avulso', async ({ page }) => {
  // Regressao: digitar um nome avulso e depois escolher uma pessoa cadastrada
  // deixava os dois campos preenchidos, violando a regra XOR (bug real
  // encontrado em teste manual, 2026-07-17).
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) => route.fulfill({ json: CONFIGURACAO }))
  await page.route(RDO_DETAIL_URL, (route) => route.fulfill({ json: RDO_CRIADO }))

  let payloadRecebido: Record<string, unknown> | null = null
  await page.route(RDO_CREATE_URL, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    payloadRecebido = route.request().postDataJSON()
    return route.fulfill({ status: 201, json: RDO_CRIADO })
  })

  await page.goto('/projetos/projeto-1/registros-diarios/novo')

  await page.getByLabel('Data').fill('2026-07-17')
  await page.getByLabel('Equipe', { exact: true }).selectOption('equipe-1')
  await page.getByLabel('Fiscal').selectOption('1')

  await page.getByLabel('Rodovia').fill('BR-365')
  await page.getByLabel('Disciplina').selectOption('disc-1')
  await page.getByLabel('Serviço').selectOption('serv-1')
  await page.getByLabel('Km inicial').fill('10.000')
  await page.getByLabel('Km final').fill('10.500')
  await page.getByLabel('Quantidade').fill('500')
  await page.getByLabel('Unidade').selectOption('1')

  // Digita um nome avulso primeiro...
  await page.getByLabel('Nome (avulso)').fill('Nome Digitado Errado')
  // ...depois muda de ideia e escolhe a pessoa cadastrada.
  await page.getByLabel('Pessoa cadastrada').selectOption('pessoa-1')
  await page.getByLabel('Função').fill('Ajudante')

  await page.getByLabel('Identificação (avulsa)').fill('Escavadeira 01')
  await page.getByLabel('Horas produtivas').fill('6')

  await page.getByRole('button', { name: 'Salvar registro diário' }).click()

  await expect(page).toHaveURL(/\/registros-diarios\/rdo-1$/)
  const presencas = (payloadRecebido as { presencas: { pessoa?: string; nome_avulso?: string }[] })
    .presencas
  expect(presencas[0].pessoa).toBe('pessoa-1')
  expect(presencas[0].nome_avulso).toBeFalsy()
})
```

Replace the whole file with:
```typescript
import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const CONFIG_URL = '**/api/v1/projetos/*/configuracao-rdo/'
const RDO_CREATE_URL = '**/api/v1/projetos/*/registros-diarios/'
const RDO_DETAIL_URL = '**/api/v1/registros-diarios/rdo-1/'
const FOTO_URL = '**/api/v1/registros-diarios/*/fotos/'

const USUARIO = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

const CONFIGURACAO = {
  disciplinas: [
    { id: 'disc-1', nome: 'Terraplenagem', servicos: [{ id: 'serv-1', nome: 'Corte', unidade: 1 }] },
  ],
  unidades: [{ id: 1, sigla: 'm³', descricao: 'metro cúbico' }],
  equipes: [
    {
      id: 'equipe-1',
      nome: 'Equipe A',
      pessoas: [{ id: 'pessoa-1', nome: 'João', funcao: 'Ajudante' }],
      maquinas: [{ id: 'maquina-1', codigo: 'ESC-01', nome: 'Escavadeira' }],
    },
  ],
  motivos_parada: [{ id: 1, descricao: 'Chuva' }],
  fiscais: [{ id: 1, nome: 'Gerente Empresa A', email: 'gerente@empresaA.example.com' }],
}

const RDO_CRIADO = {
  id: 'rdo-1',
  data_referencia: '2026-07-17',
  turno: 'diurno',
  clima: 'sol',
  producoes: [
    { rodovia: 'BR-365', km_inicial: '10.000', km_final: '10.500', quantidade: '500' },
  ],
  presencas: [{ nome_avulso: 'João Ajudante', funcao: 'Ajudante', status: 'presente' }],
  maquinas: [
    { identificacao_avulsa: 'Escavadeira 01', horas_produtivas: '6', horas_paradas: '0' },
  ],
  ocorrencias: [],
  fotos: [],
}

async function mockRotasBasicas(page: import('@playwright/test').Page) {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) => route.fulfill({ json: CONFIGURACAO }))
  await page.route(RDO_DETAIL_URL, (route) => route.fulfill({ json: RDO_CRIADO }))
}

test('preencher wizard completo de RDO, ver o detalhe e anexar foto', async ({ page }) => {
  await mockRotasBasicas(page)
  await page.route(RDO_CREATE_URL, (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    return route.fulfill({ status: 201, json: RDO_CRIADO })
  })
  await page.route(FOTO_URL, (route) =>
    route.fulfill({ status: 201, json: { id: 'foto-1', arquivo: '/media/foto.png', km: '10.250', created_at: '2026-07-17T00:00:00Z' } }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios/novo')

  // Passo 1: Gerais
  await page.getByLabel('Data').fill('2026-07-17')
  await page.getByLabel('Equipe', { exact: true }).selectOption('equipe-1')
  await page.getByLabel('Fiscal').selectOption('1')
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Passo 2: Produção
  await page.getByLabel('Rodovia').fill('BR-365')
  await page.getByLabel('Disciplina').selectOption('disc-1')
  await page.getByLabel('Serviço').selectOption('serv-1')
  await page.getByLabel('Km inicial').fill('10.000')
  await page.getByLabel('Km final').fill('10.500')
  await page.getByLabel('Quantidade').fill('500')
  await page.getByLabel('Unidade').selectOption('1')
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Passo 3: Equipe
  await page.getByLabel('Nome (avulso)').fill('João Ajudante')
  await page.getByLabel('Função').fill('Ajudante')
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Passo 4: Máquinas
  await page.getByLabel('Identificação (avulsa)').fill('Escavadeira 01')
  await page.getByLabel('Horas produtivas').fill('6')
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Passo 5: Ocorrências (nenhuma)
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Passo 6: Revisão
  await page.getByRole('button', { name: 'Salvar registro diário' }).click()

  // Apos salvar, navega para a tela de detalhe do RDO (nao fica so numa
  // mensagem solta — o registro fica de fato visivel/consultavel).
  await expect(page).toHaveURL(/\/registros-diarios\/rdo-1$/)
  await expect(page.getByRole('heading', { name: /Registro diário/ })).toBeVisible()

  const fileInput = page.locator('#foto-arquivo')
  await fileInput.setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
        '1f15c4890000000a4944415478da630001000005000105e2ff' +
        '000000004945454e44ae426082',
      'hex',
    ),
  })
  await page.getByRole('button', { name: 'Anexar foto' }).click()
})

test('trocar de nome avulso para pessoa cadastrada limpa o campo avulso', async ({ page }) => {
  // Regressao: digitar um nome avulso e depois escolher uma pessoa cadastrada
  // deixava os dois campos preenchidos, violando a regra XOR (bug real
  // encontrado em teste manual, 2026-07-17).
  await mockRotasBasicas(page)

  let payloadRecebido: Record<string, unknown> | null = null
  await page.route(RDO_CREATE_URL, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    payloadRecebido = route.request().postDataJSON()
    return route.fulfill({ status: 201, json: RDO_CRIADO })
  })

  await page.goto('/projetos/projeto-1/registros-diarios/novo')

  await page.getByLabel('Data').fill('2026-07-17')
  await page.getByLabel('Equipe', { exact: true }).selectOption('equipe-1')
  await page.getByLabel('Fiscal').selectOption('1')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByLabel('Rodovia').fill('BR-365')
  await page.getByLabel('Disciplina').selectOption('disc-1')
  await page.getByLabel('Serviço').selectOption('serv-1')
  await page.getByLabel('Km inicial').fill('10.000')
  await page.getByLabel('Km final').fill('10.500')
  await page.getByLabel('Quantidade').fill('500')
  await page.getByLabel('Unidade').selectOption('1')
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Digita um nome avulso primeiro...
  await page.getByLabel('Nome (avulso)').fill('Nome Digitado Errado')
  // ...depois muda de ideia e escolhe a pessoa cadastrada.
  await page.getByLabel('Pessoa cadastrada').selectOption('pessoa-1')
  await page.getByLabel('Função').fill('Ajudante')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByLabel('Identificação (avulsa)').fill('Escavadeira 01')
  await page.getByLabel('Horas produtivas').fill('6')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByRole('button', { name: 'Salvar registro diário' }).click()

  await expect(page).toHaveURL(/\/registros-diarios\/rdo-1$/)
  const presencas = (payloadRecebido as { presencas: { pessoa?: string; nome_avulso?: string }[] })
    .presencas
  expect(presencas[0].pessoa).toBe('pessoa-1')
  expect(presencas[0].nome_avulso).toBeFalsy()
})

test('grupos de botões de turno e clima atualizam a seleção e enviam no payload', async ({ page }) => {
  await mockRotasBasicas(page)

  let payloadRecebido: Record<string, unknown> | null = null
  await page.route(RDO_CREATE_URL, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    payloadRecebido = route.request().postDataJSON()
    return route.fulfill({ status: 201, json: RDO_CRIADO })
  })

  await page.goto('/projetos/projeto-1/registros-diarios/novo')

  await page.getByLabel('Data').fill('2026-07-17')
  await page.getByRole('button', { name: 'Noturno' }).click()
  await page.getByRole('button', { name: 'Chuva', exact: true }).click()
  await page.getByLabel('Equipe', { exact: true }).selectOption('equipe-1')
  await page.getByLabel('Fiscal').selectOption('1')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByLabel('Rodovia').fill('BR-365')
  await page.getByLabel('Disciplina').selectOption('disc-1')
  await page.getByLabel('Serviço').selectOption('serv-1')
  await page.getByLabel('Km inicial').fill('10.000')
  await page.getByLabel('Km final').fill('10.500')
  await page.getByLabel('Quantidade').fill('500')
  await page.getByLabel('Unidade').selectOption('1')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByLabel('Nome (avulso)').fill('João Ajudante')
  await page.getByLabel('Função').fill('Ajudante')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByLabel('Identificação (avulsa)').fill('Escavadeira 01')
  await page.getByLabel('Horas produtivas').fill('6')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByRole('button', { name: 'Salvar registro diário' }).click()

  await expect(page).toHaveURL(/\/registros-diarios\/rdo-1$/)
  const payload = payloadRecebido as { turno: string; clima: string }
  expect(payload.turno).toBe('noturno')
  expect(payload.clima).toBe('chuva')
})

test('duplicar dia anterior preenche equipe e fiscal do ultimo RDO', async ({ page }) => {
  await mockRotasBasicas(page)
  await page.route(RDO_CREATE_URL, (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{ ...RDO_CRIADO, equipe: 'equipe-1', fiscal: 1 }],
      },
    })
  })

  await page.goto('/projetos/projeto-1/registros-diarios/novo')

  await page.getByRole('button', { name: 'Duplicar dia anterior' }).click()

  await expect(page.getByLabel('Equipe', { exact: true })).toHaveValue('equipe-1')
  await expect(page.getByLabel('Fiscal')).toHaveValue('1')
})
```
(The two existing tests are updated only to insert a "Próximo" click between each step's fields —
every field id, label, and assertion is unchanged from before. `mockRotasBasicas` is a small
extracted helper for the 3 routes both existing tests already mocked identically, used by all 4
tests in the file now. The two new tests cover the two behaviors this plan actually adds: the
button-group interaction, and "duplicar dia anterior" pre-filling exactly `equipe`/`fiscal`. The
"never copies turno/clima/producoes/presencas/maquinas/ocorrencias" half of that requirement is a
property of `duplicarDiaAnterior()`'s implementation itself — it only ever calls
`setEquipe`/`setFiscal` — rather than something that needs its own separate E2E assertion here.)

- [ ] **Step 3: Run the RDO E2E spec**

```bash
cd frontend
npx playwright test tests/e2e/rdo.spec.ts
```
Expected: 4/4 pass (adjust the noted assertion above if needed to get there).

- [ ] **Step 4: Run the build and the full E2E suite**

```bash
cd frontend
npm run build
npx playwright test
```
Expected: build exits 0. Every spec passes — this task is the only one that changes `RdoPage`'s
actual rendered behavior, so this is the first point where a regression in an unrelated spec (e.g.
`registros-list.spec.ts`, which navigates to this same route) would surface.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/RdoPage.tsx frontend/tests/e2e/rdo.spec.ts
git commit -m "feat: reescreve RdoPage como wizard de 6 passos com duplicar dia anterior"
```

---

### Task 8: Verificação final

**Files:** none expected beyond possible small fixes found during verification.

- [ ] **Step 1: Suíte completa**

```bash
cd frontend
npm run build
npm run lint
npm run test
npx playwright test
```
Expected: build exits 0, lint exits 0 (only pre-existing fast-refresh warnings), `npm run test`
reports 0 tests (established convention), and the full Playwright suite passes.

- [ ] **Step 2: Atualizar `specs/001-mvp-gestao-diaria/tasks.md`**

Append an entry documenting this frontend work:
```markdown

**Frontend do "Field OS" — Wizard de RDO (2026-07-19)**: `RdoPage` reescrita como wizard de 6
passos (Gerais/Produção/Equipe/Máquinas/Ocorrências/Revisão), navegação Anterior/Próximo, cada
passo extraído para seu próprio componente em `features/registros-diarios/wizard/`. Turno e Clima
viram grupos de botões (`GrupoBotoes`) em vez de dropdowns — alvos maiores, mais fáceis de acertar
em campo. "Duplicar dia anterior" busca o RDO mais recente do projeto (mesmo endpoint de listagem
já existente) e pré-preenche apenas Equipe e Fiscal — nunca turno/clima/produção/presenças/
máquinas/ocorrências, que mudam dia a dia. Validação Zod continua avaliada só no submit final (não
por passo). O passo "Revisão" é informativo, não um upload real — fotos continuam sendo anexadas
na tela de detalhe pós-criação (`FotoUpload`/`useEnviarFoto`), já que o registro precisa existir no
backend antes de aceitar fotos; essa decisão foi confirmada com o usuário antes de escrever este
plano. Próximo passo do redesign "Field OS" (Configurações) fica em plano separado.

**Verificado**: build + lint limpos, suíte E2E completa passando.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra wizard de RDO do Field OS frontend em tasks.md"
```
