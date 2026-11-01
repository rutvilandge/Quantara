import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, ArrowUpRight, BrainCircuit, ChartNoAxesCombined, Check, ChevronDown, Code2, Database, FileText, FlaskConical, Layers3, LayoutDashboard, LogOut, Menu, Moon, Settings, ShieldCheck, Sun, Upload, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { Empty, Failure, Loading, PageHeading, Panel, date, number, useResource } from './shared';
import './workspace.css';
import DatasetsPage, { DatasetDetail } from './Datasets';
import QueriesPage from './Queries';
import CopilotPage from './Copilot';
import StatisticalAnalyticsPage from './StatisticalAnalytics';
import DashboardsPage, { DashboardEditor } from './Dashboards';
import ReportsPage from './Reports';
import { GlobalSearch, Notifications, Onboarding, SettingsPage, type Preferences } from './Account';
import { apiRequest } from '../lib/api';

export type DatasetSummary = { id: string; name: string; row_count: number; quality_score: number; is_demo: boolean; created_at: string };
type ActivityItem = { id: string; kind: string; description: string; created_at: string };
export type Overview = { metrics: { datasets: number; rows: number; quality: number }; analyses: number; dashboards: number; activity: ActivityItem[]; recentDatasets: DatasetSummary[]; timeline: { label: string; events: number }[] };

function OverviewPage() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useResource<Overview>('/workspace/overview');
  const [range, setRange] = useState(14);
  if (loading) return <Loading/>;
  if (error || !data) return <Failure message={error} retry={refresh}/>;
  return <>
    <PageHeading eyebrow="YOUR ANALYTICS, IN PERSPECTIVE" title={`A little clarity, ${user?.fullName.split(' ')[0]}.`} description="One thoughtful space for your data, questions, and discoveries.">
      <Link className="q-button" to="/app/datasets"><Upload size={15}/>Add your data</Link>
    </PageHeading>
    <Onboarding datasets={data.metrics.datasets} queries={data.analyses} dashboards={data.dashboards}/><div className="q-welcome"><div><span className="q-eyebrow">INTELLIGENCE STARTS HERE</span><h2>Good questions.<br/><em>Clearer possibilities.</em></h2><p>Your workspace is ready. Every metric here reflects your own saved data.</p><Link className="q-text-action" to="/app/settings">Make it yours <ArrowUpRight size={16}/></Link></div><div className="q-welcome-art" aria-hidden="true"><span className="q-orbit q-orbit-one"/><span className="q-orbit q-orbit-two"/><span className="q-orbit-core"><Layers3 size={38}/></span><span className="q-floating-label"><ShieldCheck size={15}/>Your data. Your perspective.</span></div></div>
    <div className="q-kpis">{[
      { label: 'Connected datasets', value: data.metrics.datasets, detail: 'Your data foundations', icon: Database },
      { label: 'Rows ready to explore', value: data.metrics.rows, detail: 'Across your datasets', icon: Layers3 },
      { label: 'Analyses completed', value: data.analyses, detail: 'Executed queries', icon: ChartNoAxesCombined },
      { label: 'Saved dashboards', value: data.dashboards, detail: 'Your visual stories', icon: Activity },
    ].map(({ label, value, detail, icon: Icon }) => <div className="q-kpi" key={label}><div><span>{label}</span><Icon size={17}/></div><strong>{number(value)}</strong><small>{detail}</small></div>)}</div>
    <div className="q-overview-grid"><Panel title="A rhythm of discovery" description="Your actual workspace activity over time." action={<select className="q-select" aria-label="Activity date range" value={range} onChange={e => setRange(Number(e.target.value))}><option value={14}>Last 14 days</option><option value={7}>Last 7 days</option></select>}>
      <div className="q-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.timeline.slice(-range)}><defs><linearGradient id="qActivity" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8cb79a" stopOpacity={.35}/><stop offset="100%" stopColor="#8cb79a" stopOpacity={.01}/></linearGradient></defs><CartesianGrid stroke="var(--q-border)" vertical={false}/><XAxis dataKey="label" tick={{ fill: 'var(--q-muted)', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28}/><YAxis allowDecimals={false} tick={{ fill: 'var(--q-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={25}/><Tooltip contentStyle={{ background: 'var(--q-card)', border: '1px solid var(--q-border)', borderRadius: 12, color: 'var(--q-ink)' }}/><Area type="monotone" dataKey="events" name="Workspace events" stroke="#547c60" strokeWidth={2.5} fill="url(#qActivity)"/></AreaChart></ResponsiveContainer></div>
    </Panel><Panel title="Recent activity" description="The small steps behind your next insight." action={<Link className="q-icon-button" to="/app/activity" aria-label="View all activity"><ArrowUpRight size={18}/></Link>}>
      {data.activity.length ? <ActivityList items={data.activity.slice(0, 4)}/> : <Empty title="A fresh perspective awaits." description="Your uploads, queries, and saved dashboards will appear here as you explore."/>}
    </Panel></div>
    <Panel title="Your data foundations" description="Recently added datasets, ready for a closer look.">
      {data.recentDatasets.length ? <div className="q-list">{data.recentDatasets.map(d => <Link className="q-list-item" key={d.id} to={`/app/datasets/${d.id}`}><span className="q-list-icon"><Database size={19}/></span><div><strong>{d.name}</strong><small>{number(d.row_count)} rows {d.is_demo ? '· Synthetic demo' : ''}</small></div><span className="q-pill">{number(d.quality_score)}% complete</span><ArrowUpRight size={16}/></Link>)}</div> : <Empty title="Room for your first discovery." description="Upload your own CSV/XLSX or explore the one included E-commerce Sales demo."><Link className="q-button q-secondary" to="/app/datasets">Explore datasets <ArrowRight size={15}/></Link></Empty>}
    </Panel>
  </>;
}

function ActivityList({ items }: { items: ActivityItem[] }) { return <div className="q-activity-list">{items.map(item => <div className="q-activity-item" key={item.id}><span className="q-activity-dot"><Check size={13}/></span><div><strong>{item.description}</strong><small>{date(item.created_at)}</small></div></div>)}</div>; }
function ActivityPage() {
  const { data, loading, error, refresh } = useResource<Overview>('/workspace/overview');
  return <><PageHeading eyebrow="YOUR WORKSPACE STORY" title="Every step, in view." description="Recent activity from your account."/>{loading ? <Loading/> : error ? <Failure message={error} retry={refresh}/> : <Panel title="Recent activity">{data?.activity.length ? <ActivityList items={data.activity}/> : <Empty title="Your story starts here." description="Workspace activity will appear here as you add data and explore."/>}</Panel>}</>;
}

export default function Workspace() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('quantara-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch { return 'light'; } });
  const [notice, setNotice] = useState('');
  const preferences = useResource<Preferences>('/account/preferences');
  useEffect(() => { try { localStorage.setItem('quantara-theme', theme); } catch { /* device storage may be unavailable */ } }, [theme]);
  useEffect(() => { setMobileOpen(false); setProfileOpen(false); }, [location.pathname]);
  useEffect(() => {
    function apply(mode: string) { setTheme(mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode); }
    if (preferences.data) apply(preferences.data.theme);
    const change = (event: Event) => apply((event as CustomEvent<string>).detail);
    window.addEventListener('quantara:theme', change);
    return () => window.removeEventListener('quantara:theme', change);
  }, [preferences.data]);
  async function signOut() { try { await logout(); navigate('/login'); } catch (e) { setNotice(e instanceof Error ? e.message : 'Unable to sign out'); } }
  const links = [{ to: '/app', label: 'Overview', icon: ChartNoAxesCombined }, { to: '/app/datasets', label: 'Datasets', icon: Database }, { to: '/app/copilot', label: 'AI Copilot', icon: BrainCircuit }, { to: '/app/queries', label: 'SQL workspace', icon: Code2 }, { to: '/app/statistics', label: 'Statistical analytics', icon: FlaskConical }, { to: '/app/dashboards', label: 'Dashboards', icon: LayoutDashboard }, { to: '/app/reports', label: 'Reports', icon: FileText }, { to: '/app/activity', label: 'Activity', icon: Activity }, { to: '/app/settings', label: 'Settings', icon: Settings }];
  const current = links.find(l => l.to === location.pathname)?.label || 'Workspace';
  return <div className="quantara-app" data-theme={theme}>
    {mobileOpen && <button className="q-mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>}
    <aside className={`q-sidebar ${mobileOpen ? 'q-sidebar-open' : ''}`}><Link to="/" className="brand"><span className="brand-icon"><Layers3 size={19}/></span><span>quantara<span className="brand-dot">.</span></span></Link><button className="q-mobile-close q-icon-button" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20}/></button><div className="q-workspace-label"><span className="q-avatar q-small-avatar">{user?.fullName.slice(0, 1)}</span><div><strong>Personal workspace</strong><small>Your perspective, connected</small></div></div><span className="q-nav-caption">WORKSPACE</span><nav aria-label="Workspace navigation">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/app'} className={({ isActive }) => `q-nav-item ${isActive ? 'q-active' : ''}`}><Icon size={18}/>{label}<span className="q-nav-indicator"/></NavLink>)}</nav><div className="q-sidebar-note"><span className="q-note-icon"><Layers3 size={19}/></span><strong>A clearer perspective.</strong><p>Your data stays within your account. Every discovery begins with you.</p><Link to="/app/settings">Your workspace <ArrowRight size={14}/></Link></div><button className="q-sidebar-user" onClick={() => navigate('/app/settings')}><span className="q-avatar">{user?.fullName.slice(0, 1)}</span><span><strong>{user?.fullName}</strong><small>Personal account</small></span><Settings size={16}/></button></aside>
    <div className="q-shell"><header className="q-topbar"><div className="q-topbar-start"><button className="q-icon-button q-menu-toggle" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={21}/></button><span className="q-breadcrumb">Workspace <span>/</span><strong>{current}</strong></span></div><div className="q-topbar-actions"><GlobalSearch/><span className="q-connection"><i/>Connected workspace</span><button className="q-icon-button" aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'} onClick={() => { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); void apiRequest('/account/preferences', { method: 'PATCH', body: JSON.stringify({ theme: next }) }).catch(() => setNotice('Appearance changed on this device; account preference could not be saved.')); }}>{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button><Notifications/><div className="q-popover-anchor"><button className="q-profile-trigger" aria-label="Open account menu" aria-expanded={profileOpen} onClick={() => { setProfileOpen(!profileOpen); }}><span className="q-avatar">{user?.fullName.slice(0, 1)}</span><ChevronDown size={13}/></button>{profileOpen && <div className="q-popover"><strong>{user?.fullName}</strong><small>{user?.email}</small><Link to="/app/settings"><Settings size={16}/>Account settings</Link><button onClick={() => void signOut()}><LogOut size={16}/>Sign out</button></div>}</div></div></header>
    <main className="q-main" id="workspace-main">{notice && <p className="q-form-error" role="alert">{notice}</p>}<motion.div key={location.pathname} initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}><Routes><Route index element={<OverviewPage/>}/><Route path="datasets" element={<DatasetsPage/>}/><Route path="datasets/:id" element={<DatasetDetail/>}/><Route path="queries" element={<QueriesPage/>}/><Route path="copilot" element={<CopilotPage/>}/><Route path="statistics" element={<StatisticalAnalyticsPage/>}/><Route path="dashboards" element={<DashboardsPage/>}/><Route path="dashboards/:id" element={<DashboardEditor/>}/><Route path="reports" element={<ReportsPage/>}/><Route path="activity" element={<ActivityPage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="*" element={<Empty title="This view is not here." description="Return to your overview to continue exploring."><Link className="q-button" to="/app">Back to overview <ArrowRight size={15}/></Link></Empty>}/></Routes></motion.div><footer className="q-workspace-footer"><span>QUANTARA / A CLEARER PERSPECTIVE</span><span><ShieldCheck size={12}/>Private to your account</span></footer></main></div>
  </div>;
}
