import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../services/apiClient'
import type { DashboardResponse } from '../../types/dashboard'

const DASHBOARD_PATH = '/api/v1/dashboard/'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardResponse>(DASHBOARD_PATH),
  })
}
