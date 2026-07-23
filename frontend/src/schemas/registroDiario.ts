import { z } from 'zod'

export const producaoSchema = z.object({
  rodovia: z.string().trim().min(1, 'Rodovia é obrigatória.'),
  sentido: z.enum(['crescente', 'decrescente']),
  disciplina: z.string().min(1, 'Disciplina é obrigatória.'),
  servico: z.string().min(1, 'Serviço é obrigatório.'),
  km_inicial: z.string().trim().min(1, 'Km inicial é obrigatório.'),
  km_final: z.string().trim().min(1, 'Km final é obrigatório.'),
  quantidade: z.string().trim().min(1, 'Quantidade é obrigatória.'),
  unidade: z.coerce.number().min(1, 'Unidade é obrigatória.'),
})

export const presencaSchema = z
  .object({
    pessoa: z.string().optional(),
    nome_avulso: z.string().optional(),
    funcao: z.string().trim().min(1, 'Função é obrigatória.'),
    status: z.enum(['presente', 'falta', 'atestado']),
  })
  .refine((data) => Boolean(data.pessoa) !== Boolean(data.nome_avulso), {
    message: 'Escolha uma pessoa cadastrada OU informe um nome avulso.',
    path: ['nome_avulso'],
  })

export const apontamentoMaquinaSchema = z
  .object({
    maquina: z.string().optional(),
    identificacao_avulsa: z.string().optional(),
    horas_produtivas: z.string().trim().min(1, 'Horas produtivas é obrigatório.'),
    horas_paradas: z.string().trim().default('0'),
    motivo_parada: z.coerce.number().optional(),
  })
  .refine((data) => Boolean(data.maquina) !== Boolean(data.identificacao_avulsa), {
    message: 'Escolha uma máquina cadastrada OU informe uma identificação avulsa.',
    path: ['identificacao_avulsa'],
  })
  .refine((data) => !(Number(data.horas_paradas) > 0 && !data.motivo_parada), {
    message: 'Motivo da parada é obrigatório quando há horas paradas.',
    path: ['motivo_parada'],
  })

export const registroDiarioFormSchema = z.object({
  data_referencia: z.string().min(1, 'Data é obrigatória.'),
  turno: z.enum(['diurno', 'noturno']),
  clima: z.enum(['sol', 'nublado', 'chuva', 'chuva_forte']),
  equipe: z.string().min(1, 'Equipe é obrigatória.'),
  fiscal: z.coerce.number().min(1, 'Fiscal é obrigatório.'),
  producoes: z.array(producaoSchema).min(1, 'Adicione ao menos uma produção do dia.'),
  presencas: z.array(presencaSchema).default([]),
  maquinas: z.array(apontamentoMaquinaSchema).default([]),
  ocorrencias: z
    .array(
      z.object({
        tipo: z.string().min(1),
        recurso_afetado: z.string().min(1),
        descricao: z.string().min(1),
        km: z.string().optional(),
      }),
    )
    .default([]),
})

export type RegistroDiarioFormValues = z.infer<typeof registroDiarioFormSchema>
