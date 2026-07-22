import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const CONFIG_URL = '**/api/v1/projetos/*/configuracao/'
const CUSTOS_URL = '**/api/v1/projetos/*/custos-ociosidade/**'

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

const RESPOSTA_CUSTOS = {
  mes: '2026-07',
  custo_mao_de_obra: '5000.00',
  deficit_mao_de_obra: '250.00',
  custo_produtivo_maquinas: '12000.00',
  custo_ocioso_maquinas: '600.00',
  custo_total: '17000.00',
  ociosidade_evitavel_total: '850.00',
  horas_ociosas_total: '8.00',
  eficiencia_gerencial_percentual: 87,
  mao_de_obra_por_funcao: [
    {
      funcao: 'Ajudante',
      dias_trabalhados: 20,
      faltas: 1,
      atestados: 0,
      custo: '5000.00',
      deficit: '250.00',
      tem_valor_cadastrado: true,
    },
  ],
  maquinas_por_equipamento: [
    {
      maquina_id: 'maquina-1',
      codigo: 'ESC-01',
      nome: 'Escavadeira 320D',
      equipe_nome: 'Equipe 1',
      horas_produtivas: '160.00',
      horas_paradas: '8.00',
      custo_produtivo: '12000.00',
      custo_ocioso: '600.00',
      eficiencia_percentual: 95,
      tem_valor_cadastrado: true,
    },
  ],
  horas_ociosas_por_causa: [{ motivo: 'Chuva', horas: '8.00' }],
  faltas_por_pessoa: [
    {
      pessoa_id: 'pessoa-1',
      nome: 'José Ajudante',
      funcao: 'Ajudante',
      faltas: 3,
      atestados: 0,
      valor_perdido: '750.00',
      reincidente: true,
    },
  ],
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

test('gerente ve custos e ociosidade do projeto no mes', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: GERENTE }, meta: { is_authenticated: true } } }),
  )
  let ultimaUrlRequisitada = ''
  await page.route(CUSTOS_URL, (route) => {
    ultimaUrlRequisitada = route.request().url()
    return route.fulfill({ json: RESPOSTA_CUSTOS })
  })

  await page.goto('/projetos/projeto-1/custos-ociosidade')

  // Regex (nao string literal) porque Intl.NumberFormat pode render com
  // espaco normal ou nao-quebravel (U+00A0) entre "R$" e o valor, dependendo
  // da versao do ICU do Chromium — \s cobre os dois.
  await expect(page.getByText(/R\$\s*5\.000,00/)).toBeVisible()
  await expect(page.getByText(/R\$\s*17\.000,00/)).toBeVisible()
  await expect(page.getByText('87%')).toBeVisible()
  await expect(page.getByText('José Ajudante (Ajudante)')).toBeVisible()
  await expect(page.getByText('reincidente')).toBeVisible()
  expect(ultimaUrlRequisitada).toContain('mes=2026-07')

  await page.getByLabel('Mês de referência').fill('2026-08')
  await expect.poll(() => ultimaUrlRequisitada).toContain('mes=2026-08')
})

test('sem valor cadastrado mostra aviso em vez de custo inventado', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: GERENTE }, meta: { is_authenticated: true } } }),
  )
  await page.route(CUSTOS_URL, (route) =>
    route.fulfill({
      json: {
        ...RESPOSTA_CUSTOS,
        maquinas_por_equipamento: [
          { ...RESPOSTA_CUSTOS.maquinas_por_equipamento[0], tem_valor_cadastrado: false },
        ],
      },
    }),
  )

  await page.goto('/projetos/projeto-1/custos-ociosidade')

  await expect(page.getByText('sem valor definido')).toBeVisible()
})

test('auxiliar administrativo nao ve o item no menu e recebe acesso restrito na rota', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: AUXILIAR }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) =>
    route.fulfill({ json: { disciplinas: [], equipes: [], metas: [], valores_custo: [], soma_pesos_metas: 0 } }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await expect(page.getByRole('link', { name: 'Custos & Ociosidade' })).not.toBeVisible()

  await page.goto('/projetos/projeto-1/custos-ociosidade')
  await expect(page.getByText('Esta tela é restrita ao perfil Gerente.')).toBeVisible()
})
