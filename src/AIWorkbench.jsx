import { useState } from "react";
import { generateComplianceReport } from "./rules.js";
import { answerLocalCopilot, extractLocalDocuments, generateLocalGuidance, loadPreparedPdfDemo } from "./localCopilot.js";

const pretty = (value) => JSON.stringify(value, null, 2);

export default function AIWorkbench({ report, onAnalyze }) {
  const [files, setFiles] = useState([]);
  const [extraction, setExtraction] = useState(null);
  const [specJson, setSpecJson] = useState("");
  const [poJson, setPoJson] = useState("");
  const [guidance, setGuidance] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function showExtraction(result) { setExtraction(result); setSpecJson(pretty(result.spec)); setPoJson(pretty(result.po)); setError(""); }

  async function extract() {
    if (!files.length) return setError("Choose one or two JSON, CSV, or TXT documents first.");
    setBusy(true); setError("");
    try { showExtraction(extractLocalDocuments(await Promise.all(files.map(async (file) => ({ name: file.name, text: await file.text() }))))); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }

  function analyzeExtracted() {
    try { const started = performance.now(); const next = generateComplianceReport(JSON.parse(specJson), JSON.parse(poJson)); onAnalyze({ ...next, processingTimeMs: Number((performance.now() - started).toFixed(2)) }); setError(""); }
    catch (cause) { setError(`Review the extracted fields: ${cause.message}`); }
  }

  function ask(event) {
    event.preventDefault(); if (!question.trim()) return;
    const message = question.trim(); const answer = answerLocalCopilot(message, report);
    setMessages((current) => [...current, { role: "user", content: message }, { role: "assistant", content: answer }]); setQuestion("");
  }

  return <section className="ai-workbench" aria-labelledby="ai-heading">
    <div className="section-heading"><div><span className="eyebrow">03 · Local copilot prototype</span><h2 id="ai-heading">Turn documents into decisions</h2></div><span className="ai-state online">LOCAL PROTOTYPE · OFFLINE</span></div>
    <div className="offline-banner"><b>NO API KEY · NO MODEL · NO NETWORK CALLS</b><p>Field extraction, report guidance, local retrieval, and chat use deterministic browser-side rules and sample records.</p></div>
    <div className="ai-grid">
      <article className="ai-card document-ai"><header><span>01</span><div><h3>Local document extraction</h3><p>Parse structured procurement files in your browser.</p></div></header>
        <label className="file-drop"><input type="file" accept=".json,.csv,.txt" multiple onChange={(event) => { setFiles([...event.target.files].slice(0, 2)); setError(""); }}/><b>{files.length ? files.map((file) => file.name).join(" + ") : "Choose 1-2 local documents"}</b><small>JSON, CSV, or key:value TXT · processed only in this browser</small></label>
        <div className="prototype-actions"><button className="ai-action" type="button" disabled={busy} onClick={extract}>{busy ? "Reading documents…" : "Extract procurement fields"}</button><button type="button" onClick={() => showExtraction(loadPreparedPdfDemo())}>Load prepared PDF demo</button></div>
        {extraction && <div className="extracted-editors"><label>Specification JSON<textarea value={specJson} onChange={(event) => setSpecJson(event.target.value)} spellCheck="false"/></label><label>Purchase order JSON<textarea value={poJson} onChange={(event) => setPoJson(event.target.value)} spellCheck="false"/></label><p>{extraction.evidence.length} evidence references · {extraction.warnings.length} review note(s)</p>{extraction.warnings.length > 0 && <ul>{extraction.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}<button type="button" onClick={analyzeExtracted}>Verify fields and run deterministic check →</button></div>}
      </article>
      <article className="ai-card guidance-ai"><header><span>02</span><div><h3>Template report intelligence</h3><p>Generate actions and an RFI from verified flags.</p></div></header>
        <button className="ai-action" type="button" disabled={!report} onClick={() => setGuidance(generateLocalGuidance(report))}>{report ? "Generate local guidance" : "Run a report first"}</button>
        {guidance && <div className="guidance-result"><span>EXECUTIVE SUMMARY</span><p>{guidance.executiveSummary}</p><span>IMMEDIATE ACTIONS</span><ol>{guidance.immediateActions.map((action) => <li key={action}>{action}</li>)}</ol><span>NEGOTIATION STRATEGY</span><p>{guidance.negotiationStrategy}</p><details><summary>View template RFI email</summary><b>{guidance.rfiDraft.subject}</b><pre>{guidance.rfiDraft.body}</pre></details></div>}
      </article>
    </div>
    <article className="copilot"><header><div><span>03 · RULE-BASED REPORT CHAT</span><h3>Ask GridCheck locally</h3></div><p>Answers come from the active report and local precedents.</p></header>
      <div className="chat-prompts">{["What blocks approval?", "Draft an RFI email", "What did a similar issue cost?", "Which test validates the correction?"].map((prompt) => <button type="button" onClick={() => setQuestion(prompt)} key={prompt}>{prompt}</button>)}</div>
      <div className="chat-log" aria-live="polite">{messages.length ? messages.map((message, index) => <div className={message.role} key={`${message.role}-${index}`}><b>{message.role === "user" ? "You" : "GridCheck Local"}</b><p>{message.content}</p></div>) : <div className="chat-empty">Ask about approval, scores, RFIs, vendors, past resolutions, costs, timelines, or commissioning.</div>}</div>
      <form onSubmit={ask}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about the active report…" disabled={!report}/><button type="submit" disabled={!report || !question.trim()}>Ask →</button></form>
    </article>
    {error && <p className="ai-error" role="alert">{error}</p>}
    <p className="ai-disclaimer">Prototype limitation: prepared PDF extraction is a labeled fixture. General PDF, DOCX, and XLSX parsing requires local parser libraries or a future local model.</p>
  </section>;
}
