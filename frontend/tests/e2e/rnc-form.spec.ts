import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const RNC_LIST_URL = '**/api/v1/projetos/*/rncs/'
const RNC_DETAIL_URL = '**/api/v1/rncs/rnc-1/'
const RNC_CONCLUIR_URL = '**/api/v1/rncs/rnc-1/concluir/'

const GERENTE = {
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

function rncBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rnc-1',
    projeto: 'projeto-1',
    numero_sequencial: 1,
    data_emissao: '2026-07-17',
    contratada: 'JM Engenharia',
    categoria: 'terraplenagem',
    origem: 'servico',
    gravidade: 'alta',
    tipo: 'ac',
    item: 'Cortes',
    subitem: '',
    norma: '',
    requisito: '',
    abrangencia: '',
    km: '',
    reincidencia: false,
    descricao: 'Variação de produtividade.',
    acao_imediata: '',
    data_implementacao: null,
    responsavel_implementacao: '',
    causa_metodo: false,
    causa_metodo_detalhe: '',
    causa_material: false,
    causa_material_detalhe: '',
    causa_mao_de_obra: false,
    causa_mao_de_obra_detalhe: '',
    causa_maquina: false,
    causa_maquina_detalhe: '',
    causa_medicao: false,
    causa_medicao_detalhe: '',
    causa_meio_ambiente: false,
    causa_meio_ambiente_detalhe: '',
    data_prazo: null,
    status: 'pendente',
    status_efetivo: 'pendente',
    eficacia: '',
    data_conclusao: null,
    criado_por: 1,
    created_at: '2026-07-17T18:00:00Z',
    updated_at: '2026-07-17T18:00:00Z',
    acoes_corretivas: [],
    ...overrides,
  }
}

test('gerente cria uma RNC completa', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: GERENTE }, meta: { is_authenticated: true } } }),
  )
  await page.route(RNC_LIST_URL, (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, json: rncBase() })
    }
    return route.fulfill({ json: [] })
  })

  await page.goto('/projetos/projeto-1/rncs/novo')

  await page.getByLabel('Data de emissão').fill('2026-07-17')
  await page.getByLabel('Contratada').fill('JM Engenharia')
  await page.getByLabel('Categoria').selectOption('terraplenagem')
  await page.getByLabel('Item', { exact: true }).selectOption('Cortes')
  await page.getByLabel('Descrição').fill('Variação de produtividade.')
  await page.getByRole('button', { name: 'Criar RNC' }).click()

  await expect(page).toHaveURL('/projetos/projeto-1/rncs/rnc-1')
})

test('causa raiz mostra campo de detalhe só quando marcada', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: GERENTE }, meta: { is_authenticated: true } } }),
  )
  await page.route(RNC_LIST_URL, (route) => route.fulfill({ json: [] }))

  await page.goto('/projetos/projeto-1/rncs/novo')

  await expect(page.getByLabel('Detalhe: Método')).not.toBeVisible()
  await page.getByLabel('Método (processo)').check()
  await expect(page.getByLabel('Detalhe: Método')).toBeVisible()
})

test('rnc concluida nao mostra campos editaveis nem formulario de nova acao', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: GERENTE }, meta: { is_authenticated: true } } }),
  )
  await page.route(RNC_DETAIL_URL, (route) => route.fulfill({ json: rncBase({ status: 'concluida', eficacia: 'eficaz' }) }))

  await page.goto('/projetos/projeto-1/rncs/rnc-1')

  await expect(page.getByText('Esta RNC já foi concluída e não pode mais ser editada.')).toBeVisible()
  await expect(page.getByLabel('Descrição')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Adicionar ação corretiva' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar alterações' })).not.toBeVisible()
})

test('auxiliar administrativo recebe acesso restrito na rota de formulario', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({
      json: {
        status: 200,
        data: {
          user: {
            id: '2',
            email: 'auxiliar@empresaA.example.com',
            nome: 'Auxiliar Empresa A',
            perfil: 'auxiliar_administrativo',
            empresa: 'uuid-empresa-a',
            empresa_nome: 'Empresa A',
          },
        },
        meta: { is_authenticated: true },
      },
    }),
  )

  await page.goto('/projetos/projeto-1/rncs/novo')

  await expect(page.getByText('Esta tela é restrita ao perfil Gerente.')).toBeVisible()
})

test('concluir rnc pendente envia eficacia selecionada', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: GERENTE }, meta: { is_authenticated: true } } }),
  )
  let ultimoBodyEnviado = ''
  await page.route(RNC_DETAIL_URL, (route) => route.fulfill({ json: rncBase() }))
  await page.route(RNC_CONCLUIR_URL, (route) => {
    ultimoBodyEnviado = route.request().postData() ?? ''
    return route.fulfill({ json: rncBase({ status: 'concluida', eficacia: 'ineficaz' }) })
  })

  await page.goto('/projetos/projeto-1/rncs/rnc-1')
  await page.getByLabel('Eficácia').selectOption('ineficaz')
  await page.getByRole('button', { name: 'Concluir RNC' }).click()

  await expect.poll(() => ultimoBodyEnviado).toContain('ineficaz')
})
