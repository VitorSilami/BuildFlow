import { z } from 'zod'

export const projetoFormSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'O nome do projeto é obrigatório.'),
  descricao: z.string().optional(),
})

export type ProjetoFormValues = z.infer<typeof projetoFormSchema>
