import { generateComplianceReport } from "./rules.js";

const DAY = 86_400_000;
const iso = (date) => new Date(`${date}T00:00:00Z`);
const addDays = (date, days) => new Date(iso(date).valueOf() + days * DAY).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.round((iso(to) - iso(from)) / DAY);

export const projectTimeline = {
  projectName: "Mumbai Datacenter Phase 3", goLiveDate: "2026-07-15",
  milestones: [
    { name: "Power Equipment Delivery", date: "2026-06-18", dependsOn: [] },
    { name: "Power Installation", date: "2026-06-20", dependsOn: ["Power Equipment Delivery"] },
    { name: "Power Testing", date: "2026-06-23", dependsOn: ["Power Installation"] },
    { name: "Cooling Equipment Delivery", date: "2026-06-12", dependsOn: [] },
    { name: "Cooling Installation", date: "2026-06-15", dependsOn: ["Cooling Equipment Delivery"] },
    { name: "Network Testing", date: "2026-07-01", dependsOn: ["Power Testing"] },
    { name: "Integration Testing", date: "2026-07-08", dependsOn: ["Network Testing"] },
    { name: "Go-Live", date: "2026-07-15", dependsOn: ["Integration Testing"] },
  ],
  equipmentDeliveryDates: { "UPS (Power)": "2026-06-18", "Cooling Tower": "2026-06-12", "Core Switch": "2026-06-28" },
};

export function analyzeCriticalPath(timeline, equipmentDeliveryDates, goLiveDate) {
  const milestones = Array.isArray(timeline) ? timeline : timeline.milestones;
  const byName = new Map(milestones.map((item) => [item.name, item]));
  const pathTo = (name, seen = new Set()) => {
    if (seen.has(name)) throw new Error("Milestone dependencies cannot contain a cycle");
    const item = byName.get(name);
    if (!item) throw new Error(`Unknown milestone dependency: ${name}`);
    if (!item.dependsOn.length) return [item];
    const nextSeen = new Set(seen).add(name);
    const parentPaths = item.dependsOn.map((parent) => pathTo(parent, nextSeen));
    return [...parentPaths.sort((a, b) => b.length - a.length)[0], item];
  };
  const finish = milestones.find((item) => /go.?live/i.test(item.name)) || milestones.at(-1);
  const criticalPath = pathTo(finish.name);
  const criticalNames = new Set(criticalPath.map((item) => item.name));
  const aliases = { UPS: "Power Equipment Delivery", Cooling: "Cooling Equipment Delivery", Core: "Network Testing" };
  const riskAnalysis = Object.entries(equipmentDeliveryDates).map(([equipment, scheduledDelivery]) => {
    const alias = Object.entries(aliases).find(([key]) => equipment.includes(key))?.[1];
    const deliveryMilestone = byName.get(alias) || milestones.find((item) => item.name.toLowerCase().includes(equipment.split(" ")[0].toLowerCase()));
    const downstream = milestones.filter((item) => item.dependsOn.includes(deliveryMilestone?.name));
    const needed = downstream.find((item) => /testing/i.test(item.name)) || downstream[0] || deliveryMilestone || finish;
    const bufferDays = Math.max(0, daysBetween(scheduledDelivery, needed.date));
    const onCriticalPath = Boolean(deliveryMilestone && criticalNames.has(deliveryMilestone.name));
    const risk = onCriticalPath && bufferDays <= 5 ? "CRITICAL" : bufferDays < 5 ? "HIGH" : "MEDIUM";
    const delayScenarios = [1, 3, 5].map((delayDays) => {
      const impactDays = onCriticalPath ? delayDays : Math.max(0, delayDays - bufferDays);
      return { delayDays, impactDays, newGoLiveDate: addDays(goLiveDate, impactDays),
        mitigation: impactDays >= 3 ? "Expedite shipment or compress parallel test phases." : impactDays ? "Resequence testing to recover the lost day." : "No action needed; existing buffer absorbs the delay." };
    });
    return { equipment, scheduledDelivery, neededBy: needed.date, onCriticalPath, bufferDays, risk, delayScenarios };
  });
  return { projectName: timeline.projectName || "Project", goLiveDate, criticalPath, riskAnalysis };
}

export const shipment = {
  equipment: "Eaton 500kW UPS", po: "PO-2026-4521", currentDate: "2026-06-10",
  route: [
    { leg: "Manufactured", location: "Dublin, Ireland", date: "2026-06-01", status: "COMPLETED" },
    { leg: "Port loading", location: "Dublin Port", date: "2026-06-03", status: "COMPLETED" },
    { leg: "In transit", location: "Singapore Port", eta: "2026-06-10", status: "IN_PROGRESS" },
    { leg: "Customs clearance", location: "Singapore", eta: "2026-06-15", status: "ESTIMATED", riskFactors: ["Port congestion", "Monsoon season"] },
    { leg: "Local delivery", location: "Mumbai, India", eta: "2026-06-18", status: "ESTIMATED" },
  ],
};

export function trackShipment(equipmentId, currentLeg, estimatedLegs) {
  const route = estimatedLegs?.length ? estimatedLegs : shipment.route;
  const current = typeof currentLeg === "string" ? route.find((item) => item.leg === currentLeg) : currentLeg || route.find((item) => item.status === "IN_PROGRESS");
  const expected = route.at(-1)?.eta || route.at(-1)?.date;
  const risks = route.flatMap((item) => item.riskFactors || []);
  return { equipment: equipmentId, currentLocation: current?.location || "Unknown", currentLeg: current?.leg || "Unknown", estimatedArrival: expected,
    confidenceIntervals: { optimistic: addDays(expected, -2), expected, pessimistic: addDays(expected, risks.length ? 4 : 2) },
    riskLevel: risks.length > 1 ? "MEDIUM" : risks.length ? "LOW" : "CLEAR", route,
    alerts: risks.map((factor) => ({ level: factor.includes("congestion") ? "WARNING" : "INFO", factor, impact: factor.includes("congestion") ? "ETA may slip by 2 days." : "15% chance of a 2-3 day delay." })),
    expediteOptions: [{ option: "Air freight Singapore to Mumbai", cost: "$5k", timeline: "24 hours", eta: addDays(expected, -2), recommended: "Use only if the pessimistic ETA reaches the critical path." }],
  };
}

export const issueDatabase = [
  { issueId: "RFI-2024-156", date: "2024-03-15", param: "Input breaker rating", equipment: "Eaton UPS", project: "Mumbai Datacenter Phase 2", problem: "160A breaker supplied against a 200A requirement", vendor: "Eaton", resolution: "Vendor supplied a 200A model at no charge", cost: "$0", timeline: "3 days", lesson: "Request custom breaker ratings at RFQ stage.", contact: "Raj Kumar, Project Manager", source: "Mumbai Phase 2 RFI Register", page: 2, section: "4.3 Electrical protection", excerpt: "Eaton confirmed the 200A breaker variant as a standard factory option. Replacement was supplied at no additional charge with a three-day lead time." },
  { issueId: "RFI-2023-089", date: "2023-09-08", param: "Input breaker rating", equipment: "ABB UPS", project: "Pune Edge Facility", problem: "UPS breaker and upstream panel rating conflict", vendor: "ABB", resolution: "Electrical panel was redesigned after coordination review", cost: "$12k", timeline: "4 weeks", lesson: "Coordinate upstream panel ratings before purchase.", contact: "Meera Shah, Electrical Lead", source: "Pune Electrical Coordination Log", page: 14, section: "Panel protection", excerpt: "The vendor breaker met its datasheet, but the upstream panel could not support the revised protection scheme. The site panel was redesigned." },
  { issueId: "RFI-2025-044", date: "2025-02-11", param: "Input breaker rating", equipment: "Schneider UPS", project: "Hyderabad DC-4", problem: "Breaker schedule omitted the required safety margin", vendor: "Schneider Electric", resolution: "Vendor reissued the schedule with a 225A breaker", cost: "$1k", timeline: "5 days", lesson: "Include the safety-margin calculation in the RFQ.", contact: "Neha Rao, QA Lead", source: "Hyderabad Corrective Action Report", page: 6, section: "CAR-12", excerpt: "The revised breaker schedule included the project safety margin and was accepted after electrical engineer review." },
  { issueId: "LOG-2024-201", date: "2024-06-21", param: "Delivery schedule", equipment: "Trane Cooling Tower", project: "Chennai DC-1", problem: "Customs hold caused a five-day cooling-tower delay", vendor: "Trane", resolution: "Local freight forwarder expedited customs clearance", cost: "$2k", timeline: "5 days", lesson: "Use an experienced local freight forwarder.", contact: "Arun Nair, Logistics Lead", source: "Chennai Logistics Incident Report", page: 3, section: "Customs mitigation", excerpt: "The appointed local freight forwarder cleared the customs documentation backlog within two working days and protected the installation date." },
  { issueId: "LOG-2025-071", date: "2025-04-04", param: "Delivery schedule", equipment: "Eaton UPS", project: "Noida Availability Zone", problem: "Port congestion reduced the commissioning buffer to two days", vendor: "Eaton", resolution: "Testing was resequenced while the shipment cleared port", cost: "$500", timeline: "2 days", lesson: "Trigger schedule mitigation when buffer falls below five days.", contact: "Kabir Singh, Planning Lead", source: "Noida Weekly Schedule Report", page: 8, section: "Recovery plan", excerpt: "Pre-installation checks were moved ahead of equipment receipt, recovering two days without reducing the functional test duration." },
  { issueId: "LOG-2023-118", date: "2023-12-02", param: "Delivery schedule", equipment: "Cisco Core Switch", project: "Bengaluru Edge-3", problem: "Core switch arrived three days after the committed date", vendor: "Cisco", resolution: "A loan unit supported staging until the purchased switch arrived", cost: "$0", timeline: "1 day", lesson: "Include loan-equipment terms for critical network hardware.", contact: "Isha Menon, Network Lead", source: "Bengaluru Network Handover", page: 11, section: "Temporary equipment", excerpt: "The vendor provided a compatible loan chassis for configuration staging, preventing impact to integration testing." },
  { issueId: "REL-2025-032", date: "2025-01-19", param: "MTBF reliability", equipment: "Riello UPS", project: "Mumbai Datacenter Phase 2", problem: "Quoted MTBF was 135,000 hours against a 150,000-hour minimum", vendor: "Riello", resolution: "Procurement selected the higher-reliability Master HE model", cost: "$9k", timeline: "7 days", lesson: "Compare reliability at model level, not vendor level.", contact: "Raj Kumar, Project Manager", source: "Mumbai Vendor Evaluation", page: 9, section: "Reliability deviation", excerpt: "The Sentryum offer was rejected. The alternate Master HE model met the 150,000-hour threshold and retained the required delivery window." },
  { issueId: "REL-2024-097", date: "2024-08-07", param: "MTBF reliability", equipment: "Cisco Core Switch", project: "Delhi DC-2", problem: "Switch reliability evidence did not cover redundant supervisors", vendor: "Cisco", resolution: "Vendor supplied component-level reliability evidence", cost: "$0", timeline: "4 days", lesson: "Request configuration-specific MTBF evidence.", contact: "Isha Menon, Network Lead", source: "Delhi Technical Submittal Review", page: 5, section: "Reliability evidence", excerpt: "The revised submittal included supervisor, fabric, and power-supply reliability values for the exact purchased configuration." },
  { issueId: "ELE-2024-063", date: "2024-05-16", param: "Voltage & phase", equipment: "Trane Cooling Tower", project: "Kolkata DC-1", problem: "Motor starter was quoted for 400V instead of the site 415V supply", vendor: "Trane", resolution: "Starter configuration was corrected before manufacture", cost: "$0", timeline: "2 days", lesson: "State site voltage on every equipment schedule.", contact: "Meera Shah, Electrical Lead", source: "Kolkata Electrical RFI Log", page: 4, section: "Motor voltage", excerpt: "Trane confirmed the 415V starter configuration before release for manufacture. No commercial or schedule impact applied." },
  { issueId: "CAP-2025-015", date: "2025-01-08", param: "Power capacity", equipment: "Eaton UPS", project: "Pune DC Expansion", problem: "Quoted capacity left no allowance for forecast growth", vendor: "Eaton", resolution: "Order was upgraded from 500kW to 550kW", cost: "$18k", timeline: "No change", lesson: "Include the approved growth forecast in capacity reviews.", contact: "Neha Rao, QA Lead", source: "Pune Capacity Review Minutes", page: 7, section: "Growth allowance", excerpt: "The 550kW selection provided the approved ten-percent growth allowance without affecting the manufacturing slot." },
];

export function findSimilarIssues(flag, database = issueDatabase) {
  const normalize = (value) => String(value || "").toLowerCase();
  const words = `${flag.param || ""} ${flag.message || ""}`.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
  return database.map((issue) => {
    const haystack = normalize(`${issue.param} ${issue.problem} ${issue.resolution}`);
    const sameParam = normalize(issue.param) === normalize(flag.param);
    const sameEquipment = flag.equipment && normalize(issue.equipment).split(/\W+/).some((word) => word.length > 2 && normalize(flag.equipment).includes(word));
    const sameVendor = flag.vendor && normalize(issue.vendor) === normalize(flag.vendor);
    const keyword = words.some((word) => haystack.includes(word));
    const recent = new Date(issue.date).getUTCFullYear() >= 2024;
    const relevance = (sameParam ? 40 : 0) + (sameEquipment ? 25 : 0) + (sameVendor ? 20 : 0) + (keyword ? 10 : 0) + (recent ? 5 : 0);
    return { ...issue, relevance, matchReasons: [sameParam && "same parameter", sameEquipment && "same equipment", sameVendor && "same vendor", keyword && "shared keywords", recent && "recent precedent"].filter(Boolean) };
  }).filter((issue) => issue.relevance >= 15).sort((a, b) => b.relevance - a.relevance || iso(b.date) - iso(a.date)).slice(0, 3);
}

export function answerKnowledgeQuestion(question, flag, matches = findSimilarIssues(flag)) {
  if (!matches.length) return "No supporting local precedent was found. Escalate for an engineering review.";
  const issue = matches[0];
  const query = String(question).toLowerCase();
  if (query.includes("cost")) return `${issue.issueId} was resolved for ${issue.cost}. Confirm current commercial terms with ${issue.vendor}.`;
  if (query.includes("long") || query.includes("time")) return `${issue.issueId} took ${issue.timeline} to resolve. Use that duration as the initial planning allowance.`;
  if (query.includes("test") || query.includes("commission")) {
    const test = /breaker/i.test(flag.param) ? "breaker nameplate verification and a full-load trip test" : /mtbf/i.test(flag.param) ? "configuration-specific reliability evidence review" : "receipt inspection followed by the linked functional test";
    return `Validate the correction with ${test}. Do not close the flag until the evidence is signed by engineering and QA.`;
  }
  if (query.includes("ask") || query.includes("vendor")) return `Ask ${issue.vendor} to repeat the ${issue.resolution.toLowerCase()} used in ${issue.issueId}, and request written confirmation of cost and lead time.`;
  return `${issue.issueId} on ${issue.project} resolved a similar issue by: ${issue.resolution}. It cost ${issue.cost}, took ${issue.timeline}, and established this lesson: ${issue.lesson}`;
}

export function analyzeWhatIf(spec, originalPO, proposedChange) {
  const original = generateComplianceReport(spec, originalPO);
  const proposed = generateComplianceReport(spec, { ...originalPO, ...proposedChange });
  const rank = { NON_COMPLIANT: 0, CAUTION: 1, COMPLIANT: 2 };
  const impacts = original.flags.map((before, index) => ({ param: before.param, before: before.status, after: proposed.flags[index].status,
    change: rank[proposed.flags[index].status] > rank[before.status] ? "IMPROVED" : rank[proposed.flags[index].status] < rank[before.status] ? "WORSENED" : "UNCHANGED" })).filter((item) => item.change !== "UNCHANGED");
  return { originalScore: original.score, proposedScore: proposed.score, scoreImprovement: proposed.score - original.score, impacts,
    recommendation: proposed.status === "COMPLIANT" ? "Proposal meets all evaluated requirements." : proposedChange.breakerRatingA < 200 ? "Do not settle below 200A; the remaining safety gap still requires approval." : "Review the remaining flagged requirements before approval.", confidenceLevel: 0.95 };
}

export const historicalScores = {
  Eaton: [75, 78, 82, 85, 88, 90, 92, 91, 93, 94, 95, 96],
  Schneider: [92, 92, 94, 93, 91, 90, 88, 87, 86, 85, 84, 82],
  Riello: [70, 72, 71, 70, 68, 65, 64, 62, 60, 58, 56, 55],
};

export function analyzeTrends(data, timeframe = "12 months") {
  const vendorTrends = Object.entries(data).map(([vendor, scores]) => {
    const change = scores.at(-1) - scores[0];
    return { vendor, scores, change, changePerMonth: Number((change / (scores.length - 1)).toFixed(2)), trend: change > 3 ? "IMPROVING" : change < -3 ? "DECLINING" : "STABLE",
      insight: change > 3 ? "Quality is improving; continue the current controls." : change < -10 ? "Sharp decline; audit or replace this vendor." : change < -3 ? "Recent decline; schedule a quality review." : "Performance is stable." };
  });
  return { timeframe, vendorTrends, bestVendor: [...vendorTrends].sort((a, b) => b.scores.at(-1) - a.scores.at(-1))[0].vendor };
}

const checklistTemplates = {
  UPS: [
    ["Pre-Installation", "Visual inspection", "Verify physical condition and nameplate", "No damage and ratings match the PO", false],
    ["Pre-Installation", "Breaker rating verification", "Confirm corrected protection rating", "Breaker is rated at least 200A", true],
    ["Installation", "Grounding and connection check", "Validate installation workmanship", "Ground resistance below 1Ω and terminals torqued", true],
    ["Functional Testing", "Full load and failover test", "Validate charging, discharge, and transfer", "No trip, stable voltage, temperature below 50°C", true],
    ["Acceptance", "Records and sign-off", "Complete the audit trail", "All critical tests passed and signed", true],
  ],
  Cooling: [
    ["Pre-Installation", "Visual and nameplate inspection", "Verify tower condition and rating", "No damage and 500TR minimum", false],
    ["Installation", "Flow and piping inspection", "Confirm hydraulic installation", "No leaks and design flow achieved", true],
    ["Functional Testing", "Thermal load test", "Validate heat rejection under load", "Outlet temperature meets design", true],
    ["Acceptance", "Controls and sign-off", "Verify alarms and records", "All alarms proven and results signed", true],
  ],
  Networking: [
    ["Pre-Installation", "Inventory and firmware check", "Verify model, modules, and approved firmware", "Inventory matches PO", false],
    ["Installation", "Redundant power and uplink check", "Validate resilient connections", "No single connection failure interrupts service", true],
    ["Functional Testing", "Throughput and failover test", "Validate capacity and redundancy", "Rated throughput with successful failover", true],
    ["Acceptance", "Configuration backup and sign-off", "Complete operational handover", "Backup restored and results signed", true],
  ],
};

export function generateTestChecklist(equipment, complianceFlags = [], tiaSpec = "TIA-942 Tier III") {
  const type = /cool/i.test(equipment) ? "Cooling" : /switch|network/i.test(equipment) ? "Networking" : "UPS";
  const names = ["Pre-Installation", "Installation", "Functional Testing", "Acceptance"];
  const rows = checklistTemplates[type].map((row, index) => ({ testId: `${names.indexOf(row[0]) + 1}.${index + 1}`, phase: row[0], name: row[1], purpose: row[2], passCriteria: row[3], critical: row[4], responsible: row[4] ? "Engineer + QA" : "Site engineer", duration: row[4] ? "45 min" : "30 min",
    linkedFlag: complianceFlags.find((flag) => row[1].toLowerCase().includes(flag.param.split(" ")[0].toLowerCase()))?.param || "Equipment integrity" }));
  return { equipment, testStandard: tiaSpec, totalDuration: "7 days", phases: names.map((name, index) => ({ phase: index + 1, name, tests: rows.filter((test) => test.phase === name) })) };
}
