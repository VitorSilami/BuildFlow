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

const PROJETO_DETALHE_URL = '**/api/v1/projetos/*/'
const PROJETO_MOCK = {
  id: 'projeto-1',
  nome: 'Duplicação Rodovia Norte',
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
