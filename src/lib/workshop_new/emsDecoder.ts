import zlib from "node:zlib";
import type { DecodeResult } from "./types";
import { translateSpellTokens } from "./spellCatalog";
import { normalizeResetModifiers } from "./gripResetModifiers";
import { findTalentStringInComments, stripTalentFromText, parseTalentImportHeader } from "./talentExtract";
import {
  readEnvelopeMeta,
  enrichExportMeta,
  enrichSequence,
  formatEpoch
} from "./gripEnvelope";

type LooseRecord = Record<string, any>;

const EXPORT_PREFIX = /^!(EMS1|GRIP1)!/i;
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

function decodeEMSExport(input: unknown): DecodeResult {
  const cleaned = String(input || "").trim().replace(/\s+/g, "");

  if (!cleaned) {
    throw new Error("Paste a GRIP EMS export code first.");
  }

  if (!EXPORT_PREFIX.test(cleaned)) {
    throw new Error("Expected an export code beginning with !EMS1! or !GRIP1!.");
  }

  const payload = cleaned.replace(EXPORT_PREFIX, "");
  const compressed = Buffer.from(payload, "base64");

  if (!compressed.length) {
    throw new Error("The export payload is empty or not valid Base64.");
  }

  let inflated;
  try {
    inflated = zlib.inflateRawSync(compressed);
  } catch (error) {
    throw new Error("The export payload could not be inflated as GRIP EMS data.");
  }

  const decoded = new CborReader(inflated).decode() as Record<string, any>;
  const envelope = readEnvelopeMeta(decoded);
  const sequences = normalizeSequences(decoded);
  const exportMeta = resolveExportMeta(decoded.exportMeta || decoded.ExportMeta, sequences, envelope);
  const exportProfile = readExportProfile(decoded, sequences, exportMeta);

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

  if (exportMeta?.talentSource === "description" && exportMeta.talentString) {
    if (exportMeta.description) {
      exportMeta.description = stripTalentFromText(exportMeta.description, exportMeta.talentString);
    }
    for (const sequence of sequences) {
      if (sequence.description) {
        sequence.description = stripTalentFromText(sequence.description, exportMeta.talentString);
      }
    }
  }

  return {
    meta: {
      format: decoded.format || "Unknown",
      version: decoded.version || null,
      type: decoded.type || null,
      locale: decoded.locale || null,
      checksum: decoded.checksum || null,
      exportMeta: exportMeta ?? undefined,
      envelope,
      exportedAtLabel: formatEpoch(envelope.exportedAt),
      ...exportProfile
    },
    sequences
  };
}

function resolveExportMeta(exportMeta: unknown, sequences: LooseRecord[], envelope: LooseRecord = {}): LooseRecord | null {
  const meta = normalizeRecord(exportMeta);
  const enriched = enrichExportMeta(meta, {}) as Record<string, any>;
  let talentString = String(enriched.talentString || "").trim() || null;
  let talentSource = talentString ? "exportMeta" : null;

  if (!talentString) {
    talentString = findTalentStringInComments(meta, sequences);
    if (talentString) {
      talentSource = "description";
    }
  }

  const hasContent = Object.keys(meta).length > 0
    || talentString
    || enriched.counts
    || enriched.classIDs.length
    || enriched.specIDs.length;

  if (!hasContent) {
    return null;
  }

  return {
    collectionName: enriched.collectionName,
    author: enriched.author || (envelope as Record<string, any>).exportedBy?.name || "",
    description: enriched.description,
    url: enriched.url,
    talentString: talentString || null,
    talentSource,
    createdAt: enriched.createdAt,
    createdAtLabel: formatEpoch(enriched.createdAt || (envelope as Record<string, any>).exportedAt),
    counts: enriched.counts,
    classIDs: enriched.classIDs,
    specIDs: enriched.specIDs
  };
}

function normalizeExportMeta(exportMeta: unknown): LooseRecord | null {
  return resolveExportMeta(exportMeta, []);
}

function normalizeSequences(decoded: unknown): LooseRecord[] {
  const entries = findSequenceEntries(decoded);

  return entries.map((entry: LooseRecord, index: number) => {
    const sequence = normalizeRecord(entry.value);
    const versions = normalizeVersions(sequence);
    const defaultVersion = readDefaultVersion(sequence, versions.length);
    const fallbackSteps = extractSteps(sequence, versions.map((version: LooseRecord) => version.source));
    const activeVersion = versions[defaultVersion - 1] || versions.find((version: LooseRecord) => version.steps.length > 0);
    const steps = activeVersion ? activeVersion.steps : fallbackSteps;
    const profile = readClassInfo(sequence);
    const nestedProfile = profile.class || profile.spec ? profile : findClassInfoDeep(sequence);
    const enrichment = enrichSequence(sequence);

    return {
      ...enrichment,
      name: entry.name || sequence.name || sequence.Name || sequence.title || sequence.Title || `Sequence ${index + 1}`,
      description: enrichment.description || sequence.description || sequence.Description || "",
      help: enrichment.help || "",
      comments: enrichment.comments || "",
      class: nestedProfile.class || enrichment.className,
      classId: nestedProfile.classId,
      spec: nestedProfile.spec || enrichment.specName,
      specId: nestedProfile.specId,
      defaultVersion,
      versions,
      steps,
      talentString: enrichment.talentString || null,
      talentBuild: enrichment.talentBuild || null
    };
  }).filter((sequence: LooseRecord) => sequence.steps.length > 0 || sequence.versions.length > 0);
}

function findSequenceEntries(decoded: unknown): Array<{ name: string; value: unknown }> {
  const record = normalizeRecord(decoded);
  if (record.type === "COLLECTION") {
    return entriesFromSequenceValue(record.sequences || record.Sequences);
  }

  if (record.sequence || record.Sequence) {
    return [{
      name: record.name || record.Name || "",
      value: record.sequence || record.Sequence
    }];
  }

  return entriesFromSequenceValue(record.sequences || record.Sequences);
}

function entriesFromSequenceValue(value: unknown): Array<{ name: string; value: unknown }> {
  if (Array.isArray(value)) {
    return value.map((sequence: unknown, index: number) => {
      const record = normalizeRecord(sequence);
      return {
        name: record.name || record.Name || record.title || record.Title || `Sequence ${index + 1}`,
        value: sequence
      };
    });
  }

  if (value && typeof value === "object") {
    return Object.entries(value).map(([name, sequence]) => ({ name, value: sequence }));
  }

  return [];
}

function readExportProfile(decoded: unknown, sequences: LooseRecord[], resolvedExportMeta: LooseRecord | null): LooseRecord {
  const record = normalizeRecord(decoded);
  const directCandidates = [
    record,
    record.meta,
    record.Meta,
    record.metadata,
    record.Metadata,
    record.exportMeta,
    record.ExportMeta,
    record.sequence,
    record.Sequence
  ].map(normalizeRecord);

  for (const candidate of directCandidates) {
    const profile = readClassInfo(candidate);
    if (profile.class || profile.spec) {
      return attachProfileSource(profile, profileSourceForCandidate(candidate, record));
    }
  }

  const nestedProfile = findClassInfoDeep(record);
  if (nestedProfile.class || nestedProfile.spec) {
    return attachProfileSource(nestedProfile, "payload");
  }

  const uniqueProfiles: Array<Record<string, any>> = [];
  for (const sequence of sequences) {
    if (!sequence.class && !sequence.spec) {
      continue;
    }

    const key = `${sequence.classId || sequence.class}|${sequence.specId || sequence.spec}`;
    if (!uniqueProfiles.some(profile => profile.key === key)) {
      uniqueProfiles.push({
        key,
        class: sequence.class,
        classId: sequence.classId,
        spec: sequence.spec,
        specId: sequence.specId
      });
    }
  }

  if (uniqueProfiles.length === 1) {
    const [{ key, ...profile }] = uniqueProfiles;
    return attachProfileSource(profile, "sequence");
  }

  const exportMetaRecord = normalizeRecord(record.exportMeta || record.ExportMeta);
  const talentString = resolvedExportMeta?.talentString
    || exportMetaRecord.talentString
    || exportMetaRecord.TalentString
    || findTalentStringInComments(exportMetaRecord, sequences);
  const talentProfile = readProfileFromTalentString(talentString);

  if (talentProfile.class || talentProfile.spec) {
    const profileSource = resolvedExportMeta?.talentSource === "description"
      ? "description"
      : "exportMeta";
    return attachProfileSource(talentProfile, profileSource);
  }

  return {};
}

function readProfileFromTalentString(talentString: unknown): LooseRecord {
  const normalizedTalentString = typeof talentString === "string" ? talentString : null;
  const header = parseTalentImportHeader(normalizedTalentString);
  if (!header?.specId) {
    return {};
  }

  const specInfo = SPEC_BY_ID[header.specId];
  if (!specInfo) {
    return { specId: header.specId };
  }

  return {
    class: CLASS_BY_ID[specInfo.classId] || "",
    classId: specInfo.classId,
    spec: specInfo.name,
    specId: header.specId
  };
}

function attachProfileSource(profile: LooseRecord, profileSource: string | null): LooseRecord {
  return profileSource ? { ...profile, profileSource } : profile;
}

function profileSourceForCandidate(candidate: LooseRecord, record: LooseRecord): string {
  const exportMeta = normalizeRecord(record.exportMeta || record.ExportMeta);
  if (candidate === exportMeta || candidate === normalizeRecord(record.exportMeta) || candidate === normalizeRecord(record.ExportMeta)) {
    return "exportMeta";
  }

  const sequence = normalizeRecord(record.sequence || record.Sequence);
  if (candidate === sequence) {
    return "sequence";
  }

  return "payload";
}

function readClassInfo(record: unknown): LooseRecord {
  const normalized = normalizeRecord(record);
  const metadata = normalizeRecord(
    normalized.MetaData || normalized.metaData || normalized.Metadata || normalized.metadata || {}
  );
  const source = { ...metadata, ...normalized };

  const classId = firstNumber(source, [
    "classID",
    "classId",
    "ClassID",
    "ClassId",
    "class_id",
    "playerClassID",
    "playerClassId"
  ]);
  const specId = firstNumber(source, [
    "specID",
    "specId",
    "SpecID",
    "SpecId",
    "spec_id",
    "specializationID",
    "specializationId",
    "playerSpecID",
    "playerSpecId"
  ]);
  const specInfo = specId ? SPEC_BY_ID[specId] : null;
  const resolvedClassId = classId || (specInfo ? specInfo.classId : null);

  return {
    class: firstString(source, ["class", "Class", "className", "ClassName", "playerClass"]) || (resolvedClassId != null ? CLASS_BY_ID[resolvedClassId] : "") || "",
    classId: resolvedClassId || null,
    spec: firstString(source, ["spec", "Spec", "specName", "SpecName", "specialization", "playerSpec"]) || (specInfo ? specInfo.name : ""),
    specId: specId || null
  };
}

function findClassInfoDeep(value: unknown, seen: Set<unknown> = new Set()): LooseRecord {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return {};
  }

  seen.add(value);

  const record = normalizeRecord(value);
  const direct = readClassInfo(record);
  if (direct.class || direct.spec) {
    return direct;
  }

  for (const child of Object.values(record)) {
    const nested = findClassInfoDeep(child, seen);
    if (nested.class || nested.spec) {
      return nested;
    }
  }

  return {};
}

function normalizeVersions(sequence: LooseRecord): LooseRecord[] {
  const entries = findVersionEntries(sequence);
  const versions = entries.map((entry: LooseRecord, index: number) => {
    const version = normalizeRecord(entry.value);
    const steps = stepsFromActions(version.actions || version.Actions);
    const fallbackSteps = steps.length ? steps : stepsFromRecord(version);
    const keyName = entry.key && !/^\d+$/.test(String(entry.key)) ? entry.key : "";

    return {
      index: index + 1,
      name: version.name || version.Name || version.label || version.Label || keyName || `Version ${index + 1}`,
      stepFunction: version.stepFunction || version.StepFunction || "",
      keyPress: translateSpellTokens(version.keyPress || version.KeyPress || ""),
      keyRelease: translateSpellTokens(version.keyRelease || version.KeyRelease || ""),
      resetOnCombat: Boolean(version.resetOnCombat || version.Combat),
      resetOnTarget: Boolean(version.resetOnTarget || version.Head),
      resetOnGear: Boolean(version.resetOnGear),
      resetOnSpec: Boolean(version.resetOnSpec),
      resetTimer: version.resetTimer || version.Timer || 0,
      repeatCount: Math.min(50, Math.max(1, Number(version.repeatCount ?? version.RepeatCount) || 1)),
      resetModifiers: normalizeResetModifiers(version.resetModifiers || version.ResetModifiers),
      actions: normalizeGripActions(version.actions || version.Actions),
      steps: fallbackSteps,
      source: version
    };
  }).filter((version: LooseRecord) => version.steps.length > 0);

  if (versions.length) {
    return versions;
  }

  const steps = stepsFromRecord(sequence);
  return steps.length ? [{
    index: 1,
    name: "Version 1",
    stepFunction: sequence.stepFunction || sequence.StepFunction || "",
    keyPress: translateSpellTokens(sequence.keyPress || sequence.KeyPress || ""),
    keyRelease: translateSpellTokens(sequence.keyRelease || sequence.KeyRelease || ""),
    resetOnCombat: Boolean(sequence.resetOnCombat || sequence.Combat),
    resetOnTarget: Boolean(sequence.resetOnTarget || sequence.Head),
    resetOnGear: Boolean(sequence.resetOnGear),
    resetOnSpec: Boolean(sequence.resetOnSpec),
    resetTimer: sequence.resetTimer || sequence.Timer || 0,
    repeatCount: Math.min(50, Math.max(1, Number(sequence.repeatCount ?? sequence.RepeatCount) || 1)),
    steps,
    source: sequence
  }] : [];
}

function findVersionEntries(sequence: LooseRecord): Array<{ key: string; value: unknown }> {
  const candidates = [
    sequence.versions,
    sequence.Versions,
    sequence.versionData,
    sequence.VersionData,
    sequence.sequenceVersions,
    sequence.SequenceVersions
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map((version: unknown, index: number) => ({ key: String(index + 1), value: version }));
    }

    if (candidate && typeof candidate === "object") {
      return Object.entries(candidate).map(([key, version]) => ({ key, value: version }));
    }
  }

  return [];
}

function readDefaultVersion(sequence: LooseRecord, versionCount: number): number {
  const raw = Number(sequence.defaultVersion || sequence.DefaultVersion || sequence.default || sequence.Default || 1);
  if (!Number.isFinite(raw) || raw < 1) {
    return 1;
  }
  if (versionCount > 0 && raw > versionCount) {
    return 1;
  }
  return Math.floor(raw);
}

function extractSteps(sequence: LooseRecord, versions: LooseRecord[]): LooseRecord[] {
  for (const version of versions) {
    const steps = stepsFromActions(version.actions || version.Actions);
    if (steps.length) {
      return steps;
    }
  }

  const direct = stepsFromRecord(sequence);
  if (direct.length) {
    return direct;
  }

  return [];
}

function stepsFromActions(actions: unknown): LooseRecord[] {
  if (!Array.isArray(actions) || actions.length === 0) {
    return [];
  }

  const flattened: Array<Record<string, any>> = [];
  flattenActions(actions, flattened);
  return flattened.map((step, index) => ({
    number: index + 1,
    text: step.text,
    preMarkers: step.preMarkers || [],
    postMarkers: step.postMarkers || [],
    chars: stepCharCount(step),
    limit: 255,
    source: step.source || null
  }));
}

function stepCharCount(step: LooseRecord): number {
  const markers = [...(step.preMarkers || []), ...(step.postMarkers || [])];
  const markerText = markers.join("");
  const markerSeparators = markers.length;
  return Buffer.byteLength((step.charText || step.text || "") + markerText, "utf8") + markerSeparators;
}

function flattenActions(actions: unknown[], output: LooseRecord[]): void {
  for (const action of actions) {
    const node = normalizeRecord(action);
    const type = String(node.type || node.Type || "").toLowerCase();

    if (type === "action") {
      appendMacroSteps(output, node.macro || node.Macro || "", node);
      continue;
    }

    if (type === "loop") {
      const stepFunction = node.stepFunction || node.StepFunction || "Sequential";
      const label = `(/Loop-${stepFunction}-Start)`;
      const endLabel = `(/Loop-${stepFunction}-End)`;
      const before = output.length;
      const children = Array.isArray(node.children) ? node.children : [];
      let attachedStart = false;

      if (output[output.length - 1]) {
        output[output.length - 1].postMarkers = output[output.length - 1].postMarkers || [];
        output[output.length - 1].postMarkers.push(label);
        attachedStart = true;
      }

      flattenActions(children, output);

      if (output.length > before) {
        if (!attachedStart && output[before]) {
          output[before].preMarkers = output[before].preMarkers || [];
          output[before].preMarkers.push(label);
        }
        output[output.length - 1].postMarkers = output[output.length - 1].postMarkers || [];
        output[output.length - 1].postMarkers.push(endLabel);
      }
      continue;
    }

    if (type === "if") {
      const condition = node.variable || node.Variable || node.condition || node.Condition || "";
      appendMarker(output, `(/If ${condition})`);
      const children = Array.isArray(node.children) ? node.children : [];
      for (const branch of children) {
        if (Array.isArray(branch)) {
          flattenActions(branch, output);
        }
      }
      appendMarker(output, "(/EndIf)");
      continue;
    }

    if (type === "pause") {
      const text = node.ms ? `/pause ${node.ms}ms` : node.gcd ? `/pause ${node.gcd} gcd` : `/pause ${node.clicks || 1} clicks`;
      appendMacroSteps(output, text, node);
      continue;
    }

    if (type === "embed") {
      appendMacroSteps(output, `/embed ${node.sequence || node.Sequence || ""}`.trim(), node);
    }
  }
}

function appendMacroSteps(output: LooseRecord[], macro: unknown, source: LooseRecord): void {
  String(macro || "")
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter(Boolean)
    .forEach((line: string) => {
      const translated = translateSpellTokens(line);
      output.push({ text: translated.replace(/\s{2,}/g, " "), charText: translated, source });
    });
}

function appendMarker(output: LooseRecord[], marker: string): void {
  if (output[output.length - 1]) {
    output[output.length - 1].postMarkers = output[output.length - 1].postMarkers || [];
    output[output.length - 1].postMarkers.push(marker);
  }
}

function stepsFromRecord(record: unknown): LooseRecord[] {
  const normalized = normalizeRecord(record);
  const candidates = [
    normalized.steps,
    normalized.Steps,
    normalized.actions,
    normalized.Actions,
    normalized.macroSteps,
    normalized.MacroSteps
  ].filter(Boolean);

  for (const candidate of candidates) {
    const steps = normalizeStepList(candidate);
    if (steps.length) {
      return steps;
    }
  }

  return [];
}

function normalizeStepList(value: unknown): LooseRecord[] {
  if (Array.isArray(value)) {
    return value
      .map((step: unknown, index: number) => normalizeStep(step, index))
      .filter((step: { text?: string; marker?: string }) => step.text || step.marker);
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, step], index) => normalizeStep(step, index))
      .filter((step: { text?: string; marker?: string }) => step.text || step.marker);
  }

  return [];
}

function normalizeStep(step: unknown, index: number): LooseRecord {
  if (typeof step === "string") {
    return buildStep(index, step, null, null);
  }

  if (!step || typeof step !== "object") {
    return buildStep(index, "", null, null);
  }

  const record = normalizeRecord(step);
  const text = firstString(record, [
    "macrotext",
    "macroText",
    "MacroText",
    "text",
    "Text",
    "body",
    "Body",
    "value",
    "Value",
    "line",
    "Line"
  ]);

  const marker = firstString(record, [
    "marker",
    "Marker",
    "label",
    "Label",
    "comment",
    "Comment"
  ]);

  return buildStep(index, text, marker, record);
}

function buildStep(index: number, text: string, marker: string | null, source: LooseRecord | null): LooseRecord {
  const macro = translateSpellTokens(text);
  const resolvedMarker = marker && /^\(\/.+\)$/.test(marker) ? marker : null;

  return {
    number: index + 1,
    text: macro,
    preMarkers: [],
    postMarkers: resolvedMarker ? [resolvedMarker] : [],
    chars: Buffer.byteLength(macro, "utf8"),
    limit: 255,
    source
  };
}

function firstString(record: LooseRecord, keys: string[]): string {
  for (const key of keys) {
    const value = readRecordValue(record, key);
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

function firstNumber(record: LooseRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(readRecordValue(record, key));
    if (Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
  }
  return null;
}

function readRecordValue(record: LooseRecord, key: string): unknown {
  if (Object.prototype.hasOwnProperty.call(record, key)) {
    return record[key];
  }

  const lowerKey = key.toLowerCase();
  const match = Object.keys(record).find(recordKey => recordKey.toLowerCase() === lowerKey);
  return match ? record[match] : undefined;
}

function normalizeGripActions(actions: unknown, depth: number = 0): LooseRecord[] {
  if (!Array.isArray(actions) || !actions.length) {
    return [];
  }

  return actions
    .map((action: unknown, index: number) => normalizeGripAction(action, index + 1, depth))
    .filter((action): action is LooseRecord => action !== null);
}

function normalizeGripAction(action: unknown, index: number, depth: number = 0): LooseRecord | null {
  const node = normalizeRecord(action);
  const type = String(node.type || node.Type || "").toLowerCase();

  if (type === "action") {
    const macro = String(node.macro || node.Macro || "").trim();
    if (!macro) {
      return null;
    }

    const interval = Number(node.interval || node.Interval);
    const isWeave = Number.isFinite(interval) && interval >= 2;
    const customLabel = firstString(node, ["label", "Label", "name", "Name"]);

    return {
      index,
      kind: "Step",
      depth,
      label: customLabel || (isWeave ? `[IL:${interval}]` : "Step"),
      text: translateSpellTokens(macro),
      interval: isWeave ? interval : null,
      children: []
    };
  }

  if (type === "loop") {
    const stepFunction = node.stepFunction || node.StepFunction || "Sequential";
    const repeat = node.repeat ?? node.Repeat ?? 1;

    const customLabel = firstString(node, ["label", "Label", "name", "Name"]);

    return {
      index,
      kind: "Loop",
      depth,
      label: customLabel || `Loop · ${stepFunction} · ×${repeat}`,
      stepFunction,
      repeat,
      text: "",
      children: normalizeGripActions(node.children || node.Children, depth + 1)
    };
  }

  if (type === "if") {
    const variable = node.variable || node.Variable || node.condition || node.Condition || "";
    const branches = Array.isArray(node.children) ? node.children : [];
    const children = branches.flatMap((branch: unknown) =>
      normalizeGripActions(Array.isArray(branch) ? branch : [branch], depth + 1)
    );

    const customLabel = firstString(node, ["label", "Label", "name", "Name"]);

    return {
      index,
      kind: "If",
      depth,
      label: customLabel || (variable ? `If · ${variable}` : "If"),
      variable,
      text: "",
      children
    };
  }

  if (type === "pause") {
    const clicks = node.clicks || node.Clicks || 1;
    const customLabel = firstString(node, ["label", "Label", "name", "Name"]);
    return {
      index,
      kind: "Pause",
      depth,
      label: customLabel || `Pause · ${clicks} clicks`,
      text: "",
      children: []
    };
  }

  if (type === "embed") {
    const sequence = node.sequence || node.Sequence || "";
    const customLabel = firstString(node, ["label", "Label", "name", "Name"]);
    return {
      index,
      kind: "Embed",
      depth,
      label: customLabel || (sequence ? `Embed · ${sequence}` : "Embed"),
      text: "",
      children: []
    };
  }

  return null;
}

function normalizeRecord(value: unknown): LooseRecord {
  if (Array.isArray(value)) {
    return arrayToRecord(value);
  }
  return value && typeof value === "object" ? value as LooseRecord : {};
}

function arrayToRecord(value: unknown[]): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const item of value) {
    if (Array.isArray(item) && item.length >= 2 && typeof item[0] === "string") {
      record[item[0]] = item[1];
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      Object.assign(record, item);
    }
  }
  return record;
}

export class CborReader {
  private buffer: Buffer;
  private offset: number;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  decode() {
    const value = decodeLuaStrings(this.readValue());
    if (this.offset !== this.buffer.length) {
      throw new Error("The decoded CBOR payload has trailing data.");
    }
    return value;
  }

  readValue(): unknown {
    const initial = this.readUInt8();
    const major = initial >> 5;
    const additional = initial & 0x1f;

    if (major === 0) {
      return this.readLength(additional);
    }

    if (major === 1) {
      const length = this.readLength(additional);
      if (typeof length !== "number") {
        throw new Error("CBOR negative integer exceeds supported range.");
      }
      return -1 - length;
    }

    if (major === 2) {
      return this.readBytes(additional);
    }

    if (major === 3) {
      return this.readString(additional);
    }

    if (major === 4) {
      return this.readArray(additional);
    }

    if (major === 5) {
      return this.readMap(additional);
    }

    if (major === 6) {
      return { tag: this.readLength(additional), value: this.readValue() };
    }

    return this.readSimple(additional);
  }

  readArray(additional: number): unknown[] {
    if (additional === 31) {
      const result: unknown[] = [];
      while (!this.nextIsBreak()) {
        result.push(this.readValue());
      }
      this.offset += 1;
      return result;
    }

    const length = this.readLength(additional);
    if (typeof length !== "number") {
      throw new Error("CBOR array length exceeds supported range.");
    }
    const result: unknown[] = [];
    for (let i = 0; i < length; i += 1) {
      result.push(this.readValue());
    }
    return result;
  }

  readMap(additional: number): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (additional === 31) {
      while (!this.nextIsBreak()) {
        result[String(this.readValue())] = this.readValue();
      }
      this.offset += 1;
      return result;
    }

    const length = this.readLength(additional);
    if (typeof length !== "number") {
      throw new Error("CBOR map length exceeds supported range.");
    }
    for (let i = 0; i < length; i += 1) {
      result[String(this.readValue())] = this.readValue();
    }
    return result;
  }

  readBytes(additional: number): Buffer {
    if (additional === 31) {
      const chunks: Buffer[] = [];
      while (!this.nextIsBreak()) {
        const chunk = this.readValue();
        if (!Buffer.isBuffer(chunk)) {
          throw new Error("Indefinite-length CBOR byte string contains a non-byte-string chunk.");
        }
        chunks.push(chunk);
      }
      this.offset += 1;
      return Buffer.concat(chunks);
    }

    const length = this.readLength(additional);
    if (typeof length !== "number") {
      throw new Error("CBOR byte string length exceeds supported range.");
    }
    this.require(length);
    const bytes = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return bytes;
  }

  readString(additional: number): string {
    if (additional === 31) {
      let value = "";
      while (!this.nextIsBreak()) {
        value += this.readValue();
      }
      this.offset += 1;
      return value;
    }

    const length = this.readLength(additional);
    if (typeof length !== "number") {
      throw new Error("CBOR text string length exceeds supported range.");
    }
    this.require(length);
    const value = this.buffer.toString("utf8", this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readSimple(additional: number): boolean | null | undefined | number {
    if (additional === 20) return false;
    if (additional === 21) return true;
    if (additional === 22) return null;
    if (additional === 23) return undefined;
    if (additional === 24) return this.readUInt8();
    if (additional === 25) return this.readFloat16();
    if (additional === 26) return this.readFloat32();
    if (additional === 27) return this.readFloat64();
    if (additional === 31) throw new Error("Unexpected CBOR break marker.");
    throw new Error(`Unsupported CBOR simple value ${additional}.`);
  }

  readLength(additional: number): number | string {
    if (additional < 24) {
      return additional;
    }
    if (additional === 24) {
      return this.readUInt8();
    }
    if (additional === 25) {
      this.require(2);
      const value = this.buffer.readUInt16BE(this.offset);
      this.offset += 2;
      return value;
    }
    if (additional === 26) {
      this.require(4);
      const value = this.buffer.readUInt32BE(this.offset);
      this.offset += 4;
      return value;
    }
    if (additional === 27) {
      this.require(8);
      const value = this.buffer.readBigUInt64BE(this.offset);
      this.offset += 8;
      return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
    }
    throw new Error(`Unsupported CBOR length marker ${additional}.`);
  }

  readUInt8(): number {
    this.require(1);
    const value = this.buffer[this.offset];
    this.offset += 1;
    return value;
  }

  readFloat16(): number {
    const half = this.readLength(25);
    if (typeof half !== "number") {
      throw new Error("Unexpected non-numeric CBOR half-float length.");
    }
    const exponent = (half & 0x7c00) >> 10;
    const fraction = half & 0x03ff;
    const sign = half & 0x8000 ? -1 : 1;

    if (exponent === 0) return sign * 2 ** -14 * (fraction / 2 ** 10);
    if (exponent === 31) return fraction ? NaN : sign * Infinity;
    return sign * 2 ** (exponent - 15) * (1 + fraction / 2 ** 10);
  }

  readFloat32() {
    this.require(4);
    const value = this.buffer.readFloatBE(this.offset);
    this.offset += 4;
    return value;
  }

  readFloat64() {
    this.require(8);
    const value = this.buffer.readDoubleBE(this.offset);
    this.offset += 8;
    return value;
  }

  nextIsBreak() {
    this.require(1);
    return this.buffer[this.offset] === 0xff;
  }

  require(length: number): void {
    if (this.offset + length > this.buffer.length) {
      throw new Error("The decoded CBOR payload ended unexpectedly.");
    }
  }
}

function decodeLuaStrings(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  if (Array.isArray(value)) {
    return value.map(decodeLuaStrings);
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = decodeLuaStrings(child);
    }
    return result;
  }

  return value;
}

export {
  decodeEMSExport,
  normalizeSequences,
  readExportProfile,
  normalizeExportMeta,
  stepsFromActions
};
