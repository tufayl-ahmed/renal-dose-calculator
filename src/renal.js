const FEMALE_MULTIPLIER = 1.012;

export function calculateEgfrCkdEpi2021({ age, sex, creatinine }) {
  assertAdultInputs({ age, sex, creatinine });

  const isFemale = sex === "female";
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const ratio = creatinine / kappa;

  const egfr =
    142 *
    Math.pow(Math.min(ratio, 1), alpha) *
    Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, age) *
    (isFemale ? FEMALE_MULTIPLIER : 1);

  return roundTo(egfr, 1);
}

export function calculateCockcroftGault({ age, sex, creatinine, weight }) {
  assertAdultInputs({ age, sex, creatinine });
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error("Weight is required for Cockcroft-Gault creatinine clearance.");
  }

  const sexMultiplier = sex === "female" ? 0.85 : 1;
  const crcl = (((140 - age) * weight) / (72 * creatinine)) * sexMultiplier;

  return roundTo(crcl, 1);
}

export function calculateBmi({ weight, height }) {
  if (!Number.isFinite(weight) || !Number.isFinite(height) || weight <= 0 || height <= 0) {
    return null;
  }

  const meters = height / 100;
  return roundTo(weight / (meters * meters), 1);
}

export function calculateIdealBodyWeight({ sex, height }) {
  if ((sex !== "male" && sex !== "female") || !Number.isFinite(height) || height < 100) {
    return null;
  }

  const inches = height / 2.54;
  const inchesOverFiveFeet = Math.max(0, inches - 60);
  const baseWeight = sex === "female" ? 45.5 : 50;

  return roundTo(baseWeight + 2.3 * inchesOverFiveFeet, 1);
}

export function calculateAdjustedBodyWeight({ sex, weight, height }) {
  const idealBodyWeight = calculateIdealBodyWeight({ sex, height });
  if (!idealBodyWeight || !Number.isFinite(weight) || weight <= idealBodyWeight) {
    return null;
  }

  return roundTo(idealBodyWeight + 0.4 * (weight - idealBodyWeight), 1);
}

export function getCkdStage(egfr) {
  if (!Number.isFinite(egfr)) {
    return { stage: "Waiting", label: "Waiting for inputs", tone: "neutral" };
  }
  if (egfr >= 90) {
    return { stage: "G1", label: "Normal or high", tone: "good" };
  }
  if (egfr >= 60) {
    return { stage: "G2", label: "Mildly decreased", tone: "good" };
  }
  if (egfr >= 45) {
    return { stage: "G3a", label: "Mild-moderate decrease", tone: "caution" };
  }
  if (egfr >= 30) {
    return { stage: "G3b", label: "Moderate-severe decrease", tone: "caution" };
  }
  if (egfr >= 15) {
    return { stage: "G4", label: "Severely decreased", tone: "warning" };
  }
  return { stage: "G5", label: "Kidney failure range", tone: "danger" };
}

export function buildInterpretation({ age, egfr, crcl, weight, height, sex }) {
  const notes = [];
  const stage = getCkdStage(egfr);

  notes.push(`CKD G category by eGFR: ${stage.stage} (${stage.label}).`);
  notes.push(`For drug dosing, Cockcroft-Gault CrCl is often used: ${formatNumber(crcl)} mL/min.`);

  const bmi = calculateBmi({ weight, height });
  if (bmi) {
    notes.push(`BMI is ${bmi} kg/m²; consider whether actual, ideal, or adjusted body weight best fits local dosing policy.`);
  } else {
    notes.push("Height is optional, but adding it helps flag obesity/low body weight considerations for Cockcroft-Gault.");
  }

  if (age >= 75) {
    notes.push("Older adult: review frailty, acute kidney injury, and clinical trajectory before dose changes.");
  }

  if (sex === "female" && weight < 45) {
    notes.push("Low body weight may make actual-weight Cockcroft-Gault less stable for dosing decisions.");
  }

  return notes;
}

export function parseClinicalInput(formData) {
  const values = {
    age: toNumber(formData.get("age")),
    sex: String(formData.get("sex") || "").toLowerCase(),
    creatinine: toNumber(formData.get("creatinine")),
    weight: toNumber(formData.get("weight")),
    height: toOptionalNumber(formData.get("height")),
    drug: String(formData.get("drug") || "").trim(),
    route: String(formData.get("route") || "ALL").trim(),
    dialysis: String(formData.get("dialysis") || "none").trim(),
    indication: String(formData.get("indication") || "any").trim(),
    formulation: String(formData.get("formulation") || "any").trim(),
  };

  validateParsedInputs(values);
  return values;
}

export function validateParsedInputs(values) {
  if (!Number.isFinite(values.age) || values.age < 18 || values.age > 120) {
    throw new Error("This MVP supports adults only. Enter an age from 18 to 120 years.");
  }
  if (values.sex !== "male" && values.sex !== "female") {
    throw new Error("Select male or female for the CKD-EPI and Cockcroft-Gault equations.");
  }
  if (!Number.isFinite(values.creatinine) || values.creatinine < 0.1 || values.creatinine > 25) {
    throw new Error("Enter serum creatinine in mg/dL.");
  }
  if (!Number.isFinite(values.weight) || values.weight < 20 || values.weight > 300) {
    throw new Error("Enter weight in kg. Weight is required for Cockcroft-Gault.");
  }
  if (values.height !== null && (values.height < 100 || values.height > 230)) {
    throw new Error("Height is optional. If entered, use centimeters.");
  }
}

function assertAdultInputs({ age, sex, creatinine }) {
  if (!Number.isFinite(age) || age < 18) {
    throw new Error("Adult age is required.");
  }
  if (sex !== "male" && sex !== "female") {
    throw new Error("Sex must be male or female.");
  }
  if (!Number.isFinite(creatinine) || creatinine <= 0) {
    throw new Error("Serum creatinine must be greater than 0 mg/dL.");
  }
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function toOptionalNumber(value) {
  if (value === null || String(value).trim() === "") {
    return null;
  }
  return toNumber(value);
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "--";
}
