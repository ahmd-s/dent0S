'use client'

import { memo, useId } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }
const TOOLTIP_CONTENT_STYLE = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
}
const TOOLTIP_LABEL_STYLE = { color: 'hsl(var(--foreground))', fontWeight: 600 }
const CHART_MARGIN = { top: 4, right: 4, bottom: 0, left: 0 }

/**
 * Recharts is ~380 KB parsed, so this lives in its own module and is pulled in
 * with next/dynamic by the analytics page rather than shipped in its chunk.
 */
function AnalyticsChart({ data, dataKey = 'value', color = '#0D9488', type = 'bar', formatY, height = 200 }) {
  const gradientId = `analytics-grad-${useId().replace(/:/g, '')}`

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
      <XAxis
        dataKey="label"
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={false}
        interval="preserveStartEnd"
      />
      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatY} />
      <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
    </>
  )

  return (
    <ResponsiveContainer width="100%" height={height}>
      {type === 'area' ? (
        <AreaChart data={data} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {axes}
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
        </AreaChart>
      ) : (
        <BarChart data={data} margin={CHART_MARGIN}>
          {axes}
          <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}

export default memo(AnalyticsChart)
