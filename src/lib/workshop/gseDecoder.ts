import zlib from "node:zlib";
import { CborReader } from "./emsDecoder";
import { encodeCbor } from "./cborEncode";
import { detectExportFormat, FORMAT_ERRORS } from "./serialization";
import type { DecodeResult } from "./types";
import { translateSpellTokens } from "./spellCatalog";

type LooseRecord = Record<string, any>;

const EXPORT_PREFIX = /^!GSE3!/i;
const BLOCK_TYPES = new Set(["Action", "Loop", "Repeat", "Pause", "If", "Embed"]);

const CLASS_BY_ID: Record<number, string> = {
  1: "Warrior",
  2: "Paladin",
  3: "Hunter",
  4: "Rogue",
  5: "Priest",
  6: "Death Knight",
  7: "Shaman",
  8: "Mage",
  9: "Warlock",
  10: "Monk",
  11: "Druid",
  12: "Demon Hunter",
  13: "Evoker"
};

const SPEC_BY_ID: Record<number, { name: string; classId: number }> = {
  62: { name: "Arcane", classId: 8 },
  63: { name: "Fire", classId: 8 },
  64: { name: "Frost", classId: 8 },
  65: { name: "Holy", classId: 2 },
  66: { name: "Protection", classId: 2 },
  70: { name: "Retribution", classId: 2 },
  71: { name: "Arms", classId: 1 },
  72: { name: "Fury", classId: 1 },
  73: { name: "Protection", classId: 1 },
  102: { name: "Balance", classId: 11 },
  103: { name: "Feral", classId: 11 },
  104: { name: "Guardian", classId: 11 },
  105: { name: "Restoration", classId: 11 },
  250: { name: "Blood", classId: 6 },
  251: { name: "Frost", classId: 6 },
  252: { name: "Unholy", classId: 6 },
  253: { name: "Beast Mastery", classId: 3 },
  254: { name: "Marksmanship", classId: 3 },
  255: { name: "Survival", classId: 3 },
  256: { name: "Discipline", classId: 5 },
  257: { name: "Holy", classId: 5 },
  258: { name: "Shadow", classId: 5 },
  259: { name: "Assassination", classId: 4 },
  260: { name: "Outlaw", classId: 4 },
  261: { name: "Subtlety", classId: 4 },
  262: { name: "Elemental", classId: 7 },
  263: { name: "Enhancement", classId: 7 },
  264: { name: "Restoration", classId: 7 },
  265: { name: "Affliction", classId: 9 },
  266: { name: "Demonology", classId: 9 },
  267: { name: "Destruction", classId: 9 },
  268: { name: "Brewmaster", classId: 10 },
  269: { name: "Windwalker", classId: 10 },
  270: { name: "Mistweaver", classId: 10 },
  577: { name: "Havoc", classId: 12 },
  581: { name: "Vengeance", classId: 12 },
  1480: { name: "Devourer", classId: 12 },
  1467: { name: "Devastation", classId: 13 },
  1468: { name: "Preservation", classId: 13 },
  1473: { name: "Augmentation", classId: 13 }
};

function decodeGSEExport(input: unknown): DecodeResult {
  const cleaned = String(input || "").trim().replace(/\s+/g, "");

  if (!cleaned) {
    throw new Error("Paste a GSE export code first.");
  }

  const format = detectExportFormat(cleaned);
  if (format === "GSE3_ENCRYPTED") {
    throw new Error(FORMAT_ERRORS.GSE3_ENCRYPTED);
  }

  if (format !== "GSE3") {
    throw new Error("Expected an export code beginning with !GSE3!.");
  }

  const payload = cleaned.replace(EXPORT_PREFIX, "");
  const compressed = Buffer.from(payload, "base64");

  if (!compressed.length) {
    throw new Error("The export payload is empty or not valid Base64.");
  }

  let inflated;
  try {
    inflated = decompressGSEPayload(compressed);
  } catch (error) {
    throw new Error("The export payload could not be inflated as GSE3 data.");
  }

  let decoded;
  try {
    decoded = unwrapCborValue(new CborReader(inflated).decode());
  } catch (error) {
    throw new Error("The export payload is not valid GSE3 CBOR data.");
  }

  return normalizeDecodedGSE(decoded);
}

// Normalize an already-decoded GSE CBOR object (map/array/collection container)
// into the { meta, sequences } result shape. Shared by decodeGSEExport and the
// GRIP Forge (!FRG1!) import path, whose envelope wraps a GSE collection.
function normalizeDecodedGSE(decodedInput: unknown): DecodeResult {
  const decoded = unwrapCborValue(decodedInput);
  const sequences = normalizeImportPayload(decoded);
  const exportProfile = readSequenceProfile(sequences[0]) as Record<string, any>;

  for (const sequence of sequences) {
    if (!sequence.class && exportProfile.class) {
      sequence.class = exportProfile.class;
      sequence.classId = exportProfile.classId;
    }
    if (!sequence.spec && exportProfile.spec) {
      sequence.spec = exportProfile.spec;
      sequence.specId = exportProfile.specId;
    }
  }

  const primary = (sequences[0] || {}) as Record<string, any>;
  const metaData = primary.metaData || {};
  const rootType = typeof decoded === "object" && decoded && !Array.isArray(decoded)
    ? (decoded as LooseRecord).type || (decoded as LooseRecord).Type
    : null;

  return {
    meta: {
      format: "GSE3",
      type: rootType || (sequences.length > 1 ? "COLLECTION" : "SEQUENCE"),
      class: exportProfile.class || primary.class || "",
      classId: exportProfile.classId || primary.classId || null,
      spec: exportProfile.spec || primary.spec || "",
      specId: exportProfile.specId || primary.specId || null,
      profileSource: exportProfile.profileSource || null,
      exportMeta: {
        author: metaData.Author || metaData.author || "",
        description: metaData.Help || metaData.help || "",
        collectionName: "",
        url: ""
      }
    },
    sequences
  };
}

function normalizeImportPayload(decoded: unknown): LooseRecord[] {
  const entries = collectSequenceEntries(unwrapCollectionContainer(unwrapCborValue(decoded)));

  if (!entries.length) {
    throw new Error("The GSE export did not contain a recognizable sequence.");
  }

  return entries.map((entry: LooseRecord, index: number) => normalizeSequence(entry.name || `Sequence ${index + 1}`, entry.value));
}

function unwrapCollectionContainer(root: unknown): unknown {
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    return root;
  }

  const record = normalizeRecord(root);
  const nested = record.payload || record.Payload;
  if (nested && typeof nested === "object") {
    return nested;
  }

  return root;
}

function collectSequenceEntries(container: unknown): Array<{ name: string; value: unknown }> {
  if (Array.isArray(container)) {
    if (container.length >= 2 && typeof container[1] === "object" && container[1] !== null) {
      return [{
        name: typeof container[0] === "string" ? container[0] : "Sequence",
        value: container[1]
      }];
    }

    return container
      .filter((item: unknown) => item && typeof item === "object")
      .map((item: LooseRecord, index: number) => ({
        name: normalizeRecord(item).MetaData?.Name || normalizeRecord(item).metaData?.name || `Sequence ${index + 1}`,
        value: item
      }));
  }

  if (!container || typeof container !== "object") {
    return [];
  }

  const record = normalizeRecord(container);
  const sequenceMap = record.Sequences || record.sequences;
  if (sequenceMap && typeof sequenceMap === "object") {
    return Object.entries(sequenceMap)
      .filter(([, value]) => value && typeof value === "object")
      .map(([name, value]) => ({ name, value }));
  }

  if (record.MetaData || record.metaData || record.Versions || record.Macros || record.Actions || record.actions) {
    return [{
      name: record.MetaData?.Name || record.metaData?.name || "Sequence",
      value: record
    }];
  }

  return Object.entries(record)
    .filter(([, value]) => value && typeof value === "object")
    .filter(([, value]) => {
      const sequence = normalizeRecord(value);
      return sequence.MetaData || sequence.metaData || sequence.Versions || sequence.Macros || sequence.Actions || sequence.actions;
    })
    .map(([name, value]) => ({ name, value }));
}

function normalizeSequence(name: string, sequence: unknown): LooseRecord {
  const record = normalizeRecord(sequence);
  const metaData = normalizeRecord(record.MetaData || record.metaData || {});
  const profile = readClassInfo(metaData);
  const versions = normalizeVersions(record);
  const defaultVersion = readDefaultVersion(record, versions.length);

  if (!versions.length) {
    throw new Error("The GSE export did not contain any macro blocks.");
  }

  return {
    name: metaData.Name || metaData.name || name,
    description: metaData.Help || metaData.help || "",
    class: profile.class,
    classId: profile.classId,
    spec: profile.spec,
    specId: profile.specId,
    defaultVersion,
    metaData,
    versions,
    steps: versions[defaultVersion - 1]?.steps || versions[0]?.steps || []
  };
}

function normalizeVersions(sequence: unknown): LooseRecord[] {
  const record = normalizeRecord(sequence);
  const versionEntries = record.Versions || record.Macros || record.versions || record.macros;

  let versions: LooseRecord[] = [];
  if (versionEntries) {
    versions = Array.isArray(versionEntries)
      ? versionEntries.map((version: unknown, index: number) => normalizeVersion(version, index + 1))
      : Object.entries(versionEntries)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([, version], index) => normalizeVersion(version, index + 1));
  } else if (record.Actions || record.actions) {
    versions = [normalizeVersion(record, 1)];
  }

  versions = versions.filter((version: LooseRecord) => version.blocks.length > 0);
  return versions;
}

function normalizeVersion(version: unknown, index: number): LooseRecord {
  const record = normalizeRecord(version);
  const actions = record.Actions || record.actions || record;
  const blocks = normalizeBlocks(actions);
  const flatSteps = flattenBlocks(blocks);

  return {
    index,
    name: record.Label || record.label || record.Name || record.name || `Version ${index}`,
    stepFunction: record.StepFunction || record.stepFunction || "",
    keyPress: String(record.KeyPress || record.keyPress || "").trim(),
    keyRelease: String(record.KeyRelease || record.keyRelease || "").trim(),
    blocks,
    steps: flatSteps.map((step: LooseRecord, stepIndex: number) => ({
      number: stepIndex + 1,
      text: step.text,
      kind: step.kind,
      label: step.label,
      depth: step.depth,
      chars: step.text.length,
      limit: 255,
      preMarkers: step.label ? [step.label] : [],
      postMarkers: []
    }))
  };
}

function normalizeBlocks(container: unknown, depth: number = 0): LooseRecord[] {
  return getChildEntries(container).flatMap((entry: LooseRecord, index: number) => {
    if (typeof entry.value === "string") {
      const text = translateSpellTokens(entry.value.trim());
      if (!text) {
        return [];
      }
      return [{
        index: index + 1,
        kind: "Action",
        depth,
        label: "Action",
        text,
        children: []
      }];
    }

    return [normalizeBlock(entry.value, index + 1, depth)];
  });
}

function normalizeBlock(block: unknown, index: number, depth: number): LooseRecord {
  if (typeof block === "string") {
    return {
      index,
      kind: "Action",
      depth,
      label: "Action",
      text: translateSpellTokens(block.trim()),
      children: []
    };
  }

  const record = normalizeRecord(block);
  const kind = resolveBlockKind(record);

  if (kind === "Loop" || kind === "If") {
    const children = normalizeBlocks(extractNestedContainer(record), depth + 1);
    return {
      index,
      kind,
      depth,
      label: buildBlockLabel(kind, record),
      stepFunction: record.StepFunction || record.stepFunction || "Sequential",
      repeat: readNumber(record.Repeat || record.repeat),
      variable: record.Variable || record.variable || "",
      children,
      text: ""
    };
  }

  if (kind === "Repeat") {
    const text = translateSpellTokens(extractBlockText(record));
    return {
      index,
      kind,
      depth,
      label: buildBlockLabel(kind, record),
      interval: readNumber(record.Interval || record.interval),
      text,
      children: []
    };
  }

  if (kind === "Pause") {
    return {
      index,
      kind,
      depth,
      label: buildBlockLabel(kind, record),
      ms: record.MS || record.ms || "",
      clicks: readNumber(record.Clicks || record.clicks),
      text: "",
      children: []
    };
  }

  if (kind === "Embed") {
    return {
      index,
      kind,
      depth,
      label: buildBlockLabel(kind, record),
      sequence: record.Sequence || record.sequence || "",
      text: "",
      children: []
    };
  }

  const text = translateSpellTokens(extractBlockText(record));
  return {
    index,
    kind: "Action",
    depth,
    label: "Action",
    text,
    children: []
  };
}

function flattenBlocks(blocks: any[], output: any[] = []): any[] {
  for (const block of blocks) {
    output.push(block);
    if (block.children?.length) {
      flattenBlocks(block.children, output);
    }
  }
  return output;
}

function extractBlockText(block: LooseRecord): string {
  if (block.macro) {
    return String(block.macro);
  }

  if (block.spell) {
    const unit = block.unit ? `@${block.unit} ` : "";
    const spell = translateSpellTokens(String(block.spell));
    return `/cast ${unit}${spell}`.trim();
  }

  if (block.item) {
    return `/use ${block.item}`;
  }

  const stackLines = getChildEntries(block)
    .map((entry: { key: string; value: unknown }) => entry.value)
    .filter((value: unknown): value is string => typeof value === "string" && Boolean(value.trim()))
    .map((value: string) => value.trim());

  if (stackLines.length) {
    return stackLines.join("\n");
  }

  const inlineValues = Object.entries(block)
    .filter(([key, value]) => !/^(type|Type|Interval|Repeat|StepFunction|Variable|Sequence|MS|Clicks|Disabled)$/i.test(key))
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([, value]) => (value as string).trim());

  return inlineValues.join("\n");
}

function buildBlockLabel(kind: string, block: LooseRecord): string {
  if (kind === "Loop") {
    const parts = ["Loop"];
    const stepFunction = block.StepFunction || block.stepFunction;
    const repeat = block.Repeat || block.repeat;
    if (stepFunction) {
      parts.push(stepFunction);
    }
    if (repeat !== undefined && repeat !== null && repeat !== "") {
      parts.push(`×${repeat}`);
    }
    return parts.join(" · ");
  }

  if (kind === "Repeat") {
    const interval = block.Interval || block.interval;
    return interval ? `Repeat · every ${interval}` : "Repeat";
  }

  if (kind === "Pause") {
    if (block.MS !== undefined && block.MS !== null && block.MS !== "") {
      return String(block.MS) === "GCD" ? "Pause · GCD" : `Pause · ${block.MS}ms`;
    }
    if (block.Clicks || block.clicks) {
      return `Pause · ${block.Clicks || block.clicks} clicks`;
    }
    return "Pause";
  }

  if (kind === "If") {
    const variable = block.Variable || block.variable;
    return variable ? `If · ${variable}` : "If";
  }

  if (kind === "Embed") {
    const sequence = block.Sequence || block.sequence;
    return sequence ? `Embed · ${sequence}` : "Embed";
  }

  return kind;
}

function getChildEntries(container: unknown): Array<{ key: string; value: unknown }> {
  if (Array.isArray(container)) {
    return container
      .filter((value: unknown) => value !== undefined && value !== null)
      .map((value: unknown, index: number) => ({ key: String(index + 1), value }));
  }

  if (!container || typeof container !== "object") {
    return [];
  }

  return Object.entries(container)
    .filter(([key]) => /^\d+$/.test(key))
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([key, value]) => ({ key, value }));
}

function extractNestedContainer(record: LooseRecord): unknown {
  if (Array.isArray(record)) {
    return record;
  }

  const nestedKeys = new Set([
    "Actions", "actions", "Type", "type", "Repeat", "repeat", "StepFunction", "stepFunction",
    "Interval", "interval", "Variable", "variable", "Sequence", "sequence", "MS", "ms",
    "Clicks", "clicks", "Disabled", "disabled", "Name", "name"
  ]);

  const entries = Object.entries(record).filter(([key]) => /^\d+$/.test(key) || !nestedKeys.has(key));
  if (!entries.length) {
    return record;
  }

  return Object.fromEntries(entries);
}

function resolveBlockKind(record: LooseRecord): string {
  const blockType = String(record.Type || record.type || "Action");
  const match = [...BLOCK_TYPES].find(type => type.toLowerCase() === blockType.toLowerCase());
  if (match) {
    return match;
  }

  if (record.Interval || record.interval) {
    return "Repeat";
  }

  if (record.Repeat !== undefined || record.repeat !== undefined || record.StepFunction || record.stepFunction) {
    return "Loop";
  }

  if (record.Variable || record.variable) {
    return "If";
  }

  if (record.Sequence || record.sequence) {
    return "Embed";
  }

  if (record.MS !== undefined || record.ms !== undefined || record.Clicks || record.clicks) {
    return "Pause";
  }

  return "Action";
}

function decompressGSEPayload(compressed: Buffer): Buffer {
  const attempts = [
    () => zlib.inflateRawSync(compressed),
    () => zlib.inflateSync(compressed),
    () => zlib.unzipSync(compressed)
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      return attempt();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function unwrapCborValue(value: unknown, depth: number = 0): unknown {
  if (depth > 8) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => unwrapCborValue(item, depth + 1));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (Object.prototype.hasOwnProperty.call(value, "tag") && Object.prototype.hasOwnProperty.call(value, "value")) {
    const keys = Object.keys(value);
    if (keys.length <= 2 || (keys.length === 3 && keys.includes("tag") && keys.includes("value"))) {
      return unwrapCborValue((value as LooseRecord).value, depth + 1);
    }
  }

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = unwrapCborValue(child, depth + 1);
  }
  return result;
}

function readSequenceProfile(sequence: LooseRecord | undefined): LooseRecord {
  if (!sequence) {
    return {};
  }

  return {
    ...readClassInfo(sequence.metaData || {}),
    profileSource: sequence.metaData ? "exportMeta" : null
  };
}

function readClassInfo(record: unknown): LooseRecord {
  const source = normalizeRecord(record);
  const classId = readNumber(
    source.ClassID,
    source.classID,
    source.ClassId,
    source.classId
  );
  const specId = readNumber(
    source.SpecID,
    source.specID,
    source.SpecId,
    source.specId
  );
  const specInfo = specId ? SPEC_BY_ID[specId] : null;
  const resolvedClassId = classId || (specInfo ? specInfo.classId : null);

  return {
    class: source.Class || source.class || (resolvedClassId != null ? CLASS_BY_ID[resolvedClassId] : "") || "",
    classId: resolvedClassId || null,
    spec: source.Spec || source.spec || (specInfo ? specInfo.name : ""),
    specId: specId || null
  };
}

function readDefaultVersion(sequence: unknown, versionCount: number): number {
  const record = normalizeRecord(sequence);
  const metaData = normalizeRecord(record.MetaData || record.metaData || {});
  const value = readNumber(
    record.DefaultVersion,
    record.defaultVersion,
    metaData.Default,
    metaData.default
  );
  if (!value || value < 1 || value > versionCount) {
    return 1;
  }
  return value;
}

function readNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeRecord(value: unknown): LooseRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as LooseRecord;
}

function encodeGSEExport(payload: unknown): string {
  const encoded = Buffer.from(encodeCbor(payload as Parameters<typeof encodeCbor>[0]));
  const compressed = zlib.deflateRawSync(encoded);
  return `!GSE3!${compressed.toString("base64")}`;
}

export {
  decodeGSEExport,
  normalizeDecodedGSE,
  encodeGSEExport,
  normalizeBlocks
};
