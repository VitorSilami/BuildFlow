import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const REGISTROS_URL = '**/api/v1/projetos/*/registros-diarios/**'

const FISCAL = {
  id: '1',
  email: 'fiscal@empresaA.example.com',
  nome: 'Fiscal Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

const OUTRO_USUARIO = {
  id: '2',
  email: 'auxiliar@empresaA.example.com',
  nome: 'Auxiliar Empresa A',
  perfil: 'auxiliar_administrativo',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

function rdoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rdo-1',
    data_referencia: '2026-07-17',
    turno: 'diurno',
    clima: 'sol',
    equipe: 'equipe-1',
    fiscal: 1,
    autor: 2,
    status: 'aguardando_aprovacao',
    motivo_rejeicao: '',
    aprovado_em: null,
    created_at: '2026-07-17T18:42:00Z',
    updated_at: '2026-07-17T18:42:00Z',
    producoes: [],
    presencas: [],
    maquinas: [],
    ocorrencias: [],
    fotos: [],
    ...overrides,
  }
}

test('fiscal aprova um rdo aguardando aprovacao', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: FISCAL }, meta: { is_authenticated: true } } }),
  )
  let rdo = rdoBase()
  await page.route(REGISTROS_URL, (route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (method === 'POST' && url.endsWith('/aprovar/')) {
      rdo = { ...rdo, status: 'aprovado', aprovado_em: '2026-07-18T09:00:00Z' }
      return route.fulfill({ json: rdo })
    }
    return route.fulfill({ json: [rdo] })
  })

  await page.goto('/projetos/projeto-1/historico-aprovacoes')

  // Escopado à linha do RDO: os pílulos de filtro ("Aguardando Aprovação",
  // "Aprovado", "Rejeitado") reusam os mesmos rótulos e ficam sempre visíveis,
  // então um getByText solto na página colide com eles (strict mode).
  const linhaRdo = page.getByRole('button', { name: /17\/07\/2026 · diurno/ })

  await expect(linhaRdo.getByText('Aguardando Aprovação', { exact: true })).toBeVisible()
  await linhaRdo.click()
  await page.getByRole('button', { name: 'Aprovar RDO' }).click()

  await expect(linhaRdo.getByText('Aprovado', { exact: true })).toBeVisible()
})

test('usuario que nao e o fiscal nao ve botoes de decisao', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({
      json: { status: 200, data: { user: OUTRO_USUARIO }, meta: { is_authenticated: true } },
    }),
  )
  const rdo = rdoBase()
  await page.route(REGISTROS_URL, (route) => route.fulfill({ json: [rdo] }))

  await page.goto('/projetos/projeto-1/historico-aprovacoes')
  await page.getByText('17/07/2026 · diurno').click()

  await expect(page.getByRole('button', { name: 'Aprovar RDO' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Rejeitar' })).not.toBeVisible()
})

test('rejeitar exige motivo antes de confirmar', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: FISCAL }, meta: { is_authenticated: true } } }),
  )
  let rdo = rdoBase()
  await page.route(REGISTROS_URL, (route) => {
    if (route.request().method() === 'POST') {
      rdo = { ...rdo, status: 'rejeitado', motivo_rejeicao: 'Faltam fotos.' }
      return route.fulfill({ json: rdo })
    }
    return route.fulfill({ json: [rdo] })
  })

  await page.goto('/projetos/projeto-1/historico-aprovacoes')
  const linhaRdo = page.getByRole('button', { name: /17\/07\/2026 · diurno/ })
  await linhaRdo.click()
  await page.getByRole('button', { name: 'Rejeitar' }).click()

  const confirmar = page.getByRole('button', { name: 'Confirmar rejeição' })
  await expect(confirmar).toBeDisabled()

  await page.getByLabel('Motivo da rejeição').fill('Faltam fotos.')
  await expect(confirmar).toBeEnabled()
  await confirmar.click()

  await expect(linhaRdo.getByText('Rejeitado', { exact: true })).toBeVisible()
})

test('kpis refletem as contagens do mes', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: FISCAL }, meta: { is_authenticated: true } } }),
  )
  const lista = [
    rdoBase({ id: 'rdo-1', status: 'aguardando_aprovacao' }),
    rdoBase({ id: 'rdo-2', status: 'aprovado', data_referencia: '2026-07-10' }),
    rdoBase({ id: 'rdo-3', status: 'rejeitado', data_referencia: '2026-07-05' }),
  ]
  await page.route(REGISTROS_URL, (route) => route.fulfill({ json: lista }))

  await page.goto('/projetos/projeto-1/historico-aprovacoes')

  await expect(page.getByText('Taxa de aprovação')).toBeVisible()
  await expect(page.getByText('50%')).toBeVisible()
})
