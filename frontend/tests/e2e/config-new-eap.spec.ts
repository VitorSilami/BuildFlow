import { expect, test, type Page } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const CONFIG_URL = '**/api/v1/projetos/*/configuracao/'
const CONFIG_RDO_URL = '**/api/v1/projetos/*/configuracao-rdo/'
const DISCIPLINAS_URL = '**/api/v1/projetos/*/configuracao/disciplinas/'
const PROJETO_DETALHE_URL = '**/api/v1/projetos/*/'
const EAP_URL = '/projetos/projeto-1/planejamento/eap'

const USUARIO = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
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

function disciplinaMock(peso = '100.00') {
  return {
    id: 'disc-1',
    nome: 'Terraplenagem',
    peso_percentual: peso,
    avanco_percentual: '25.00',
    avanco_previsto_percentual: '60.00',
    status_eap: 'atencao',
    data_inicio_prevista: '2026-01-01',
    data_fim_prevista: '2026-03-01',
    subdisciplinas: [],
    servicos: [
      {
        id: 'serv-1',
        nome: 'Corte',
        unidade: 1,
        peso_percentual: '100.00',
        quantidade_planejada: '1000.000',
        quantidade_executada_manual: '250.000',
        quantidade_executada: '250.000',
        producoes_vinculadas: [],
        carta_controle: null,
        avanco_percentual: '25.00',
        avanco_previsto_percentual: '60.00',
        data_inicio_prevista: '2026-01-01',
        data_fim_prevista: '2026-03-01',
        status_eap: 'atencao',
      },
    ],
  }
}

function disciplinaCriticaMock() {
  return {
    ...disciplinaMock('20.00'),
    id: 'disc-2',
    nome: 'Drenagem',
    avanco_percentual: '10.00',
    avanco_previsto_percentual: '35.00',
    status_eap: 'critico',
    servicos: [
      {
        id: 'serv-2',
        nome: 'Bueiro celular',
        unidade: 1,
        peso_percentual: '100.00',
        quantidade_planejada: '80.000',
        quantidade_executada_manual: '0.000',
        quantidade_executada: '10.000',
        producoes_vinculadas: [],
        carta_controle: null,
        avanco_percentual: '12.50',
        avanco_previsto_percentual: '40.00',
        data_inicio_prevista: '2026-02-01',
        data_fim_prevista: '2026-04-01',
        status_eap: 'critico',
      },
    ],
  }
}

async function mockConfiguracaoComEap(page: Page, pesoDisciplina = '100.00') {
  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [disciplinaMock(pesoDisciplina), disciplinaCriticaMock()],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: Number(pesoDisciplina) + 20,
      },
    }),
  )
}

test.beforeEach(async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(PROJETO_DETALHE_URL, (route) => route.fulfill({ json: PROJETO_MOCK }))
  await page.route(CONFIG_RDO_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [],
        unidades: [{ id: 1, sigla: 'm³', descricao: 'metro cúbico' }],
        equipes: [],
        motivos_parada: [],
        fiscais: [],
      },
    }),
  )
})

test('filtra cronograma e estrutura por status operacional', async ({ page }) => {
  await mockConfiguracaoComEap(page, '80.00')

  await page.goto(EAP_URL)

  await page.getByLabel('Status').click()
  await page.getByRole('option', { name: 'Crítico' }).click()

  await page.getByRole('tab', { name: 'Estrutura da EAP' }).click()
  const tabelaEstrutura = page.getByRole('table', { name: 'Estrutura hierárquica da EAP' })
  await expect(tabelaEstrutura.getByText('Drenagem')).toBeVisible()
  await expect(tabelaEstrutura.getByText('Bueiro celular')).toBeVisible()
  await expect(tabelaEstrutura.getByText('Terraplenagem')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Cronograma' }).click()
  await page.getByLabel('Buscar etapa').fill('sem resultado')
  await expect(page.getByText('Sem datas planejadas')).toBeVisible()
})

test('tabs internas funcionam por teclado', async ({ page }) => {
  await mockConfiguracaoComEap(page, '80.00')

  await page.goto(EAP_URL)

  const dependenciasTab = page.getByRole('tab', { name: 'Dependências' })
  await dependenciasTab.focus()
  await page.keyboard.press('Enter')

  await expect(dependenciasTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Dependências ainda não configuradas')).toBeVisible()
})

test('cancela edição de pesos sem enviar patch', async ({ page }) => {
  let payloadRecebido: { peso_percentual?: string } | null = null
  await mockConfiguracaoComEap(page, '80.00')
  await page.route('**/api/v1/configuracoes/disciplinas/disc-1/', (route) => {
    payloadRecebido = route.request().postDataJSON() as { peso_percentual?: string }
    return route.fulfill({ json: disciplinaMock(payloadRecebido.peso_percentual) })
  })

  await page.goto(EAP_URL)
  await page.getByRole('tab', { name: 'Pesos' }).click()
  await page.getByRole('button', { name: 'Editar distribuição' }).click()
  await page.getByLabel('Peso de Terraplenagem').fill('70')

  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('dialog', { name: 'Descartar alterações?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar editando' }).click()
  await expect(page.getByLabel('Peso de Terraplenagem')).toHaveValue('70')

  await page.getByRole('button', { name: 'Cancelar' }).click()
  await page.getByRole('button', { name: 'Descartar' }).click()

  await expect(page.getByLabel('Peso de Terraplenagem')).toHaveCount(0)
  expect(payloadRecebido).toBeNull()
})

test('empty state permite criar a primeira etapa', async ({ page }) => {
  let etapaCriada = false
  let payloadRecebido: { nome?: string } | null = null

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: etapaCriada ? [disciplinaMock('100.00')] : [],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: etapaCriada ? 100 : 0,
      },
    }),
  )
  await page.route(DISCIPLINAS_URL, (route) => {
    payloadRecebido = route.request().postDataJSON() as { nome?: string }
    etapaCriada = true
    return route.fulfill({ status: 201, json: disciplinaMock('100.00') })
  })

  await page.goto(EAP_URL)

  await expect(page.getByText('EAP ainda não cadastrada')).toBeVisible()
  await page.getByRole('button', { name: 'Nova etapa' }).click()
  await page.getByLabel('Nova etapa').fill('Mobilização')
  await page.getByRole('button', { name: 'Criar etapa' }).click()

  await expect.poll(() => payloadRecebido).toEqual({ nome: 'Mobilização' })
  await expect(page.getByText('Avanço realizado')).toBeVisible()
})

test('captura visual mobile da EAP padrao', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockConfiguracaoComEap(page, '80.00')

  await page.goto(EAP_URL)
  await expect(page.getByRole('heading', { name: 'EAP e Cronograma', level: 2 })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Visões da EAP' })).toBeVisible()

  await testInfo.attach('eap-padrao-mobile', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
})

test('renderiza a EAP padrao e salva pesos em modo explícito', async ({ page }) => {
  let pesoDisciplina = '100.00'
  let payloadRecebido: { peso_percentual?: string } | null = null

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [disciplinaMock(pesoDisciplina)],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: Number(pesoDisciplina),
      },
    }),
  )

  await page.route('**/api/v1/configuracoes/disciplinas/disc-1/', (route) => {
    payloadRecebido = route.request().postDataJSON() as { peso_percentual?: string }
    pesoDisciplina = payloadRecebido.peso_percentual ?? pesoDisciplina
    return route.fulfill({ json: disciplinaMock(pesoDisciplina) })
  })

  await page.goto(EAP_URL)

  await expect(page.getByRole('heading', { name: 'EAP e Cronograma', level: 2 })).toBeVisible()
  await expect(page.getByText('Avanço realizado')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Estrutura hierárquica da EAP' })).toBeVisible()

  await page.getByRole('tab', { name: 'Cronograma' }).click()
  await expect(page.getByLabel('Cronograma da EAP')).toBeVisible()

  await page.getByRole('tab', { name: 'Estrutura da EAP' }).click()
  const tabelaEstrutura = page.getByRole('table', { name: 'Estrutura hierárquica da EAP' })
  await expect(tabelaEstrutura).toBeVisible()
  await expect(tabelaEstrutura.getByText('Terraplenagem')).toBeVisible()
  await expect(tabelaEstrutura.getByText('Corte')).toBeVisible()

  await page.getByRole('tab', { name: 'Pesos' }).click()
  await page.getByRole('button', { name: 'Editar distribuição' }).click()
  await page.getByLabel('Peso de Terraplenagem').fill('80')
  await expect(page.getByText('A soma dos pesos das etapas principais não fecha 100%.')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar alterações' }).click()

  await expect.poll(() => payloadRecebido).toEqual({ peso_percentual: '80' })
})
