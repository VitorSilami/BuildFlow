import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../services/apiClient'
import type { ProjetoFormValues } from '../../schemas/projeto'
import type { Projeto, ProjetoListResponse } from '../../types/projeto'

const PROJETOS_PATH = '/api/v1/projetos/'

export function useProjetos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['projetos'],
    queryFn: () => apiClient.get<ProjetoListResponse>(PROJETOS_PATH),
    enabled: options?.enabled ?? true,
  })
}

export function useCriarProjeto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ProjetoFormValues) => apiClient.post<Projeto>(PROJETOS_PATH, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projetos'] })
    },
  })
}
