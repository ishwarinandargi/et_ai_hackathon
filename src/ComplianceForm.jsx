import { useState } from "react";
import { generateComplianceReport } from "./rules.js";
import { equipmentSamples, samples, vendorQuotes } from "./samples.js";

const pretty = (value) => JSON.stringify(value, null, 2);

export default function ComplianceForm({ onAnalyze }) {
  const [specJson, setSpecJson] = useState(pretty(samples["SC-001"].spec));
  const [poJson, setPoJson] = useState(pretty(samples["SC-001"].po));
  const [selected, setSelected] = useState("SC-001");
  const [error, setError] = useState("");

  function loadSample(id) {
    setSelected(id); setSpecJson(pretty(samples[id].spec)); setPoJson(pretty(samples[id].po));
    setError(""); onAnalyze(null);
  }

  function analyze(event) {
    event.preventDefault();
    try {
      const started = performance.now();
      const report = generateComplianceReport(JSON.parse(specJson), JSON.parse(poJson));
      setError("");
      onAnalyze({ ...report, processingTimeMs: Number((performance.now() - started).toFixed(2)) });
    } catch (cause) {
      setError(cause instanceof SyntaxError ? `Invalid JSON: ${cause.message}` : cause.message);
    }
  }

  function analyzePreset(kind) {
    const started = performance.now();
    const source = kind === "portfolio" ? equipmentSamples : vendorQuotes.map((po) => ({ spec: samples["SC-001"].spec, po }));
    const reports = source.map(({ category, spec, po }) => ({ ...generateComplianceReport(spec, po), category }));
    setError("");
    onAnalyze({ kind, reports, processingTimeMs: Number((performance.now() - started).toFixed(2)) });
  }

  return <section className="workspace" aria-labelledby="input-heading">
    <div className="section-heading"><div><span className="eyebrow">01 · Input</span><h2 id="input-heading">Compare equipment documents</h2></div>
      <div className="samples" aria-label="Sample scenarios">{Object.entries(samples).map(([id, sample]) =>
        <button className={selected === id ? "sample active" : "sample"} type="button" onClick={() => loadSample(id)} key={id} title={sample.label}>{id}</button>)}</div>
    </div>
    <form onSubmit={analyze}>
      <div className="demo-actions"><span>QUICK DEMOS</span><button type="button" onClick={() => analyzePreset("portfolio")}>3 equipment report</button><button type="button" onClick={() => analyzePreset("comparison")}>Compare UPS vendors</button></div>
      <div className="editors">
        <label><span><b>Specification</b><small>REQUIREMENTS.JSON</small></span><textarea value={specJson} onChange={(e) => { setSpecJson(e.target.value); setSelected(""); }} spellCheck="false" aria-label="Equipment specification JSON" /></label>
        <label><span><b>Procurement order</b><small>PURCHASE_ORDER.JSON</small></span><textarea value={poJson} onChange={(e) => { setPoJson(e.target.value); setSelected(""); }} spellCheck="false" aria-label="Procurement order JSON" /></label>
      </div>
      <div className="form-footer"><p className={error ? "error" : "privacy"} role={error ? "alert" : undefined}>{error || "Runs locally in your browser · No data leaves this device"}</p>
        <button className="analyze" type="submit">Run compliance check <span>→</span></button></div>
    </form>
  </section>;
}
