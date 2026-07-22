import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../services/apiClient'
import type { AcaoCorretiva, AcaoCorretivaInput, Rnc, RncInput } from '../../types/rnc'

interface UseRncsOptions {
  status?: string
  categoria?: string
}

export function useRncs(projetoId: string, options: UseRncsOptions = {}) {
  const { status, categoria } = options
  return useQuery({
    queryKey: ['rncs', projetoId, status ?? null, categoria ?? null],
    queryFn: () => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (categoria) params.set('categoria', categoria)
      const query = params.toString()
      return apiClient.get<Rnc[]>(
        `/api/v1/projetos/${projetoId}/rncs/${query ? `?${query}` : ''}`,
      )
    },
  })
}

export function useRnc(rncId: string | undefined, habilitado = true) {
  return useQuery({
    queryKey: ['rnc', rncId],
    queryFn: () => apiClient.get<Rnc>(`/api/v1/rncs/${rncId}/`),
    enabled: habilitado && Boolean(rncId),
  })
}

export function useCriarRnc(projetoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: RncInput) =>
      apiClient.post<Rnc>(`/api/v1/projetos/${projetoId}/rncs/`, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rncs', projetoId] })
    },
  })
}

export function useAtualizarRnc(rncId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: Partial<RncInput>) =>
      apiClient.patch<Rnc>(`/api/v1/rncs/${rncId}/`, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rnc', rncId] })
    },
  })
}

export function useConcluirRnc(rncId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (eficacia: 'eficaz' | 'ineficaz') =>
      apiClient.post<Rnc>(`/api/v1/rncs/${rncId}/concluir/`, { eficacia }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rnc', rncId] })
    },
  })
}

export function useCriarAcaoCorretiva(rncId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: AcaoCorretivaInput) =>
      apiClient.post<AcaoCorretiva>(`/api/v1/rncs/${rncId}/acoes-corretivas/`, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rnc', rncId] })
    },
  })
}
