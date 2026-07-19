import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
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

test('lista vazia mostra estado vazio e permite criar o primeiro projeto', async ({ page }) => {
  await mockAuthenticated(page)

  let projetoCriado = false
  await page.route(PROJETOS_URL, (route) => {
    if (route.request().method() === 'POST') {
      projetoCriado = true
      return route.fulfill({
        status: 201,
        json: {
          id: 'novo-projeto',
          nome: 'Duplicação BR-365',
          descricao: '',
          numero_contrato: '',
          trecho: '',
          engenheiro_responsavel: '',
          status: 'ativo',
          execucao_percentual: null,
          criado_por: 1,
        },
      })
    }
    const results = projetoCriado
      ? [
          {
            id: 'novo-projeto',
            nome: 'Duplicação BR-365',
            descricao: '',
            numero_contrato: '',
            trecho: '',
            engenheiro_responsavel: '',
            status: 'ativo',
            execucao_percentual: null,
            criado_por: 1,
          },
        ]
      : []
    return route.fulfill({ json: { count: results.length, next: null, previous: null, results } })
  })

  await page.goto('/projetos')

  await expect(page.getByText('Nenhum projeto ainda')).toBeVisible()

  await page.getByRole('button', { name: 'Novo Projeto' }).click()
  await page.getByLabel('Nome do projeto').fill('Duplicação BR-365')
  await page.getByRole('button', { name: 'Criar projeto' }).click()

  await expect(page.getByText('Duplicação BR-365')).toBeVisible()
})

test('nome vazio é rejeitado com erro próximo ao campo', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } }),
  )

  await page.goto('/projetos')
  await page.getByRole('button', { name: 'Novo Projeto' }).click()
  await page.getByRole('button', { name: 'Criar projeto' }).click()

  await expect(page.getByRole('alert')).toContainText('obrigatório')
})

test('filtro por status mostra apenas projetos do status selecionado', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({
      json: {
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            id: 'projeto-ativo',
            nome: 'Duplicação BR-365',
            descricao: '',
            numero_contrato: '',
            trecho: '',
            engenheiro_responsavel: '',
            status: 'ativo',
            execucao_percentual: null,
            criado_por: 1,
          },
          {
            id: 'projeto-pausado',
            nome: 'Contorno BR-101',
            descricao: '',
            numero_contrato: '',
            trecho: '',
            engenheiro_responsavel: '',
            status: 'pausado',
            execucao_percentual: null,
            criado_por: 1,
          },
        ],
      },
    }),
  )

  await page.goto('/projetos')

  await expect(page.getByText('Duplicação BR-365')).toBeVisible()
  await expect(page.getByText('Contorno BR-101')).toBeVisible()

  await page.getByRole('tab', { name: 'Pausados' }).click()

  await expect(page.getByText('Contorno BR-101')).toBeVisible()
  await expect(page.getByText('Duplicação BR-365')).not.toBeVisible()
})
