import { answerKnowledgeQuestion, findSimilarIssues } from "./advanced.js";
import { baseSpec, samples } from "./samples.js";

const specFields = ["equipment", "standard", "minCapacityKw", "maxCapacityKw", "chargingCurrentA", "dischargeCurrentA", "voltageV", "voltageTolerance", "voltagePhase", "minMTBFHours", "deliveryBufferDays"];
const poFields = ["poNumber", "vendor", "model", "capacityKw", "breakerRatingA", "voltageV", "voltagePhase", "mtbfHours", "scheduledDelivery", "criticalDate", "price"];
const aliases = {
  equipment: "equipment", standard: "standard", minimumcapacitykw: "minCapacityKw", mincapacitykw: "minCapacityKw", maximumcapacitykw: "maxCapacityKw", maxcapacitykw: "maxCapacityKw",
  chargingcurrenta: "chargingCurrentA", dischargecurrenta: "dischargeCurrentA", voltagev: "voltageV", voltagetolerance: "voltageTolerance", voltagephase: "voltagePhase", phase: "voltagePhase",
  minimummtbfhours: "minMTBFHours", minmtbfhours: "minMTBFHours", deliverybufferdays: "deliveryBufferDays", ponumber: "poNumber", po: "poNumber", vendor: "vendor", model: "model",
  capacitykw: "capacityKw", breakerratinga: "breakerRatingA", breaker: "breakerRatingA", mtbfhours: "mtbfHours", mtbf: "mtbfHours", scheduleddelivery: "scheduledDelivery", deliverydate: "scheduledDelivery", criticaldate: "criticalDate", price: "price",
};
const numeric = new Set([...specFields, ...poFields].filter((field) => /Kw|Current|Voltage|Tolerance|Hours|Days|Rating|price/i.test(field) && !/Phase/i.test(field)));
const cleanKey = (key) => String(key).replace(/^spec[._ -]?|^po[._ -]?/i, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const empty = (fields) => Object.fromEntries(fields.map((field) => [field, null]));

function scalar(value, field) {
  if (value === "" || value == null) return null;
  if (!numeric.has(field)) return String(value).trim();
  const number = Number(String(value).replace(/[$,%\s]/g, ""));
  if (!Number.isFinite(number)) return null;
  return field === "voltageTolerance" && String(value).includes("%") ? number / 100 : number;
}

function assign(result, rawKey, value, source, hint = "") {
  const field = aliases[cleanKey(rawKey)];
  if (!field) return;
  const target = specFields.includes(field) && !poFields.includes(field) ? "spec" : poFields.includes(field) && !specFields.includes(field) ? "po" : /spec|requirement/i.test(`${rawKey} ${hint}`) ? "spec" : "po";
  result[target][field] = scalar(value, field);
  result.evidence.push({ field: `${target}.${field}`, value: String(value), source });
}

function ingestObject(result, object, source, hint = "") {
  if (object.spec || object.po) {
    if (object.spec) ingestObject(result, object.spec, source, "specification");
    if (object.po) ingestObject(result, object.po, source, "purchase order");
    return;
  }
  for (const [key, value] of Object.entries(object)) assign(result, key, value, source, hint);
}

export function extractLocalDocuments(documents) {
  const result = { spec: empty(specFields), po: empty(poFields), evidence: [], warnings: [] };
  for (const document of documents) {
    const extension = document.name.split(".").pop().toLowerCase();
    try {
      if (extension === "json") ingestObject(result, JSON.parse(document.text), document.name, document.name);
      else if (extension === "csv") {
        // ponytail: prototype CSV supports one header row and one value row; use a real parser when arbitrary vendor CSVs matter.
        const [header = "", values = ""] = document.text.trim().split(/\r?\n/);
        header.split(",").forEach((key, index) => assign(result, key, values.split(",")[index], document.name, document.name));
      } else if (extension === "txt") {
        document.text.split(/\r?\n/).forEach((line) => { const separator = line.indexOf(":"); if (separator > 0) assign(result, line.slice(0, separator), line.slice(separator + 1), document.name, document.name); });
      } else result.warnings.push(`${document.name}: unsupported in offline prototype. Use the prepared PDF demo or JSON/CSV/TXT.`);
    } catch (error) { result.warnings.push(`${document.name}: ${error.message}`); }
  }
  const missing = [...specFields.map((field) => `spec.${field}`), ...poFields.filter((field) => field !== "price").map((field) => `po.${field}`)].filter((path) => { const [group, field] = path.split("."); return result[group][field] == null; });
  if (missing.length) result.warnings.push(`Review missing fields: ${missing.join(", ")}`);
  return result;
}

export function loadPreparedPdfDemo() {
  const spec = { ...baseSpec };
  const po = { ...samples["SC-001"].po, price: 250000 };
  return { spec, po, warnings: ["Prepared PDF demo: values represent a deterministic extraction fixture, not general PDF parsing."], evidence: [
    { field: "spec.minCapacityKw", value: "500", source: "UPS-Specification-Demo.pdf · page 2" },
    { field: "spec.voltageV", value: "400", source: "UPS-Specification-Demo.pdf · page 3" },
    { field: "po.breakerRatingA", value: "160", source: "Eaton-Quote-Demo.pdf · page 4" },
    { field: "po.scheduledDelivery", value: "2026-06-18", source: "Eaton-Quote-Demo.pdf · page 1" },
  ] };
}

function reportsOf(report) { return report?.reports || (report ? [report] : []); }
function actionable(report) { return reportsOf(report).flatMap((item) => (item.flags || []).filter((flag) => flag.status !== "COMPLIANT").map((flag) => ({ ...flag, vendor: item.equipment?.poVendor, equipment: item.equipment?.specName }))); }

export function generateLocalGuidance(report) {
  const issues = actionable(report);
  const critical = issues.filter((flag) => flag.severity === "CRITICAL");
  const equipment = reportsOf(report)[0]?.equipment || {};
  const actions = issues.length ? issues.map((flag) => `${flag.severity}: Resolve ${flag.param} — ${flag.message}`) : ["Record approval and proceed to commissioning preparation."];
  const executiveSummary = issues.length ? `${critical.length} critical and ${issues.length - critical.length} cautionary issue(s) require review before procurement approval.` : "All evaluated requirements comply with the active specification.";
  const primary = issues[0];
  const subject = primary ? `RFI: ${primary.param} correction for ${equipment.poNumber || "equipment order"}` : `Compliance confirmation for ${equipment.poNumber || "equipment order"}`;
  const body = primary ? `Hello ${equipment.poVendor || "Vendor"},\n\nOur compliance review identified the following issue:\n${primary.message}\n\nSpecification: ${primary.spec}\nQuoted offer: ${primary.po}\n\nPlease confirm a corrected configuration, associated cost, and committed delivery date. Procurement approval remains pending until written evidence is received.\n\nRegards,\nGridCheck Procurement Team` : `Hello ${equipment.poVendor || "Vendor"},\n\nThe evaluated offer meets all five GridCheck requirements. Please confirm the final configuration and delivery commitment.\n\nRegards,\nGridCheck Procurement Team`;
  return { executiveSummary, immediateActions: actions, negotiationStrategy: primary ? `Lead with the ${primary.severity.toLowerCase()} ${primary.param} deviation. Request written technical evidence before discussing commercial approval.` : "Preserve the compliant configuration and delivery terms in the final order.", rfiDraft: { subject, body } };
}

export function answerLocalCopilot(message, report) {
  if (!report) return "Run a compliance report first so the prototype can answer from verified results.";
  const query = String(message).toLowerCase();
  const issues = actionable(report);
  if (/block|approval|critical/.test(query)) return issues.length ? `Approval is blocked by: ${issues.map((flag) => `${flag.param} (${flag.status.replace("_", " ")})`).join(", ")}.` : "Nothing blocks approval; all evaluated requirements comply.";
  if (/email|rfi|draft/.test(query)) return generateLocalGuidance(report).rfiDraft.body;
  if (/best vendor|which vendor|winner/.test(query) && report.kind === "comparison") return `${[...report.reports].sort((a, b) => b.score - a.score || a.equipment.price - b.equipment.price)[0].equipment.poVendor} has the strongest evaluated compliance score.`;
  if (/score|status/.test(query)) return report.kind ? `This view contains ${report.reports.length} reports. Scores: ${report.reports.map((item) => `${item.equipment.poVendor}: ${item.score}%`).join(", ")}.` : `The active report is ${report.status.replace("_", " ")} with a score of ${report.score}%.`;
  const primary = issues[0];
  if (primary && /resolv|cost|time|long|vendor|test|commission|previous|past/.test(query)) {
    const matches = findSimilarIssues(primary);
    return `${answerKnowledgeQuestion(message, primary, matches)}\n\nSource: ${matches[0]?.issueId || "No local precedent"}${matches[0] ? ` · ${matches[0].source}, page ${matches[0].page}` : ""}`;
  }
  return "This offline prototype supports questions about approval blockers, status, scores, RFI emails, vendors, past resolutions, cost, timeline, and commissioning tests.";
}
