import { z } from 'zod'

export const projetoFormSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'O nome do projeto é obrigatório.'),
  descricao: z.string().optional(),
  numero_contrato: z.string().optional(),
  trecho: z.string().optional(),
  engenheiro_responsavel: z.string().optional(),
  status: z.enum(['ativo', 'pausado', 'concluido']).optional(),
})

export type ProjetoFormValues = z.infer<typeof projetoFormSchema>
