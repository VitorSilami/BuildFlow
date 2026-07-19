import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const DASHBOARD_URL = '**/api/v1/dashboard/*'
const PROJETOS_URL = '**/api/v1/projetos/*'

const USUARIO_EMPRESA_A = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

async function mockAuthenticated(page: import('@playwright/test').Page) {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({
      json: { status: 200, data: { user: USUARIO_EMPRESA_A }, meta: { is_authenticated: true } },
    }),
  )
}

test('dashboard mostra resumo, projetos ativos e alertas', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(DASHBOARD_URL, (route) =>
    route.fulfill({
      json: {
        projetos_ativos: 1,
        projetos_pausados: 0,
        projetos_concluidos: 0,
        execucao_media: '40.00',
        projetos: [
          { id: 'projeto-1', nome: 'Duplicação BR-365', status: 'ativo', execucao_percentual: '40.00' },
        ],
        alertas: [{ projeto_id: 'projeto-1', projeto_nome: 'Duplicação BR-365', dias_sem_rdo: 9 }],
      },
    }),
  )

  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('40.00%').first()).toBeVisible()
  await expect(page.getByText('9 dias sem RDO')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Duplicação BR-365' }).first()).toBeVisible()
})

test('dashboard sem projetos ativos mostra estado vazio', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(DASHBOARD_URL, (route) =>
    route.fulfill({
      json: {
        projetos_ativos: 0,
        projetos_pausados: 0,
        projetos_concluidos: 0,
        execucao_media: null,
        projetos: [],
        alertas: [],
      },
    }),
  )

  await page.goto('/dashboard')

  await expect(page.getByText('Nenhum projeto ativo ainda.')).toBeVisible()
  // exact: true evita colisao com o em-dash que tambem aparece no texto do
  // Topbar ("Empresa A — Gerente Empresa A (gerente)").
  await expect(page.getByText('—', { exact: true })).toBeVisible()
})

test('busca no Topbar filtra projetos e navega ao clicar', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(DASHBOARD_URL, (route) =>
    route.fulfill({
      json: {
        projetos_ativos: 0,
        projetos_pausados: 0,
        projetos_concluidos: 0,
        execucao_media: null,
        projetos: [],
        alertas: [],
      },
    }),
  )
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 'projeto-1', nome: 'Duplicação BR-365', descricao: '', criado_por: 1 }],
      },
    }),
  )

  await page.goto('/dashboard')
  await page.getByLabel('Buscar projeto').fill('Duplic')

  await expect(page.getByRole('link', { name: 'Duplicação BR-365' })).toBeVisible()
  await page.getByRole('link', { name: 'Duplicação BR-365' }).click()

  await expect(page).toHaveURL(/\/projetos\/projeto-1\/registros-diarios$/)
})
