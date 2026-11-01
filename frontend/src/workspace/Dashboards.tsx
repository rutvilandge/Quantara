import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, Check, GripVertical, LayoutDashboard, Maximize, Minimize, Plus, Save, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { Busy, Empty, Failure, Loading, PageHeading, Panel, Table, date, number, useResource } from './shared';
import { ResultChart, type ChartKind } from './Charts';
import type { Dataset, DatasetItem } from './Datasets';
import type { QueryResult } from './Queries';

type Widget = { id: string; title: string; datasetId: string; sql: string; chartType: ChartKind | 'kpi'; dimension: string; metric: string };
type Layout = { id: string; name: string; widgets: Widget[]; updatedAt: string };
type DashboardItem = { id: string; name: string; widget_count: number; updated_at: string };
type Filters = { dateColumn: string; from: string; to: string; categoryColumn: string; categoryValue: string };
let queryQueue: Promise<unknown> = Promise.resolve();
function queuedQuery(options: RequestInit) {
  const job = queryQueue.then(() => apiRequest<QueryResult>('/queries/run', options));
  queryQueue = job.catch(() => undefined);
  return job;
}
function widget(datasetId: string, title: string, sql: string, chartType: Widget['chartType'], dimension = '', metric = ''): Widget { return { id: crypto.randomUUID(), datasetId, title, sql, chartType, dimension, metric }; }
function buildOverview(source: Dataset): Widget[] {
  const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
  const numeric = source.columns.filter(c => c.type === 'number');
  const metric = numeric.find(c => !/(^id$|_id$)/i.test(c.name)) || numeric[0];
  const category = source.columns.find(c => c.type === 'text' && c.distinct > 1 && c.distinct <= 100) || source.columns.find(c => c.type === 'boolean');
  const dateColumn = source.columns.find(c => c.type === 'date');
  const result = [widget(source.id, 'Total records', 'SELECT COUNT(*) AS records FROM data', 'kpi', '', 'records')];
  if (metric) result.push(widget(source.id, `Total ${metric.name.replaceAll('_', ' ')}`, `SELECT SUM(${quote(metric.name)}) AS total FROM data`, 'kpi', '', 'total'));
  if (dateColumn) result.push(widget(source.id, metric ? `${metric.name.replaceAll('_', ' ')} over time` : 'Records over time', `SELECT DATE_TRUNC('month', ${quote(dateColumn.name)})::DATE AS period, ${metric ? `SUM(${quote(metric.name)})` : 'COUNT(*)'} AS value FROM data GROUP BY period ORDER BY period`, 'area', 'period', 'value'));
  if (category) result.push(widget(source.id, metric ? `${metric.name.replaceAll('_', ' ')} by ${category.name.replaceAll('_', ' ')}` : `Records by ${category.name.replaceAll('_', ' ')}`, `SELECT ${quote(category.name)}, ${metric ? `SUM(${quote(metric.name)})` : 'COUNT(*)'} AS value FROM data GROUP BY ${quote(category.name)} ORDER BY value DESC LIMIT 15`, 'bar', category.name, 'value'));
  if (!category && numeric.length > 1) result.push(widget(source.id, 'Numeric relationship', `SELECT ${quote(numeric[0].name)}, ${quote(numeric[1].name)} FROM data LIMIT 200`, 'scatter', numeric[0].name, numeric[1].name));
  result.push(widget(source.id, 'Your data, in detail', 'SELECT * FROM data LIMIT 25', 'table'));
  return result;
}
export default function DashboardsPage() {
  const dashboards = useResource<DashboardItem[]>('/dashboards');
  const datasets = useResource<DatasetItem[]>('/datasets');
  const navigate = useNavigate();
  const [name, setName] = useState('My perspective');
  const [datasetId, setDatasetId] = useState('');
  const [template, setTemplate] = useState('auto');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const selected = datasetId || datasets.data?.find(d => d.is_demo)?.id || datasets.data?.[0]?.id || '';
  async function create(event: FormEvent) {
    event.preventDefault(); setCreating(true); setError('');
    try {
      let widgets: Widget[] = [];
      const source = template === 'blank' ? null : await apiRequest<Dataset>(`/datasets/${selected}`);
      const ecommerce = source && ['revenue', 'profit', 'region', 'product', 'date'].every(c => source.columns.some(column => column.name === c)) && source.columns.some(c => c.name === 'date' && c.type === 'date') && ['revenue', 'profit'].every(name => source.columns.some(c => c.name === name && c.type === 'number'));
      if ((template === 'ecommerce' || template === 'auto') && ecommerce) {
        widgets = [widget(selected, 'Total revenue', 'SELECT SUM(revenue) AS revenue FROM data', 'kpi', '', 'revenue'), widget(selected, 'Total profit', 'SELECT SUM(profit) AS profit FROM data', 'kpi', '', 'profit'), widget(selected, 'Monthly revenue', "SELECT DATE_TRUNC('month', date)::DATE AS month, SUM(revenue) AS revenue FROM data GROUP BY month ORDER BY month", 'area', 'month', 'revenue'), widget(selected, 'Revenue by region', 'SELECT region, SUM(revenue) AS revenue FROM data GROUP BY region ORDER BY revenue DESC', 'bar', 'region', 'revenue'), widget(selected, 'Product contribution', 'SELECT product, SUM(revenue) AS revenue FROM data GROUP BY product ORDER BY revenue DESC', 'pie', 'product', 'revenue')];
      }
      if ((template === 'auto' || template === 'ecommerce') && source && !ecommerce) widgets = buildOverview(source);
      if (template === 'explorer') widgets = [widget(selected, 'Total records', 'SELECT COUNT(*) AS records FROM data', 'kpi', '', 'records'), widget(selected, 'Your data, in detail', 'SELECT * FROM data LIMIT 25', 'table')];
      const result = await apiRequest<{ id: string }>('/dashboards', { method: 'POST', body: JSON.stringify({ name, widgets }) });
      navigate(`/app/dashboards/${result.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create dashboard'); }
    finally { setCreating(false); }
  }
  return <><PageHeading eyebrow="YOUR VISUAL STORIES" title="A perspective worth keeping." description="Build, arrange, and save dashboards from your own data."/><Panel title="Start with a clear canvas" description="Create an overview tailored to your columns, explore your data, or start with a blank canvas."><form className="q-dashboard-create" onSubmit={e => void create(e)}><label>Dashboard name<input required aria-label="Dashboard name" maxLength={150} value={name} onChange={e => setName(e.target.value)}/></label><label>Dataset<select aria-label="Dashboard dataset" value={selected} onChange={e => setDatasetId(e.target.value)}><option value="" disabled>Choose a dataset</option>{datasets.data?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Starting point<select aria-label="Dashboard template" value={template} onChange={e => setTemplate(e.target.value)}><option value="auto">Automatic overview</option><option value="ecommerce">E-commerce overview</option><option value="explorer">Data explorer</option><option value="blank">Blank canvas</option></select></label><button className="q-button" disabled={creating || !name.trim() || (!selected && template !== 'blank')}>{creating ? <Busy label="Creating…"/> : <><Plus size={15}/>Create dashboard</>}</button></form>{error && <p className="q-form-error" role="alert">{error}</p>}</Panel><div className="q-section-label">SAVED PERSPECTIVES</div>{dashboards.loading ? <Loading/> : dashboards.error ? <Failure message={dashboards.error} retry={dashboards.refresh}/> : dashboards.data?.length ? <div className="q-dataset-grid">{dashboards.data.map(d => <Link className="q-dataset-card" to={`/app/dashboards/${d.id}`} key={d.id}><div className="q-dataset-card-top"><span className="q-list-icon"><LayoutDashboard size={22}/></span><ArrowUpRight size={17}/></div><h2>{d.name}</h2><p>{d.widget_count} visualizations</p><p className="q-caption">Updated {date(d.updated_at)}</p></Link>)}</div> : <Panel><Empty title="A story takes shape." description="Create a dashboard above. Its layout and queries will be saved privately to your account."/></Panel>}</>;
}

function WidgetCard({ item, filters, onFilter }: { item: Widget; filters: Filters; onFilter: (column: string, value: string) => void }) {
  const source = useResource<Dataset>(`/datasets/${item.datasetId}`);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const filterString = JSON.stringify(filters);
  useEffect(() => {
    if (!source.data) return;
    const controller = new AbortController(); setLoading(true); setError('');
    const body: Record<string, unknown> = { datasetId: item.datasetId, sql: item.sql };
    const f: Filters = JSON.parse(filterString);
    if (source.data.columns.some(c => c.name === f.dateColumn && c.type === 'date')) Object.assign(body, { dateColumn: f.dateColumn, from: f.from, to: f.to });
    if (source.data.columns.some(c => c.name === f.categoryColumn)) Object.assign(body, { categoryColumn: f.categoryColumn, categoryValue: f.categoryValue });
    queuedQuery({ method: 'POST', body: JSON.stringify(body), signal: controller.signal }).then(setResult).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load chart'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [item.datasetId, item.sql, filterString, revision, source.data]);
  if (source.error || error) return <Failure message={source.error || error} retry={() => { source.refresh(); setRevision(v => v + 1); }}/>;
  if (loading || !result) return <div className="q-widget-loading" aria-label={`Loading ${item.title}`}><span className="q-spinner"/></div>;
  const numeric = item.metric || result.columns.find(c => result.rows.some(r => typeof r[c] === 'number')) || result.columns[0];
  return <><div className="q-widget-content">{item.chartType === 'kpi' ? <div className="q-kpi-result"><strong>{number(Number(result.rows[0]?.[numeric]) || 0)}</strong><span>{numeric}</span></div> : item.chartType === 'table' ? <Table columns={result.columns} rows={result.rows}/> : <ResultChart result={result} kind={item.chartType} dimension={item.dimension || undefined} metric={item.metric || undefined} onSelect={value => { if (source.data?.columns.some(c => c.name === item.dimension)) onFilter(item.dimension, value); }}/>}</div><div className="q-widget-source"><span>{source.data?.name}</span><small>{source.data?.demo ? 'Synthetic demo · Actual computed values' : 'Your uploaded data'}</small></div></>;
}

export function DashboardEditor() {
  const { id } = useParams();
  const saved = useResource<Layout>(`/dashboards/${id}`);
  const datasets = useResource<DatasetItem[]>('/datasets');
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('A new perspective');
  const [datasetId, setDatasetId] = useState('');
  const [sql, setSql] = useState('SELECT * FROM data LIMIT 25');
  const [kind, setKind] = useState<Widget['chartType']>('table');
  const [dimension, setDimension] = useState('');
  const [metric, setMetric] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dragged, setDragged] = useState<number | null>(null);
  const [presentation, setPresentation] = useState(false);
  const [filters, setFilters] = useState<Filters>({ dateColumn: 'date', from: '', to: '', categoryColumn: '', categoryValue: '' });
  useEffect(() => { if (saved.data) { setWidgets(saved.data.widgets); setName(saved.data.name); } }, [saved.data]);
  function move(from: number, to: number) { setWidgets(old => { const next = [...old]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }); setMessage(''); }
  async function save() {
    setSaving(true); setError(''); setMessage('');
    try { await apiRequest(`/dashboards/${id}`, { method: 'PUT', body: JSON.stringify({ name, widgets }) }); setMessage('Dashboard saved.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save dashboard'); }
    finally { setSaving(false); }
  }
  function add(event: FormEvent) { event.preventDefault(); if (widgets.length >= 12) return; setWidgets(w => [...w, widget(datasetId || datasets.data?.[0]?.id || '', title, sql, kind, dimension, metric)]); setAdding(false); setMessage(''); }
  if (saved.loading) return <Loading/>;
  if (saved.error) return <Failure message={saved.error} retry={saved.refresh}/>;
  return <div className={presentation ? 'q-presentation' : ''}><Link to="/app/dashboards" className="q-back"><ArrowLeft size={14}/>Saved dashboards</Link><PageHeading eyebrow="YOUR DATA, YOUR COMPOSITION" title={name} description="Drag charts to arrange. Select a category in a bar or pie chart to cross-filter matching datasets."><button className="q-button q-secondary" onClick={() => setPresentation(!presentation)}>{presentation ? <Minimize size={15}/> : <Maximize size={15}/>} {presentation ? 'Exit presentation' : 'Present'}</button>{!presentation && <><button className="q-button q-secondary" onClick={() => setAdding(!adding)} disabled={widgets.length >= 12}><Plus size={15}/>Add visualization</button><button className="q-button" onClick={() => void save()} disabled={saving || !name.trim()}>{saving ? <Busy/> : <><Save size={15}/>Save layout</>}</button></>}</PageHeading>
    {!presentation && <div className="q-dashboard-controls"><label>Dashboard name<input aria-label="Edit dashboard name" value={name} maxLength={150} onChange={e => { setName(e.target.value); setMessage(''); }}/></label><label>Date column<input aria-label="Dashboard date column" value={filters.dateColumn} onChange={e => setFilters(f => ({ ...f, dateColumn: e.target.value }))}/></label><label>From<input aria-label="Dashboard date from" type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}/></label><label>To<input aria-label="Dashboard date to" type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}/></label></div>}
    {filters.categoryColumn && <div className="q-inline-note">Cross-filter: {filters.categoryColumn} = {filters.categoryValue}<button className="q-icon-button" aria-label="Clear cross-filter" onClick={() => setFilters(f => ({ ...f, categoryColumn: '', categoryValue: '' }))}><X size={14}/></button></div>}
    {message && <p className="q-success" role="status"><Check size={14}/>{message}</p>}{error && <p className="q-form-error" role="alert">{error}</p>}
    {adding && <Panel title="Shape a new perspective"><form className="q-form" onSubmit={add}><div className="q-form-row"><label>Title<input required aria-label="Visualization title" value={title} maxLength={120} onChange={e => setTitle(e.target.value)}/></label><label>Dataset<select aria-label="Visualization dataset" value={datasetId || datasets.data?.[0]?.id || ''} onChange={e => setDatasetId(e.target.value)}>{datasets.data?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div><label>Read-only SQL<textarea aria-label="Visualization SQL" className="q-sql-editor" value={sql} onChange={e => setSql(e.target.value)} required maxLength={10000}/></label><div className="q-form-row"><label>Chart type<select aria-label="Visualization chart type" value={kind} onChange={e => setKind(e.target.value as Widget['chartType'])}>{['bar', 'line', 'area', 'pie', 'scatter', 'heatmap', 'table', 'kpi'].map(k => <option key={k}>{k}</option>)}</select></label><label>Dimension result column<input aria-label="Visualization dimension" value={dimension} onChange={e => setDimension(e.target.value)} placeholder="e.g. region (optional)"/></label><label>Metric result column<input aria-label="Visualization metric" value={metric} onChange={e => setMetric(e.target.value)} placeholder="e.g. revenue (optional)"/></label></div><button className="q-button" disabled={!datasets.data?.length}><Plus size={15}/>Add to canvas</button></form></Panel>}
    {!widgets.length ? <Panel><Empty title="A clear canvas. A fresh perspective." description="Add a visualization, arrange your layout, and save a dashboard that tells your story."><button className="q-button" onClick={() => setAdding(true)}><Plus size={15}/>Add a visualization</button></Empty></Panel> : <div className="q-builder-grid">{widgets.map((item, i) => <section className={`q-builder-widget ${item.chartType === 'kpi' ? 'q-builder-kpi' : ''}`} key={item.id} draggable={!presentation} onDragStart={() => setDragged(i)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragged != null) move(dragged, i); setDragged(null); }}><header><h2>{item.title}</h2>{!presentation && <div><button className="q-icon-button" aria-label={`Move ${item.title} up`} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp size={13}/></button><button className="q-icon-button" aria-label={`Move ${item.title} down`} disabled={i === widgets.length - 1} onClick={() => move(i, i + 1)}><ArrowDown size={13}/></button><GripVertical size={14}/><button className="q-icon-button" aria-label={`Remove ${item.title}`} onClick={() => setWidgets(w => w.filter(x => x.id !== item.id))}><X size={14}/></button></div>}</header>{!presentation && <select className="q-widget-kind" aria-label={`Chart type for ${item.title}`} value={item.chartType} onChange={e => setWidgets(w => w.map(x => x.id === item.id ? { ...x, chartType: e.target.value as Widget['chartType'] } : x))}>{['bar', 'line', 'area', 'pie', 'scatter', 'heatmap', 'table', 'kpi'].map(k => <option key={k}>{k}</option>)}</select>}<WidgetCard item={item} filters={filters} onFilter={(column, value) => setFilters(f => ({ ...f, categoryColumn: column, categoryValue: value }))}/></section>)}</div>}
  </div>;
}
