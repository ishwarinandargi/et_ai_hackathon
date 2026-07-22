import { findSimilarIssues } from "./advanced.js";

const severityMeta = { CRITICAL: { symbol: "×", label: "Critical" }, WARNING: { symbol: "!", label: "Warning" }, INFO: { symbol: "✓", label: "Info" } };

export default function ComplianceReport({ report }) {
  function downloadJSON() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `compliance-${report.kind || report.equipment.poNumber || Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <section className="report" aria-labelledby="report-heading">
    <div className="section-heading report-title"><div><span className="eyebrow">02 · Analysis</span><h2 id="report-heading">{report.kind === "portfolio" ? "Combined compliance report" : report.kind === "comparison" ? "Vendor comparison" : "Compliance report"}</h2></div>
      <button className="export" type="button" onClick={downloadJSON}>↓ Export JSON</button></div>
    {report.kind === "portfolio" ? <Portfolio reports={report.reports} /> : report.kind === "comparison" ? <Comparison reports={report.reports} /> : <SingleReport report={report} />}
    <footer className="report-footer"><span>Deterministic procurement controls</span><span>{report.kind ? `${report.reports.length} reports` : "5 rules"} · {report.processingTimeMs ?? "<1"} ms</span></footer>
  </section>;
}

function SingleReport({ report }) {
  return <><Verdict report={report}/><Metrics summary={report.summary}/><FlagList flags={report.flags} equipment={report.equipment}/></>;
}

function Verdict({ report }) {
  return <div className={`verdict ${report.status.toLowerCase()}`}><div><span className="verdict-label">Overall determination</span>
    <strong>{report.status.replace("_", " ")}</strong><p>{report.equipment.poNumber} · {report.equipment.poVendor} · {report.equipment.poModel}</p></div>
    <div className="score"><b>{report.score}</b><span>/ 100</span></div></div>;
}

function Metrics({ summary }) {
  return <div className="metrics"><Metric value={summary.total} label="Rules evaluated"/><Metric value={summary.compliant} label="Compliant" tone="green"/>
    <Metric value={summary.caution} label="Caution" tone="amber"/><Metric value={summary.nonCompliant} label="Non-compliant" tone="red"/></div>;
}

function Portfolio({ reports }) {
  const score = Math.round(reports.reduce((sum, item) => sum + item.score, 0) / reports.length);
  return <><div className="portfolio-overview"><div><span>Portfolio score</span><strong>{score}%</strong></div><p>{reports.length} equipment types checked across power, cooling, and networking.</p></div>
    <div className="equipment-list">{reports.map((item) => { const actionable = item.flags.filter((flag) => flag.status !== "COMPLIANT"); return <article className="equipment-section" key={item.equipment.poNumber}>
      <div className="equipment-header"><div><span>{item.category}</span><h3>{item.equipment.specName}</h3><p>{item.equipment.poVendor} · {item.equipment.poModel}<br/>{item.equipment.poNumber}</p></div>
        <div className={`equipment-score ${item.status.toLowerCase()}`}><b>{item.score}%</b><span>{item.status.replace("_", " ")}</span></div></div>
      <div className="mini-metrics"><span><b>{item.summary.compliant}</b> compliant</span><span><b>{item.summary.caution}</b> caution</span><span><b>{item.summary.nonCompliant}</b> non-compliant</span></div>
      {actionable.length ? <FlagList flags={actionable} equipment={item.equipment}/> : <p className="all-clear">✓ All five requirements comply with the specification.</p>}
    </article>; })}</div></>;
}

function Comparison({ reports }) {
  const winner = [...reports].sort((a, b) => b.score - a.score || a.equipment.price - b.equipment.price)[0];
  const rows = [
    ["Status", (item) => item.status.replace("_", " ")], ["Score", (item) => `${item.score}%`],
    ["Capacity", (item) => flagValue(item, "flag_001")], ["Voltage", (item) => flagValue(item, "flag_002")],
    ["Breaker", (item) => flagValue(item, "flag_003")], ["Delivery", (item) => flagValue(item, "flag_004")],
    ["MTBF", (item) => flagValue(item, "flag_005")], ["Price", (item) => `$${item.equipment.price.toLocaleString()}`],
  ];
  return <><div className="winner"><span>RECOMMENDED VENDOR</span><strong>{winner.equipment.poVendor}</strong><p>{winner.score}% compliant · best technical score</p></div>
    <div className="comparison-table-wrap"><table className="vendor-table"><thead><tr><th>Requirement</th>{reports.map((item) => <th key={item.equipment.poNumber}>{item.equipment.poVendor}<small>{item.equipment.poModel}</small></th>)}</tr></thead>
      <tbody>{rows.map(([label, value]) => <tr key={label}><th>{label}</th>{reports.map((item) => <td key={item.equipment.poNumber} className={label === "Status" ? item.status.toLowerCase() : ""}>{value(item)}</td>)}</tr>)}</tbody></table></div>
    <div className="comparison-notes">{reports.map((item) => <article key={item.equipment.poNumber}><b>{item.equipment.poVendor}</b><span>{item.summary.critical ? "Do not approve until critical issues are fixed." : item.summary.caution ? "Approve only after deviations are accepted." : "Meets all evaluated requirements."}</span></article>)}</div></>;
}

function flagValue(report, id) {
  const flag = report.flags.find((item) => item.id === id);
  return `${flag.po} ${flag.status === "COMPLIANT" ? "✓" : flag.status === "CAUTION" ? "⚠" : "×"}`;
}

function FlagList({ flags, equipment }) {
  return <div className="rule-list">{flags.map((flag, index) => { const meta = severityMeta[flag.severity]; const matches = flag.status === "COMPLIANT" ? [] : findSimilarIssues({ ...flag, vendor: equipment?.poVendor, equipment: equipment?.specName }); return <article className={`rule ${flag.status.toLowerCase()}`} key={flag.id}>
    <div className="rule-index">{String(index + 1).padStart(2, "0")}</div><div className="severity" aria-label={meta.label}>{meta.symbol}</div>
    <div className="rule-main"><div className="rule-topline"><h3>{flag.param}</h3><span>{flag.status.replace("_", " ")}</span></div><p>{flag.message}</p>
      <div className="comparison"><span><small>SPECIFICATION</small>{flag.spec}</span><i>→</i><span><small>PROCUREMENT ORDER</small>{flag.po}</span>{flag.delta && <span className="delta"><small>DELTA</small>{flag.delta}</span>}</div>
      {flag.rfi && <div className="rfi"><span>SUGGESTED RFI · {flag.rfi.priority} PRIORITY</span><strong>{flag.rfi.question}</strong><p>{flag.rfi.rationale}</p><div><small>COST</small>{flag.rfi.costImpact}<small>TIMELINE</small>{flag.rfi.timeline}</div><em>Alternative: {flag.rfi.alternative}</em></div>}
      {matches.length > 0 && <details className="local-match"><summary>Local precedents found · {matches.length}</summary><p><b>{matches[0].issueId}</b> — {matches[0].resolution} ({matches[0].cost}, {matches[0].timeline})</p><small>{matches[0].source} · page {matches[0].page} · relevance {matches[0].relevance}/100</small><a href="#local-knowledge">Explore all supporting evidence →</a></details>}
    </div></article>; })}</div>;
}

function Metric({ value, label, tone = "" }) { return <div className={tone}><b>{String(value).padStart(2, "0")}</b><span>{label}</span></div>; }
