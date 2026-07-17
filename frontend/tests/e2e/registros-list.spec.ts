import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const LIST_URL = '**/api/v1/projetos/*/registros-diarios/'
const DETAIL_URL = '**/api/v1/registros-diarios/rdo-1/'

const USUARIO = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

async function mockAuthenticated(page: import('@playwright/test').Page) {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
}

test('lista vazia mostra estado vazio e link para criar o primeiro registro', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(LIST_URL, (route) =>
    route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  await expect(page.getByText('Nenhum registro diário ainda')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Novo registro diário' })).toBeVisible()
})

test('lista mostra registros existentes e navega para o detalhe', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(LIST_URL, (route) =>
    route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 'rdo-1', data_referencia: '2026-07-17', turno: 'diurno', clima: 'sol' }],
      },
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

  await expect(page.getByRole('link', { name: /2026-07-17/ })).toBeVisible()
  await page.getByRole('link', { name: /2026-07-17/ }).click()

  await expect(page).toHaveURL(/\/registros-diarios\/rdo-1$/)
  await expect(page.getByText('BR-365')).toBeVisible()
})
