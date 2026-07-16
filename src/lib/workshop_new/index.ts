// Public API for the LazyGRIP engine.
//
// Production (the Next.js site) should import everything from this barrel so the
// internal module layout can change without breaking downstream code. As more
// modules are converted from JS to TS, their types flow through here automatically.

// --- Serialization / format detection (TypeScript) ---
export {
  PREFIXES,
  FORMAT_ERRORS,
  cleanExportCode,
  detectExportFormat,
  getPrefixLength,
  inflateCompressedPayload,
  decodeCborExport,
  isExportFormat
} from "./serialization";

// --- Unified decode routing (TypeScript) ---
export { decodeExport } from "./exportDecode";

// --- GRIP Forge (!FRG1!) import (TypeScript) ---
export {
  FORGE_FORMAT_VERSION,
  decodeForgeExport,
  decodeForgeForInspect
} from "./forgeImport";

// --- Core decode / encode / build engine (TypeScript) ---
export { decodeEMSExport, CborReader, stepsFromActions } from "./emsDecoder";
export { decodeGSEExport, normalizeDecodedGSE } from "./gseDecoder";
export { decodeCvarProfileExport } from "./cvarProfileDecoder";
export { encodeCbor } from "./cborEncode";
export { encodeEMSExport, EMS_PREFIX, GRIP_PREFIX, GRIP_FORMAT_VERSION } from "./emsEncoder";
export { convertGSEExportToGRIP, convertDecodedGSEToGRIP } from "./gseToGrip";
export { buildGripFromModel } from "./gripBuilder";
export { importToBuilderModel } from "./gripImport";
export {
  readEnvelopeMeta,
  enrichExportMeta,
  enrichSequence,
  formatEpoch,
  buildSequenceTalentFields
} from "./gripEnvelope";
export {
  buildEnvelopeFields,
  buildCollectionExportMeta,
  enrichSequencePayload,
  LAZYGRIP_TARGET_ADDON_VERSION,
  EXPORT_SCHEMA_REV
} from "./gripExportEnrich";

// --- Shared helpers (TypeScript) ---
export {
  getSpellName,
  getSpellIdByName,
  getCatalogInfo,
  searchSpells,
  classIdToCatalogKey,
  translateSpellTokens,
  resolveSpellIdsInMacrotext,
  formatMacroForGripExport,
  tagMacrotextToSpellIds,
  formatMacroToBareSpellIds,
  isInventorySlotNumber
} from "./spellCatalog";
export {
  RESET_MODIFIER_KEYS,
  RESET_MODIFIER_LABELS,
  RESET_MODIFIER_GROUPS,
  normalizeResetModifiers,
  createEmptyResetModifiers,
  exportResetModifiers
} from "./gripResetModifiers";
export {
  CONTEXT_GROUPS,
  CONTEXT_LABELS,
  CONTEXT_KEYS,
  normalizeContextOverrides,
  exportContextOverrides,
  adjustContextOverridesAfterVersionDelete,
  summarizeContextOverrides
} from "./gripContextOverrides";
export {
  extractTalentStringFromText,
  findTalentStringInComments,
  isLikelyTalentString,
  stripTalentFromText,
  parseTalentImportHeader
} from "./talentExtract";
export {
  splitMacroLines,
  joinMacroLines,
  collectActionTexts,
  findCommonLinePrefix,
  findSharedLines,
  extractCommonKeyPress,
  extractKeyPressFromVersion,
  stripKeyPressLinesFromBlocks,
  mergeKeyPress
} from "./keyPressExtract";
export {
  createAuthorLockToken,
  verifyAuthorLockToken,
  enforceAuthorLock,
  attachAuthorLockToken
} from "./authorLock";

// --- Shared types ---
export type {
  ExportFormat,
  CvarOverride,
  DecodeEnvelope,
  ExportMetaInfo,
  DecodeMeta,
  DecodedSequence,
  DecodeResult,
  ForgeAttribution,
  ForgeCollection,
  ForgeEnvelope,
  BuilderExportMeta,
  BuilderActionNode,
  BuilderVersion,
  BuilderSequence,
  BuilderVariable,
  BuilderStandaloneMacro,
  BuilderModel,
  ImportResult,
  BuildResult,
  ConvertResult
} from "./types";
