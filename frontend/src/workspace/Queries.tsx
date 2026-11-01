import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Code2, Play, Save, Sparkles } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { Busy, Empty, Failure, Loading, PageHeading, Panel, Table, date, number, useResource } from './shared';
import type { Dataset, DatasetItem } from './Datasets';

export type QueryResult = { columns: string[]; rows: Record<string, unknown>[]; durationMs: number; truncated: boolean };
type Saved = { id: string; dataset_id: string; name: string; sql_text: string; created_at: string };
type History = { id: string; dataset_id: string; question: string | null; sql_text: string; row_count: number; duration_ms: number; created_at: string };
export default function QueriesPage() {
  const [params, setParams] = useSearchParams();
  const list = useResource<DatasetItem[]>('/datasets');
  const saved = useResource<Saved[]>('/queries');
  const history = useResource<History[]>('/queries/history');
  const datasetId = params.get('dataset') || list.data?.[0]?.id || '';
  const dataset = useResource<Dataset>(`/datasets/${datasetId || '00000000-0000-0000-0000-000000000000'}`);
  const [sql, setSql] = useState('SELECT * FROM data LIMIT 25');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [name, setName] = useState('');
  const [tab, setTab] = useState('saved');
  async function run() {
    setBusy('run'); setError(''); setMessage(''); setResult(null);
    try { setResult(await apiRequest<QueryResult>('/queries/run', { method: 'POST', body: JSON.stringify({ datasetId, sql }) })); history.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to run query'); }
    finally { setBusy(''); }
  }
  async function save() {
    setBusy('save'); setError('');
    try { await apiRequest('/queries', { method: 'POST', body: JSON.stringify({ datasetId, sql, name }) }); setName(''); setMessage('Query saved to your workspace.'); saved.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save query'); }
    finally { setBusy(''); }
  }
  if (list.loading) return <Loading/>;
  if (list.error) return <Failure message={list.error} retry={list.refresh}/>;
  return <><PageHeading eyebrow="THOUGHTFUL EXPLORATION" title="Questions, with structure." description="Read-only SQL, isolated to your selected dataset."/>{!list.data?.length ? <Panel><Empty title="Bring a dataset into focus." description="Upload a CSV/XLSX or explore the E-commerce demo before running SQL."><Link className="q-button" to="/app/datasets">Explore datasets</Link></Empty></Panel> : <div className="q-stack"><Panel title="SQL workspace" action={<span className="q-pill">Read only · 500 result rows · 8s execution limit</span>}><div className="q-toolbar"><label className="q-field-inline">Dataset<select aria-label="Query dataset" value={datasetId} onChange={e => { setParams({ dataset: e.target.value }); setResult(null); }}>{list.data.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label><span className="q-muted">Table name: <code>data</code></span></div><textarea className="q-sql-editor" aria-label="SQL query" value={sql} onChange={e => { setSql(e.target.value); setResult(null); }} spellCheck={false} maxLength={10000}/><div className="q-query-columns">{dataset.data?.columns.map(c => <button key={c.name} title={`Insert ${c.name} (${c.type})`} onClick={() => setSql(s => s + ` "${c.name}"`)}><Code2 size={11}/>{c.name}<small>{c.type}</small></button>)}</div><div className="q-toolbar"><button className="q-button" disabled={!!busy || !sql.trim()} onClick={() => void run()}>{busy === 'run' ? <Busy label="Running analysis…"/> : <><Play size={14}/>Run query</>}</button><form className="q-inline-form" onSubmit={e => { e.preventDefault(); void save(); }}><input aria-label="Saved query name" placeholder="Name this query…" required maxLength={150} value={name} onChange={e => setName(e.target.value)}/><button className="q-button q-secondary" disabled={!!busy || !name.trim()}>{busy === 'save' ? <Busy/> : <><Save size={14}/>Save</>}</button></form></div>{error && <p className="q-form-error" role="alert">{error}</p>}{message && <p className="q-inline-note" role="status">{message}</p>}</Panel>{result && <Panel title="Results, grounded in your data" description={`${number(result.rows.length)} rows · ${result.durationMs} ms${result.truncated ? ' · Limited to the first 500 rows' : ''}`}><Table columns={result.columns} rows={result.rows}/></Panel>}<Panel title="Your analytical trail" action={<div className="q-tabs"><button className={tab === 'saved' ? 'q-selected' : ''} onClick={() => setTab('saved')}>Saved queries</button><button className={tab === 'history' ? 'q-selected' : ''} onClick={() => setTab('history')}>History</button></div>}>{(tab === 'saved' ? saved.loading : history.loading) ? <span className="q-spinner"/> : (tab === 'saved' ? saved.data : history.data)?.length ? <div className="q-query-list">{(tab === 'saved' ? saved.data : history.data)?.map(q => <button key={q.id} onClick={() => { setParams({ dataset: q.dataset_id }); setSql(q.sql_text); setResult(null); }}><span><strong>{'name' in q ? q.name : q.question || 'SQL analysis'}</strong><small>{date(q.created_at)}</small><code>{q.sql_text}</code></span><Play size={16}/></button>)}</div> : <Empty title={tab === 'saved' ? 'Keep a good question close.' : 'A trail of discovery awaits.'} description={tab === 'saved' ? 'Save SQL queries above to reuse them whenever you need.' : 'Successfully executed analyses will appear here.'}/>}</Panel><div className="q-inline-note"><Sparkles size={17}/><span>Prefer a conversation? <Link to={`/app/copilot?dataset=${datasetId}`}>Ask the AI Copilot</Link> to draft a query you can review and run.</span></div></div>}</>;
}
