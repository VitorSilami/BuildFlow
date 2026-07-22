import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const CONFIG_URL = '**/api/v1/projetos/*/configuracao-rdo/'
const RDO_CREATE_URL = '**/api/v1/projetos/*/registros-diarios/'
const RDO_DETAIL_URL = '**/api/v1/registros-diarios/rdo-1/'
const FOTO_URL = '**/api/v1/registros-diarios/*/fotos/'

const USUARIO = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

const CONFIGURACAO = {
  disciplinas: [
    { id: 'disc-1', nome: 'Terraplenagem', servicos: [{ id: 'serv-1', nome: 'Corte', unidade: 1 }] },
  ],
  unidades: [{ id: 1, sigla: 'm³', descricao: 'metro cúbico' }],
  equipes: [
    {
      id: 'equipe-1',
      nome: 'Equipe A',
      pessoas: [{ id: 'pessoa-1', nome: 'João', funcao: 'Ajudante' }],
      maquinas: [{ id: 'maquina-1', codigo: 'ESC-01', nome: 'Escavadeira' }],
    },
  ],
  motivos_parada: [{ id: 1, descricao: 'Chuva' }],
  fiscais: [{ id: 1, nome: 'Gerente Empresa A', email: 'gerente@empresaA.example.com' }],
}

const RDO_CRIADO = {
  id: 'rdo-1',
  data_referencia: '2026-07-17',
  turno: 'diurno',
  clima: 'sol',
  equipe_nome: 'Equipe A',
  fiscal_nome: 'Gerente Empresa A',
  producoes: [
    {
      rodovia: 'BR-365',
      km_inicial: '10.000',
      km_final: '10.500',
      quantidade: '500',
      disciplina_nome: 'Terraplenagem',
      servico_nome: 'Corte',
      unidade_sigla: 'm³',
    },
  ],
  presencas: [{ nome_avulso: 'João Ajudante', funcao: 'Ajudante', status: 'presente' }],
  maquinas: [
    {
      identificacao_avulsa: 'Escavadeira 01',
      horas_produtivas: '6',
      horas_paradas: '0',
      eficiencia: 1,
    },
  ],
  ocorrencias: [],
  fotos: [],
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

async function mockRotasBasicas(page: import('@playwright/test').Page) {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) => route.fulfill({ json: CONFIGURACAO }))
  await page.route(RDO_DETAIL_URL, (route) => route.fulfill({ json: RDO_CRIADO }))
}

test('preencher wizard completo de RDO, ver o detalhe e anexar foto', async ({ page }) => {
  await mockRotasBasicas(page)
  await page.route(RDO_CREATE_URL, (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    return route.fulfill({ status: 201, json: RDO_CRIADO })
  })
  await page.route(FOTO_URL, (route) =>
    route.fulfill({ status: 201, json: { id: 'foto-1', arquivo: '/media/foto.png', km: '10.250', created_at: '2026-07-17T00:00:00Z' } }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios/novo')

  // Passo 1: Gerais
  await page.getByLabel('Data').fill('2026-07-17')
  await page.getByLabel('Equipe', { exact: true }).selectOption('equipe-1')
  await page.getByLabel('Fiscal').selectOption('1')
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Passo 2: Produção
  await page.getByLabel('Rodovia').fill('BR-365')
  await page.getByLabel('Disciplina').selectOption('disc-1')
  await page.getByLabel('Serviço').selectOption('serv-1')
  await page.getByLabel('Km inicial').fill('10.000')
  await page.getByLabel('Km final').fill('10.500')
  await page.getByLabel('Quantidade').fill('500')
  await page.getByLabel('Unidade').selectOption('1')
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Passo 3: Equipe
  await page.getByLabel('Nome (avulso)').fill('João Ajudante')
  await page.getByLabel('Função').fill('Ajudante')
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Passo 4: Máquinas
  await page.getByLabel('Identificação (avulsa)').fill('Escavadeira 01')
  await page.getByLabel('Horas produtivas', { exact: true }).fill('6')
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Passo 5: Ocorrências (nenhuma)
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Passo 6: Revisão
  await page.getByRole('button', { name: 'Salvar registro diário' }).click()

  // Apos salvar, navega para a tela de detalhe do RDO (nao fica so numa
  // mensagem solta — o registro fica de fato visivel/consultavel).
  await expect(page).toHaveURL(/\/registros-diarios\/rdo-1$/)
  await expect(page.getByRole('heading', { name: /Registro diário/ })).toBeVisible()

  // Momento de "dopamina": toast de sucesso aparece antes/durante a navegacao
  // pro detalhe (nao so a navegacao silenciosa que ja existia). Escopado pra
  // regiao do ToastViewport — o anunciador aria-live do Radix duplica o texto
  // num node separado, e usar .first() dependeria de ordem de montagem no DOM.
  await expect(
    page.getByRole('region', { name: /Notifications/ }).getByText('Registro diário salvo'),
  ).toBeVisible()

  const fileInput = page.locator('#foto-arquivo')
  await fileInput.setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
        '1f15c4890000000a4944415478da630001000005000105e2ff' +
        '000000004945454e44ae426082',
      'hex',
    ),
  })
  await page.getByRole('button', { name: 'Anexar foto' }).click()
})

test('trocar de nome avulso para pessoa cadastrada limpa o campo avulso', async ({ page }) => {
  // Regressao: digitar um nome avulso e depois escolher uma pessoa cadastrada
  // deixava os dois campos preenchidos, violando a regra XOR (bug real
  // encontrado em teste manual, 2026-07-17).
  await mockRotasBasicas(page)

  let payloadRecebido: Record<string, unknown> | null = null
  await page.route(RDO_CREATE_URL, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    payloadRecebido = route.request().postDataJSON()
    return route.fulfill({ status: 201, json: RDO_CRIADO })
  })

  await page.goto('/projetos/projeto-1/registros-diarios/novo')

  await page.getByLabel('Data').fill('2026-07-17')
  await page.getByLabel('Equipe', { exact: true }).selectOption('equipe-1')
  await page.getByLabel('Fiscal').selectOption('1')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByLabel('Rodovia').fill('BR-365')
  await page.getByLabel('Disciplina').selectOption('disc-1')
  await page.getByLabel('Serviço').selectOption('serv-1')
  await page.getByLabel('Km inicial').fill('10.000')
  await page.getByLabel('Km final').fill('10.500')
  await page.getByLabel('Quantidade').fill('500')
  await page.getByLabel('Unidade').selectOption('1')
  await page.getByRole('button', { name: 'Próximo' }).click()

  // Digita um nome avulso primeiro...
  await page.getByLabel('Nome (avulso)').fill('Nome Digitado Errado')
  // ...depois muda de ideia e escolhe a pessoa cadastrada.
  await page.getByLabel('Pessoa cadastrada').selectOption('pessoa-1')
  await page.getByLabel('Função').fill('Ajudante')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByLabel('Identificação (avulsa)').fill('Escavadeira 01')
  await page.getByLabel('Horas produtivas', { exact: true }).fill('6')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByRole('button', { name: 'Salvar registro diário' }).click()

  await expect(page).toHaveURL(/\/registros-diarios\/rdo-1$/)
  const presencas = (payloadRecebido as { presencas: { pessoa?: string; nome_avulso?: string }[] })
    .presencas
  expect(presencas[0].pessoa).toBe('pessoa-1')
  expect(presencas[0].nome_avulso).toBeFalsy()
})

test('grupos de botões de turno e clima atualizam a seleção e enviam no payload', async ({ page }) => {
  await mockRotasBasicas(page)

  let payloadRecebido: Record<string, unknown> | null = null
  await page.route(RDO_CREATE_URL, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    payloadRecebido = route.request().postDataJSON()
    return route.fulfill({ status: 201, json: RDO_CRIADO })
  })

  await page.goto('/projetos/projeto-1/registros-diarios/novo')

  await page.getByLabel('Data').fill('2026-07-17')
  await page.getByRole('button', { name: 'Noturno' }).click()
  await page.getByRole('button', { name: 'Chuva', exact: true }).click()
  await page.getByLabel('Equipe', { exact: true }).selectOption('equipe-1')
  await page.getByLabel('Fiscal').selectOption('1')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByLabel('Rodovia').fill('BR-365')
  await page.getByLabel('Disciplina').selectOption('disc-1')
  await page.getByLabel('Serviço').selectOption('serv-1')
  await page.getByLabel('Km inicial').fill('10.000')
  await page.getByLabel('Km final').fill('10.500')
  await page.getByLabel('Quantidade').fill('500')
  await page.getByLabel('Unidade').selectOption('1')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByLabel('Nome (avulso)').fill('João Ajudante')
  await page.getByLabel('Função').fill('Ajudante')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByLabel('Identificação (avulsa)').fill('Escavadeira 01')
  await page.getByLabel('Horas produtivas', { exact: true }).fill('6')
  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByRole('button', { name: 'Próximo' }).click()

  await page.getByRole('button', { name: 'Salvar registro diário' }).click()

  await expect(page).toHaveURL(/\/registros-diarios\/rdo-1$/)
  const payload = payloadRecebido as { turno: string; clima: string }
  expect(payload.turno).toBe('noturno')
  expect(payload.clima).toBe('chuva')
})

test('duplicar dia anterior preenche equipe e fiscal do ultimo RDO', async ({ page }) => {
  await mockRotasBasicas(page)
  await page.route(RDO_CREATE_URL, (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{ ...RDO_CRIADO, equipe: 'equipe-1', fiscal: 1 }],
      },
    })
  })

  await page.goto('/projetos/projeto-1/registros-diarios/novo')

  await page.getByRole('button', { name: 'Duplicar dia anterior' }).click()

  await expect(page.getByLabel('Equipe', { exact: true })).toHaveValue('equipe-1')
  await expect(page.getByLabel('Fiscal')).toHaveValue('1')
})

test('data vem pre-preenchida quando a URL tem o parametro data', async ({ page }) => {
  await mockRotasBasicas(page)

  await page.goto('/projetos/projeto-1/registros-diarios/novo?data=2026-07-20')

  await expect(page.getByLabel('Data')).toHaveValue('2026-07-20')
})
