import { decodeCborExport } from "./serialization";
import { normalizeDecodedGSE } from "./gseDecoder";
import type { DecodeResult, ForgeAttribution, ForgeCollection, ForgeEnvelope } from "./types";

export const FORGE_FORMAT_VERSION = 1;

// Decode a GRIP Forge export (!FRG1!). The envelope wraps a COLLECTION payload
// (GSE-format sequences) with a forge attribution block:
//   { type: "FORGE_EXPORT", formatVersion, forge: { author, ... },
//     payload: { type: "COLLECTION", payload: { Sequences } } }
// Mirrors GRIP-EMS Serialization.Decode + LegacyImport.ValidateForgeEnvelope.
export function decodeForgeExport(input: unknown): ForgeEnvelope {
  const decoded = decodeCborExport(input, "FRG1") as Record<string, any> | null;

  if (!decoded || typeof decoded !== "object" || decoded.type !== "FORGE_EXPORT") {
    throw new Error("This is not a GRIP Forge export (missing FORGE_EXPORT envelope).");
  }

  const formatVersion = Number(decoded.formatVersion) || 0;
  if (formatVersion > FORGE_FORMAT_VERSION) {
    throw new Error(
      `Forge export format v${decoded.formatVersion} is newer than this tool supports.`
    );
  }

  const forge = decoded.forge as ForgeAttribution | undefined;
  if (!forge || typeof forge !== "object" || !String(forge.author || "").trim()) {
    throw new Error("Forge export is missing required attribution (forge.author).");
  }

  const collection = decoded.payload as ForgeCollection | undefined;
  if (!collection || typeof collection !== "object" || collection.type !== "COLLECTION") {
    throw new Error("Forge export payload is not a COLLECTION.");
  }

  return { forge, collection };
}

// Decode a Forge export for the inspect/decode UI (inner sequences as GSE shape).
export function decodeForgeForInspect(input: unknown): DecodeResult {
  const { forge, collection } = decodeForgeExport(input);
  const decoded = normalizeDecodedGSE(collection);

  return {
    ...decoded,
    meta: {
      ...decoded.meta,
      format: "FRG1",
      forge,
      exportMeta: {
        ...(decoded.meta?.exportMeta || {}),
        author: String(forge.author || "").trim(),
        description: String(forge.notes || "").trim(),
        talentString: String(forge.talentString || "").trim() || null,
        url: ""
      },
      envelope: {
        exportedAt: forge.exportedAt || null,
        wowPatch: null,
        wowBuild: null,
        addonVersion: String(forge.toolVersion || forge.tool || "").trim() || null
      },
      specId: Number(forge.specID || forge.specId) || decoded.meta?.specId || null
    }
  };
}
