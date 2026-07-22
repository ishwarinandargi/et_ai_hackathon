import { useState } from "react";
import ComplianceForm from "./ComplianceForm.jsx";
import ComplianceReport from "./ComplianceReport.jsx";
import AdvancedFeatures from "./AdvancedFeatures.jsx";
import AIWorkbench from "./AIWorkbench.jsx";
import "./styles.css";
import "./enhancements.css";

export default function App() {
  const [report, setReport] = useState(null);
  return <><header className="site-header"><a className="brand" href="#top" aria-label="GridCheck home"><span>G</span> GRIDCHECK</a><div className="system-state"><i /> RULE ENGINE ONLINE</div></header>
    <main id="top"><section className="hero"><div className="hero-copy"><span className="eyebrow">Datacenter procurement control</span>
      <h1>Specification<br/><em>compliance,</em> instantly.</h1><p>Five deterministic checks for electrical safety, delivery risk and Tier III equipment reliability.</p></div>
      <div className="hero-stat"><b>&lt;100</b><span>ms target</span><small>ZERO API CALLS</small></div></section>
      <ComplianceForm onAnalyze={setReport}/>{report && <ComplianceReport report={report}/>}<AIWorkbench report={report} onAnalyze={setReport}/><AdvancedFeatures/></main></>;
}
