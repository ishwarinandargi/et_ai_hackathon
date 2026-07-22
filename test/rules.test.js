import test from "node:test";
import assert from "node:assert/strict";
import { checkNumericRange, checkVoltage, checkBreakerRating, checkDeliverySchedule, checkMTBF, generateComplianceReport } from "../src/rules.js";
import { baseSpec, equipmentSamples, samples, vendorQuotes } from "../src/samples.js";
import { analyzeCriticalPath, analyzeTrends, analyzeWhatIf, answerKnowledgeQuestion, findSimilarIssues, generateTestChecklist, historicalScores, projectTimeline, shipment, trackShipment } from "../src/advanced.js";
import { answerLocalCopilot, extractLocalDocuments, generateLocalGuidance, loadPreparedPdfDemo } from "../src/localCopilot.js";

test("all five rules cover their boundaries", () => {
  assert.equal(checkNumericRange("Power capacity", 500, 600, 500).status, "COMPLIANT");
  assert.equal(checkNumericRange("Power capacity", 500, 600, 480).severity, "CRITICAL");
  assert.equal(checkNumericRange("Power capacity", 500, 600, 650).status, "CAUTION");
  assert.equal(checkVoltage(400, "3-phase", .1, 440, "3-phase").status, "COMPLIANT");
  assert.equal(checkVoltage(400, "3-phase", .1, 460, "3-phase").severity, "CRITICAL");
  assert.equal(checkVoltage(400, "3-phase", .1, 400, "1-phase").severity, "CRITICAL");
  assert.equal(checkBreakerRating(160, 160, 200).status, "COMPLIANT");
  assert.equal(checkBreakerRating(160, 160, 160).details.required, 200);
  assert.equal(checkDeliverySchedule("2026-06-15", "2026-06-22", 7).status, "COMPLIANT");
  assert.equal(checkDeliverySchedule("2026-06-18", "2026-06-22", 7).status, "CAUTION");
  assert.equal(checkDeliverySchedule("2026-06-25", "2026-06-22", 7).severity, "CRITICAL");
  assert.equal(checkMTBF(150000, 150000).status, "COMPLIANT");
  assert.equal(checkMTBF(150000, 135000).status, "CAUTION");
  assert.equal(checkMTBF(150000, 120000).status, "NON_COMPLIANT");
});

test("sample reports match the written rule engine", () => {
  const report = (id) => generateComplianceReport(samples[id].spec, samples[id].po);
  assert.deepEqual([report("SC-001").status, report("SC-001").score], ["NON_COMPLIANT", 70]);
  assert.deepEqual([report("SC-002").status, report("SC-002").score], ["COMPLIANT", 100]);
  assert.deepEqual([report("SC-003").status, report("SC-003").score], ["NON_COMPLIANT", 70]);
});

test("invalid inputs fail clearly", () => {
  assert.throws(() => checkNumericRange("Capacity", 600, 500, 550), RangeError);
  assert.throws(() => checkDeliverySchedule("2026-02-30", "2026-03-10", 7), TypeError);
});

test("demo reports cover three equipment types, RFIs, and vendor ranking", () => {
  const equipmentReports = equipmentSamples.map(({ spec, po }) => generateComplianceReport(spec, po));
  assert.deepEqual(equipmentReports.map(({ status }) => status), ["NON_COMPLIANT", "COMPLIANT", "CAUTION"]);
  assert.match(equipmentReports[0].flags.find(({ id }) => id === "flag_003").rfi.question, /200A/);
  const vendorReports = vendorQuotes.map((po) => generateComplianceReport(samples["SC-001"].spec, po));
  assert.equal(vendorReports.sort((a, b) => b.score - a.score)[0].equipment.poVendor, "Schneider Electric");
});

test("advanced project intelligence engines return actionable results", () => {
  const path = analyzeCriticalPath(projectTimeline, projectTimeline.equipmentDeliveryDates, projectTimeline.goLiveDate);
  assert.equal(path.criticalPath.at(-1).name, "Go-Live");
  assert.equal(path.riskAnalysis.find(({ equipment }) => equipment.includes("UPS")).delayScenarios[1].newGoLiveDate, "2026-07-18");

  const tracked = trackShipment(shipment.equipment, null, shipment.route);
  assert.equal(tracked.estimatedArrival, "2026-06-18");
  assert.equal(tracked.alerts.length, 2);

  assert.equal(findSimilarIssues({ param: "Input breaker rating", vendor: "Eaton" })[0].issueId, "RFI-2024-156");
  const scenario = analyzeWhatIf(samples["SC-001"].spec, samples["SC-001"].po, { breakerRatingA: 180 });
  assert.equal(scenario.impacts[0].change, "IMPROVED");
  assert.equal(analyzeTrends(historicalScores).bestVendor, "Eaton");

  const checklist = generateTestChecklist("Eaton UPS", [{ param: "Breaker rating" }]);
  assert.equal(checklist.phases.length, 4);
  assert.ok(checklist.phases.flatMap(({ tests }) => tests).some(({ critical }) => critical));
});

test("local knowledge prototype ranks three demo scenarios and answers from evidence", () => {
  const breaker = findSimilarIssues({ param: "Input breaker rating", vendor: "Eaton", equipment: "Eaton UPS", message: "160A instead of 200A" });
  const delivery = findSimilarIssues({ param: "Delivery schedule", vendor: "Trane", equipment: "Trane Cooling Tower", message: "customs delay" });
  const reliability = findSimilarIssues({ param: "MTBF reliability", vendor: "Riello", equipment: "Riello UPS", message: "135000 hours" });
  assert.deepEqual([breaker[0].issueId, delivery[0].issueId, reliability[0].issueId], ["RFI-2024-156", "LOG-2024-201", "REL-2025-032"]);
  assert.equal(breaker[0].relevance, 100);
  assert.match(answerKnowledgeQuestion("What did it cost?", { param: "Input breaker rating" }, breaker), /\$0/);
  assert.ok(breaker[0].source && breaker[0].page && breaker[0].excerpt);
});

test("offline copilot extracts documents and generates report-grounded templates", () => {
  const extraction = extractLocalDocuments([
    { name: "specification.json", text: JSON.stringify({ spec: baseSpec }) },
    { name: "purchase-order.json", text: JSON.stringify({ po: samples["SC-001"].po }) },
  ]);
  assert.equal(extraction.spec.minCapacityKw, 500);
  assert.equal(extraction.po.breakerRatingA, 160);
  assert.ok(extraction.evidence.length > 10);

  const report = generateComplianceReport(extraction.spec, extraction.po);
  const guidance = generateLocalGuidance(report);
  assert.match(guidance.executiveSummary, /critical/i);
  assert.match(guidance.rfiDraft.body, /200 A minimum/);
  assert.match(answerLocalCopilot("What blocks approval?", report), /Input breaker rating/);
  assert.match(answerLocalCopilot("What did a similar issue cost?", report), /\$0/);
  assert.equal(loadPreparedPdfDemo().po.poNumber, "PO-2026-4521");
});
