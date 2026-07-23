import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../components/ui'
import { cn } from '../../lib/utils'
import type { RegistroDiario, StatusRegistro } from '../../types/registroDiario'
import { PRIORIDADE_STATUS_REGISTRO, STATUS_REGISTRO_COR_CELULA } from './statusRegistroBadge'

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DIAS_POR_SEMANA = 7

export interface MesAno {
  ano: number
  mes: number
}

export interface DiaCalendario {
  data: string
  numeroDia: number
  doMesCorrente: boolean
  hoje: boolean
  fimDeSemana: boolean
  registros: RegistroDiario[]
  statusPrioritario: StatusRegistro | null
}

function statusPrioritarioDoDia(registros: RegistroDiario[]): StatusRegistro | null {
  for (const status of PRIORIDADE_STATUS_REGISTRO) {
    if (registros.some((registro) => registro.status === status)) return status
  }
  return null
}

function formatarDataLocal(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function construirGrade(mesAno: MesAno, registros: RegistroDiario[]): DiaCalendario[] {
  const primeiroDoMes = new Date(mesAno.ano, mesAno.mes - 1, 1)
  const offsetInicial = primeiroDoMes.getDay()
  const ultimoDiaDoMes = new Date(mesAno.ano, mesAno.mes, 0).getDate()
  const hojeIso = formatarDataLocal(new Date())

  const registrosPorDia = new Map<string, RegistroDiario[]>()
  for (const registro of registros) {
    const lista = registrosPorDia.get(registro.data_referencia) ?? []
    lista.push(registro)
    registrosPorDia.set(registro.data_referencia, lista)
  }

  const totalCelulas = Math.ceil((offsetInicial + ultimoDiaDoMes) / DIAS_POR_SEMANA) * DIAS_POR_SEMANA

  return Array.from({ length: totalCelulas }, (_, indice) => {
    const numeroDia = indice - offsetInicial + 1
    const data = new Date(mesAno.ano, mesAno.mes - 1, numeroDia)
    const iso = formatarDataLocal(data)
    const registrosDoDia = registrosPorDia.get(iso) ?? []
    return {
      data: iso,
      numeroDia: data.getDate(),
      doMesCorrente: numeroDia >= 1 && numeroDia <= ultimoDiaDoMes,
      hoje: iso === hojeIso,
      fimDeSemana: data.getDay() === 0 || data.getDay() === 6,
      registros: registrosDoDia,
      statusPrioritario: statusPrioritarioDoDia(registrosDoDia),
    }
  })
}

interface CalendarioMensalProps {
  mesAno: MesAno
  registros: RegistroDiario[]
  onMesAnteriorClick: () => void
  onMesSeguinteClick: () => void
  onHojeClick: () => void
  onDiaClick: (dia: DiaCalendario) => void
}

export function CalendarioMensal({
  mesAno,
  registros,
  onMesAnteriorClick,
  onMesSeguinteClick,
  onHojeClick,
  onDiaClick,
}: CalendarioMensalProps) {
  const dias = useMemo(() => construirGrade(mesAno, registros), [mesAno, registros])

  return (
    <div aria-label="Calendário de registros diários">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={onMesAnteriorClick}>
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Mês seguinte" onClick={onMesSeguinteClick}>
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
        <h2 className="font-display text-lg font-semibold text-ink">
          {NOMES_MESES[mesAno.mes - 1]} {mesAno.ano}
        </h2>
        <Button variant="outline" onClick={onHojeClick}>
          Hoje
        </Button>
      </div>

      <div
        className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase text-muted-foreground"
        aria-hidden="true"
      >
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="py-2">{dia}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dias.map((dia) => (
          <button
            key={dia.data}
            type="button"
            disabled={!dia.doMesCorrente}
            onClick={() => onDiaClick(dia)}
            aria-label={
              dia.registros.length > 0
                ? `Dia ${dia.numeroDia}, ${dia.registros.length} registro(s)`
                : `Dia ${dia.numeroDia}, sem registro`
            }
            className={cn(
              'flex h-20 flex-col items-start gap-1 rounded-md border p-2 text-left text-sm transition-colors',
              !dia.doMesCorrente && 'cursor-default border-transparent text-muted-foreground/40',
              dia.doMesCorrente &&
                !dia.statusPrioritario && [
                  'border-border hover:bg-surface',
                  dia.fimDeSemana && 'bg-muted/40',
                ],
              dia.doMesCorrente &&
                dia.statusPrioritario && [
                  STATUS_REGISTRO_COR_CELULA[dia.statusPrioritario],
                  'hover:brightness-95',
                ],
              dia.hoje && (dia.statusPrioritario ? 'ring-2 ring-primary ring-offset-1' : 'border-primary bg-primary/10'),
            )}
          >
            <span className={dia.hoje ? 'font-semibold text-primary' : 'text-ink'}>{dia.numeroDia}</span>
            {dia.registros.length > 0 && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  dia.statusPrioritario ? 'bg-background/70 text-ink' : 'bg-primary/15 text-primary',
                )}
              >
                {dia.registros.length > 1 ? `${dia.registros.length} RDOs` : '1 RDO'}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
