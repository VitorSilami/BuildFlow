import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const CONFIG_URL = '**/api/v1/projetos/*/configuracao/'
const CONFIG_RDO_URL = '**/api/v1/projetos/*/configuracao-rdo/'
const DISCIPLINAS_URL = '**/api/v1/projetos/*/configuracao/disciplinas/'
const EQUIPES_URL = '**/api/v1/projetos/*/configuracao/equipes/'

const USUARIO = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
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

test('criar disciplina e equipe na configuração do projeto', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  let disciplinaCriada = false
  let equipeCriada = false

  await page.route(CONFIG_URL, (route) => {
    const disciplinas = disciplinaCriada
      ? [{ id: 'disc-1', nome: 'Terraplenagem', peso_percentual: null, avanco_percentual: null, servicos: [] }]
      : []
    const equipes = equipeCriada
      ? [{ id: 'equipe-1', nome: 'Equipe A', pessoas: [], maquinas: [] }]
      : []
    return route.fulfill({
      json: { disciplinas, equipes, valores_custo: [], soma_pesos_disciplinas: 0 },
    })
  })

  await page.route(DISCIPLINAS_URL, (route) => {
    disciplinaCriada = true
    return route.fulfill({
      status: 201,
      json: { id: 'disc-1', nome: 'Terraplenagem', peso_percentual: null, avanco_percentual: null, servicos: [] },
    })
  })

  await page.route(EQUIPES_URL, (route) => {
    equipeCriada = true
    return route.fulfill({
      status: 201,
      json: { id: 'equipe-1', nome: 'Equipe A', pessoas: [], maquinas: [] },
    })
  })

  await page.goto('/projetos/projeto-1/configuracoes')

  await expect(page.getByText('Nenhuma disciplina cadastrada ainda.')).toBeVisible()

  await page.getByLabel('Nova disciplina').fill('Terraplenagem')
  await page.getByRole('button', { name: 'Adicionar disciplina' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Terraplenagem' })).toBeVisible()

  await page.getByRole('tab', { name: 'Equipes' }).click()

  await page.getByLabel('Nova equipe').fill('Equipe A')
  await page.getByRole('button', { name: 'Adicionar equipe' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Equipe A' })).toBeVisible()
})

test('trocar de aba mantém a seção anterior preenchida ao voltar', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          { id: 'disc-1', nome: 'Terraplenagem', peso_percentual: null, avanco_percentual: null, servicos: [] },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 0,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')

  await expect(page.getByRole('listitem').filter({ hasText: 'Terraplenagem' })).toBeVisible()

  await page.getByLabel('Nova disciplina').fill('Rascunho')

  await page.getByRole('tab', { name: 'Valores' }).click()
  await expect(page.getByLabel('Descrição')).toBeVisible()

  await page.getByRole('tab', { name: 'Disciplinas' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Terraplenagem' })).toBeVisible()
  await expect(page.getByLabel('Nova disciplina')).toHaveValue('Rascunho')
})

test('tipo equipamento mostra seletor de máquina cadastrada em vez de função', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [],
        equipes: [
          {
            id: 'equipe-1',
            nome: 'Equipe A',
            pessoas: [],
            maquinas: [{ id: 'maquina-1', codigo: 'ESC-01', nome: 'Escavadeira 320D' }],
          },
        ],
        valores_custo: [],
        soma_pesos_disciplinas: 0,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'Valores' }).click()

  await expect(page.getByLabel('Função')).toBeVisible()
  await expect(page.getByLabel('Valor (R$/dia)')).toBeVisible()

  // "Tipo" e "Máquina" sao SelectField (Radix, nao <select> nativo) — abrir
  // via click e escolher a opcao por role, nao .selectOption() (nativo).
  await page.getByLabel('Tipo').click()
  await page.getByRole('option', { name: 'Equipamento' }).click()

  await expect(page.getByLabel('Função')).not.toBeVisible()
  await expect(page.getByLabel('Máquina')).toBeVisible()
  await expect(page.getByLabel('Valor (R$/hora)')).toBeVisible()

  await page.getByLabel('Máquina').click()
  await expect(page.getByRole('option', { name: 'Escavadeira 320D (ESC-01)' })).toBeVisible()
})

test('define peso da disciplina e adiciona serviço na aba EAP', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  let pesoDisciplina: string | null = null
  let servicoCriado = false

  await page.route(CONFIG_URL, (route) => {
    const disciplina = {
      id: 'disc-1',
      nome: 'Terraplenagem',
      peso_percentual: pesoDisciplina,
      avanco_percentual: null,
      servicos: servicoCriado
        ? [
            {
              id: 'serv-1',
              nome: 'Corte',
              unidade: 1,
              peso_percentual: null,
              quantidade_planejada: null,
              quantidade_executada: '0.000',
              avanco_percentual: null,
            },
          ]
        : [],
    }
    return route.fulfill({
      json: {
        disciplinas: [disciplina],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: pesoDisciplina ? Number(pesoDisciplina) : 0,
      },
    })
  })

  await page.route('**/api/v1/configuracoes/disciplinas/disc-1/', (route) => {
    pesoDisciplina = '100.00'
    return route.fulfill({
      json: {
        id: 'disc-1',
        nome: 'Terraplenagem',
        peso_percentual: '100.00',
        avanco_percentual: null,
        servicos: [],
      },
    })
  })

  await page.route('**/api/v1/configuracoes/disciplinas/disc-1/servicos/', (route) => {
    servicoCriado = true
    return route.fulfill({
      status: 201,
      json: {
        id: 'serv-1',
        nome: 'Corte',
        unidade: 1,
        peso_percentual: null,
        quantidade_planejada: null,
        quantidade_executada: '0.000',
        avanco_percentual: null,
      },
    })
  })

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()

  await page.getByLabel('Peso (%)').first().fill('100')
  await page.getByLabel('Peso (%)').first().blur()
  await expect.poll(() => pesoDisciplina).toBe('100.00')

  await page.getByRole('button', { name: 'Expandir Terraplenagem' }).click()

  await page.getByLabel('Unidade').click()
  await page.getByRole('option', { name: 'm³' }).click()
  await page.getByLabel('Novo serviço').fill('Corte')
  await page.getByRole('button', { name: 'Adicionar serviço' }).click()

  await expect(page.getByText('Corte')).toBeVisible()
})
