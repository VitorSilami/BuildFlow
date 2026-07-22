import { Cloud, CloudLightning, CloudRain, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Clima } from '../../types/registroDiario'

export const LABEL_CLIMA: Record<Clima, string> = {
  sol: 'Sol',
  nublado: 'Nublado',
  chuva: 'Chuva',
  chuva_forte: 'Chuva forte',
}

export const ICONE_CLIMA: Record<Clima, ReactNode> = {
  sol: <Sun size={16} className="text-amber-500" aria-hidden="true" />,
  nublado: <Cloud size={16} className="text-slate-400" aria-hidden="true" />,
  chuva: <CloudRain size={16} className="text-blue-500" aria-hidden="true" />,
  chuva_forte: <CloudLightning size={16} className="text-blue-700" aria-hidden="true" />,
}
