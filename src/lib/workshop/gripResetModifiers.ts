const RESET_MODIFIER_KEYS = [
  "LeftButton",
  "RightButton",
  "MiddleButton",
  "Button4",
  "Button5",
  "LeftAlt",
  "RightAlt",
  "Alt",
  "LeftControl",
  "RightControl",
  "Control",
  "LeftShift",
  "RightShift",
  "Shift",
  "AnyMod"
];

const RESET_MODIFIER_LABELS: Record<string, string> = {
  LeftButton: "Left Click",
  RightButton: "Right Click",
  MiddleButton: "Middle Click",
  Button4: "Mouse Btn 4",
  Button5: "Mouse Btn 5",
  LeftAlt: "Left Alt",
  RightAlt: "Right Alt",
  Alt: "Any Alt",
  LeftControl: "Left Control",
  RightControl: "Right Control",
  Control: "Any Control",
  LeftShift: "Left Shift",
  RightShift: "Right Shift",
  Shift: "Any Shift",
  AnyMod: "Any Modifier"
};

const RESET_MODIFIER_GROUPS = [
  { mods: ["LeftButton", "RightButton", "MiddleButton", "Button4", "Button5"] },
  { mods: ["LeftAlt", "RightAlt", "Alt"] },
  { mods: ["LeftControl", "RightControl", "Control"] },
  { mods: ["LeftShift", "RightShift", "Shift"] },
  { mods: ["AnyMod"] }
];

function normalizeResetModifiers(raw: unknown): Record<string, boolean> | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const normalized: Record<string, boolean> = {};
  for (const key of RESET_MODIFIER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      normalized[key] = Boolean(record[key]);
    }
  }

  return normalized;
}

function createEmptyResetModifiers() {
  return Object.fromEntries(RESET_MODIFIER_KEYS.map(key => [key, false]));
}

function exportResetModifiers(resetModifiers: unknown): Record<string, boolean> | undefined {
  const normalized = normalizeResetModifiers(resetModifiers);
  if (normalized === null) {
    return undefined;
  }
  return normalized;
}

export {
  RESET_MODIFIER_KEYS,
  RESET_MODIFIER_LABELS,
  RESET_MODIFIER_GROUPS,
  normalizeResetModifiers,
  createEmptyResetModifiers,
  exportResetModifiers
};
