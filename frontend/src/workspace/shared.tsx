import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowUpRight, LoaderCircle, Sparkles } from 'lucide-react';
import { apiRequest } from '../lib/api';

export function useResource<T>(path: string, version = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    apiRequest<T>(path, { signal: controller.signal }).then(setData).catch(e => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load this view');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, revision, version]);
  return { data, loading, error, refresh };
}

export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: ReactNode }) {
  return <div className="q-page-heading"><div><span className="q-eyebrow"><span/>{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div><div className="q-heading-actions">{children}</div></div>;
}
export function Panel({ title, description, children, action, className = '' }: { title?: string; description?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`q-panel ${className}`}>{title && <header className="q-panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</header>}{children}</section>;
}
export function Empty({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="q-empty"><span className="q-empty-icon"><Sparkles size={25}/></span><h3>{title}</h3><p>{description}</p>{children}</div>;
}
export function Loading() {
  return <div className="q-loading" role="status" aria-label="Loading workspace"><div className="q-skeleton q-skeleton-title"/><div className="q-kpis">{[1, 2, 3, 4].map(i => <div className="q-skeleton" key={i}/>)}</div><div className="q-skeleton q-skeleton-chart"/><span className="q-sr-only">Loading…</span></div>;
}
export function Failure({ message, retry }: { message: string; retry: () => void }) {
  return <div className="q-error" role="alert"><AlertCircle size={20}/><span>{message}</span><button className="q-button q-secondary" onClick={retry}>Try again</button></div>;
}
export function Busy({ label = 'Working…' }: { label?: string }) { return <><LoaderCircle className="q-spin" size={16}/>{label}</>; }
export const number = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
export const date = (d: string) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export function Table({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  return <div className="q-table-scroll"><table className="q-table"><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{columns.map(c => <td key={c} title={String(r[c] ?? '')}>{r[c] == null ? <span className="q-muted">Missing</span> : String(r[c])}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="q-table-empty">No matching rows.</p>}</div>;
}
export function TextAction({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button className="q-text-action" onClick={onClick}>{children}<ArrowUpRight size={15}/></button>; }
