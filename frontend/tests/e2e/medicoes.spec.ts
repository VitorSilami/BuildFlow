import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const PROJETO_DETALHE_URL = '**/api/v1/projetos/*/'
const CONFIG_RDO_URL = '**/api/v1/projetos/*/configuracao-rdo/'
const MEDICOES_URL = '**/api/v1/projetos/*/medicoes/'

const USUARIO_GERENTE = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

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
  await page.route(SESSION_URL, (route) =>
    route.fulfill({
      json: { status: 200, data: { user: USUARIO_GERENTE }, meta: { is_authenticated: true } },
    }),
  )
  await page.route(PROJETO_DETALHE_URL, (route) => route.fulfill({ json: PROJETO_MOCK }))
  await page.route(CONFIG_RDO_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [],
        unidades: [],
        equipes: [],
        motivos_parada: [],
        fiscais: [{ id: 2, nome: 'Fiscal da Obra', email: 'fiscal@empresaA.example.com' }],
      },
    }),
  )
})

test('lista vazia mostra estado vazio e cria uma nova medição', async ({ page }) => {
  let medicaoCriada = false
  const medicaoMock = {
    id: 'medicao-1',
    data_corte: '2026-07-31',
    fiscal: 2,
    fiscal_nome: 'Fiscal da Obra',
    criado_por: 1,
    criado_por_nome: 'Gerente Empresa A',
    status: 'aguardando_aprovacao',
    motivo_rejeicao: '',
    aprovado_em: null,
    created_at: '2026-07-31T10:00:00Z',
    itens: [],
    valor_total: '0',
    quantidade_itens_sem_preco: 0,
  }

  await page.route(MEDICOES_URL, (route) => {
    if (route.request().method() === 'POST') {
      medicaoCriada = true
      return route.fulfill({ status: 201, json: medicaoMock })
    }
    return route.fulfill({ json: medicaoCriada ? [medicaoMock] : [] })
  })
  await page.route('**/api/v1/projetos/*/medicoes/medicao-1/', (route) =>
    route.fulfill({ json: medicaoMock }),
  )

  await page.goto('/projetos/projeto-1/medicoes')

  await expect(page.getByText('Nenhuma medição criada ainda.')).toBeVisible()

  await page.getByRole('button', { name: 'Nova medição' }).click()
  await page.getByLabel('Fiscal').click()
  await page.getByRole('option', { name: 'Fiscal da Obra' }).click()
  await page.getByRole('button', { name: 'Criar medição' }).click()

  await expect(page).toHaveURL('/projetos/projeto-1/medicoes/medicao-1')
})

test('botão de nova medição fica desabilitado quando já existe uma pendente', async ({ page }) => {
  await page.route(MEDICOES_URL, (route) =>
    route.fulfill({
      json: [
        {
          id: 'medicao-1',
          data_corte: '2026-07-31',
          fiscal: 2,
          fiscal_nome: 'Fiscal da Obra',
          criado_por: 1,
          criado_por_nome: 'Gerente Empresa A',
          status: 'aguardando_aprovacao',
          motivo_rejeicao: '',
          aprovado_em: null,
          created_at: '2026-07-31T10:00:00Z',
          itens: [],
          valor_total: '0',
          quantidade_itens_sem_preco: 0,
        },
      ],
    }),
  )

  await page.goto('/projetos/projeto-1/medicoes')

  await expect(page.getByRole('button', { name: 'Nova medição' })).toBeDisabled()
})

test('fiscal aprova uma medição pendente', async ({ page }) => {
  const medicaoMock = {
    id: 'medicao-1',
    data_corte: '2026-07-31',
    fiscal: 1,
    fiscal_nome: 'Gerente Empresa A',
    criado_por: 1,
    criado_por_nome: 'Gerente Empresa A',
    status: 'aguardando_aprovacao',
    motivo_rejeicao: '',
    aprovado_em: null,
    created_at: '2026-07-31T10:00:00Z',
    itens: [
      {
        id: 'item-1',
        servico: 'servico-1',
        servico_nome: 'Corte',
        disciplina_nome: 'Terraplenagem',
        quantidade_anterior: '0.000',
        quantidade_acumulada: '100.000',
        quantidade_periodo: '100.000',
        preco_unitario_snapshot: '10.00',
        valor_periodo: '1000.00',
      },
    ],
    valor_total: '1000.00',
    quantidade_itens_sem_preco: 0,
  }

  await page.route('**/api/v1/projetos/*/medicoes/medicao-1/', (route) => {
    if (route.request().method() !== 'DELETE') return route.fulfill({ json: medicaoMock })
    return route.fulfill({ status: 204 })
  })
  await page.route('**/api/v1/projetos/*/medicoes/medicao-1/aprovar/', (route) =>
    route.fulfill({ json: { ...medicaoMock, status: 'aprovado', aprovado_em: '2026-07-31T12:00:00Z' } }),
  )

  await page.goto('/projetos/projeto-1/medicoes/medicao-1')

  await expect(page.getByText('Corte')).toBeVisible()
  await expect(page.getByText('R$ 1.000,00').first()).toBeVisible()

  await page.getByRole('button', { name: 'Aprovar medição' }).click()

  await expect(page.getByText('Aprovado', { exact: true })).toBeVisible()
})
