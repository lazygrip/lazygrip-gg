// Core engine types shared across the GRIP-EMS serialization/import/export modules.
//
// These are intentionally permissive during the JS -> TS migration: several
// upstream modules (emsDecoder, gseDecoder, gripImport, gripBuilder) are still
// plain JavaScript and produce loosely-shaped objects. As those modules are
// converted, tighten the index signatures here into concrete fields.

// GRIP-EMS export prefixes, matching Serialization.DetectFormat in the addon.
export type ExportFormat =
  | "EMS1"
  | "GSE3_ENCRYPTED"
  | "GSE3"
  | "GRIP1"
  | "FRG1"
  | "GEMSCP1";

// A single CVar override entry from a !GEMSCP1! profile export.
export interface CvarOverride {
  cvar: string;
  value: string;
}

// Envelope metadata attached to a decoded export for the inspect/decode view.
export interface DecodeEnvelope {
  exportedAt?: number | null;
  wowPatch?: string | null;
  wowBuild?: string | null;
  wowInterface?: number | null;
  addonVersion?: string | null;
  [key: string]: unknown;
}

// Author/description metadata surfaced alongside a decoded export.
export interface ExportMetaInfo {
  author?: string;
  description?: string;
  talentString?: string | null;
  url?: string;
  [key: string]: unknown;
}

// Metadata block on a decode result. `format` echoes the detected prefix.
export interface DecodeMeta {
  format?: string;
  label?: string;
  overrideCount?: number;
  specId?: number | null;
  envelope?: DecodeEnvelope;
  exportMeta?: ExportMetaInfo;
  forge?: ForgeAttribution;
  [key: string]: unknown;
}

// A decoded sequence. Shape mirrors what emsDecoder/gseDecoder emit.
export interface DecodedSequence {
  name?: string;
  classId?: number | null;
  specId?: number | null;
  class?: string;
  versions?: unknown[];
  [key: string]: unknown;
}

// Unified decode result returned by decodeExport for every supported format.
export interface DecodeResult {
  meta: DecodeMeta;
  sequences: DecodedSequence[];
  overrides?: CvarOverride[];
  [key: string]: unknown;
}

// Attribution block carried inside a GRIP Forge (!FRG1!) envelope.
export interface ForgeAttribution {
  author: string;
  notes?: string;
  talentString?: string;
  talentBuild?: string;
  tool?: string;
  toolVersion?: string;
  exportedAt?: number | null;
  specID?: number;
  specId?: number;
  [key: string]: unknown;
}

// The inner COLLECTION payload wrapped by a Forge envelope (GSE-format sequences).
export interface ForgeCollection {
  type: "COLLECTION";
  [key: string]: unknown;
}

// Result of validating/unwrapping a Forge envelope.
export interface ForgeEnvelope {
  forge: ForgeAttribution;
  collection: ForgeCollection;
}

// --- Builder / import / export API shapes (Tier 2) ---

export interface BuilderExportMeta {
  collectionName?: string;
  author?: string;
  originalAuthor?: string;
  originalAuthorRealm?: string;
  authorLocked?: boolean;
  lockedAuthor?: string;
  authorLockTokens?: Record<string, string>;
  description?: string;
  wowPatch?: string;
  talentString?: string;
  url?: string;
  privacyMode?: string;
  exporterName?: string;
  exporterRealm?: string;
  pseudonym?: string;
  region?: string;
  [key: string]: unknown;
}

export interface BuilderActionNode {
  id: string;
  type: string;
  macro?: string;
  disabled?: boolean;
  stepFunction?: string;
  repeat?: number;
  variable?: string;
  sequence?: string;
  embedSequenceId?: string;
  ms?: number | string;
  gcd?: number | string;
  clicks?: number;
  children?: BuilderActionNode[];
  then?: BuilderActionNode[];
  else?: BuilderActionNode[];
  [key: string]: unknown;
}

export interface BuilderVersion {
  id: string;
  name: string;
  stepFunction: string;
  keyPress?: string;
  keyRelease?: string;
  resetOnCombat?: boolean;
  resetOnTarget?: boolean;
  resetOnGear?: boolean;
  resetOnSpec?: boolean;
  resetTimer?: number;
  repeatCount?: number;
  resetModifiers?: Record<string, boolean> | null;
  actions: BuilderActionNode[];
  [key: string]: unknown;
}

export interface BuilderSequence {
  id: string;
  name: string;
  description?: string;
  help?: string;
  comments?: string;
  changelog?: string;
  talentString?: string;
  talentBuild?: string;
  url?: string;
  contentTypes?: string[];
  contextOverrides?: Record<string, number>;
  classId?: number;
  specId?: number | null;
  defaultVersion?: number;
  versions: BuilderVersion[];
  [key: string]: unknown;
}

export interface BuilderVariable {
  id: string;
  name: string;
  functionBody?: string;
  events?: string | string[];
  [key: string]: unknown;
}

export interface BuilderStandaloneMacro {
  id: string;
  name: string;
  body?: string;
  [key: string]: unknown;
}

/** Input to buildGripFromModel / POST /api/workshop/build */
export interface BuilderModel {
  exportMeta?: BuilderExportMeta;
  variables?: BuilderVariable[];
  standaloneMacros?: BuilderStandaloneMacro[];
  sequences: BuilderSequence[];
  [key: string]: unknown;
}

/** Result of importToBuilderModel / POST /api/workshop/import */
export interface ImportResult {
  model: BuilderModel;
  warnings: string[];
  type?: string | null;
  envelope?: DecodeEnvelope | null;
  exportMeta?: ExportMetaInfo | null;
  forge?: ForgeAttribution;
  [key: string]: unknown;
}

/** Result of buildGripFromModel / POST /api/workshop/build */
export interface BuildResult {
  export: string;
  format: string;
  version: number;
  type: "COLLECTION" | "SEQUENCE";
  sequenceCount: number;
  sequenceNames: string[];
  warnings: string[];
}

/** Result of convertGSEExportToGRIP / POST /api/workshop/convert */
export interface ConvertResult extends BuildResult {}

// --- Client-only builder types (React builder UI) ---
//
// These extend the engine-facing shapes above with the extra fields the
// interactive builder tracks per-session (stable ids, collapse state,
// spell-id display mode, weave intervals). They are stripped back down to the
// engine shapes by lib/builder/serialize.ts before hitting the API.

export interface BuilderClientActionNode extends BuilderActionNode {
  id: string;
  type: string;
  name?: string;
  label?: string;
  collapsed?: boolean;
  /** Interleave/weave interval (2-50). Absent when disabled. */
  interval?: number;
  children?: BuilderClientActionNode[];
  then?: BuilderClientActionNode[];
  else?: BuilderClientActionNode[];
}

export interface BuilderClientVersion extends BuilderVersion {
  id: string;
  /** Whether spell text is currently displayed as numeric IDs. */
  useSpellIds?: boolean;
  actions: BuilderClientActionNode[];
}

export interface BuilderClientVariable {
  id: string;
  name: string;
  description?: string;
  type: "text" | "function";
  value?: string;
  function?: string;
  events?: string;
  [key: string]: unknown;
}

export interface BuilderClientStandaloneMacro {
  id: string;
  name: string;
  macro: string;
  category: "a" | "p";
  [key: string]: unknown;
}

export interface BuilderClientSequence extends BuilderSequence {
  id: string;
  versions: BuilderClientVersion[];
}

export interface BuilderClientModel extends BuilderModel {
  exportMeta: BuilderExportMeta;
  variables: BuilderClientVariable[];
  standaloneMacros: BuilderClientStandaloneMacro[];
  sequences: BuilderClientSequence[];
}
