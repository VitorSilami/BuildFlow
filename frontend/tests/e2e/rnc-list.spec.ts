import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const RNC_LIST_URL = '**/api/v1/projetos/*/rncs/**'

const GERENTE = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

const AUXILIAR = {
  id: '2',
  email: 'auxiliar@empresaA.example.com',
  nome: 'Auxiliar Empresa A',
  perfil: 'auxiliar_administrativo',
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
    reincidencia: true,
    descricao: 'Variação de produtividade acima do aceitável no trecho.',
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

test('gerente ve kpis e lista de rncs do projeto', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: GERENTE }, meta: { is_authenticated: true } } }),
  )
  const lista = [
    rncBase({ id: 'rnc-1', status: 'pendente', status_efetivo: 'pendente' }),
    rncBase({ id: 'rnc-2', numero_sequencial: 2, status: 'concluida', status_efetivo: 'concluida', reincidencia: false }),
    rncBase({ id: 'rnc-3', numero_sequencial: 3, status: 'pendente', status_efetivo: 'prazo_excedido', reincidencia: false }),
  ]
  await page.route(RNC_LIST_URL, (route) => route.fulfill({ json: lista }))

  await page.goto('/projetos/projeto-1/rncs')

  await expect(page.getByText('Total de RNCs')).toBeVisible()
  await expect(page.getByText('RNC-001')).toBeVisible()

  // "Prazo excedido" aparece duas vezes na página: o rótulo do KPI e o badge
  // de status do card da RNC-003 — getByText exato colide nos dois. Escopamos
  // a busca ao link da RNC-003 para checar especificamente o badge dela.
  const cardRnc3 = page.getByRole('link', { name: /RNC-003/ })
  await expect(cardRnc3.getByText('Prazo excedido', { exact: true })).toBeVisible()
})

test('auxiliar administrativo nao ve o item no menu e recebe acesso restrito na rota', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: AUXILIAR }, meta: { is_authenticated: true } } }),
  )
  await page.route(RNC_LIST_URL, (route) => route.fulfill({ json: [] }))

  await page.goto('/projetos/projeto-1/registros-diarios')
  await expect(page.getByRole('link', { name: 'RNCs' })).not.toBeVisible()

  await page.goto('/projetos/projeto-1/rncs')
  await expect(page.getByText('Esta tela é restrita ao perfil Gerente.')).toBeVisible()
})

test('filtro por status pendente atualiza a query', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: GERENTE }, meta: { is_authenticated: true } } }),
  )
  let ultimaUrl = ''
  await page.route(RNC_LIST_URL, (route) => {
    ultimaUrl = route.request().url()
    return route.fulfill({ json: [rncBase()] })
  })

  await page.goto('/projetos/projeto-1/rncs')
  await page.getByRole('button', { name: 'Pendentes' }).click()

  await expect.poll(() => ultimaUrl).toContain('status=pendente')
})
