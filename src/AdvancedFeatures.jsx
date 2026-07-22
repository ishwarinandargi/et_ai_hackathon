import { useMemo, useState } from "react";
import { analyzeCriticalPath, analyzeTrends, analyzeWhatIf, answerKnowledgeQuestion, findSimilarIssues, generateTestChecklist, historicalScores, projectTimeline, shipment, trackShipment } from "./advanced.js";
import { samples } from "./samples.js";

const tabs = [
  ["critical", "Critical path"], ["shipment", "Shipment"], ["issues", "Past issues"],
  ["whatif", "What-if"], ["trends", "Trends"], ["checklist", "Commissioning"],
];
const prettyDate = (value) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

export default function AdvancedFeatures() {
  const [active, setActive] = useState("critical");
  return <section className="intelligence" aria-labelledby="intelligence-heading">
    <div className="section-heading"><div><span className="eyebrow">04 · Project intelligence</span><h2 id="intelligence-heading">From compliance to commissioning</h2></div></div>
    <nav className="feature-tabs" aria-label="Project intelligence modules">{tabs.map(([id, label]) => <button type="button" className={active === id ? "active" : ""} aria-pressed={active === id} onClick={() => setActive(id)} key={id}>{label}</button>)}</nav>
    <div className="feature-panel">{active === "critical" ? <CriticalPath/> : active === "shipment" ? <Shipment/> : active === "issues" ? <PastIssues/> : active === "whatif" ? <WhatIf/> : active === "trends" ? <Trends/> : <Checklist/>}</div>
  </section>;
}

function FeatureHeader({ eyebrow, title, children, data }) {
  return <div className="feature-header"><div><span>{eyebrow}</span><h3>{title}</h3>{children}</div>{data && <Download data={data}/>}</div>;
}

function CriticalPath() {
  const [goLive, setGoLive] = useState(projectTimeline.goLiveDate);
  const result = useMemo(() => analyzeCriticalPath(projectTimeline, projectTimeline.equipmentDeliveryDates, goLive), [goLive]);
  return <><FeatureHeader eyebrow="FEATURE A · RISK ANALYZER" title={result.projectName} data={result}><label className="inline-input">Go-live date <input type="date" value={goLive} onChange={(event) => setGoLive(event.target.value)}/></label></FeatureHeader>
    <div className="path-line">{result.criticalPath.map((item, index) => <div key={item.name}><i>{index + 1}</i><span>{item.name}<small>{prettyDate(item.date)}</small></span></div>)}</div>
    <div className="risk-grid">{result.riskAnalysis.map((item) => <details className={`risk-card ${item.risk.toLowerCase()}`} open={item.equipment.includes("UPS")} key={item.equipment}><summary><span>{item.equipment}<small>{item.onCriticalPath ? "ON CRITICAL PATH" : "PARALLEL PATH"}</small></span><b>{item.risk}</b></summary>
      <p>Scheduled {prettyDate(item.scheduledDelivery)} · Needed {prettyDate(item.neededBy)} · <strong>{item.bufferDays}-day buffer</strong></p>
      <div className="scenario-list">{item.delayScenarios.map((scenario) => <div key={scenario.delayDays}><b>+{scenario.delayDays} days</b><span>{scenario.impactDays ? `Go-live slips ${scenario.impactDays} day(s) to ${prettyDate(scenario.newGoLiveDate)}.` : "No go-live impact."}<small>{scenario.mitigation}</small></span></div>)}</div>
    </details>)}</div></>;
}

function Shipment() {
  const result = trackShipment(shipment.equipment, null, shipment.route);
  return <><FeatureHeader eyebrow="FEATURE B · LIVE LOGISTICS" title={`${shipment.equipment} · ${shipment.po}`} data={result}><p>Current location: <b>{result.currentLocation}</b> · {result.currentLeg}</p></FeatureHeader>
    <div className="eta-grid"><div><span>OPTIMISTIC</span><b>{prettyDate(result.confidenceIntervals.optimistic)}</b><small>90% confidence</small></div><div className="expected"><span>EXPECTED</span><b>{prettyDate(result.confidenceIntervals.expected)}</b><small>70% confidence</small></div><div><span>PESSIMISTIC</span><b>{prettyDate(result.confidenceIntervals.pessimistic)}</b><small>10% confidence</small></div></div>
    <div className="shipment-layout"><div className="shipment-timeline">{result.route.map((leg) => <div className={leg.status.toLowerCase()} key={leg.leg}><i>{leg.status === "COMPLETED" ? "✓" : leg.status === "IN_PROGRESS" ? "●" : "○"}</i><span><b>{leg.leg}</b><small>{leg.location} · {prettyDate(leg.date || leg.eta)}</small></span></div>)}</div>
      <div><h4>Risk alerts · {result.riskLevel}</h4>{result.alerts.map((alert) => <article className={`alert ${alert.level.toLowerCase()}`} key={alert.factor}><b>{alert.factor}</b><p>{alert.impact}</p></article>)}<h4>Expedite option</h4>{result.expediteOptions.map((option) => <article className="expedite" key={option.option}><b>{option.option} · {option.cost}</b><p>{option.timeline} · ETA {prettyDate(option.eta)}</p><small>{option.recommended}</small></article>)}</div></div>
    <div className="path-impact"><b>Critical path impact</b><span>Expected arrival preserves the 5-day test buffer. Pessimistic arrival slips go-live by up to 4 days.</span></div></>;
}

function PastIssues() {
  const scenarios = [
    { id: "breaker", label: "Eaton breaker", flag: { param: "Input breaker rating", message: "160A supplied; 200A required", vendor: "Eaton", equipment: "Eaton UPS" } },
    { id: "delivery", label: "Trane delivery", flag: { param: "Delivery schedule", message: "Customs delay cuts the project buffer", vendor: "Trane", equipment: "Trane Cooling Tower" } },
    { id: "mtbf", label: "Riello reliability", flag: { param: "MTBF reliability", message: "135,000 hours against 150,000 required", vendor: "Riello", equipment: "Riello UPS" } },
  ];
  const [scenarioId, setScenarioId] = useState("breaker");
  const [question, setQuestion] = useState("How was it resolved?");
  const [source, setSource] = useState(null);
  const scenario = scenarios.find((item) => item.id === scenarioId);
  const matches = findSimilarIssues(scenario.flag);
  const answer = answerKnowledgeQuestion(question, scenario.flag, matches);
  const evidence = { prototype: "deterministic local retrieval", currentFlag: scenario.flag, question, answer, matches, retrievedAt: new Date().toISOString() };
  const questions = ["How was it resolved?", "What did it cost?", "How long did it take?", "What should we ask the vendor?", "Which test validates the correction?"];
  return <div id="local-knowledge"><FeatureHeader eyebrow="FEATURE C · LOCAL KNOWLEDGE RETRIEVAL" title={`${matches.length} supporting precedents`} data={evidence}><p>Prototype retrieval over ten on-device sample records.</p></FeatureHeader>
    <div className="prototype-note"><b>PROTOTYPE MODE</b><span>Deterministic weighted matching · no embeddings · no model · no network calls</span></div>
    <div className="scenario-picker" aria-label="Knowledge retrieval scenarios">{scenarios.map((item) => <button type="button" className={scenarioId === item.id ? "active" : ""} onClick={() => { setScenarioId(item.id); setSource(null); }} key={item.id}>{item.label}</button>)}</div>
    <div className="retrieval-query"><span>CURRENT FLAG</span><b>{scenario.flag.param}</b><p>{scenario.flag.vendor} · {scenario.flag.equipment} · {scenario.flag.message}</p></div>
    <div className="issue-matches">{matches.map((issue) => <article key={issue.issueId}><header><span>{issue.issueId} · {issue.relevance}/100 RELEVANCE</span><b>{issue.project}</b><small>{prettyDate(issue.date)} · {issue.matchReasons.join(" · ")}</small></header><dl><div><dt>Problem</dt><dd>{issue.problem}</dd></div><div><dt>Resolution</dt><dd>{issue.resolution}</dd></div><div><dt>Cost / timeline</dt><dd>{issue.cost} · {issue.timeline}</dd></div><div><dt>Lesson</dt><dd>{issue.lesson}</dd></div></dl><footer><span>{issue.source} · page {issue.page} · {issue.section}</span><button type="button" onClick={() => setSource(issue)}>View source</button></footer></article>)}</div>
    <div className="knowledge-qa"><div><span>GUIDED QUESTIONS</span>{questions.map((item) => <button type="button" className={question === item ? "active" : ""} onClick={() => setQuestion(item)} key={item}>{item}</button>)}</div><form onSubmit={(event) => event.preventDefault()}><label htmlFor="knowledge-question">Ask the local records</label><input id="knowledge-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about cost, timeline, resolution, vendor, or testing…"/><article><b>Evidence-based answer</b><p>{answer}</p><small>Source: {matches[0]?.issueId} · {matches[0]?.source}, page {matches[0]?.page}</small></article></form></div>
    {source && <div className="source-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSource(null); }}><section className="source-dialog" role="dialog" aria-modal="true" aria-labelledby="source-heading"><header><div><span>LOCAL SOURCE RECORD</span><h4 id="source-heading">{source.source}</h4></div><button type="button" aria-label="Close source" onClick={() => setSource(null)}>×</button></header><dl><div><dt>Reference</dt><dd>{source.issueId} · page {source.page} · {source.section}</dd></div><div><dt>Project</dt><dd>{source.project}</dd></div><div><dt>Document excerpt</dt><dd>“{source.excerpt}”</dd></div><div><dt>Resolution owner</dt><dd>{source.contact}</dd></div></dl><button type="button" onClick={() => setSource(null)}>Close source</button></section></div>}
  </div>;
}

function WhatIf() {
  const [breaker, setBreaker] = useState(180);
  const result = useMemo(() => analyzeWhatIf(samples["SC-001"].spec, samples["SC-001"].po, { breakerRatingA: breaker }), [breaker]);
  return <><FeatureHeader eyebrow="FEATURE D · SCENARIO MODEL" title="What if the breaker rating changes?" data={result}><p>Adjust the proposed Eaton UPS protection rating.</p></FeatureHeader>
    <label className="range-control"><span>Breaker rating <b>{breaker}A</b></span><input type="range" min="160" max="220" step="10" value={breaker} onChange={(event) => setBreaker(Number(event.target.value))}/><small>160A quoted <i/> 200A required <i/> 220A maximum</small></label>
    <div className="score-change"><div><span>CURRENT</span><b>{result.originalScore}%</b></div><i>→</i><div className={result.scoreImprovement > 0 ? "better" : ""}><span>PROPOSED</span><b>{result.proposedScore}%</b><small>{result.scoreImprovement >= 0 ? "+" : ""}{result.scoreImprovement} points</small></div></div>
    <div className="impact-list"><h4>What changes</h4>{result.impacts.length ? result.impacts.map((impact) => <p key={impact.param}><b>{impact.change}</b> {impact.param}: {impact.before.replace("_", " ")} → {impact.after.replace("_", " ")}</p>) : <p>↔ All five compliance outcomes remain unchanged.</p>}</div>
    <div className="recommendation"><b>Recommendation · {Math.round(result.confidenceLevel * 100)}% confidence</b><p>{result.recommendation}</p></div></>;
}

function Trends() {
  const result = analyzeTrends(historicalScores);
  return <><FeatureHeader eyebrow="FEATURE E · 12-MONTH VIEW" title="Vendor compliance trends" data={result}><p>Best current score: <b>{result.bestVendor}</b></p></FeatureHeader>
    <div className="trend-grid">{result.vendorTrends.map((item) => <article className={item.trend.toLowerCase()} key={item.vendor}><header><div><span>{item.vendor}</span><b>{item.scores.at(-1)}%</b></div><strong>{item.trend} · {item.change > 0 ? "+" : ""}{item.change}%</strong></header><Sparkline scores={item.scores}/><p>{item.insight}</p></article>)}</div>
    <div className="category-trends"><div><span>UPS</span><b>85%</b><i style={{ width: "85%" }}/></div><div><span>Cooling</span><b>72%</b><i style={{ width: "72%" }}/></div><div><span>Networking</span><b>65%</b><i style={{ width: "65%" }}/></div></div>
    <div className="recommendation"><b>Recommended focus</b><p>Standardize the improving UPS procurement process. Audit Riello and publish a networking equipment specification guide.</p></div></>;
}

function Sparkline({ scores }) {
  const points = scores.map((score, index) => `${index * (100 / (scores.length - 1))},${100 - score}`).join(" ");
  return <svg className="sparkline" viewBox="0 0 100 35" preserveAspectRatio="none" role="img" aria-label={`Scores from ${scores[0]} to ${scores.at(-1)}`}><polyline points={points}/></svg>;
}

function Checklist() {
  const report = useMemo(() => generateTestChecklist("Eaton UPS 500kW · PO-2026-4521", [{ param: "Breaker rating" }, { param: "Delivery schedule" }]), []);
  const [results, setResults] = useState({});
  const setResult = (id, value) => setResults((current) => ({ ...current, [id]: value }));
  return <><FeatureHeader eyebrow="FEATURE F · SITE ACCEPTANCE" title={report.equipment} data={{ ...report, results }}><p>{report.testStandard} · Estimated duration {report.totalDuration}</p></FeatureHeader>
    <div className="checklist-phases">{report.phases.map((phase) => <section key={phase.name}><header><span>PHASE {phase.phase}</span><h4>{phase.name}</h4></header>{phase.tests.map((test) => <article className={test.critical ? "critical-test" : ""} key={test.testId}><div><b>{test.testId} · {test.name}</b>{test.critical && <span>CRITICAL</span>}<p>{test.purpose}</p><small>Pass: {test.passCriteria}<br/>Owner: {test.responsible} · {test.duration} · Linked to {test.linkedFlag}</small></div><div className="test-result" role="group" aria-label={`${test.name} result`}>{["PASS", "FAIL", "N/A"].map((value) => <button type="button" className={results[test.testId] === value ? value.toLowerCase().replace("/", "") : ""} onClick={() => setResult(test.testId, value)} key={value}>{value}</button>)}</div></article>)}</section>)}</div>
    <div className="checklist-notes"><label>Issues found & resolution<textarea placeholder="Document any failures and corrective actions…"/></label><label>Lessons learned<textarea placeholder="Record improvements for the next project…"/></label></div></>;
}

function Download({ data }) {
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "gridcheck-intelligence.json"; anchor.click(); URL.revokeObjectURL(url);
  }
  return <button className="export" type="button" onClick={download}>↓ Export</button>;
}
