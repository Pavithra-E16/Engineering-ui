import { useChartTheme } from '../theme';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
/** Validated categorical order (dataviz reference palette) — assign in this order, never cycled. */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
/** Single-hue sequential (magnitude) — brand blue. */
export const SEQ = '#1a8fe0';
export const STATUS = { good: '#059669', warning: '#d97706', critical: '#dc2626' };
/** Axis / grid / tooltip styling for the current light or dark theme. */
function useChartStyle() {
  const t = useChartTheme();
  return {
    grid: t.grid,
    surface: t.tooltipBg,
    axis: { fontSize: 11, fill: t.axis },
    tooltipStyle: {
      contentStyle: {
        borderRadius: 10,
        border: `1px solid ${t.tooltipBorder}`,
        background: t.tooltipBg,
        color: t.tooltipText,
        fontSize: 12,
        boxShadow: '0 4px 12px rgba(15,23,42,.12)',
      },
      labelStyle: { color: t.tooltipText },
      cursor: { fill: t.cursor },
    },
  };
}
export function ChartFrame({ height = 260, children }) {
  return (
    <div style={{ height }} className="chart">
      {children}
    </div>
  );
}
export function SimpleBar({ data, x, bars, height = 260, stacked, unit = '', horizontal, refLine, yMax }) {
  const { grid, axis, tooltipStyle, surface } = useChartStyle();
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 12, left: horizontal ? 8 : -12, bottom: 0 }}
          barGap={2}
          barCategoryGap="22%"
        >
          <CartesianGrid stroke={grid} vertical={!!horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={axis} axisLine={false} tickLine={false} unit={unit} domain={[0, yMax ?? 'auto']} />
              <YAxis type="category" dataKey={x} tick={axis} axisLine={false} tickLine={false} width={88} />
            </>
          ) : (
            <>
              <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={axis} axisLine={false} tickLine={false} unit={unit} domain={[0, yMax ?? 'auto']} />
            </>
          )}
          <Tooltip {...tooltipStyle} formatter={(v) => `${typeof v === 'number' ? v.toLocaleString('en-IN') : v}${unit}`} />
          {bars.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: axis.fill }} />}
          {refLine && (
            <ReferenceLine
              y={horizontal ? undefined : refLine.y}
              x={horizontal ? refLine.y : undefined}
              stroke={STATUS.critical}
              strokeDasharray="4 4"
              label={{ value: refLine.label, fontSize: 10, fill: '#b91c1c', position: 'insideTopRight' }}
            />
          )}
          {bars.map((b, i) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.label}
              fill={b.color ?? (bars.length === 1 ? SEQ : SERIES[i])}
              stackId={stacked ? 's' : undefined}
              radius={
                stacked
                  ? i === bars.length - 1
                    ? horizontal
                      ? [0, 4, 4, 0]
                      : [4, 4, 0, 0]
                    : 0
                  : horizontal
                    ? [0, 4, 4, 0]
                    : [4, 4, 0, 0]
              }
              maxBarSize={36}
              stroke={surface}
              strokeWidth={stacked ? 1 : 0}
              animationDuration={450}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
export function SimpleLine({ data, x, lines, height = 260, unit = '', yDomain, refLine }) {
  const { grid, axis, tooltipStyle, surface } = useChartStyle();
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} unit={unit} domain={yDomain ?? ['auto', 'auto']} />
          <Tooltip {...tooltipStyle} cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} formatter={(v) => `${v}${unit}`} />
          {lines.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: axis.fill }} />}
          {refLine && (
            <ReferenceLine
              y={refLine.y}
              stroke={STATUS.critical}
              strokeDasharray="4 4"
              label={{ value: refLine.label, fontSize: 10, fill: '#b91c1c', position: 'insideBottomRight' }}
            />
          )}
          {lines.map((l, i) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color ?? (lines.length === 1 ? SEQ : SERIES[i])}
              strokeWidth={2}
              dot={{ r: 3.5, strokeWidth: 2, fill: surface }}
              activeDot={{ r: 5, stroke: surface, strokeWidth: 2 }}
              animationDuration={450}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
/** Horizontal proportion bars — used instead of pie charts for shares. */
export function ShareBars({ items, unit = '' }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="plain-list" style={{ gap: 10 }}>
      {items.map((i) => (
        <li key={i.label}>
          <div className="meter-label">
            <span className="strong">{i.label}</span>
            <span className="muted">
              {i.value.toLocaleString('en-IN')}
              {unit}
              {i.sub ? ` · ${i.sub}` : ''}
            </span>
          </div>
          <div className="progress" style={{ height: 8 }}>
            <span style={{ width: `${(i.value / max) * 100}%`, background: SEQ }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
