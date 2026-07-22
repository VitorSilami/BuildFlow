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

const PROJETO_DETALHE_URL = '**/api/v1/projetos/*/'
const PROJETO_MOCK = {
  id: 'projeto-1',
  nome: 'Duplicação BR-365',
  descricao: '',
  numero_contrato: '',
  trecho: '',
  engenheiro_responsavel: '',
  status: 'ativo',
  execucao_percentual: '52',
  ultimo_rdo_data: '2026-07-17',
  criado_por: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

test.beforeEach(async ({ page }) => {
  await page.route(PROJETO_DETALHE_URL, (route) => route.fulfill({ json: PROJETO_MOCK }))
})

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

  await page.getByLabel('Nova disciplina').fill('Rascunho')

  await page.getByRole('tab', { name: 'Valores' }).click()
  await expect(page.getByLabel('Descrição')).toBeVisible()

  await page.getByRole('tab', { name: 'Disciplinas' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Terraplenagem' })).toBeVisible()
  await expect(page.getByLabel('Nova disciplina')).toHaveValue('Rascunho')
})

test('tipo equipamento mostra seletor de máquina cadastrada em vez de função', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [],
        equipes: [
          {
            id: 'equipe-1',
            nome: 'Equipe A',
            pessoas: [],
            maquinas: [{ id: 'maquina-1', codigo: 'ESC-01', nome: 'Escavadeira 320D' }],
          },
        ],
        metas: [],
        valores_custo: [],
        soma_pesos_metas: 0,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'Valores' }).click()

  await expect(page.getByLabel('Função')).toBeVisible()
  await expect(page.getByLabel('Valor (R$/dia)')).toBeVisible()

  // "Tipo" e "Máquina" sao SelectField (Radix, nao <select> nativo) — abrir
  // via click e escolher a opcao por role, nao .selectOption() (nativo).
  await page.getByLabel('Tipo').click()
  await page.getByRole('option', { name: 'Equipamento' }).click()

  await expect(page.getByLabel('Função')).not.toBeVisible()
  await expect(page.getByLabel('Máquina')).toBeVisible()
  await expect(page.getByLabel('Valor (R$/hora)')).toBeVisible()

  await page.getByLabel('Máquina').click()
  await expect(page.getByRole('option', { name: 'Escavadeira 320D (ESC-01)' })).toBeVisible()
})
