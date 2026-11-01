import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bell, Check, CheckCheck, Database, LayoutDashboard, LogOut, Search, ShieldCheck, Sparkles, Sun, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth, type Account } from '../lib/auth';
import { Busy, Empty, Failure, PageHeading, Panel, date, number, useResource } from './shared';

export type Preferences = { theme: 'light' | 'dark' | 'system'; onboarding_complete: boolean };
type Usage = { queries: { count: number; average_ms: number; result_rows: number }; aiQuestions: number; statisticalRuns: number; datasets: number; rows: number };
export function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const preferences = useResource<Preferences>('/account/preferences');
  const usage = useResource<Usage>('/account/usage');
  const [name, setName] = useState(user?.fullName || '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function saveProfile() { setBusy('profile'); setError(''); setMessage(''); try { updateUser(await apiRequest<Account>('/account/profile', { method: 'PATCH', body: JSON.stringify({ fullName: name.trim() }) })); setMessage('Profile saved.'); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update profile'); } finally { setBusy(''); } }
  async function preference(value: Partial<{ theme: string; onboardingComplete: boolean }>) { setBusy('preferences'); setError(''); try { await apiRequest('/account/preferences', { method: 'PATCH', body: JSON.stringify(value) }); if (value.theme) window.dispatchEvent(new CustomEvent('quantara:theme', { detail: value.theme })); preferences.refresh(); if (value.onboardingComplete === false) navigate('/app'); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save preferences'); } finally { setBusy(''); } }
  async function signOut() { try { await logout(); navigate('/login'); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign out'); } }
  return <><PageHeading eyebrow="A SPACE THAT FEELS LIKE YOU" title="Your account, thoughtfully." description="Your profile, appearance, and a transparent view of workspace usage."/>{error && <p className="q-form-error" role="alert">{error}</p>}{message && <p className="q-success" role="status"><Check size={14}/>{message}</p>}<div className="q-two-col"><Panel title="Profile" description="A personal workspace, with your name on it."><div className="q-profile-large"><span className="q-avatar">{user?.fullName.slice(0, 1)}</span><div><h3>{user?.fullName}</h3><p>{user?.email}</p></div></div><form className="q-form" onSubmit={e => { e.preventDefault(); void saveProfile(); }}><label>Full name<input aria-label="Profile full name" value={name} required minLength={2} maxLength={100} onChange={e => setName(e.target.value)}/></label><label>Email address<input aria-label="Account email" value={user?.email || ''} readOnly/></label><button className="q-button" disabled={!!busy}>{busy === 'profile' ? <Busy/> : 'Save profile'}</button></form><p className="q-caption">Account ID: {user?.id}</p></Panel><Panel title="Appearance & getting started"><div className="q-setting-row"><Sun size={22}/><div><strong>A familiar perspective, in every light.</strong><p>Forest and sage, warm whites and thoughtful contrast. Your preference follows your account.</p></div></div><label className="q-form">Appearance<select aria-label="Appearance preference" value={preferences.data?.theme || 'system'} disabled={!!busy || preferences.loading} onChange={e => void preference({ theme: e.target.value })}><option value="system">Match this device</option><option value="light">Light</option><option value="dark">Dark</option></select></label><div className="q-setting-row"><Sparkles size={22}/><div><strong>A little guidance goes a long way.</strong><p>Revisit your introduction to uploading data, asking questions, and saving visual stories.</p><button className="q-text-action" disabled={!!busy} onClick={() => void preference({ onboardingComplete: false })}>Reopen getting-started guide <ArrowUpRight size={14}/></button></div></div></Panel></div><div className="q-section-label">YOUR WORKSPACE, MEASURED</div>{usage.error ? <Failure message={usage.error} retry={usage.refresh}/> : <div className="q-kpis">{[['Queries executed', usage.data?.queries.count], ['AI questions asked', usage.data?.aiQuestions], ['Statistical analyses', usage.data?.statisticalRuns], ['Rows in your datasets', usage.data?.rows]].map(([label, value]) => <div className="q-kpi" key={String(label)}><div>{label}</div><strong>{value == null ? '—' : number(Number(value))}</strong><small>Actual account activity</small></div>)}</div>}<Panel title="Session & security"><div className="q-setting-row"><ShieldCheck size={22}/><div><strong>Protected, from sign-in to sign-out.</strong><p>Your account uses a secure server session, HTTP-only session cookie, CSRF protection, and a 30-minute idle timeout. Shared links never grant access to your private data.</p></div></div><button className="q-button q-secondary" onClick={() => void signOut()}><LogOut size={16}/>Sign out securely</button></Panel></>;
}

export function Onboarding({ datasets, queries, dashboards }: { datasets: number; queries: number; dashboards: number }) {
  const preferences = useResource<Preferences>('/account/preferences');
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (preferences.loading || preferences.error || preferences.data?.onboarding_complete) return null;
  async function dismiss() { try { await apiRequest('/account/preferences', { method: 'PATCH', body: JSON.stringify({ onboardingComplete: true }) }); preferences.refresh(); } catch { setError('Unable to save your guide preference. Please try again.'); } }
  async function demo() { setBusy(true); try { const d = await apiRequest<{ id: string }>('/datasets/demo', { method: 'POST' }); navigate(`/app/datasets/${d.id}`); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to open demo'); } finally { setBusy(false); } }
  return <div className="q-onboarding"><div className="q-onboarding-heading"><span className="q-eyebrow"><Sparkles size={13}/>YOUR FIRST PERSPECTIVE</span><button className="q-icon-button" aria-label="Dismiss getting-started guide" onClick={() => void dismiss()}><X size={16}/></button></div><h2>A few small steps. A whole new view.</h2><div className="q-onboarding-steps">{[{ label: 'Bring your data', to: '/app/datasets', done: datasets > 0, icon: Database }, { label: 'Explore a question', to: '/app/copilot', done: queries > 0, icon: Sparkles }, { label: 'Save a perspective', to: '/app/dashboards', done: dashboards > 0, icon: LayoutDashboard }].map(({ label, to, done, icon: Icon }, i) => <Link key={to} to={to}><span className={done ? 'q-step-complete' : ''}>{done ? <Check size={15}/> : <Icon size={15}/>}</span><small>0{i + 1}</small><strong>{label}</strong><ArrowUpRight size={14}/></Link>)}</div>{!datasets && <button className="q-text-action" disabled={busy} onClick={() => void demo()}>{busy ? <Busy label="Opening demo…"/> : <>Try the 750-order E-commerce demo <ArrowRight size={14}/></>}</button>}{error && <p className="q-form-error" role="alert">{error}</p>}</div>;
}

export function GlobalSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const location = useLocation();
  const results = useResource<{ id: string; title: string; type: string; path: string }[]>(`/workspace/search?q=${encodeURIComponent(debounced)}`);
  useEffect(() => { const timer = setTimeout(() => setDebounced(query), 250); return () => clearTimeout(timer); }, [query]);
  useEffect(() => { if (open) { dialog.current?.showModal(); input.current?.focus(); } else { dialog.current?.close(); setQuery(''); } }, [open]);
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen(o => !o); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  return <><button className="q-global-search-trigger" aria-label="Search workspace" onClick={() => setOpen(true)}><Search size={15}/><span>Search your workspace</span><kbd>⌘ K</kbd></button><dialog ref={dialog} className="q-search-dialog" aria-label="Search your workspace" onCancel={e => { e.preventDefault(); setOpen(false); }}><div className="q-search-dialog-top"><Search size={19}/><input ref={input} aria-label="Workspace search query" placeholder="Search datasets, dashboards, saved queries…" maxLength={100} value={query} onChange={e => setQuery(e.target.value)}/><button className="q-icon-button" aria-label="Close workspace search" onClick={() => setOpen(false)}><X size={18}/></button></div>{query.length < 2 ? <Empty title="Find your next perspective." description="Enter at least two characters to search your private workspace."/> : results.loading || query !== debounced ? <div className="q-search-wait"><span className="q-spinner"/></div> : results.error ? <Failure message={results.error} retry={results.refresh}/> : results.data?.length ? <div className="q-search-results">{results.data.map(result => <Link to={result.path} key={`${result.type}-${result.id}`} onClick={() => setOpen(false)}><span className="q-list-icon">{result.type === 'Dataset' ? <Database size={17}/> : <LayoutDashboard size={17}/>}</span><span><strong>{result.title}</strong><small>{result.type}</small></span><ArrowUpRight size={15}/></Link>)}</div> : <Empty title="Nothing in view just yet." description="Try a different name. Search only includes items belonging to your account."/>}<p className="q-search-footnote"><ShieldCheck size={12}/>Private to your account · Esc to close</p></dialog></>;
}

export function Notifications() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const notifications = useResource<{ id: string; description: string; created_at: string; unread: boolean }[]>('/workspace/notifications');
  const { refresh } = notifications;
  useEffect(() => { setOpen(false); refresh(); }, [location.pathname, refresh]);
  const unread = notifications.data?.filter(n => n.unread).length || 0;
  async function read() { try { await apiRequest('/workspace/notifications/read', { method: 'POST' }); refresh(); } catch { setError('Unable to update notifications.'); } }
  return <div className="q-popover-anchor"><button className="q-icon-button q-notification-trigger" aria-label="Recent notifications" aria-expanded={open} onClick={() => { setOpen(!open); if (!open) refresh(); }}><Bell size={18}/>{unread > 0 && <i/>}</button>{open && <div className="q-popover q-notifications"><div className="q-panel-heading"><h3>Workspace updates</h3>{unread > 0 && <button className="q-icon-button" aria-label="Mark notifications as read" onClick={() => void read()}><CheckCheck size={18}/></button>}</div>{error && <p role="alert">{error}</p>}{notifications.error ? <p>{notifications.error}</p> : notifications.data?.length ? notifications.data.slice(0, 6).map(n => <div className={`q-activity-item ${n.unread ? 'q-unread' : ''}`} key={n.id}><span className="q-activity-dot"><Check size={12}/></span><div><strong>{n.description}</strong><small>{date(n.created_at)}</small></div></div>) : <p>You're all caught up. Your workspace activity will appear here.</p>}<Link className="q-text-action" to="/app/activity">View all activity <ArrowUpRight size={14}/></Link></div>}</div>;
}
