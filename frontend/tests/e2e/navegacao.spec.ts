import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const PROJETOS_URL = '**/api/v1/projetos/**'

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

async function mockSessao(page: import('@playwright/test').Page, user: typeof GERENTE) {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user }, meta: { is_authenticated: true } } }),
  )
}

async function mockProjetos(page: import('@playwright/test').Page) {
  await page.route(PROJETOS_URL, (route) => {
    if (route.request().url().endsWith('/projeto-1/')) {
      return route.fulfill({ json: PROJETO_MOCK })
    }
    return route.fulfill({
      json: { count: 1, next: null, previous: null, results: [PROJETO_MOCK] },
    })
  })
}

test('sem projeto aberto, sidebar mostra so o nivel Empresa', async ({ page }) => {
  await mockSessao(page, GERENTE)
  await mockProjetos(page)

  await page.goto('/dashboard')

  const sidebar = page.getByRole('navigation')
  await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Projetos' })).toBeVisible()
  await expect(sidebar.getByText('Operação')).not.toBeVisible()
})

test('com projeto aberto, sidebar mostra os grupos Operacao, Gestao e Administracao', async ({ page }) => {
  await mockSessao(page, GERENTE)
  await mockProjetos(page)
  await page.route('**/api/v1/projetos/projeto-1/registros-diarios/**', (route) =>
    route.fulfill({ json: [] }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  const sidebar = page.getByRole('navigation')
  await expect(sidebar.getByText('Operação')).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Registros diários' })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Histórico & Aprovações' })).toBeVisible()
  await expect(sidebar.getByText('Gestão')).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'RNCs' })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Custos & Ociosidade' })).toBeVisible()
  await expect(sidebar.getByText('Administração')).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Configurações' })).toBeVisible()
})

test('perfil auxiliar nao ve o grupo Gestao', async ({ page }) => {
  await mockSessao(page, AUXILIAR)
  await mockProjetos(page)
  await page.route('**/api/v1/projetos/projeto-1/registros-diarios/**', (route) =>
    route.fulfill({ json: [] }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  const sidebar = page.getByRole('navigation')
  await expect(sidebar.getByText('Gestão')).not.toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'RNCs' })).not.toBeVisible()
})

test('clicar no titulo do grupo colapsa e expande os itens', async ({ page }) => {
  await mockSessao(page, GERENTE)
  await mockProjetos(page)
  await page.route('**/api/v1/projetos/projeto-1/registros-diarios/**', (route) =>
    route.fulfill({ json: [] }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  const sidebar = page.getByRole('navigation')
  const itemRegistros = sidebar.getByRole('link', { name: 'Registros diários' })
  await expect(itemRegistros).toBeVisible()

  await sidebar.getByRole('button', { name: 'Operação' }).click()
  await expect(itemRegistros).not.toBeVisible()

  await sidebar.getByRole('button', { name: 'Operação' }).click()
  await expect(itemRegistros).toBeVisible()
})

test('sidebar nao exibe card de contexto do projeto', async ({ page }) => {
  await mockSessao(page, GERENTE)
  await mockProjetos(page)
  await page.route('**/api/v1/projetos/projeto-1/registros-diarios/**', (route) =>
    route.fulfill({ json: [] }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  const sidebar = page.getByRole('navigation', { name: 'Navegação principal' })
  await expect(sidebar.getByRole('button', { name: 'Trocar de projeto' })).not.toBeVisible()
  await expect(sidebar.getByText('Duplicação BR-365')).not.toBeVisible()
})

test('breadcrumb mostra o nome do projeto e linka para o projeto', async ({ page }) => {
  await mockSessao(page, GERENTE)
  await mockProjetos(page)
  await page.route('**/api/v1/projetos/projeto-1/registros-diarios/**', (route) =>
    route.fulfill({ json: [] }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
  await expect(breadcrumb.getByText('Projetos')).toBeVisible()
  const linkProjeto = breadcrumb.getByRole('link', { name: 'Duplicação BR-365' })
  await expect(linkProjeto).toBeVisible()
  await expect(linkProjeto).toHaveAttribute('href', '/projetos/projeto-1/registros-diarios')
  await expect(breadcrumb.getByText('Registros diários')).toBeVisible()
})
