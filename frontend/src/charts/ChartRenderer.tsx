/**
 * Chart renderer — Task C1
 * Drives all chart types from a backend ChartSpec.
 * Charts use ONLY backend-computed values; no frontend calculations.
 */
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceDot,
} from 'recharts'
import type { ChartSpec } from '@/types'

const PALETTE = [
  'hsl(220,56%,62%)',  // brand blue
  'hsl(186,95%,55%)',  // cyan
  'hsl(263,80%,65%)',  // violet
  'hsl(38,95%,58%)',   // amber
  'hsl(158,75%,50%)',  // emerald
  'hsl(348,90%,62%)',  // rose
]

function getColor(index: number, overrides?: string[]) {
  return overrides?.[index] ?? PALETTE[index % PALETTE.length]
}

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(224,16%,14%)',
  border: '1px solid hsl(224,14%,24%)',
  borderRadius: '10px',
  color: 'hsl(224,4%,90%)',
  fontSize: '13px',
}

function formatValue(v: unknown): string {
  if (typeof v === 'number') {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
    return v.toLocaleString()
  }
  return String(v ?? '')
}

interface ChartRendererProps {
  spec: ChartSpec
  height?: number
  className?: string
}

export function ChartRenderer({ spec, height = 300, className = '' }: ChartRendererProps) {
  if (!spec || spec.type === 'none') return null

  const commonAxisProps = {
    tick: { fill: 'hsl(224,8%,55%)', fontSize: 12 },
    axisLine: { stroke: 'hsl(224,14%,22%)' },
    tickLine: false as const,
  }

  const gridProps = {
    strokeDasharray: '3 3',
    stroke: 'hsl(224,14%,22%)',
    vertical: false as const,
  }

  const tooltipProps = {
    contentStyle: TOOLTIP_STYLE,
    formatter: (value: unknown) => [formatValue(value), ''],
    labelStyle: { color: 'hsl(224,4%,70%)', marginBottom: 4 },
  }

  return (
    <div className={`w-full ${className}`}>
      {spec.title && (
        <p className="text-sm font-semibold text-surface-200 mb-3">{spec.title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {spec.type === 'bar' ? (
          <BarChart data={spec.data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={spec.x_key} {...commonAxisProps} />
            <YAxis {...commonAxisProps} tickFormatter={v => formatValue(v)} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(224,8%,62%)' }} />
            {spec.y_keys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={getColor(i, spec.colors)} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : spec.type === 'line' ? (
          <LineChart data={spec.data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={spec.x_key} {...commonAxisProps} />
            <YAxis {...commonAxisProps} tickFormatter={v => formatValue(v)} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(224,8%,62%)' }} />
            {spec.y_keys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={getColor(i, spec.colors)}
                strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        ) : spec.type === 'area' ? (
          <AreaChart data={spec.data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <defs>
              {spec.y_keys.map((key, i) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={getColor(i, spec.colors)} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={getColor(i, spec.colors)} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={spec.x_key} {...commonAxisProps} />
            <YAxis {...commonAxisProps} tickFormatter={v => formatValue(v)} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(224,8%,62%)' }} />
            {spec.y_keys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key}
                stroke={getColor(i, spec.colors)} strokeWidth={2}
                fill={`url(#grad-${key})`} />
            ))}
          </AreaChart>
        ) : spec.type === 'scatter' ? (
          <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis type="number" dataKey={spec.x_key} name={spec.x_label} {...commonAxisProps} tickFormatter={v => formatValue(v)} />
            <YAxis type="number" dataKey={spec.y_keys[0]} name={spec.y_label} {...commonAxisProps} tickFormatter={v => formatValue(v)} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={TOOLTIP_STYLE}
              formatter={(value: unknown) => [formatValue(value), '']} />
            <Scatter
              data={spec.data}
              fill="hsl(220,56%,62%)"
              fillOpacity={0.7}
            />
            {spec.anomaly_markers?.map(m => (
              <ReferenceDot
                key={m.index}
                x={spec.data[m.index]?.[spec.x_key ?? ''] as number}
                y={spec.data[m.index]?.[spec.y_keys[0]] as number}
                r={8}
                fill="hsl(348,90%,62%)"
                fillOpacity={0.4}
                stroke="hsl(348,90%,62%)"
                strokeWidth={1.5}
                label={{ value: m.label, fill: 'hsl(348,90%,72%)', fontSize: 10, dy: -12 }}
              />
            ))}
          </ScatterChart>
        ) : (
          <LineChart data={[]} />
        )}
      </ResponsiveContainer>
    </div>
  )
}

/** KPI card — for chart_spec.type === 'kpi' or standalone use */
export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  trend,
}: {
  label: string
  value: string | number
  unit?: string
  delta?: number
  deltaLabel?: string
  trend?: 'up' | 'down' | 'neutral'
}) {
  const trendColor =
    trend === 'up' ? 'text-accent-emerald' :
    trend === 'down' ? 'text-accent-rose' :
    'text-surface-400'

  const trendIcon =
    trend === 'up' ? '↑' :
    trend === 'down' ? '↓' :
    '–'

  return (
    <div className="card p-5 flex flex-col gap-2">
      <p className="stat-label">{label}</p>
      <p className="stat-value text-white">
        {unit && <span className="text-surface-400 text-lg mr-1">{unit}</span>}
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {delta !== undefined && (
        <p className={`text-xs font-medium ${trendColor}`}>
          {trendIcon} {Math.abs(delta)}%
          {deltaLabel && <span className="text-surface-500 font-normal ml-1">{deltaLabel}</span>}
        </p>
      )}
    </div>
  )
}
