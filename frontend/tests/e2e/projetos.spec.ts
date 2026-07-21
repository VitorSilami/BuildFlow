import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
// Double-star: precisa casar tanto com a listagem (/api/v1/projetos/) quanto com
// URLs de item (/api/v1/projetos/{id}/, usadas pelo PATCH de edicao) — um unico
// `*` no final nao casa atraves da barra apos o id.
const PROJETOS_URL = '**/api/v1/projetos/**'

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
          ultimo_rdo_data: null,
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
            ultimo_rdo_data: null,
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
            ultimo_rdo_data: null,
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
            ultimo_rdo_data: null,
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

test('filtro sem projetos correspondentes mostra mensagem de vazio', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({
      json: {
        count: 1,
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
            ultimo_rdo_data: null,
            criado_por: 1,
          },
        ],
      },
    }),
  )

  await page.goto('/projetos')

  await expect(page.getByText('Duplicação BR-365')).toBeVisible()

  await page.getByRole('tab', { name: 'Concluídos' }).click()

  await expect(page.getByText('Nenhum projeto encontrado')).toBeVisible()
})

test('editar projeto abre modal preenchido e salva alterações', async ({ page }) => {
  await mockAuthenticated(page)

  let projetoAtualizado = false
  await page.route(PROJETOS_URL, (route) => {
    if (route.request().method() === 'PATCH') {
      projetoAtualizado = true
      return route.fulfill({
        status: 200,
        json: {
          id: 'projeto-1',
          nome: 'Duplicação BR-365 Renovada',
          descricao: '',
          numero_contrato: '',
          trecho: 'BR-365 · km 10-25',
          engenheiro_responsavel: '',
          status: 'pausado',
          execucao_percentual: null,
          ultimo_rdo_data: null,
          criado_por: 1,
        },
      })
    }
    const nome = projetoAtualizado ? 'Duplicação BR-365 Renovada' : 'Duplicação BR-365'
    const status = projetoAtualizado ? 'pausado' : 'ativo'
    return route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 'projeto-1',
            nome,
            descricao: '',
            numero_contrato: '',
            trecho: 'BR-365 · km 10-25',
            engenheiro_responsavel: '',
            status,
            execucao_percentual: null,
            ultimo_rdo_data: null,
            criado_por: 1,
          },
        ],
      },
    })
  })

  await page.goto('/projetos')
  await expect(page.getByText('Duplicação BR-365', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Editar Duplicação BR-365' }).click()
  await expect(page.getByLabel('Nome do projeto')).toHaveValue('Duplicação BR-365')

  await page.getByLabel('Nome do projeto').fill('Duplicação BR-365 Renovada')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()

  await expect(page.getByText('Duplicação BR-365 Renovada')).toBeVisible()
})

test('busca em texto filtra por nome, trecho ou engenheiro', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({
      json: {
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            id: 'projeto-1',
            nome: 'Duplicação BR-365',
            descricao: '',
            numero_contrato: '',
            trecho: 'BR-365 · km 10-25',
            engenheiro_responsavel: 'Eng. Carlos Mendes',
            status: 'ativo',
            execucao_percentual: null,
            ultimo_rdo_data: null,
            criado_por: 1,
          },
          {
            id: 'projeto-2',
            nome: 'Contorno BR-101',
            descricao: '',
            numero_contrato: '',
            trecho: 'BR-101 · km 40-55',
            engenheiro_responsavel: 'Eng. Ana Souza',
            status: 'ativo',
            execucao_percentual: null,
            ultimo_rdo_data: null,
            criado_por: 1,
          },
        ],
      },
    }),
  )

  await page.goto('/projetos')
  await expect(page.getByText('Duplicação BR-365', { exact: true })).toBeVisible()
  await expect(page.getByText('Contorno BR-101', { exact: true })).toBeVisible()

  await page.getByLabel('Buscar projetos').fill('Carlos')

  await expect(page.getByText('Duplicação BR-365', { exact: true })).toBeVisible()
  await expect(page.getByText('Contorno BR-101', { exact: true })).not.toBeVisible()
})

test('botao de editar fica oculto ate hover ou foco no card', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 'projeto-1', nome: 'Duplicação BR-365', trecho: '', engenheiro_responsavel: '', status: 'ativo', execucao_percentual: null, ultimo_rdo_data: null }],
      },
    }),
  )

  await page.goto('/projetos')

  const botaoEditar = page.getByRole('button', { name: 'Editar Duplicação BR-365' })
  await expect(botaoEditar).toHaveCSS('opacity', '0')

  await page.getByText('Duplicação BR-365').hover()
  await expect(botaoEditar).toHaveCSS('opacity', '1')
})
