import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileDown, Play } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { Busy, Empty, Failure, Loading, PageHeading, Panel, Table, useResource } from './shared';
import { exportCsv, exportPdf } from './exports';
import type { DatasetItem } from './Datasets';
import type { QueryResult } from './Queries';

export default function ReportsPage() {
  const datasets = useResource<DatasetItem[]>('/datasets');
  const saved = useResource<{ id: string; name: string; dataset_id: string; sql_text: string }[]>('/queries');
  const [dataset, setDataset] = useState('');
  const [title, setTitle] = useState('My analytics report');
  const [sql, setSql] = useState('SELECT * FROM data LIMIT 100');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [resultSource, setResultSource] = useState('');
  const [resultSql, setResultSql] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const id = dataset || datasets.data?.[0]?.id || '';
  async function preview() { setBusy('preview'); setError(''); setResult(null); try { const r = await apiRequest<QueryResult>('/queries/run', { method: 'POST', body: JSON.stringify({ datasetId: id, sql }) }); setResult(r); setResultSql(sql); const d = datasets.data?.find(d => d.id === id); setResultSource(`${d?.name || ''}${d?.is_demo ? ' (synthetic demo)' : ''}`); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to build report'); } finally { setBusy(''); } }
  async function pdf() { if (!result) return; setBusy('pdf'); try { await exportPdf(result, title, resultSource, resultSql); } catch { setError('The PDF could not be generated. Try exporting CSV.'); } finally { setBusy(''); } }
  if (datasets.loading) return <Loading/>;
  if (datasets.error) return <Failure message={datasets.error} retry={datasets.refresh}/>;
  return <><PageHeading eyebrow="CLARITY, READY TO SHARE" title="A story beyond the screen." description="Export real query results as PDF or CSV, with source context and clear provenance."/>{!datasets.data?.length ? <Panel><Empty title="A report begins with your data." description="Add a dataset to create your first report."><Link className="q-button" to="/app/datasets">Explore datasets</Link></Empty></Panel> : <div className="q-stack"><Panel title="Compose your report"><form className="q-form" onSubmit={e => { e.preventDefault(); void preview(); }}><div className="q-form-row"><label>Report title<input aria-label="Report title" value={title} maxLength={100} required onChange={e => setTitle(e.target.value)}/></label><label>Dataset<select aria-label="Report dataset" value={id} onChange={e => { setDataset(e.target.value); setResult(null); }}>{datasets.data.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label></div><label>Reuse a saved question<select aria-label="Report saved query" defaultValue="" onChange={e => { const q = saved.data?.find(q => q.id === e.target.value); if (q) { setDataset(q.dataset_id); setSql(q.sql_text); setTitle(q.name); setResult(null); } }}><option value="">Choose a saved query (optional)</option>{saved.data?.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}</select></label><label>Source SQL<textarea className="q-sql-editor" aria-label="Report SQL" maxLength={10000} value={sql} onChange={e => { setSql(e.target.value); setResult(null); }}/></label><button className="q-button" disabled={!!busy || !sql.trim()}>{busy === 'preview' ? <Busy label="Preparing report…"/> : <><Play size={14}/>Preview report</>}</button></form>{error && <p className="q-form-error" role="alert">{error}</p>}</Panel>{result && <Panel title={title} description={`${resultSource} · ${result.rows.length} executed result rows${result.truncated ? ' · Limited to 500 rows' : ''}`} action={<div className="q-heading-actions"><button className="q-button q-secondary" onClick={() => exportCsv(result, title)} disabled={!!busy}><Download size={14}/>Export CSV</button><button className="q-button" onClick={() => void pdf()} disabled={!!busy}>{busy === 'pdf' ? <Busy/> : <><FileDown size={14}/>Export PDF</>}</button></div>}><Table columns={result.columns} rows={result.rows}/><p className="q-caption">Exports include actual query results. CSV text is escaped to reduce spreadsheet formula injection. PDF reports include their source query.</p></Panel>}</div>}</>;
}
