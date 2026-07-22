export const baseSpec = {
  equipment: "Uninterruptible Power Supply (UPS)", standard: "TIA-942 Tier III",
  minCapacityKw: 500, maxCapacityKw: 600, chargingCurrentA: 160, dischargeCurrentA: 160,
  requiredBreakerA: 200, voltageV: 400, voltageTolerance: 0.1, voltagePhase: "3-phase",
  minMTBFHours: 150000, deliveryBufferDays: 7,
};

export const samples = {
  "SC-001": { label: "Safety + schedule faults", spec: baseSpec, po: {
    poNumber: "PO-2026-4521", vendor: "Eaton", model: "500kW UPS 93PM", capacityKw: 500,
    breakerRatingA: 160, voltageV: 400, voltagePhase: "3-phase", mtbfHours: 200000,
    scheduledDelivery: "2026-06-18", criticalDate: "2026-06-22",
  } },
  "SC-002": { label: "Fully compliant", spec: baseSpec, po: {
    poNumber: "PO-2026-4522", vendor: "Schneider Electric", model: "Galaxy VX 500kW", capacityKw: 550,
    breakerRatingA: 200, voltageV: 415, voltagePhase: "3-phase", mtbfHours: 175000,
    scheduledDelivery: "2026-06-10", criticalDate: "2026-06-22",
  } },
  "SC-003": { label: "Electrical + reliability faults", spec: baseSpec, po: {
    poNumber: "PO-2026-4523", vendor: "Vertiv", model: "Liebert EXL S1 550kW", capacityKw: 550,
    breakerRatingA: 225, voltageV: 450, voltagePhase: "3-phase", mtbfHours: 135000,
    scheduledDelivery: "2026-06-12", criticalDate: "2026-06-22",
  } },
};

export const equipmentSamples = [
  { category: "Power distribution", ...samples["SC-001"] },
  { category: "Cooling", label: "Cooling tower", spec: {
    ...baseSpec, equipment: "Cooling Tower 500TR", standard: "ASHRAE TC 9.9",
    capacityLabel: "Cooling capacity", capacityUnit: "TR", minCapacityKw: 500, maxCapacityKw: 550,
    chargingCurrentA: 80, dischargeCurrentA: 80, voltageV: 415, voltageTolerance: 0.05,
    minMTBFHours: 100000,
  }, po: {
    poNumber: "PO-2026-4602", vendor: "Trane", model: "CVGF 500TR", capacityKw: 525,
    breakerRatingA: 125, voltageV: 415, voltagePhase: "3-phase", mtbfHours: 120000,
    scheduledDelivery: "2026-06-08", criticalDate: "2026-06-22",
  } },
  { category: "Networking", label: "Core switch", spec: {
    ...baseSpec, equipment: "Core Switch 10G Redundant", standard: "TIA-942 Tier III",
    capacityLabel: "Switching capacity", capacityUnit: "Gbps", minCapacityKw: 800, maxCapacityKw: 1000,
    chargingCurrentA: 8, dischargeCurrentA: 8, voltageV: 230, voltageTolerance: 0.05,
    voltagePhase: "1-phase", minMTBFHours: 150000,
  }, po: {
    poNumber: "PO-2026-4703", vendor: "Cisco", model: "Nexus 9504", capacityKw: 900,
    breakerRatingA: 12, voltageV: 230, voltagePhase: "1-phase", mtbfHours: 180000,
    scheduledDelivery: "2026-06-17", criticalDate: "2026-06-22",
  } },
];

export const vendorQuotes = [
  { ...samples["SC-001"].po, price: 250000 },
  { ...samples["SC-002"].po, price: 280000 },
  { ...samples["SC-003"].po, vendor: "Riello", model: "Sentryum 550kW", breakerRatingA: 200, voltageV: 425, price: 240000 },
];
