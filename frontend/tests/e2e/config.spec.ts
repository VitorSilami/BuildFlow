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
      ? [{ id: 'disc-1', nome: 'Terraplenagem', peso_percentual: null, avanco_percentual: null, subdisciplinas: [], servicos: [] }]
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
      json: { id: 'disc-1', nome: 'Terraplenagem', peso_percentual: null, avanco_percentual: null, subdisciplinas: [], servicos: [] },
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
          { id: 'disc-1', nome: 'Terraplenagem', peso_percentual: null, avanco_percentual: null, subdisciplinas: [], servicos: [] },
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
      subdisciplinas: [],
      servicos: servicoCriado
        ? [
            {
              id: 'serv-1',
              nome: 'Corte',
              unidade: 1,
              peso_percentual: null,
              quantidade_planejada: null,
              quantidade_executada: '0.000',
              quantidade_executada_manual: '0.000',
              producoes_vinculadas: [],
              carta_controle: null,
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
    const payload = route.request().postDataJSON() as { peso_percentual?: string }
    if (payload.peso_percentual !== '100') {
      return route.fulfill({ status: 400, json: { detail: 'peso_percentual inesperado no payload' } })
    }
    pesoDisciplina = '100.00'
    return route.fulfill({
      json: {
        id: 'disc-1',
        nome: 'Terraplenagem',
        peso_percentual: '100.00',
        avanco_percentual: null,
        subdisciplinas: [],
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
        quantidade_executada_manual: '0.000',
        producoes_vinculadas: [],
        carta_controle: null,
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

test('mostra total executado combinando RDO e ajuste manual, com lançamentos vinculados', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: '25.00',
            subdisciplinas: [],
            servicos: [
              {
                id: 'serv-1',
                nome: 'Corte',
                unidade: 1,
                peso_percentual: '100.00',
                quantidade_planejada: '1000.000',
                quantidade_executada_manual: '100.000',
                quantidade_executada: '250.000',
                producoes_vinculadas: [
                  { data_referencia: '2026-07-10', quantidade: '150.000' },
                  { data_referencia: '2026-07-01', quantidade: '100.000' },
                ],
                avanco_percentual: '25.00',
              },
            ],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Expandir Terraplenagem' }).click()

  await expect(page.getByText(/Executado:\s*250\.000/)).toBeVisible()

  await page.getByRole('button', { name: 'Ver lançamentos (2)' }).click()
  await expect(page.getByText('10/07/2026 — 150.000')).toBeVisible()
  await expect(page.getByText('01/07/2026 — 100.000')).toBeVisible()
})

test('mostra a carta de controle quando o servico tem amostra suficiente de RDOs aprovados', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: '25.00',
            subdisciplinas: [],
            servicos: [
              {
                id: 'serv-1',
                nome: 'Corte',
                unidade: 1,
                peso_percentual: '100.00',
                quantidade_planejada: '1000.000',
                quantidade_executada_manual: '0.000',
                quantidade_executada: '500.000',
                producoes_vinculadas: [
                  { data_referencia: '2026-07-05', quantidade: '95.000' },
                  { data_referencia: '2026-07-04', quantidade: '105.000' },
                  { data_referencia: '2026-07-03', quantidade: '90.000' },
                  { data_referencia: '2026-07-02', quantidade: '110.000' },
                  { data_referencia: '2026-07-01', quantidade: '100.000' },
                ],
                carta_controle: {
                  media: '100.000',
                  desvio_padrao: '7.906',
                  lsc: '123.718',
                  lic: '76.282',
                  pontos: [
                    { data_referencia: '2026-07-01', quantidade: '100.000', fora_de_controle: false },
                    { data_referencia: '2026-07-02', quantidade: '110.000', fora_de_controle: false },
                    { data_referencia: '2026-07-03', quantidade: '90.000', fora_de_controle: false },
                    { data_referencia: '2026-07-04', quantidade: '105.000', fora_de_controle: false },
                    { data_referencia: '2026-07-05', quantidade: '95.000', fora_de_controle: false },
                  ],
                },
                avanco_percentual: '50.00',
              },
            ],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Expandir Terraplenagem' }).click()
  await page.getByRole('button', { name: 'Ver lançamentos (5)' }).click()

  await expect(page.getByLabel('Carta de controle de produtividade diária')).toBeVisible()
})

test('mostra badge de status e avanco previsto quando o servico tem datas previstas', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: '25.00',
            avanco_previsto_percentual: '60.00',
            status_eap: 'atencao',
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
                data_inicio_prevista: '2026-01-01',
                data_fim_prevista: '2026-01-31',
                avanco_previsto_percentual: '60.00',
                status_eap: 'atencao',
              },
            ],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Expandir Terraplenagem' }).click()

  await expect(page.getByText('Atenção').first()).toBeVisible()
  await expect(page.getByText(/Previsto:\s*60\.00%/).first()).toBeVisible()
})

test('limpar a data de inicio previsto envia null no PATCH, nao string vazia', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: '25.00',
            avanco_previsto_percentual: '60.00',
            status_eap: 'atencao',
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
                data_inicio_prevista: '2026-01-01',
                data_fim_prevista: '2026-01-31',
                avanco_previsto_percentual: '60.00',
                status_eap: 'atencao',
              },
            ],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  let payloadRecebido: { data_inicio_prevista?: string | null } | null = null
  await page.route('**/api/v1/configuracoes/servicos/serv-1/', (route) => {
    payloadRecebido = route.request().postDataJSON() as { data_inicio_prevista?: string | null }
    return route.fulfill({
      json: {
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
        data_inicio_prevista: null,
        data_fim_prevista: '2026-01-31',
        avanco_previsto_percentual: null,
        status_eap: 'planejado',
      },
    })
  })

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Expandir Terraplenagem' }).click()

  await page.getByLabel('Início previsto').fill('')
  await page.getByLabel('Início previsto').blur()

  await expect.poll(() => payloadRecebido).not.toBeNull()
  expect(payloadRecebido).toEqual({ data_inicio_prevista: null })
})

test('nao mostra badge nem previsto quando o servico nao tem datas previstas', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: '25.00',
            avanco_previsto_percentual: null,
            status_eap: null,
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
                data_inicio_prevista: null,
                data_fim_prevista: null,
                avanco_previsto_percentual: null,
                status_eap: null,
              },
            ],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Expandir Terraplenagem' }).click()

  await expect(page.getByText(/Previsto:/)).toHaveCount(0)
})

test('toggle do Gantt fica oculto por padrao e mostra o cronograma ao clicar', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: '50.00',
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
                quantidade_executada_manual: '500.000',
                quantidade_executada: '500.000',
                producoes_vinculadas: [],
                carta_controle: null,
                avanco_percentual: '50.00',
                data_inicio_prevista: '2026-01-01',
                data_fim_prevista: '2026-03-01',
                avanco_previsto_percentual: '60.00',
                status_eap: 'atencao',
              },
            ],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()

  await expect(page.getByLabel('Cronograma da EAP')).not.toBeVisible()
  await page.getByRole('button', { name: 'Ver cronograma (Gantt)' }).click()
  await expect(page.getByLabel('Cronograma da EAP')).toBeVisible()
})

test('disciplina sem janela valida nao aparece no Gantt', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: null,
            avanco_previsto_percentual: null,
            status_eap: null,
            data_inicio_prevista: null,
            data_fim_prevista: null,
            subdisciplinas: [],
            servicos: [],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()

  await expect(page.getByRole('button', { name: 'Ver cronograma (Gantt)' })).not.toBeVisible()
})

test('disciplina com status_eap nulo renderiza no Gantt sem quebrar', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: null,
            avanco_previsto_percentual: null,
            status_eap: null,
            data_inicio_prevista: '2026-01-01',
            data_fim_prevista: '2026-03-01',
            subdisciplinas: [],
            servicos: [
              {
                id: 'serv-1',
                nome: 'Corte',
                unidade: 1,
                peso_percentual: '100.00',
                quantidade_planejada: null,
                quantidade_executada_manual: null,
                quantidade_executada: null,
                producoes_vinculadas: [],
                carta_controle: null,
                avanco_percentual: null,
                data_inicio_prevista: '2026-01-01',
                data_fim_prevista: '2026-03-01',
                avanco_previsto_percentual: null,
                status_eap: null,
              },
            ],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Ver cronograma (Gantt)' }).click()

  await expect(page.getByLabel('Cronograma da EAP')).toBeVisible()
})

test('cria subdisciplina e ela aparece aninhada dentro do card do pai', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  let subdisciplinaCriada = false

  await page.route(CONFIG_URL, (route) => {
    const disciplina = {
      id: 'disc-1',
      nome: 'Terraplenagem',
      peso_percentual: '100.00',
      avanco_percentual: null,
      servicos: [],
      subdisciplinas: subdisciplinaCriada
        ? [
            {
              id: 'disc-2',
              nome: 'Movimento de Terra',
              peso_percentual: null,
              avanco_percentual: null,
              servicos: [],
              subdisciplinas: [],
            },
          ]
        : [],
    }
    return route.fulfill({
      json: { disciplinas: [disciplina], equipes: [], valores_custo: [], soma_pesos_disciplinas: 100 },
    })
  })

  await page.route(DISCIPLINAS_URL, (route) => {
    subdisciplinaCriada = true
    return route.fulfill({
      status: 201,
      json: {
        id: 'disc-2',
        nome: 'Movimento de Terra',
        peso_percentual: null,
        avanco_percentual: null,
        servicos: [],
        subdisciplinas: [],
      },
    })
  })

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Expandir Terraplenagem' }).click()

  await page.getByLabel('Nova subdisciplina').fill('Movimento de Terra')
  await page.getByRole('button', { name: '+ Subdisciplina' }).click()

  await expect(page.getByText('Movimento de Terra')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Expandir Movimento de Terra' })).toBeVisible()
})

test('aviso de soma de pesos considera subdisciplinas e servicos juntos', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: null,
            servicos: [
              {
                id: 'serv-1',
                nome: 'Corte',
                unidade: 1,
                peso_percentual: '30.00',
                quantidade_planejada: null,
                quantidade_executada: '0.000',
                quantidade_executada_manual: '0.000',
                producoes_vinculadas: [],
                carta_controle: null,
                avanco_percentual: null,
              },
            ],
            subdisciplinas: [
              {
                id: 'disc-2',
                nome: 'Movimento de Terra',
                peso_percentual: '30.00',
                avanco_percentual: null,
                servicos: [],
                subdisciplinas: [],
              },
            ],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Expandir Terraplenagem' }).click()

  await expect(page.getByText(/a soma dos pesos dos filhos desta disciplina não fecha 100% \(60%\)/)).toBeVisible()
})

test('Gantt mostra uma barra para disciplina raiz e outra para a subdisciplina', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: null,
            avanco_previsto_percentual: null,
            status_eap: null,
            data_inicio_prevista: '2026-01-01',
            data_fim_prevista: '2026-03-01',
            servicos: [],
            subdisciplinas: [
              {
                id: 'disc-2',
                nome: 'Movimento de Terra',
                peso_percentual: '100.00',
                avanco_percentual: '50.00',
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
                    quantidade_executada_manual: '500.000',
                    quantidade_executada: '500.000',
                    producoes_vinculadas: [],
                    carta_controle: null,
                    avanco_percentual: '50.00',
                    data_inicio_prevista: '2026-01-01',
                    data_fim_prevista: '2026-03-01',
                    avanco_previsto_percentual: '60.00',
                    status_eap: 'atencao',
                  },
                ],
              },
            ],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Ver cronograma (Gantt)' }).click()

  const grafico = page.getByLabel('Cronograma da EAP')
  await expect(grafico).toBeVisible()
  await expect(grafico.getByText('Terraplenagem')).toBeVisible()
  await expect(grafico.getByText('Movimento de Terra')).toBeVisible()
})

test('Gantt nao colapsa subdisciplinas com o mesmo nome em pais diferentes', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: null,
            avanco_previsto_percentual: null,
            status_eap: null,
            data_inicio_prevista: '2026-01-01',
            data_fim_prevista: '2026-03-01',
            servicos: [],
            subdisciplinas: [
              {
                id: 'disc-1a',
                nome: 'Escavação',
                peso_percentual: '100.00',
                avanco_percentual: '30.00',
                avanco_previsto_percentual: null,
                status_eap: null,
                data_inicio_prevista: '2026-01-01',
                data_fim_prevista: '2026-01-31',
                subdisciplinas: [],
                servicos: [],
              },
            ],
          },
          {
            id: 'disc-2',
            nome: 'Drenagem',
            peso_percentual: '100.00',
            avanco_percentual: null,
            avanco_previsto_percentual: null,
            status_eap: null,
            data_inicio_prevista: '2026-01-01',
            data_fim_prevista: '2026-03-01',
            servicos: [],
            subdisciplinas: [
              {
                id: 'disc-2a',
                nome: 'Escavação',
                peso_percentual: '100.00',
                avanco_percentual: '70.00',
                avanco_previsto_percentual: null,
                status_eap: null,
                data_inicio_prevista: '2026-02-01',
                data_fim_prevista: '2026-02-28',
                subdisciplinas: [],
                servicos: [],
              },
            ],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Ver cronograma (Gantt)' }).click()

  const grafico = page.getByLabel('Cronograma da EAP')
  await expect(grafico).toBeVisible()
  await expect(grafico.getByText('Escavação')).toHaveCount(2)
})

test('importa planilha CSV e popula a EAP com as disciplinas do arquivo', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  let importado = false

  await page.route(CONFIG_URL, (route) => {
    const disciplinas = importado
      ? [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: null,
            avanco_percentual: null,
            subdisciplinas: [],
            servicos: [
              {
                id: 'serv-1',
                nome: 'Corte',
                unidade: 1,
                peso_percentual: null,
                quantidade_planejada: '1500.000',
                quantidade_executada: '0.000',
                quantidade_executada_manual: '0.000',
                producoes_vinculadas: [],
                carta_controle: null,
                avanco_percentual: null,
              },
            ],
          },
        ]
      : []
    return route.fulfill({
      json: { disciplinas, equipes: [], valores_custo: [], soma_pesos_disciplinas: 0 },
    })
  })

  await page.route('**/api/v1/projetos/*/configuracao/eap/importar/', (route) => {
    importado = true
    return route.fulfill({ status: 201, json: { disciplinas_criadas: 1, servicos_criados: 1 } })
  })

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()

  await expect(page.getByRole('button', { name: 'Importar planilha' })).toBeVisible()

  await page.getByLabel('Importar planilha', { exact: true }).setInputFiles({
    name: 'import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('DISCIPLINA,ATIVIDADE,UN,TOTAL\nTerraplenagem,Corte,m3,1500\n'),
  })

  await expect(page.getByText('Terraplenagem')).toBeVisible()
})

test('mostra lista de erros quando a planilha tem linha inválida e não altera a EAP', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) =>
    route.fulfill({ json: { disciplinas: [], equipes: [], valores_custo: [], soma_pesos_disciplinas: 0 } }),
  )
  await page.route('**/api/v1/projetos/*/configuracao/eap/importar/', (route) =>
    route.fulfill({ status: 400, json: { erros: ['Linha 2: TOTAL/QUANTIDADE inválido.'] } }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()

  await page.getByLabel('Importar planilha', { exact: true }).setInputFiles({
    name: 'import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('DISCIPLINA,ATIVIDADE,UN,TOTAL\nTerraplenagem,Corte,m3,abc\n'),
  })

  await expect(page.getByText('Linha 2: TOTAL/QUANTIDADE inválido.')).toBeVisible()
  await expect(page.getByText('Cadastre uma disciplina na aba Disciplinas para começar a EAP.')).toBeVisible()
})
