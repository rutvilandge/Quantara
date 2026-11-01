import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, BrainCircuit, Check, Code2, Play, Plus, Send, Sparkles } from 'lucide-react';
import { apiRequest, streamRequest } from '../lib/api';
import { Busy, Empty, Failure, Loading, PageHeading, Panel, Table, useResource } from './shared';
import type { DatasetItem } from './Datasets';
import type { QueryResult } from './Queries';
import { ResultChart, type ChartKind } from './Charts';

type Draft = { conversationId: string; sql: string; explanation: string; chartType: ChartKind; model: string };
type Insight = { summary: string; observations: string[]; nextQuestions: string[]; truncated: boolean };
type Turn = { question: string; draft: Draft; result?: QueryResult; error?: string; insight?: Insight };
export default function CopilotPage() {
  const [params, setParams] = useSearchParams();
  const list = useResource<DatasetItem[]>('/datasets');
  const status = useResource<{ available: boolean; modelReady: boolean; model: string }>('/copilot/status');
  const datasetId = params.get('dataset') || list.data?.[0]?.id || '';
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [streamed, setStreamed] = useState('');
  async function ask(prompt: string) {
    if (!prompt.trim() || busy) return;
    setBusy('ask'); setError(''); setQuestion(prompt); setStreamed('');
    try {
      const draft = await streamRequest<Draft>('/copilot/ask/stream', { datasetId, question: prompt, conversationId }, token => setStreamed(s => s + token));
      setConversationId(draft.conversationId); setTurns(t => [...t, { question: prompt, draft }]); setQuestion('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to ask Quantara'); }
    finally { setBusy(''); }
  }
  async function run(index: number) {
    setBusy(`run-${index}`);
    try {
      const result = await apiRequest<QueryResult>('/queries/run', { method: 'POST', body: JSON.stringify({ datasetId, sql: turns[index].draft.sql }) });
      setTurns(t => t.map((turn, i) => i === index ? { ...turn, result, error: undefined } : turn));
    } catch (e) { setTurns(t => t.map((turn, i) => i === index ? { ...turn, error: e instanceof Error ? e.message : 'Unable to run query' } : turn)); }
    finally { setBusy(''); }
  }
  async function explain(index: number) {
    setBusy(`insight-${index}`);
    try {
      const insight = await apiRequest<Insight>('/copilot/insights', { method: 'POST', body: JSON.stringify({ datasetId, sql: turns[index].draft.sql }) });
      setTurns(t => t.map((turn, i) => i === index ? { ...turn, insight, error: undefined } : turn));
    } catch (e) { setTurns(t => t.map((turn, i) => i === index ? { ...turn, error: e instanceof Error ? e.message : 'Unable to interpret results' } : turn)); }
    finally { setBusy(''); }
  }
  function fresh() { setTurns([]); setConversationId(undefined); setQuestion(''); setError(''); }
  const demo = list.data?.find(d => d.id === datasetId)?.is_demo;
  const examples = demo ? ['Which products generated the most revenue?', 'Compare monthly revenue and profit in 2025.', 'How does revenue compare across regions?', 'What is the average order value by sales channel?'] : ['Show the first 10 rows of this dataset.', 'Count the rows in this dataset.', 'Summarize the numeric columns.', 'Which values appear most frequently?'];
  if (list.loading) return <Loading/>;
  if (list.error) return <Failure message={list.error} retry={list.refresh}/>;
  return <><PageHeading eyebrow="CONVERSATIONAL INTELLIGENCE" title="A good question changes everything." description="Ask naturally. Review the SQL. Discover what your data actually says."><button className="q-button q-secondary" onClick={fresh} disabled={!!busy}><Plus size={15}/>New conversation</button></PageHeading>
    {!list.data?.length ? <Panel><Empty title="Give your questions a foundation." description="Connect a dataset or explore the E-commerce Sales demo first."><Link className="q-button" to="/app/datasets">Explore datasets <ArrowUpRight size={15}/></Link></Empty></Panel> : <div className="q-copilot-layout"><aside className="q-copilot-context"><Panel title="In this conversation"><label className="q-form">Dataset<select aria-label="Copilot dataset" value={datasetId} onChange={e => { setParams({ dataset: e.target.value }); fresh(); }}>{list.data.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label><div className="q-model-status"><i className={status.data?.available && status.data.modelReady ? 'q-ready' : ''}/><span>{status.data?.model || 'Ollama'}<small>{status.loading ? 'Checking model…' : status.data?.modelReady ? 'Local model is ready' : 'Start Ollama to ask questions'}</small></span></div><p className="q-caption">SQL is generated by your local Ollama model. Review every draft before running it. Query results come directly from your selected dataset.</p></Panel><Panel title="Follow your curiosity"><div className="q-example-questions">{examples.map(q => <button key={q} onClick={() => void ask(q)} disabled={!!busy}><Sparkles size={13}/><span>{q}</span><ArrowUpRight size={13}/></button>)}</div></Panel></aside><div className="q-chat-panel">
    {!turns.length && !busy && <div className="q-copilot-intro"><span className="q-copilot-orb"><BrainCircuit size={32}/></span><span className="q-eyebrow">MEET YOUR ANALYTICS COPILOT</span><h2>Let curiosity<br/><em>lead the way.</em></h2><p>Your data has a story. Ask a question, and we'll find a thoughtful way to explore it together.</p>{demo && <span className="q-pill">750 fictional E-commerce orders · Synthetic demo</span>}</div>}
    <div className="q-conversation">{turns.map((turn, index) => <div className="q-turn" key={index}><div className="q-user-question">{turn.question}</div><div className="q-assistant-answer"><span className="q-assistant-label"><Sparkles size={15}/>QUANTARA <small>SQL draft · Not yet a result</small></span><p>{turn.draft.explanation}</p><pre className="sql-code"><code>{turn.draft.sql}</code></pre><div className="q-toolbar"><button className="q-button" onClick={() => void run(index)} disabled={!!busy}>{busy === `run-${index}` ? <Busy label="Running analysis…"/> : <><Play size={13}/>{turn.result ? 'Run again' : 'Run this analysis'}</>}</button><Link className="q-text-action" to={`/app/queries?dataset=${datasetId}`}><Code2 size={14}/>SQL workspace</Link></div>{turn.error && <div className="q-form-error" role="alert">{turn.error}<button className="q-text-action" disabled={!!busy} onClick={() => void ask(`Correct this failed read-only DuckDB query. Original question: ${turn.question}. SQL: ${turn.draft.sql}. Error: ${turn.error}. Return a new draft for review.`.slice(0, 2000))}>Ask AI to revise the draft</button></div>}{turn.result && <div className="q-grounded-result"><span className="q-inline-note"><Check size={15}/>Executed on your selected dataset · {turn.result.rows.length} rows · {turn.result.durationMs} ms</span>{turn.draft.chartType !== 'table' && <ResultChart result={turn.result} kind={turn.draft.chartType}/>}<Table columns={turn.result.columns} rows={turn.result.rows}/><button className="q-button q-secondary" disabled={!!busy} onClick={() => void explain(index)}>{busy === `insight-${index}` ? <Busy label="Reading the results?"/> : <><Sparkles size={14}/>Explain these results</>}</button>{turn.insight && <div className="q-ai-insight"><span className="q-eyebrow">AI INTERPRETATION ? VERIFY AGAINST THE TABLE</span><h3>Executive summary</h3><p>{turn.insight.summary}</p><ul>{turn.insight.observations.map((item, i) => <li key={i}>{item}</li>)}</ul>{turn.insight.truncated && <p className="q-caption">This interpretation uses a limited sample of the result.</p>}<div className="q-example-questions">{turn.insight.nextQuestions.map(q => <button key={q} disabled={!!busy} onClick={() => void ask(q)}><Sparkles size={13}/>{q}</button>)}</div></div>}</div>}</div></div>)}</div>
    {busy === 'ask' && <div className="q-thinking" role="status"><span className="q-spinner"/><span>Quantara is drafting a query from your schema. Local inference may take a moment.</span></div>}{busy === 'ask' && streamed && <pre className="q-streaming-draft" aria-label="Streaming AI draft">{streamed}</pre>}{error && <p className="q-form-error" role="alert">{error}</p>}
    <form className="q-composer" onSubmit={(e: FormEvent) => { e.preventDefault(); void ask(question); }}><textarea aria-label="Ask your data a question" placeholder={turns.length ? 'Ask a follow-up question…' : 'What would you like to understand?'} maxLength={2000} value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(question); } }}/><button className="q-send" aria-label="Send question" disabled={!!busy || !question.trim()}><Send size={17}/></button></form><p className="q-chat-footnote">AI can make mistakes. Review the query and verify the results. No predictions are substituted for actual data.</p></div></div>}
  </>;
}
