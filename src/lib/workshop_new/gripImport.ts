import { decodeEMSExport } from "./emsDecoder";
import { decodeGSEExport, normalizeDecodedGSE } from "./gseDecoder";
import { convertDecodedGSEToGRIP } from "./gseToGrip";
import { decodeForgeExport } from "./forgeImport";
import { detectExportFormat, FORMAT_ERRORS } from "./serialization";
import { decodeEMSPayload } from "./emsEncoder";
import {
  variablesFromPayload,
  macrosFromPayload,
  resolveSequenceHelpAndComments,
  parseVariableEvents
} from "./gripEnvelope";
import type { BuilderModel, ImportResult } from "./types";
import { translateSpellTokens, formatMacroToBareSpellIds } from "./spellCatalog";
import { normalizeResetModifiers } from "./gripResetModifiers";
import { normalizeContextOverrides } from "./gripContextOverrides";

type LooseRecord = Record<string, any>;

const STEP_FUNCTIONS = new Set(["Sequential", "Priority", "Random", "ReversePriority"]);
const LOOP_REPEAT_MAX = 50;

let nextNodeId = 1;
let nextSequenceId = 1;
let nextVersionId = 1;
let nextGripVariableId = 1;
let nextStandaloneMacroId = 1;

const DEFAULT_VARIABLE_FUNCTION = `function()
    return true
end`;

function resetIdCounters() {
  nextNodeId = 1;
  nextSequenceId = 1;
  nextVersionId = 1;
  nextGripVariableId = 1;
  nextStandaloneMacroId = 1;
}

function newNodeId() {
  return String(nextNodeId++);
}

function newSequenceId() {
  return String(nextSequenceId++);
}

function newVersionId() {
  return String(nextVersionId++);
}

function newGripVariableId() {
  return String(nextGripVariableId++);
}

function newStandaloneMacroId() {
  return String(nextStandaloneMacroId++);
}

function normalizeStepFunction(stepFunction: unknown): string {
  const value = String(stepFunction || "").trim();
  if (!value) {
    return "Sequential";
  }

  const match = [...STEP_FUNCTIONS].find(name => name.toLowerCase() === value.toLowerCase());
  return match || "Sequential";
}

function clampLoopRepeat(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(LOOP_REPEAT_MAX, Math.floor(parsed));
}

function normalizeRecord(value: unknown): LooseRecord {
  if (Array.isArray(value)) {
    const record: LooseRecord = {};
    for (const item of value) {
      if (Array.isArray(item) && item.length >= 2 && typeof item[0] === "string") {
        record[item[0]] = item[1];
      } else if (item && typeof item === "object" && !Array.isArray(item)) {
        Object.assign(record, item);
      }
    }
    return record;
  }
  return value && typeof value === "object" ? value as LooseRecord : {};
}

function formatMacroForBuilder(macro: unknown, useSpellIds: boolean): string {
  const text = String(macro || "");
  if (!text.trim()) {
    return "";
  }
  const translated = translateSpellTokens(text);
  return useSpellIds ? formatMacroToBareSpellIds(translated) : translated;
}

function attachImportedMetadata(target: LooseRecord, node: LooseRecord): LooseRecord {
  const name = String(node.name || node.Name || "").trim();
  const label = String(node.label || node.Label || "").trim();
  if (name) {
    target.name = name;
  }
  if (label) {
    target.label = label;
  }
  if (node.disabled || node.Disabled) {
    target.disabled = true;
  }
  return target;
}

function pauseClicks(node: LooseRecord): number {
  const clicks = Number(node.clicks || node.Clicks);
  if (Number.isFinite(clicks) && clicks > 0) {
    return Math.floor(clicks);
  }

  const ms = Number(node.ms || node.Ms);
  if (Number.isFinite(ms) && ms > 0) {
    return Math.max(1, Math.ceil(ms / 250));
  }

  return 1;
}

function mapRawAction(action: unknown, warnings: string[]): LooseRecord | null {
  const node = normalizeRecord(action);
  const type = String(node.type || node.Type || "").toLowerCase();

  if (type === "action") {
    const macro = String(node.macro || node.Macro || "").trim();
    if (!macro) {
      return null;
    }

    const step = attachImportedMetadata({ id: newNodeId(), type: "action", macro }, node);
    const interval = Number(node.interval || node.Interval);
    if (Number.isFinite(interval) && interval >= 2) {
      step.interval = Math.min(50, Math.floor(interval));
    }
    return step;
  }

  if (type === "loop") {
    const children = mapRawActionsToBuilder(node.children || node.Children || [], warnings);
    if (!children.length) {
      warnings.push("Skipped empty loop while importing.");
      return null;
    }

    return attachImportedMetadata({
      id: newNodeId(),
      type: "loop",
      stepFunction: normalizeStepFunction(node.stepFunction || node.StepFunction),
      repeat: clampLoopRepeat(node.repeat ?? node.Repeat ?? 1),
      children
    }, node);
  }

  if (type === "if") {
    const branches = Array.isArray(node.children) ? node.children : [];
    const thenBranch = mapRawActionsToBuilder(Array.isArray(branches[0]) ? branches[0] : [], warnings);
    const elseBranch = mapRawActionsToBuilder(Array.isArray(branches[1]) ? branches[1] : [], warnings);

    if (!thenBranch.length && !elseBranch.length) {
      warnings.push("Skipped empty If block while importing.");
      return null;
    }

    return attachImportedMetadata({
      id: newNodeId(),
      type: "if",
      variable: String(node.variable || node.Variable || node.condition || node.Condition || "= true").trim() || "= true",
      then: thenBranch,
      else: elseBranch
    }, node);
  }

  if (type === "pause") {
    return attachImportedMetadata({ id: newNodeId(), type: "pause", clicks: pauseClicks(node) }, node);
  }

  if (type === "embed") {
    const sequence = String(node.sequence || node.Sequence || "").trim();
    if (!sequence) {
      warnings.push("Skipped embed without a sequence name while importing.");
      return null;
    }
    return attachImportedMetadata({ id: newNodeId(), type: "embed", sequence }, node);
  }

  warnings.push(`Skipped unsupported block type "${type}" while importing.`);
  return null;
}

function mapRawActionsToBuilder(actions: unknown, warnings: string[]): LooseRecord[] {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .map((action: unknown) => mapRawAction(action, warnings))
    .filter((action): action is LooseRecord => action !== null);
}

function formatStepText(step: LooseRecord): string {
  const pre = (step.preMarkers || []).join("");
  const post = (step.postMarkers || []).join("");
  return `${pre}${step.text || ""}${post}`.trim();
}

function mapStepsToBuilder(steps: LooseRecord[] | null | undefined, warnings: string[]): LooseRecord[] {
  const actions: LooseRecord[] = [];

  for (const step of steps || []) {
    const text = formatStepText(step);
    if (!text) {
      continue;
    }

    if (/^\(\/(?:Loop|If|EndIf)\b/i.test(text)) {
      continue;
    }

    const pauseMsMatch = text.match(/^\/pause\s+(\d+)\s*ms$/i);
    if (pauseMsMatch) {
      actions.push({
        id: newNodeId(),
        type: "pause",
        clicks: Math.max(1, Math.ceil(Number(pauseMsMatch[1]) / 250))
      });
      continue;
    }

    const pauseClicksMatch = text.match(/^\/pause\s+(\d+)\s*clicks?$/i);
    if (pauseClicksMatch) {
      actions.push({ id: newNodeId(), type: "pause", clicks: Number(pauseClicksMatch[1]) });
      continue;
    }

    const embedMatch = text.match(/^\/embed\s+(.+)$/i);
    if (embedMatch) {
      actions.push({ id: newNodeId(), type: "embed", sequence: embedMatch[1].trim() });
      continue;
    }

    actions.push({ id: newNodeId(), type: "action", macro: text });
  }

  if (!actions.length && (steps || []).length) {
    warnings.push("Imported flat steps only; block structure may be simplified.");
  }

  return actions;
}

function applySpellDisplay(version: LooseRecord, useSpellIds: boolean): void {
  version.keyPress = formatMacroForBuilder(version.keyPress, useSpellIds);
  version.keyRelease = formatMacroForBuilder(version.keyRelease, useSpellIds);
  version.useSpellIds = useSpellIds === true;

  function walk(nodes: LooseRecord[] | null | undefined): void {
    for (const node of nodes || []) {
      if (node.type === "action") {
        node.macro = formatMacroForBuilder(node.macro, useSpellIds);
      } else if (node.type === "loop") {
        walk(node.children);
      } else if (node.type === "if") {
        walk(node.then);
        walk(node.else);
      }
    }
  }

  walk(version.actions);
}

function importVersion(decodedVersion: LooseRecord, warnings: string[]): LooseRecord {
  const source = normalizeRecord(decodedVersion.source || {});
  const rawActions = source.actions || source.Actions;
  let actions: LooseRecord[] = [];

  if (Array.isArray(rawActions) && rawActions.length) {
    actions = mapRawActionsToBuilder(rawActions, warnings);
  } else if (decodedVersion.steps?.length) {
    actions = mapStepsToBuilder(decodedVersion.steps, warnings);
  }

  const keyPress = String(decodedVersion.keyPress || "");
  const keyRelease = String(decodedVersion.keyRelease || "");
  const resetModifiers = normalizeResetModifiers(
    source.resetModifiers || source.ResetModifiers || decodedVersion.resetModifiers
  );

  const version = {
    id: newVersionId(),
    name: decodedVersion.name || "Default",
    stepFunction: normalizeStepFunction(decodedVersion.stepFunction),
    keyPress,
    keyRelease,
    resetOnCombat: Boolean(decodedVersion.resetOnCombat),
    resetOnTarget: Boolean(decodedVersion.resetOnTarget),
    resetOnGear: Boolean(decodedVersion.resetOnGear),
    resetOnSpec: Boolean(decodedVersion.resetOnSpec),
    resetTimer: Math.max(0, Number(decodedVersion.resetTimer) || 0),
    repeatCount: Math.min(50, Math.max(1, Number(decodedVersion.repeatCount) || 1)),
    resetModifiers,
    useSpellIds: false,
    actions
  };

  applySpellDisplay(version, false);
  return version;
}

function findRawSequenceEntries(payload: unknown): Array<{ name: string; value: unknown }> {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const payloadRecord = payload as LooseRecord;
  if (String(payloadRecord.type || "").toUpperCase() === "COLLECTION") {
    const sequences = payloadRecord.sequences || payloadRecord.Sequences || {};
    if (Array.isArray(sequences)) {
      return sequences.map((value: unknown, index: number) => ({
        name: normalizeRecord(value).name || normalizeRecord(value).Name || `Sequence ${index + 1}`,
        value
      }));
    }

    return Object.entries(sequences).map(([name, value]) => ({ name, value }));
  }

  const sequence = payloadRecord.sequence || payloadRecord.Sequence;
  if (sequence) {
    return [{
      name: payloadRecord.name || payloadRecord.Name || "",
      value: sequence
    }];
  }

  return [];
}

function importSequence(sequence: LooseRecord, warnings: string[], rawSequence: LooseRecord | null = null): LooseRecord | null {
  let versions = (sequence.versions || []).map((version: LooseRecord) => importVersion(version, warnings));

  if (!versions.length && sequence.steps?.length) {
    versions = [importVersion({
      name: "Default",
      stepFunction: sequence.stepFunction || "Sequential",
      keyPress: sequence.keyPress || "",
      keyRelease: sequence.keyRelease || "",
      resetOnCombat: sequence.resetOnCombat,
      resetOnTarget: sequence.resetOnTarget,
      resetOnGear: sequence.resetOnGear,
      resetOnSpec: sequence.resetOnSpec,
      resetTimer: sequence.resetTimer,
      repeatCount: Math.min(50, Math.max(1, Number(sequence.repeatCount) || 1)),
      resetModifiers: normalizeResetModifiers(sequence.resetModifiers || sequence.ResetModifiers),
      steps: sequence.steps,
      source: sequence.source || sequence
    }, warnings)];
  }

  if (!versions.length) {
    warnings.push(`Sequence "${sequence.name || "Untitled"}" had no importable content.`);
    return null;
  }

  const resolved = resolveSequenceHelpAndComments(rawSequence || sequence);

  return {
    id: newSequenceId(),
    name: sequence.name || "IMPORTED_SEQUENCE",
    description: resolved.description || sequence.description || "",
    help: resolved.help || "",
    comments: resolved.comments || "",
    changelog: String(sequence.changelog || sequence.Changelog || "").trim(),
    talentString: String(sequence.talentString || sequence.TalentString || "").trim(),
    talentBuild: String(sequence.talentBuild || sequence.TalentBuild || "").trim(),
    url: String(sequence.url || sequence.Url || "").trim(),
    contentTypes: Array.isArray(sequence.contentTypes)
      ? sequence.contentTypes.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [],
    classId: Number(sequence.classId) || 0,
    specId: sequence.specId ? Number(sequence.specId) : null,
    defaultVersion: Math.min(Math.max(1, Number(sequence.defaultVersion) || 1), versions.length),
    contextOverrides: normalizeContextOverrides(
      rawSequence?.contextOverrides
        || rawSequence?.ContextOverrides
        || sequence.contextOverrides
        || sequence.ContextOverrides,
      versions.length
    ),
    versions
  };
}

function mapImportedVariables(variables: unknown): LooseRecord[] {
  const entries = variablesFromPayload(variables);
  if (!entries.length && Array.isArray(variables)) {
    return variables
      .map((entry: LooseRecord) => mapImportedVariableEntry(normalizeRecord(entry), entry?.name || entry?.Name))
      .filter((entry): entry is LooseRecord => entry !== null);
  }

  return entries
    .map((entry: unknown) => mapImportedVariableEntry(entry as LooseRecord, (entry as LooseRecord).name))
    .filter((entry): entry is LooseRecord => entry !== null);
}

function mapImportedVariableEntry(node: LooseRecord, fallbackName: string = ""): LooseRecord | null {
  const name = String(node.name || node.Name || fallbackName || "").trim();
  if (!name) {
    return null;
  }

  const description = String(
    node.description
    || node.Description
    || node.comments
    || node.Comments
    || ""
  ).trim();
  const value = String(node.value || node.Value || node.text || node.Text || "").trim();
  const fn = String(
    node.function
    || node.Function
    || node.funct
    || node.Funct
    || node.body
    || node.Body
    || ""
  ).trim();
  const isText = node.type === "text" || (Boolean(value) && !fn);

  return {
    id: newGripVariableId(),
    name,
    description,
    type: isText ? "text" : "function",
    value: isText ? formatMacroForBuilder(value, false) : "",
    function: isText ? "" : (fn || DEFAULT_VARIABLE_FUNCTION),
    events: isText ? "" : parseVariableEvents(node.events || node.Events)
  };
}

function mapImportedStandaloneMacros(macros: unknown): LooseRecord[] {
  const entries = macrosFromPayload(macros);
  if (!entries.length && Array.isArray(macros)) {
    return macros
      .map((entry: LooseRecord) => mapImportedMacroEntry(normalizeRecord(entry), entry?.name || entry?.Name))
      .filter((entry): entry is LooseRecord => entry !== null);
  }

  return entries
    .map((entry: unknown) => mapImportedMacroEntry(entry as LooseRecord, (entry as LooseRecord).name))
    .filter((entry): entry is LooseRecord => entry !== null);
}

function mapImportedMacroEntry(node: LooseRecord, fallbackName: string = ""): LooseRecord | null {
  const name = String(node.name || node.Name || fallbackName || "").trim();
  const macro = formatMacroForBuilder(
    node.text || node.Text || node.macro || node.Macro || node.body || node.Body || "",
    false
  );
  if (!name || !macro.trim()) {
    return null;
  }

  return {
    id: newStandaloneMacroId(),
    name,
    macro,
    category: String(node.category || node.Category || "a").trim().toLowerCase() === "p" ? "p" : "a"
  };
}

function firstNonEmpty(values: unknown[]): string {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function resolveBuilderExportMeta(
  decoded: LooseRecord,
  exportMeta: LooseRecord = {},
  envelope: LooseRecord = {},
  talentString = ""
) {
  const decodedSequences = decoded.sequences || [];
  const exportedBy = envelope.exportedBy || {};

  const wireAuthor = firstNonEmpty(decodedSequences.map((sequence: LooseRecord) => sequence.author));
  const originalAuthor = firstNonEmpty(decodedSequences.map((sequence: LooseRecord) => sequence.originalAuthor));
  const originalAuthorRealm = firstNonEmpty(decodedSequences.map((sequence: LooseRecord) => sequence.originalAuthorRealm));
  const sequencePrivacy = firstNonEmpty(decodedSequences.map((sequence: LooseRecord) => sequence.privacyMode)).toLowerCase();

  const privacyMode = firstNonEmpty([
    exportMeta.privacyMode,
    exportedBy.mode,
    sequencePrivacy,
    "public"
  ]).toLowerCase() || "public";

  const lockedAuthor = firstNonEmpty([originalAuthor, wireAuthor]);

  let pseudonym = firstNonEmpty([exportMeta.pseudonym]);
  let exporterName = firstNonEmpty([exportMeta.exporterName, exportedBy.name]);
  let exporterRealm = firstNonEmpty([
    exportMeta.exporterRealm,
    exportedBy.realm,
    originalAuthorRealm
  ]);
  const region = firstNonEmpty([exportMeta.region, envelope.region]);

  if (privacyMode === "pseudonymous") {
    if (!pseudonym) {
      pseudonym = wireAuthor || lockedAuthor;
    }
  } else if (privacyMode === "private") {
    pseudonym = "";
    exporterName = "";
    exporterRealm = "";
  } else if (!exporterName) {
    exporterName = lockedAuthor;
  }

  return {
    collectionName: exportMeta.collectionName || exportMeta.CollectionName || "",
    author: lockedAuthor,
    originalAuthor: lockedAuthor,
    originalAuthorRealm: privacyMode === "public" ? exporterRealm : "",
    authorLocked: Boolean(lockedAuthor),
    lockedAuthor,
    description: exportMeta.description || exportMeta.Description || "",
    wowPatch: exportMeta.wowPatch || envelope.wowPatch || "",
    talentString: talentString || exportMeta.talentString || "",
    url: exportMeta.url || "",
    privacyMode,
    exporterName: privacyMode === "public" ? exporterName : "",
    exporterRealm: privacyMode === "public" ? exporterRealm : "",
    pseudonym: privacyMode === "pseudonymous" ? pseudonym : "",
    region: privacyMode === "public" ? region : ""
  };
}

function mergeRawSequenceContext(rawValue: unknown, topLevelOverrides: unknown) {
  const record: LooseRecord = rawValue && typeof rawValue === "object" ? rawValue as LooseRecord : {};
  const fromSequence = record.contextOverrides ?? record.ContextOverrides;

  if (fromSequence && typeof fromSequence === "object" && !Array.isArray(fromSequence)) {
    return record;
  }

  if (topLevelOverrides && typeof topLevelOverrides === "object" && !Array.isArray(topLevelOverrides)) {
    return {
      ...record,
      contextOverrides: topLevelOverrides
    };
  }

  return record;
}

function importFromDecoded(decoded: LooseRecord, rawPayload: unknown = null): ImportResult {
  const warnings: string[] = [];
  const meta = (decoded.meta || {}) as LooseRecord;
  const exportMeta = (meta.exportMeta || {}) as LooseRecord;
  const payload: LooseRecord = rawPayload && typeof rawPayload === "object" ? rawPayload as LooseRecord : {};
  const rawSequenceEntries = findRawSequenceEntries(payload);
  const topLevelContextOverrides = payload.type === "COLLECTION"
    ? null
    : (payload.contextOverrides || payload.ContextOverrides);
  const mappedSequences: Array<LooseRecord | null> = (decoded.sequences || [])
    .map((sequence: LooseRecord, index: number) => {
      const rawEntry = rawSequenceEntries.find((entry: { name: string; value: unknown }) =>
        String(entry.name || "").trim() === String(sequence.name || "").trim()
      ) || rawSequenceEntries[index];
      const rawSequence = mergeRawSequenceContext(rawEntry?.value, topLevelContextOverrides);
      return importSequence(sequence, warnings, rawSequence);
    });
  const sequences = mappedSequences.filter((sequence): sequence is LooseRecord => sequence !== null);

  if (!sequences.length) {
    throw new Error("No sequences with importable content were found.");
  }

  const variables = mapImportedVariables(
    payload.variables || payload.Variables || meta.variables || meta.Variables
  ).filter((variable): variable is NonNullable<typeof variable> => variable != null);
  for (const variable of variables) {
    if (variable.type === "text" && String(variable.value || "").trim()) {
      warnings.push(
        `Variable "${variable.name}" is plain text. GRIP only uses Lua function variables — convert it before exporting back to GRIP.`
      );
    }
  }
  const standaloneMacros = mapImportedStandaloneMacros(
    payload.Macros || payload.macros || meta.macros || meta.Macros
  );
  const collectionTalentString = String(exportMeta.talentString || exportMeta.TalentString || "").trim();

  const envelope = meta.envelope || {};
  const builderExportMeta = resolveBuilderExportMeta(decoded, exportMeta, envelope, collectionTalentString);

  return {
    model: {
      exportMeta: builderExportMeta,
      variables: variables.filter((variable): variable is NonNullable<typeof variable> => variable != null),
      standaloneMacros: standaloneMacros.filter((macro): macro is NonNullable<typeof macro> => macro != null),
      sequences: sequences as BuilderModel["sequences"]
    },
    warnings,
    type: meta.type || null,
    envelope: meta.envelope || null,
    exportMeta
  } as unknown as ImportResult;
}

function importPlainMacro(text: unknown): ImportResult {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("Paste a GRIP export or macro text to import.");
  }

  const actions = lines.map((line: string) => ({
    id: newNodeId(),
    type: "action",
    macro: formatMacroForBuilder(line, false)
  }));

  return {
    model: {
      exportMeta: {
        collectionName: "",
        author: "",
        originalAuthor: "",
        originalAuthorRealm: "",
        authorLocked: false,
        lockedAuthor: "",
        description: "",
        wowPatch: "",
        talentString: "",
        url: "",
        privacyMode: "public",
        exporterName: "",
        exporterRealm: "",
        pseudonym: "",
        region: ""
      },
      variables: [],
      standaloneMacros: [],
      sequences: [{
        id: newSequenceId(),
        name: "IMPORTED_MACRO",
        description: "",
        help: "",
        comments: "",
        changelog: "",
        talentString: "",
        url: "",
        contentTypes: [],
        contextOverrides: {},
        classId: 0,
        specId: null,
        defaultVersion: 1,
        versions: [{
          id: newVersionId(),
          name: "Default",
          stepFunction: "Sequential",
          keyPress: "",
          keyRelease: "",
          resetOnCombat: false,
          resetOnTarget: false,
          resetOnGear: false,
          resetOnSpec: false,
          resetTimer: 0,
          repeatCount: 1,
          resetModifiers: null,
          useSpellIds: false,
          actions
        }]
      }]
    },
    warnings: [],
    type: "SEQUENCE"
  } as ImportResult;
}

function enforceSpellNamesDefault(model: LooseRecord): void {
  for (const macro of model.standaloneMacros || []) {
    macro.macro = formatMacroForBuilder(macro.macro, false);
  }

  for (const sequence of model.sequences || []) {
    for (const version of sequence.versions || []) {
      delete version.UseSpellIds;
      delete version.useSpellIDs;
      applySpellDisplay(version, false);
    }
  }
}

// Surface GRIP Forge envelope attribution onto the imported model. The inner
// sequences are GSE-format, so class/spec/author already resolve from GSE
// MetaData; here we carry the forge-only fields (talent loadout, tooling,
// authoring notes) that the GSE payload does not include.
function applyForgeAttribution(imported: LooseRecord, forge: LooseRecord): void {
  if (!imported?.model || !forge) {
    return;
  }

  const author = String(forge.author || "").trim();
  const talentBuild = String(forge.talentBuild || "").trim();
  const notes = String(forge.notes || "").trim();
  const tool = String(forge.tool || "").trim();
  const toolVersion = String(forge.toolVersion || "").trim();

  const exportMeta = imported.model.exportMeta || (imported.model.exportMeta = {});
  if (author && !String(exportMeta.author || "").trim()) {
    exportMeta.author = author;
  }

  for (const sequence of imported.model.sequences || []) {
    if (talentBuild && !String(sequence.talentBuild || "").trim()) {
      sequence.talentBuild = talentBuild;
    }
    if (notes && !String(sequence.changelog || "").trim()) {
      sequence.changelog = notes;
    }
  }

  const summary = [`Imported from GRIP Forge${author ? ` (author: ${author})` : ""}.`];
  if (tool) {
    summary.push(`Source tool: ${tool}${toolVersion ? ` ${toolVersion}` : ""}.`);
  }
  if (talentBuild) {
    summary.push("Talent loadout preserved as talentBuild.");
  }
  imported.warnings = [summary.join(" "), ...(imported.warnings || [])];
  imported.forge = forge;
}

function importToBuilderModel(input: unknown): ImportResult {
  const code = String(input || "").trim();
  resetIdCounters();

  if (!code) {
    throw new Error("Paste a GRIP export or macro text to import.");
  }

  const format = detectExportFormat(code);

  if (format === "GSE3_ENCRYPTED") {
    throw new Error(FORMAT_ERRORS.GSE3_ENCRYPTED);
  }

  if (format === "GEMSCP1") {
    throw new Error(FORMAT_ERRORS.GEMSCP1_MACRO);
  }

  if (format === "EMS1" || format === "GRIP1") {
    const rawPayload = decodeEMSPayload(code);
    const result = importFromDecoded(decodeEMSExport(code), rawPayload);
    enforceSpellNamesDefault(result.model);
    return result;
  }

  if (format === "GSE3") {
    const decodedGse = decodeGSEExport(code);
    const converted = convertDecodedGSEToGRIP(decodedGse);
    const rawPayload = decodeEMSPayload(converted.export);
    const imported = importFromDecoded(decodeEMSExport(converted.export), rawPayload);
    imported.warnings = [...(converted.warnings || []), ...(imported.warnings || [])];
    enforceSpellNamesDefault(imported.model);
    return imported;
  }

  if (format === "FRG1") {
    const { forge, collection } = decodeForgeExport(code);
    const decodedGse = normalizeDecodedGSE(collection);
    const converted = convertDecodedGSEToGRIP(decodedGse);
    const rawPayload = decodeEMSPayload(converted.export);
    const imported = importFromDecoded(decodeEMSExport(converted.export), rawPayload);
    applyForgeAttribution(imported, forge);
    imported.warnings = [...(converted.warnings || []), ...(imported.warnings || [])];
    imported.type = imported.type || "FORGE";
    enforceSpellNamesDefault(imported.model);
    return imported;
  }

  const result = importPlainMacro(code);
  enforceSpellNamesDefault(result.model);
  return result;
}

export {
  importToBuilderModel
};
