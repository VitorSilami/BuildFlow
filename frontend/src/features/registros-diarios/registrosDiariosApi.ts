import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../services/apiClient'
import type {
  ConfiguracaoRdo,
  Foto,
  RegistroDiario,
  RegistroDiarioInput,
} from '../../types/registroDiario'

export function useConfiguracaoRdo(projetoId: string) {
  return useQuery({
    queryKey: ['configuracao-rdo', projetoId],
    queryFn: () => apiClient.get<ConfiguracaoRdo>(`/api/v1/projetos/${projetoId}/configuracao-rdo/`),
  })
}

export function useRegistrosDiarios(projetoId: string) {
  return useQuery({
    queryKey: ['registros-diarios', projetoId],
    queryFn: () =>
      apiClient.get<{ results: RegistroDiario[] }>(
        `/api/v1/projetos/${projetoId}/registros-diarios/`,
      ),
  })
}

export function useRegistroDiario(registroId: string | undefined) {
  return useQuery({
    queryKey: ['registro-diario', registroId],
    queryFn: () => apiClient.get<RegistroDiario>(`/api/v1/registros-diarios/${registroId}/`),
    enabled: Boolean(registroId),
  })
}

export function useCriarRegistroDiario(projetoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: RegistroDiarioInput) =>
      apiClient.post<RegistroDiario>(`/api/v1/projetos/${projetoId}/registros-diarios/`, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['registros-diarios', projetoId] })
    },
  })
}

export function useEnviarFoto(registroId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ arquivo, km }: { arquivo: File; km?: string }) => {
      const formData = new FormData()
      formData.append('arquivo', arquivo)
      if (km) formData.append('km', km)

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}/api/v1/registros-diarios/${registroId}/fotos/`,
        {
          method: 'POST',
          body: formData,
          credentials: 'include',
          headers: {
            'X-CSRFToken':
              document.cookie.match(/(?:^|; )csrftoken=([^;]*)/)?.[1] ?? '',
          },
        },
      )
      if (!response.ok) throw new Error('Falha ao enviar foto.')
      return (await response.json()) as Foto
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['registro-diario', registroId] })
    },
  })
}
