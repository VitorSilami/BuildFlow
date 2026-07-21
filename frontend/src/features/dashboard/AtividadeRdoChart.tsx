import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DashboardAtividadeDia } from '../../types/dashboard'

const DIAS_SEMANA_ABREVIADOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function formatarDiaCurto(iso: string): string {
  const data = new Date(`${iso}T00:00:00`)
  return DIAS_SEMANA_ABREVIADOS[data.getDay()]
}

interface AtividadeRdoChartProps {
  dados: DashboardAtividadeDia[]
}

export function AtividadeRdoChart({ dados }: AtividadeRdoChartProps) {
  const dadosFormatados = dados.map((dia) => ({ ...dia, rotulo: formatarDiaCurto(dia.data) }))

  return (
    <div aria-label="Gráfico de RDOs por dia" style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={dadosFormatados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="rotulo"
            stroke="var(--color-muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            stroke="var(--color-muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={24}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-surface)' }}
            contentStyle={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="quantidade" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="RDOs" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
