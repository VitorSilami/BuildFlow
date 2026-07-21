# Field OS — Conclusão (Frontend Configurações) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar `ConfiguracaoPage` de 4 `Card`s empilhados para `Tabs` (Disciplinas / Metas /
Equipes / Valores) — reduz rolagem, sem mudar nenhuma lógica de negócio, handler, ou validação.

**Architecture:** Mudança puramente de apresentação. O conteúdo de cada `Card` existente (JSX,
handlers, hooks) é movido, sem alteração, para dentro de um `TabsContent` correspondente. Nenhum
arquivo novo, nenhuma mudança de API/hooks de `configuracaoApi.ts`.

**Tech Stack:** React 19, TypeScript, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (Radix, já no
barrel `components/ui`, mesmo padrão já usado no filtro de status de `ProjetosListPage.tsx`),
Playwright.

## Global Constraints

- Zero mudança de comportamento: mesmos 4 formulários, mesmos hooks (`useCriarDisciplina`,
  `useCriarEquipe`, `useCriarPessoa`, `useCriarMaquina`, `useCriarMeta`, `useCriarValorCusto`),
  mesma validação (`disabled={...}` de cada botão), mesmos textos.
- Aba inicial: "Disciplinas" (`defaultValue="disciplinas"`) — ordem natural, já que "Metas" depende
  de uma disciplina existir.
- Nunca usar `--no-verify`; commits novos ao invés de amend.

---

### Task 1: `ConfiguracaoPage` em Tabs

**Files:**
- Modify: `frontend/src/pages/ConfiguracaoPage.tsx`
- Modify: `frontend/tests/e2e/config.spec.ts`

**Interfaces:** nenhuma mudança de interface pública — mesmo componente `ConfiguracaoPage`, mesmos
hooks consumidos de `configuracaoApi.ts`.

- [ ] **Step 1: Reescrever `ConfiguracaoPage.tsx`**

Substituir o arquivo inteiro por (idêntico ao atual, só reorganizado em Tabs — imports, estado e
handlers de cada seção continuam exatamente os mesmos):

```tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useConfiguracaoProjeto,
  useCriarDisciplina,
  useCriarEquipe,
  useCriarMaquina,
  useCriarMeta,
  useCriarPessoa,
  useCriarValorCusto,
} from '../features/configuracoes/configuracaoApi'
import {
  Button,
  Card,
  EmptyState,
  ErrorRetry,
  FormField,
  Input,
  PageHeader,
  SelectField,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui'

export function ConfiguracaoPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const configuracao = useConfiguracaoProjeto(projetoId ?? '')

  const criarDisciplina = useCriarDisciplina(projetoId ?? '')
  const criarEquipe = useCriarEquipe(projetoId ?? '')
  const criarPessoa = useCriarPessoa(projetoId ?? '')
  const criarMaquina = useCriarMaquina(projetoId ?? '')
  const criarMeta = useCriarMeta(projetoId ?? '')
  const criarValorCusto = useCriarValorCusto(projetoId ?? '')

  const [nomeDisciplina, setNomeDisciplina] = useState('')
  const [nomeEquipe, setNomeEquipe] = useState('')
  const [pessoaNome, setPessoaNome] = useState('')
  const [pessoaFuncao, setPessoaFuncao] = useState('')
  const [pessoaEquipeId, setPessoaEquipeId] = useState('')
  const [maquinaCodigo, setMaquinaCodigo] = useState('')
  const [maquinaNome, setMaquinaNome] = useState('')
  const [maquinaEquipeId, setMaquinaEquipeId] = useState('')
  const [metaDisciplinaId, setMetaDisciplinaId] = useState('')
  const [metaValorAlvo, setMetaValorAlvo] = useState('')
  const [metaPeso, setMetaPeso] = useState('')
  const [valorTipo, setValorTipo] = useState<'mao_de_obra' | 'equipamento'>('mao_de_obra')
  const [valorDescricao, setValorDescricao] = useState('')
  const [valorValor, setValorValor] = useState('')

  if (configuracao.isLoading) return <Spinner label="Carregando…" />
  if (configuracao.isError || !configuracao.data) {
    return (
      <ErrorRetry
        message="Não foi possível carregar a configuração do projeto."
        onRetry={() => void configuracao.refetch()}
      />
    )
  }

  const { disciplinas, equipes, metas, valores_custo: valoresCusto, soma_pesos_metas: somaPesos } =
    configuracao.data

  return (
    <main aria-label="Configurações do projeto">
      <PageHeader title="Configurações" breadcrumbs={[{ label: 'Projetos', to: '/projetos' }, { label: 'Configurações' }]} />

      <Tabs defaultValue="disciplinas">
        <TabsList aria-label="Seções de configuração">
          <TabsTrigger value="disciplinas">Disciplinas</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="equipes">Equipes</TabsTrigger>
          <TabsTrigger value="valores">Valores</TabsTrigger>
        </TabsList>

        <TabsContent value="disciplinas">
          <Card title="Disciplinas">
            <div aria-label="Disciplinas">
              {disciplinas.length === 0 && <EmptyState>Nenhuma disciplina cadastrada ainda.</EmptyState>}
              <ul className="mb-4 divide-y divide-border">
                {disciplinas.map((disciplina) => (
                  <li className="py-2 text-sm" key={disciplina.id}>{disciplina.nome}</li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end gap-3">
                <FormField id="nova-disciplina" label="Nova disciplina">
                  <Input id="nova-disciplina" value={nomeDisciplina} onChange={(event) => setNomeDisciplina(event.target.value)} />
                </FormField>
                <Button
                  onClick={() => criarDisciplina.mutate(nomeDisciplina, { onSuccess: () => setNomeDisciplina('') })}
                  disabled={!nomeDisciplina.trim() || criarDisciplina.isPending}
                >
                  Adicionar disciplina
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="metas">
          <Card title="Metas">
            <div aria-label="Metas">
              {metas.length === 0 && <EmptyState>Nenhuma meta cadastrada ainda.</EmptyState>}
              <ul className="mb-4 divide-y divide-border">
                {metas.map((meta) => (
                  <li className="py-2 text-sm" key={meta.id}>
                    {disciplinas.find((d) => d.id === meta.disciplina)?.nome ?? meta.disciplina}: {meta.valor_alvo}
                    {meta.peso_percentual ? ` (${meta.peso_percentual}%)` : ''}
                  </li>
                ))}
              </ul>
              <p className="mb-4 text-sm text-muted-foreground">
                Soma dos pesos: {somaPesos}%{' '}
                {Math.abs(somaPesos - 100) > 0.01 && somaPesos > 0 && '(atenção: não fecha 100%)'}
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <SelectField
                  id="meta-disciplina"
                  label="Disciplina"
                  value={metaDisciplinaId}
                  onChange={setMetaDisciplinaId}
                  options={disciplinas.map((disciplina) => ({ value: disciplina.id, label: disciplina.nome }))}
                />
                <FormField id="meta-valor" label="Valor alvo">
                  <Input id="meta-valor" value={metaValorAlvo} onChange={(event) => setMetaValorAlvo(event.target.value)} />
                </FormField>
                <FormField id="meta-peso" label="Peso (%)">
                  <Input id="meta-peso" value={metaPeso} onChange={(event) => setMetaPeso(event.target.value)} />
                </FormField>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={!metaDisciplinaId || !metaValorAlvo || criarMeta.isPending}
                    onClick={() =>
                      criarMeta.mutate(
                        {
                          disciplina: metaDisciplinaId,
                          unidade: disciplinas.find((d) => d.id === metaDisciplinaId)?.servicos[0]?.unidade ?? 0,
                          valor_alvo: metaValorAlvo,
                          peso_percentual: metaPeso || undefined,
                        },
                        { onSuccess: () => { setMetaValorAlvo(''); setMetaPeso('') } },
                      )
                    }
                  >
                    Adicionar meta
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="equipes">
          <Card title="Equipes">
            <div aria-label="Equipes">
              {equipes.length === 0 && <EmptyState>Nenhuma equipe cadastrada ainda.</EmptyState>}
              <ul className="mb-4 divide-y divide-border">
                {equipes.map((equipe) => (
                  <li className="py-2 text-sm" key={equipe.id}>
                    <strong className="text-ink">{equipe.nome}</strong>
                    <ul className="mt-1 pl-4 text-muted-foreground">
                      {equipe.pessoas.map((pessoa) => (
                        <li key={pessoa.id}>{pessoa.nome} — {pessoa.funcao}</li>
                      ))}
                      {equipe.maquinas.map((maquina) => (
                        <li key={maquina.id}>{maquina.nome} ({maquina.codigo})</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>

              <div className="mb-6 flex flex-wrap items-end gap-3">
                <FormField id="nova-equipe" label="Nova equipe">
                  <Input id="nova-equipe" value={nomeEquipe} onChange={(event) => setNomeEquipe(event.target.value)} />
                </FormField>
                <Button
                  disabled={!nomeEquipe.trim() || criarEquipe.isPending}
                  onClick={() => criarEquipe.mutate(nomeEquipe, { onSuccess: () => setNomeEquipe('') })}
                >
                  Adicionar equipe
                </Button>
              </div>

              <h5 className="mb-3 font-display text-sm font-semibold text-ink">Adicionar pessoa</h5>
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                <SelectField
                  id="pessoa-equipe"
                  label="Equipe"
                  value={pessoaEquipeId}
                  onChange={setPessoaEquipeId}
                  options={equipes.map((equipe) => ({ value: equipe.id, label: equipe.nome }))}
                />
                <FormField id="pessoa-nome" label="Nome">
                  <Input id="pessoa-nome" value={pessoaNome} onChange={(event) => setPessoaNome(event.target.value)} />
                </FormField>
                <FormField id="pessoa-funcao" label="Função">
                  <Input id="pessoa-funcao" value={pessoaFuncao} onChange={(event) => setPessoaFuncao(event.target.value)} />
                </FormField>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={!pessoaEquipeId || !pessoaNome.trim() || criarPessoa.isPending}
                    onClick={() =>
                      criarPessoa.mutate(
                        { equipeId: pessoaEquipeId, nome: pessoaNome, funcao: pessoaFuncao },
                        { onSuccess: () => { setPessoaNome(''); setPessoaFuncao('') } },
                      )
                    }
                  >
                    Adicionar pessoa
                  </Button>
                </div>
              </div>

              <h5 className="mb-3 font-display text-sm font-semibold text-ink">Adicionar máquina</h5>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <SelectField
                  id="maquina-equipe"
                  label="Equipe"
                  value={maquinaEquipeId}
                  onChange={setMaquinaEquipeId}
                  options={equipes.map((equipe) => ({ value: equipe.id, label: equipe.nome }))}
                />
                <FormField id="maquina-codigo" label="Código">
                  <Input id="maquina-codigo" value={maquinaCodigo} onChange={(event) => setMaquinaCodigo(event.target.value)} />
                </FormField>
                <FormField id="maquina-nome" label="Nome">
                  <Input id="maquina-nome" value={maquinaNome} onChange={(event) => setMaquinaNome(event.target.value)} />
                </FormField>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={!maquinaEquipeId || !maquinaNome.trim() || criarMaquina.isPending}
                    onClick={() =>
                      criarMaquina.mutate(
                        { equipeId: maquinaEquipeId, codigo: maquinaCodigo, nome: maquinaNome },
                        { onSuccess: () => { setMaquinaCodigo(''); setMaquinaNome('') } },
                      )
                    }
                  >
                    Adicionar máquina
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="valores">
          <Card title="Valores">
            <div aria-label="Valores de custo">
              {valoresCusto.length === 0 && <EmptyState>Nenhum valor cadastrado ainda.</EmptyState>}
              <ul className="mb-4 divide-y divide-border">
                {valoresCusto.map((valor) => (
                  <li className="py-2 text-sm" key={valor.id}>{valor.descricao} ({valor.tipo}): {valor.valor}</li>
                ))}
              </ul>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <SelectField
                  id="valor-tipo"
                  label="Tipo"
                  value={valorTipo}
                  onChange={(value) => setValorTipo(value as typeof valorTipo)}
                  options={[
                    { value: 'mao_de_obra', label: 'Mão de obra' },
                    { value: 'equipamento', label: 'Equipamento' },
                  ]}
                />
                <FormField id="valor-descricao" label="Descrição">
                  <Input id="valor-descricao" value={valorDescricao} onChange={(event) => setValorDescricao(event.target.value)} />
                </FormField>
                <FormField id="valor-valor" label="Valor">
                  <Input id="valor-valor" value={valorValor} onChange={(event) => setValorValor(event.target.value)} />
                </FormField>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={!valorDescricao.trim() || !valorValor || criarValorCusto.isPending}
                    onClick={() =>
                      criarValorCusto.mutate(
                        { tipo: valorTipo, descricao: valorDescricao, valor: valorValor },
                        { onSuccess: () => { setValorDescricao(''); setValorValor('') } },
                      )
                    }
                  >
                    Adicionar valor
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
```

- [ ] **Step 2: Atualizar `config.spec.ts`**

O teste existente cria uma disciplina e, na sequência, uma equipe — como as duas seções agora
ficam em abas diferentes, é preciso clicar na aba "Equipes" entre as duas ações. Substituir o
arquivo inteiro (mesmos mocks e asserções, só com a navegação por aba adicionada):

```typescript
import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const CONFIG_URL = '**/api/v1/projetos/*/configuracao/'
const DISCIPLINAS_URL = '**/api/v1/projetos/*/configuracao/disciplinas/'
const EQUIPES_URL = '**/api/v1/projetos/*/configuracao/equipes/'

const USUARIO = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

test('criar disciplina e equipe na configuração do projeto', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  let disciplinaCriada = false
  let equipeCriada = false

  await page.route(CONFIG_URL, (route) => {
    const disciplinas = disciplinaCriada
      ? [{ id: 'disc-1', nome: 'Terraplenagem', servicos: [] }]
      : []
    const equipes = equipeCriada
      ? [{ id: 'equipe-1', nome: 'Equipe A', pessoas: [], maquinas: [] }]
      : []
    return route.fulfill({
      json: { disciplinas, equipes, metas: [], valores_custo: [], soma_pesos_metas: 0 },
    })
  })

  await page.route(DISCIPLINAS_URL, (route) => {
    disciplinaCriada = true
    return route.fulfill({ status: 201, json: { id: 'disc-1', nome: 'Terraplenagem', servicos: [] } })
  })

  await page.route(EQUIPES_URL, (route) => {
    equipeCriada = true
    return route.fulfill({
      status: 201,
      json: { id: 'equipe-1', nome: 'Equipe A', pessoas: [], maquinas: [] },
    })
  })

  await page.goto('/projetos/projeto-1/configuracoes')

  await expect(page.getByText('Nenhuma disciplina cadastrada ainda.')).toBeVisible()

  await page.getByLabel('Nova disciplina').fill('Terraplenagem')
  await page.getByRole('button', { name: 'Adicionar disciplina' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Terraplenagem' })).toBeVisible()

  await page.getByRole('tab', { name: 'Equipes' }).click()

  await page.getByLabel('Nova equipe').fill('Equipe A')
  await page.getByRole('button', { name: 'Adicionar equipe' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Equipe A' })).toBeVisible()
})

test('trocar de aba mantém a seção anterior preenchida ao voltar', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [{ id: 'disc-1', nome: 'Terraplenagem', servicos: [] }],
        equipes: [],
        metas: [],
        valores_custo: [],
        soma_pesos_metas: 0,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')

  await expect(page.getByRole('listitem').filter({ hasText: 'Terraplenagem' })).toBeVisible()

  await page.getByRole('tab', { name: 'Valores' }).click()
  await expect(page.getByLabel('Descrição')).toBeVisible()

  await page.getByRole('tab', { name: 'Disciplinas' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Terraplenagem' })).toBeVisible()
})
```

- [ ] **Step 3: Rodar o build e os testes**

Run: `cd frontend && npm run build && npx playwright test tests/e2e/config.spec.ts`
Expected: build exit 0; 2/2 testes passando.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ConfiguracaoPage.tsx frontend/tests/e2e/config.spec.ts
git commit -m "feat: reorganiza ConfiguracaoPage em abas"
```

---

### Task 2: Verificação final

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

**Frontend do "Field OS" — Configurações em abas (2026-07-21)**: `ConfiguracaoPage` reorganizada de
4 `Card`s empilhados para `Tabs` (Disciplinas / Metas / Equipes / Valores) — reduz rolagem, zero
mudança de lógica de negócio, handlers ou validação. Encerra o redesign "Field OS" iniciado em
`2026-07-18-field-os-dashboard-design.md`.

**Verificado**: build + lint limpos, suíte E2E completa passando.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra configuracoes em abas do Field OS frontend em tasks.md"
```
