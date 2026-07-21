import { decodeCborExport } from "./serialization";
import type { DecodeResult } from "./types";

export function decodeCvarProfileExport(input: unknown): DecodeResult {
  const decoded = decodeCborExport(input, "GEMSCP1") as Record<string, any> | null;

  if (!decoded || typeof decoded !== "object" || decoded.format !== "GEMSCP1") {
    throw new Error("This is not a GRIP CVar profile export (expected format GEMSCP1).");
  }

  const overrides = decoded.overrides && typeof decoded.overrides === "object"
    ? decoded.overrides as Record<string, unknown>
    : {};

  const entries = Object.entries(overrides)
    .map(([cvar, value]) => ({
      cvar: String(cvar),
      value: value === null || value === undefined ? "" : String(value)
    }))
    .sort((left, right) => left.cvar.localeCompare(right.cvar));

  return {
    meta: {
      format: "GEMSCP1",
      label: String(decoded.label || "").trim() || "Imported profile",
      overrideCount: Number(decoded.overrideCount) || entries.length,
      author: String(decoded.author || "").trim(),
      addonVersion: String(decoded.addonVersion || "").trim(),
      exportedAt: Number(decoded.exportedAt) || null,
      envelope: {
        wowPatch: String(decoded.wowPatch || "").trim() || null,
        wowBuild: String(decoded.wowBuild || "").trim() || null,
        wowInterface: Number(decoded.wowInterface) || null
      }
    },
    overrides: entries,
    sequences: []
  };
}
