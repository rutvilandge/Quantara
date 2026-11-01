import { useRef, useState, type DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Database, FileSpreadsheet, Layers3, Search, Sparkles, Upload, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { Busy, Empty, Failure, Loading, PageHeading, Panel, Table, date, number, useResource } from './shared';

export type DatasetItem = { id: string; name: string; filename: string; row_count: number; column_count: number; quality_score: number; is_demo: boolean; created_at: string };
export type Column = { name: string; sourceName: string; type: string; missing: number; distinct: number; minimum: number | null; maximum: number | null; mean: number | null };
export type Dataset = { id: string; name: string; filename: string; columns: Column[]; rowCount: number; qualityScore: number; demo: boolean; createdAt: string; suggestions: string[]; duplicateRows: number };
type Rows = { rows: Record<string, unknown>[]; total: number; page: number; size: number };

export default function DatasetsPage() {
  const { data, loading, error, refresh } = useResource<DatasetItem[]>('/datasets');
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState(false);
  async function upload(file?: File) {
    if (!file || busy) return;
    setMessage('');
    if (!/\.(csv|xlsx)$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024) { setMessage('Choose a nonempty CSV or XLSX file up to 5 MB.'); return; }
    setBusy('upload');
    try { const body = new FormData(); body.append('file', file); const dataset = await apiRequest<Dataset>('/datasets', { method: 'POST', body }); navigate(`/app/datasets/${dataset.id}`); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setBusy(''); if (input.current) input.current.value = ''; }
  }
  async function demo() {
    setBusy('demo'); setMessage('');
    try { const d = await apiRequest<Dataset>('/datasets/demo', { method: 'POST' }); navigate(`/app/datasets/${d.id}`); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to create demo'); }
    finally { setBusy(''); }
  }
  function drop(event: DragEvent) { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files[0]); }
  return <>
    <PageHeading eyebrow="YOUR DATA FOUNDATIONS" title="Every dataset, a possibility." description="Bring your own data. Find a new perspective."><button className="q-button" onClick={() => input.current?.click()} disabled={!!busy}>{busy === 'upload' ? <Busy label="Uploading…"/> : <><Upload size={15}/>Upload dataset</>}</button></PageHeading>
    <input ref={input} type="file" className="q-sr-only" accept=".csv,.xlsx" aria-label="Choose dataset file" onChange={e => void upload(e.target.files?.[0])}/>
    {message && <p className="q-form-error" role="alert">{message}</p>}
    <div className={`q-upload-zone ${dragging ? 'q-dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}><span className="q-empty-icon"><Upload size={24}/></span><div><h2>A fresh perspective starts with a file.</h2><p>Drop a CSV or XLSX here. Up to 5 MB, 10,000 rows, 50 columns. We read the first Excel sheet.</p></div><button className="q-button q-secondary" onClick={() => input.current?.click()} disabled={!!busy}>Browse files <ArrowUpRight size={15}/></button></div>
    <div className="q-toolbar"><label className="q-search"><Search size={15}/><input aria-label="Search datasets" placeholder="Find a dataset…" value={search} onChange={e => setSearch(e.target.value)}/></label><span className="q-muted">{data?.length || 0} datasets in your workspace</span></div>
    {loading ? <Loading/> : error ? <Failure message={error} retry={refresh}/> : data?.length ? <div className="q-dataset-grid">{data.filter(d => d.name.toLowerCase().includes(search.toLowerCase())).map(d => <Link className="q-dataset-card" to={`/app/datasets/${d.id}`} key={d.id}><div className="q-dataset-card-top"><span className="q-list-icon"><FileSpreadsheet size={21}/></span><ArrowUpRight size={17}/></div><h2>{d.name}</h2><p>{d.filename}</p><div className="q-dataset-card-stats"><span><strong>{number(d.row_count)}</strong> rows</span><span><strong>{d.column_count}</strong> columns</span></div><div className="q-dataset-card-bottom"><span className="q-pill">{number(d.quality_score)}% complete</span><small>{d.is_demo ? 'SYNTHETIC DEMO' : date(d.created_at)}</small></div></Link>)}</div> : <Panel><Empty title="Make room for discovery." description="Upload your own data or explore the one included E-commerce Sales demo."><button className="q-button q-secondary" onClick={() => void demo()} disabled={!!busy}>{busy === 'demo' ? <Busy/> : <><Sparkles size={15}/>Explore E-commerce demo</>}</button></Empty></Panel>}
    {!data?.some(d => d.is_demo) && !!data?.length && <div className="q-demo-strip"><div><Sparkles size={20}/><span><strong>A thoughtful place to start.</strong><small>One E-commerce Sales demo. 750 synthetic orders. Clearly labeled, always.</small></span></div><button className="q-text-action" onClick={() => void demo()} disabled={!!busy}>Explore demo <ArrowRight size={15}/></button></div>}
    {!!data?.length && !data.some(d => d.name.toLowerCase().includes(search.toLowerCase())) && <Empty title="No matching datasets." description="Try a different name or clear your search."/>}
  </>;
}

export function DatasetDetail() {
  const { id } = useParams();
  const { data, loading, error, refresh } = useResource<Dataset>(`/datasets/${id}`);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('');
  const [direction, setDirection] = useState('asc');
  const [filterColumn, setFilterColumn] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [tab, setTab] = useState('preview');
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const params = new URLSearchParams({ page: String(page), size: '25', search, sort, direction, column: filterColumn, value: filterValue });
  const rows = useResource<Rows>(`/datasets/${id}/rows?${params}`);
  async function rename() {
    setSaving(true); setNotice('');
    try { await apiRequest(`/datasets/${id}`, { method: 'PATCH', body: JSON.stringify({ name: newName }) }); setRenaming(false); refresh(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Unable to rename'); }
    finally { setSaving(false); }
  }
  if (loading) return <Loading/>;
  if (error || !data) return <Failure message={error} retry={refresh}/>;
  return <><Link to="/app/datasets" className="q-back"><ArrowLeft size={14}/>All datasets</Link><PageHeading eyebrow={data.demo ? 'SYNTHETIC E-COMMERCE DEMO' : 'DATASET INTELLIGENCE'} title={data.name} description={`${data.filename} · Added ${date(data.createdAt)}`}><button className="q-button q-secondary" onClick={() => { setNewName(data.name); setRenaming(true); }}>Rename</button><Link className="q-button" to={`/app/queries?dataset=${id}`}>Explore with SQL <ArrowUpRight size={15}/></Link></PageHeading>
    {data.demo && <div className="q-inline-note"><Sparkles size={17}/><span>750 synthetic E-commerce orders, generated for exploration. These are fictional transactions, not customer data.</span></div>}
    {renaming && <Panel title="Rename dataset"><form className="q-inline-form" onSubmit={e => { e.preventDefault(); void rename(); }}><input aria-label="Dataset name" maxLength={150} required value={newName} onChange={e => setNewName(e.target.value)}/><button className="q-button" disabled={saving}>{saving ? <Busy/> : 'Save name'}</button><button className="q-icon-button" type="button" aria-label="Cancel rename" onClick={() => setRenaming(false)}><X size={18}/></button></form></Panel>}
    {notice && <p className="q-form-error" role="alert">{notice}</p>}
    <div className="q-kpis">{[['Total records', number(data.rowCount)], ['Detected columns', String(data.columns.length)], ['Data completeness', `${number(data.qualityScore)}%`], ['Duplicate rows', String(data.duplicateRows)]].map(([label, value]) => <div className="q-kpi" key={label}><div>{label}<Database size={15}/></div><strong>{value}</strong><small>Computed from this dataset</small></div>)}</div>
    <div className="q-tabs" role="tablist" aria-label="Dataset views">{['preview', 'schema', 'quality'].map(t => <button role="tab" aria-selected={tab === t} className={tab === t ? 'q-selected' : ''} key={t} onClick={() => setTab(t)}>{t === 'preview' ? 'Data preview' : t === 'schema' ? 'Schema & types' : 'Quality & suggestions'}</button>)}</div>
    {tab === 'preview' && <Panel><div className="q-toolbar"><label className="q-search"><Search size={15}/><input aria-label="Search data rows" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search every column…" maxLength={200}/></label><div><select aria-label="Sort column" value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}><option value="">Original order</option>{data.columns.map(c => <option key={c.name}>{c.name}</option>)}</select><select aria-label="Sort direction" value={direction} onChange={e => setDirection(e.target.value)}><option value="asc">Ascending</option><option value="desc">Descending</option></select></div></div><div className="q-toolbar"><div><select aria-label="Filter column" value={filterColumn} onChange={e => { setFilterColumn(e.target.value); setPage(0); }}><option value="">No column filter</option>{data.columns.map(c => <option key={c.name}>{c.name}</option>)}</select><input aria-label="Filter value" placeholder="Contains…" value={filterValue} disabled={!filterColumn} onChange={e => { setFilterValue(e.target.value); setPage(0); }} maxLength={200}/></div><span className="q-muted">{rows.data?.total ?? 0} matching records</span></div>{rows.error ? <Failure message={rows.error} retry={rows.refresh}/> : <div aria-busy={rows.loading}><Table columns={data.columns.map(c => c.name)} rows={rows.data?.rows || []}/></div>}<div className="q-pagination"><span>Page {page + 1} of {Math.max(1, Math.ceil((rows.data?.total || 0) / 25))}</span><div><button className="q-button q-secondary" disabled={page === 0 || rows.loading} onClick={() => setPage(p => p - 1)}>Previous</button><button className="q-button q-secondary" disabled={(page + 1) * 25 >= (rows.data?.total || 0) || rows.loading} onClick={() => setPage(p => p + 1)}>Next</button></div></div></Panel>}
    {tab === 'schema' && <Panel title="Structure, made visible" description="Inferred from all records. Dates use ISO format. Column names are normalized for SQL."><div className="q-schema"><div className="q-schema-title"><Layers3 size={18}/><strong>data</strong><span>{data.columns.length} columns</span></div>{data.columns.map(c => <div className="q-schema-row" key={c.name}><span><strong>{c.name}</strong><small>Source: {c.sourceName}</small></span><span className="q-pill">{c.type}</span><small>{c.distinct} distinct</small><span>{c.missing === 0 && c.distinct === data.rowCount ? 'Potential key' : `${c.missing} missing`}</span></div>)}</div><p className="q-caption">Potential keys have no missing or duplicate values. They are candidates, not verified business relationships.</p></Panel>}
    {tab === 'quality' && <div className="q-stack"><Panel title="A closer look at quality" description="Suggestions are computed from missing values and exact duplicates. Your source data is preserved.">{data.suggestions.map(s => <div className="q-quality-item" key={s}><Check size={17}/><span>{s}</span></div>)}</Panel><Panel title="Column profile"><Table columns={['column', 'type', 'missing', 'distinct', 'minimum', 'maximum', 'mean']} rows={data.columns.map(c => ({ column: c.name, type: c.type, missing: c.missing, distinct: c.distinct, minimum: c.minimum, maximum: c.maximum, mean: c.mean == null ? null : number(c.mean) }))}/></Panel></div>}
    <div className="q-demo-strip"><div><Sparkles size={20}/><span><strong>Follow your curiosity.</strong><small>Ask a question grounded in this dataset with the AI Copilot.</small></span></div><Link className="q-text-action" to={`/app/copilot?dataset=${id}`}>Ask Quantara <ArrowUpRight size={15}/></Link></div>
  </>;
}
