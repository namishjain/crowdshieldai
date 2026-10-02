import {
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PredictionPoint } from '@/types'

const CRITICAL_THRESHOLD = 80

export function CongestionForecastChart({ data }: { data: PredictionPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 24, right: 24, bottom: 0, left: -12 }}>
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: '#5f6873' }}
          axisLine={{ stroke: '#e3e5e8' }}
          tickLine={false}
        />
        <YAxis hide domain={[0, 100]} />
        <ReferenceArea y1={CRITICAL_THRESHOLD} y2={100} fill="#dc2626" fillOpacity={0.06} />
        <ReferenceLine
          y={CRITICAL_THRESHOLD}
          stroke="#dc2626"
          strokeDasharray="3 3"
          label={{ value: 'Critical threshold', position: 'insideTopRight', fontSize: 10, fill: '#c81e1e' }}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, borderColor: '#e3e5e8', fontSize: 12 }}
          formatter={(value: number) => [`${value} / 100`, 'Risk score']}
        />
        <Line
          type="monotone"
          dataKey="current"
          stroke="#2b323a"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="forecast"
          stroke="#f59e0b"
          strokeWidth={2.5}
          strokeDasharray="6 4"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
