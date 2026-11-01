import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { Empty } from './shared';
import type { QueryResult } from './Queries';

export type ChartKind = 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'heatmap' | 'table';
const colors = ['#315b43', '#688d70', '#8cb79a', '#b5d8b6', '#496d55', '#789d7e', '#638e6b', '#89a990'];
const tooltipStyle = { background: 'var(--q-card)', border: '1px solid var(--q-border)', borderRadius: 12, color: 'var(--q-ink)', fontSize: 11 };
export function ResultChart({ result, kind = 'bar', dimension, metric, onSelect }: { result: QueryResult; kind?: ChartKind; dimension?: string; metric?: string; onSelect?: (value: string) => void }) {
  const numerics = result.columns.filter(c => result.rows.some(r => typeof r[c] === 'number'));
  const x = dimension || result.columns.find(c => !numerics.includes(c)) || result.columns[0];
  const y = metric || numerics.find(c => c !== x) || numerics[0];
  const rows = result.rows.slice(0, kind === 'pie' ? 8 : 100);
  if (!y || !rows.length || kind === 'table') return <Empty title="Clarity is in the details." description="The table below shows your query results. Choose a numeric result column to visualize it."/>;
  const axis = { tick: { fill: 'var(--q-muted)', fontSize: 10 }, axisLine: false, tickLine: false };
  const grid = <CartesianGrid stroke="var(--q-border)" vertical={false}/>;
  const axes = <><XAxis dataKey={x} {...axis} minTickGap={25}/><YAxis {...axis} width={55} tickFormatter={v => Intl.NumberFormat('en', { notation: 'compact' }).format(v)}/><Tooltip contentStyle={tooltipStyle}/></>;
  if (kind === 'heatmap') {
    const max = Math.max(...rows.map(r => Math.abs(Number(r[y]) || 0)), 1);
    return <div className="q-heatmap">{rows.map((row, i) => <button key={i} onClick={() => onSelect?.(String(row[x]))} style={{ backgroundColor: `rgba(84,124,96,${.12 + .75 * Math.abs(Number(row[y]) || 0) / max})`, color: Math.abs(Number(row[y]) || 0) / max > .6 ? '#fff' : 'var(--q-ink)' }}><span>{String(row[x] ?? '')}</span><strong>{Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(Number(row[y]))}</strong></button>)}</div>;
  }
  if (kind === 'scatter' && numerics.length < 2) return <Empty title="Two measures, one relationship." description="A scatter plot needs at least two numeric result columns."/>;
  if (kind === 'pie' && rows.some(r => Number(r[y]) < 0)) return <Empty title="Try a bar chart for this view." description="A pie chart requires nonnegative values."/>;
  return <div className="q-result-chart" aria-label={`${kind} chart of ${y} by ${x}`}><ResponsiveContainer width="100%" height="100%">
    {kind === 'pie' ? <PieChart><Pie data={rows} dataKey={y} nameKey={x} innerRadius="48%" outerRadius="75%" paddingAngle={3} label={({ name }) => String(name)} onClick={data => onSelect?.(String(data.name))}>{rows.map((_, i) => <Cell key={i} fill={colors[i % colors.length]}/>)}</Pie><Tooltip contentStyle={tooltipStyle}/></PieChart> : kind === 'scatter' ? <ScatterChart><CartesianGrid stroke="var(--q-border)"/><XAxis dataKey={numerics[0]} type="number" name={numerics[0]} {...axis}/><YAxis dataKey={numerics[1]} type="number" name={numerics[1]} {...axis}/><Tooltip contentStyle={tooltipStyle}/><Scatter data={rows} fill="#688d70"/></ScatterChart> : kind === 'line' ? <LineChart data={rows}>{grid}{axes}<Line dataKey={y} stroke="#547c60" strokeWidth={2.5} dot={false}/></LineChart> : kind === 'area' ? <AreaChart data={rows}><defs><linearGradient id={`q-result-${y}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8cb79a" stopOpacity={.4}/><stop offset="100%" stopColor="#8cb79a" stopOpacity={.02}/></linearGradient></defs>{grid}{axes}<Area dataKey={y} stroke="#547c60" strokeWidth={2.5} fill={`url(#q-result-${y})`}/></AreaChart> : <BarChart data={rows}>{grid}{axes}<Bar dataKey={y} fill="#688d70" radius={[5, 5, 0, 0]} maxBarSize={55} onClick={(_, index) => onSelect?.(String(rows[index]?.[x] ?? ""))}/></BarChart>}
  </ResponsiveContainer></div>;
}
