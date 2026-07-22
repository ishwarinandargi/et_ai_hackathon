const DAY_MS = 86_400_000;

function finite(name, value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

function rounded(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function signed(value) {
  const number = rounded(value);
  return `${number > 0 ? "+" : ""}${number}%`;
}

function parseISODate(name, value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${name} must be an ISO date (YYYY-MM-DD)`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${name} is not a valid date`);
  }
  return date;
}

export function checkNumericRange(paramName, specMin, specMax, poValue, unitOverride) {
  finite("specMin", specMin);
  finite("specMax", specMax);
  finite("poValue", poValue);
  if (typeof paramName !== "string" || !paramName.trim()) throw new TypeError("paramName is required");
  if (specMin > specMax) throw new RangeError("specMin cannot exceed specMax");

  const unit = unitOverride ?? (/mtbf|reliability|hours?/i.test(paramName) ? "h" : /power|capacity/i.test(paramName) ? "kW" : "");
  const withUnit = (value) => `${value.toLocaleString()}${unit ? ` ${unit}` : ""}`;
  const base = {
    id: "flag_001",
    param: paramName,
    spec: `${withUnit(specMin)}–${withUnit(specMax)}`,
    po: withUnit(poValue),
  };

  if (poValue >= specMin && poValue <= specMax) {
    return { ...base, status: "COMPLIANT", severity: "INFO", message: `${paramName} within spec (${withUnit(specMin)}–${withUnit(specMax)})` };
  }

  const undersized = poValue < specMin;
  const reference = undersized ? specMin : specMax;
  const delta = Math.abs(poValue - reference);
  const percent = rounded((delta / reference) * 100);
  return undersized
    ? { ...base, status: "NON_COMPLIANT", severity: "CRITICAL", message: `${paramName} undersized by ${withUnit(delta)} (${percent}%)`, delta: `-${withUnit(delta)} (-${percent}%)` }
    : { ...base, status: "CAUTION", severity: "INFO", message: `${paramName} oversized by ${withUnit(delta)} (${percent}%)`, delta: `+${withUnit(delta)} (+${percent}%)` };
}

export function checkVoltage(specVoltage, specPhase, specTolerance, poVoltage, poPhase) {
  finite("specVoltage", specVoltage);
  finite("specTolerance", specTolerance);
  finite("poVoltage", poVoltage);
  if (specVoltage <= 0 || specTolerance < 0) throw new RangeError("Voltage must be positive and tolerance cannot be negative");

  const lower = specVoltage * (1 - specTolerance);
  const upper = specVoltage * (1 + specTolerance);
  const base = {
    id: "flag_002",
    param: "Voltage & phase",
    spec: `${specVoltage} V ±${rounded(specTolerance * 100)}% · ${specPhase}`,
    po: `${poVoltage} V · ${poPhase}`,
  };
  if (poPhase !== specPhase) {
    return { ...base, status: "NON_COMPLIANT", severity: "CRITICAL", message: `Phase mismatch: spec ${specPhase}, PO ${poPhase}` };
  }

  const percent = ((poVoltage - specVoltage) / specVoltage) * 100;
  const delta = signed(percent);
  return poVoltage >= lower && poVoltage <= upper
    ? { ...base, status: "COMPLIANT", severity: "INFO", message: `Voltage within tolerance (${delta})`, delta }
    : { ...base, status: "NON_COMPLIANT", severity: "CRITICAL", message: `Voltage ${delta} outside tolerance (spec ±${rounded(specTolerance * 100)}%)`, delta };
}

export function checkBreakerRating(chargingCurrentA, dischargeCurrentA, poBreaker, safetyMargin = 1.25) {
  finite("chargingCurrentA", chargingCurrentA);
  finite("dischargeCurrentA", dischargeCurrentA);
  finite("poBreaker", poBreaker);
  finite("safetyMargin", safetyMargin);
  if ([chargingCurrentA, dischargeCurrentA, poBreaker].some((n) => n < 0) || safetyMargin <= 0) throw new RangeError("Current cannot be negative and safety margin must be positive");

  const required = rounded(((chargingCurrentA + dischargeCurrentA) * safetyMargin) / 2);
  const base = { id: "flag_003", param: "Input breaker rating", spec: `${required} A minimum`, po: `${poBreaker} A` };
  if (poBreaker < required) {
    const delta = rounded(required - poBreaker);
    const percent = rounded((delta / required) * 100);
    const nearMinimum = poBreaker >= required * 0.9;
    return {
      ...base,
      status: nearMinimum ? "CAUTION" : "NON_COMPLIANT",
      severity: nearMinimum ? "WARNING" : "CRITICAL",
      message: nearMinimum ? `Breaker is ${delta}A below minimum. Engineering deviation required.` : `Breaker undersized by ${delta}A. Fire hazard. Blocks certification.`,
      delta: `-${delta} A (-${percent}%)`,
      details: {
        required,
        provided: poBreaker,
        delta,
        reason: `Charging ${chargingCurrentA}A + discharge ${dischargeCurrentA}A + ${rounded((safetyMargin - 1) * 100)}% safety margin = ${required}A required per circuit`,
      },
    };
  }
  return { ...base, status: "COMPLIANT", severity: "INFO", message: `Breaker ${poBreaker}A meets spec (${required}A required)` };
}

export function checkDeliverySchedule(scheduledDeliveryDate, criticalPathDate, specBufferDays = 7) {
  finite("specBufferDays", specBufferDays);
  if (specBufferDays < 0) throw new RangeError("specBufferDays cannot be negative");
  const delivery = parseISODate("scheduledDeliveryDate", scheduledDeliveryDate);
  const critical = parseISODate("criticalPathDate", criticalPathDate);
  const days = Math.floor((critical - delivery) / DAY_MS);
  const base = {
    id: "flag_004",
    param: "Delivery schedule",
    spec: `${specBufferDays}-day buffer before critical path`,
    po: `${scheduledDeliveryDate} · ${days} day${Math.abs(days) === 1 ? "" : "s"} before ${criticalPathDate}`,
  };
  if (days < 0) {
    return { ...base, status: "NON_COMPLIANT", severity: "CRITICAL", message: `Delivery is ${Math.abs(days)} days LATE (past critical path)`, delta: `${days} days` };
  }
  if (days < specBufferDays) {
    const percent = specBufferDays === 0 ? 100 : Math.round((days / specBufferDays) * 100);
    return { ...base, status: "CAUTION", severity: "WARNING", message: `Delivery cuts buffer from ${specBufferDays} days to ${days} days (${percent}% of spec). Schedule risk.`, delta: `-${specBufferDays - days} days` };
  }
  return { ...base, status: "COMPLIANT", severity: "INFO", message: `${days} days buffer before critical path (spec requires ${specBufferDays})` };
}

export function checkMTBF(specMinMTBFHours, poMTBFHours) {
  finite("specMinMTBFHours", specMinMTBFHours);
  finite("poMTBFHours", poMTBFHours);
  if (specMinMTBFHours <= 0 || poMTBFHours < 0) throw new RangeError("MTBF spec must be positive and PO MTBF cannot be negative");

  const percent = rounded((poMTBFHours / specMinMTBFHours) * 100);
  const short = rounded(100 - percent);
  const base = {
    id: "flag_005",
    param: "MTBF reliability",
    spec: `${specMinMTBFHours.toLocaleString()} h minimum`,
    po: `${poMTBFHours.toLocaleString()} h`,
  };
  if (poMTBFHours >= specMinMTBFHours) {
    return { ...base, status: "COMPLIANT", severity: "INFO", message: `MTBF ${poMTBFHours.toLocaleString()}h meets spec (${percent}%)` };
  }
  return poMTBFHours >= specMinMTBFHours * 0.9
    ? { ...base, status: "CAUTION", severity: "WARNING", message: `MTBF ${poMTBFHours.toLocaleString()}h is ${short}% below spec. May fail Tier III audit.`, delta: `-${short}%` }
    : { ...base, status: "NON_COMPLIANT", severity: "CRITICAL", message: `MTBF ${poMTBFHours.toLocaleString()}h is ${short}% below spec. Audit failure risk.`, delta: `-${short}%` };
}

export function generateRFI(flag) {
  if (flag.status === "COMPLIANT") return null;
  const common = { priority: flag.severity === "CRITICAL" ? "HIGH" : "MEDIUM" };
  if (flag.id === "flag_003") return { ...common,
    question: `Can you supply protection rated at ${flag.details.required}A instead of ${flag.details.provided}A?`,
    rationale: "The quoted rating cannot safely support the design load and safety margin.",
    costImpact: "$0-5k; standard ratings are often no-charge", timeline: "Confirm with the current lead time",
    alternative: "Upgrade the upstream protection and cabling after an engineering review.",
  };
  if (flag.id === "flag_004") return { ...common,
    question: "Can you expedite delivery to restore the required project buffer?",
    rationale: "The reduced buffer leaves too little time for inspection, rework, and commissioning.",
    costImpact: "$500-2k typical expedite fee", timeline: "Request a committed date within 24 hours",
    alternative: "Resequence dependent testing while the equipment is in transit.",
  };
  if (flag.id === "flag_002") return { ...common,
    question: `Can you provide a configuration that matches ${flag.spec}?`,
    rationale: "The quoted electrical configuration is outside the approved design envelope.",
    costImpact: "Confirm configuration pricing", timeline: "Usually no schedule impact before manufacture",
    alternative: "Submit an engineered deviation for approval.",
  };
  if (flag.id === "flag_005") return { ...common,
    question: `Can you provide a model meeting ${flag.spec}?`,
    rationale: "The quoted reliability may not meet the availability target or audit requirement.",
    costImpact: "Model-dependent", timeline: "Confirm alternate model lead time",
    alternative: "Add redundancy with documented failure-domain separation.",
  };
  return { ...common, question: `Can you revise the offer to meet ${flag.spec}?`,
    rationale: `${flag.param} is outside the approved specification.`, costImpact: "Confirm with vendor",
    timeline: "Confirm before purchase approval", alternative: "Submit a documented technical deviation.",
  };
}

export function generateComplianceReport(specification, procurementOrder) {
  if (!specification || !procurementOrder || typeof specification !== "object" || typeof procurementOrder !== "object") {
    throw new TypeError("Specification and procurement order must be JSON objects");
  }
  const flags = [
    checkNumericRange(specification.capacityLabel || "Power capacity", specification.minCapacityKw, specification.maxCapacityKw, procurementOrder.capacityKw, specification.capacityUnit),
    checkVoltage(specification.voltageV, specification.voltagePhase, specification.voltageTolerance, procurementOrder.voltageV, procurementOrder.voltagePhase),
    checkBreakerRating(specification.chargingCurrentA, specification.dischargeCurrentA, procurementOrder.breakerRatingA),
    checkDeliverySchedule(procurementOrder.scheduledDelivery, procurementOrder.criticalDate, specification.deliveryBufferDays),
    checkMTBF(specification.minMTBFHours, procurementOrder.mtbfHours),
  ].map((flag) => ({ ...flag, rfi: generateRFI(flag) }));
  const compliant = flags.filter((flag) => flag.status === "COMPLIANT").length;
  const caution = flags.filter((flag) => flag.status === "CAUTION").length;
  const critical = flags.filter((flag) => flag.severity === "CRITICAL").length;
  const warnings = flags.filter((flag) => flag.severity === "WARNING").length;
  return {
    status: critical ? "NON_COMPLIANT" : warnings ? "CAUTION" : "COMPLIANT",
    score: Math.round(((compliant + 0.5 * caution) / flags.length) * 100),
    flags,
    summary: { total: flags.length, compliant, caution, nonCompliant: flags.length - compliant - caution, critical, warnings },
    equipment: {
      specName: specification.equipment,
      specStandard: specification.standard,
      poVendor: procurementOrder.vendor,
      poModel: procurementOrder.model,
      poNumber: procurementOrder.poNumber,
      price: procurementOrder.price,
    },
    timestamp: new Date().toISOString(),
  };
}
