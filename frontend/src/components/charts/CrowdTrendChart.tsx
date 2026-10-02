import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TrendPoint } from '@/types'

export function CrowdTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: '#5f6873' }}
          axisLine={{ stroke: '#e3e5e8' }}
          tickLine={false}
        />
        <YAxis hide domain={['dataMin - 500', 'dataMax + 500']} />
        <Tooltip
          contentStyle={{ borderRadius: 8, borderColor: '#e3e5e8', fontSize: 12 }}
          formatter={(value: number) => [value.toLocaleString('en-IN'), 'People']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#2b323a"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
