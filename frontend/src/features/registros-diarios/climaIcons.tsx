import { Cloud, CloudLightning, CloudRain, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Clima, Turno } from '../../types/registroDiario'

export const LABEL_CLIMA: Record<Clima, string> = {
  sol: 'Sol',
  nublado: 'Nublado',
  chuva: 'Chuva',
  chuva_forte: 'Chuva forte',
}

export const LABEL_TURNO: Record<Turno, string> = {
  diurno: 'Diurno',
  noturno: 'Noturno',
}

export const ICONE_CLIMA: Record<Clima, ReactNode> = {
  sol: <Sun size={16} className="text-warning" aria-hidden="true" />,
  nublado: <Cloud size={16} className="text-baseline" aria-hidden="true" />,
  chuva: <CloudRain size={16} className="text-info" aria-hidden="true" />,
  chuva_forte: <CloudLightning size={16} className="text-brand-blue" aria-hidden="true" />,
}
