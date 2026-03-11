'use client'

import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import type { ChartConfig } from '@/types'

interface ChartPanelProps {
  config: ChartConfig | null
}

const CHART_COLORS = [
  'hsl(216, 47%, 20%)',
  'hsl(189, 53%, 36%)',
  'hsl(45, 100%, 51%)',
  'hsl(354, 70%, 54%)',
  'hsl(134, 61%, 41%)',
]

function BarChartView({ config }: { config: ChartConfig }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={config.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
        <XAxis
          dataKey={config.xKey}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid hsl(220, 13%, 91%)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            fontSize: '13px',
          }}
        />
        {config.yKeys.length > 1 && <Legend />}
        {config.yKeys.map((yKey, idx) => (
          <Bar
            key={yKey.key}
            dataKey={yKey.key}
            name={yKey.name}
            fill={yKey.color || CHART_COLORS[idx % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function LineChartView({ config }: { config: ChartConfig }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={config.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
        <XAxis
          dataKey={config.xKey}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid hsl(220, 13%, 91%)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            fontSize: '13px',
          }}
        />
        {config.yKeys.length > 1 && <Legend />}
        {config.yKeys.map((yKey, idx) => (
          <Line
            key={yKey.key}
            type="monotone"
            dataKey={yKey.key}
            name={yKey.name}
            stroke={yKey.color || CHART_COLORS[idx % CHART_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2 }}
            activeDot={{ r: 5, strokeWidth: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function AreaChartView({ config }: { config: ChartConfig }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={config.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
        <XAxis
          dataKey={config.xKey}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid hsl(220, 13%, 91%)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            fontSize: '13px',
          }}
        />
        {config.yKeys.length > 1 && <Legend />}
        {config.yKeys.map((yKey, idx) => {
          const color = yKey.color || CHART_COLORS[idx % CHART_COLORS.length]
          return (
            <Area
              key={yKey.key}
              type="monotone"
              dataKey={yKey.key}
              name={yKey.name}
              stroke={color}
              fill={color}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          )
        })}
      </AreaChart>
    </ResponsiveContainer>
  )
}

function PieChartView({ config }: { config: ChartConfig }) {
  const dataKey = config.yKeys[0]?.key ?? 'value'
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={config.data}
          dataKey={dataKey}
          nameKey={config.xKey}
          cx="50%"
          cy="50%"
          outerRadius={110}
          innerRadius={50}
          paddingAngle={2}
          label={({ name, percent }: { name?: string; percent?: number }) =>
            `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={{ strokeWidth: 1 }}
        >
          {config.data.map((_, idx) => (
            <Cell
              key={`cell-${idx}`}
              fill={CHART_COLORS[idx % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid hsl(220, 13%, 91%)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            fontSize: '13px',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

function ChartRenderer({ config }: { config: ChartConfig }) {
  switch (config.type) {
    case 'bar':
      return <BarChartView config={config} />
    case 'line':
      return <LineChartView config={config} />
    case 'area':
      return <AreaChartView config={config} />
    case 'pie':
      return <PieChartView config={config} />
    case 'composed':
      return <BarChartView config={config} />
    default:
      return <BarChartView config={config} />
  }
}

export function ChartPanel({ config }: ChartPanelProps) {
  if (!config) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
        <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground">
          Charts will appear here when you ask data questions
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-semibold text-primary">{config.title}</h3>
      <ChartRenderer config={config} />
      {config.interpretation && (
        <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3 mt-2">
          {config.interpretation}
        </p>
      )}
    </div>
  )
}
