import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatData } from '../../lib/format'
import type { CartaControle } from '../../types/configuracao'

interface CartaControleChartProps {
  cartaControle: CartaControle
}

export function CartaControleChart({ cartaControle }: CartaControleChartProps) {
  const dados = cartaControle.pontos.map((ponto) => ({
    rotulo: formatData(ponto.data_referencia),
    valor: Number(ponto.quantidade),
    valorForaDeControle: ponto.fora_de_controle ? Number(ponto.quantidade) : undefined,
  }))

  return (
    <div aria-label="Carta de controle de produtividade diária" style={{ width: '100%', height: 180 }}>
      <ResponsiveContainer>
        <LineChart data={dados} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="rotulo"
            stroke="var(--color-muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            contentStyle={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <ReferenceLine y={Number(cartaControle.media)} stroke="var(--color-primary)" label="Média" />
          <ReferenceLine
            y={Number(cartaControle.lsc)}
            stroke="var(--color-destructive)"
            strokeDasharray="5 4"
            label="LSC"
          />
          <ReferenceLine
            y={Number(cartaControle.lic)}
            stroke="var(--color-destructive)"
            strokeDasharray="5 4"
            label="LIC"
          />
          <Line type="monotone" dataKey="valor" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
          <Line
            dataKey="valorForaDeControle"
            stroke="none"
            dot={{ r: 5, fill: 'var(--color-destructive)', stroke: 'var(--color-destructive)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
