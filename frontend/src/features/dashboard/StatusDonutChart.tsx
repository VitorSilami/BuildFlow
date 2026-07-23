import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const CORES_STATUS = {
  ativo: 'var(--color-emerald-500)',
  pausado: 'var(--color-amber-500)',
  concluido: 'var(--color-slate-500)',
} as const

const CLASSE_LEGENDA_STATUS = {
  ativo: 'bg-emerald-500',
  pausado: 'bg-amber-500',
  concluido: 'bg-slate-500',
} as const

interface StatusDonutChartProps {
  ativos: number
  pausados: number
  concluidos: number
}

export function StatusDonutChart({ ativos, pausados, concluidos }: StatusDonutChartProps) {
  const dados = [
    { status: 'ativo' as const, label: 'Ativos', valor: ativos },
    { status: 'pausado' as const, label: 'Pausados', valor: pausados },
    { status: 'concluido' as const, label: 'Concluídos', valor: concluidos },
  ]

  return (
    <div className="flex items-center gap-4">
      <div aria-label="Gráfico de distribuição de status" style={{ width: 140, height: 140 }} className="shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={dados}
              dataKey="valor"
              nameKey="label"
              innerRadius={38}
              outerRadius={62}
              paddingAngle={2}
            >
              {dados.map((entrada) => (
                <Cell key={entrada.status} fill={CORES_STATUS[entrada.status]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-1 flex-col gap-2" aria-hidden="true">
        {dados.map((entrada) => (
          <li key={entrada.status} className="flex items-center gap-2 text-sm">
            <span className={`size-2.5 shrink-0 rounded-full ${CLASSE_LEGENDA_STATUS[entrada.status]}`} />
            <span className="text-muted-foreground">{entrada.label}</span>
            <span className="ml-auto font-semibold text-ink">{entrada.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
