import { buildSequenceTalentFields } from "./gripEnvelope";
import { exportContextOverrides } from "./gripContextOverrides";

type LooseRecord = Record<string, any>;

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

const CLASS_FILE_BY_ID: Record<number, string> = {
  1: "WARRIOR",
  2: "PALADIN",
  3: "HUNTER",
  4: "ROGUE",
  5: "PRIEST",
  6: "DEATHKNIGHT",
  7: "SHAMAN",
  8: "MAGE",
  9: "WARLOCK",
  10: "MONK",
  11: "DRUID",
  12: "DEMONHUNTER",
  13: "EVOKER"
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

const LAZYGRIP_TARGET_ADDON_VERSION = "2.3.3";
const EXPORT_SCHEMA_REV = 2;

function resolveClassSpecNames(classId: number, specId: number | null) {
  const numericSpecId = specId != null ? Number(specId) : null;
  const resolvedClassId = Number(classId) || (numericSpecId != null ? SPEC_BY_ID[numericSpecId]?.classId : null);
  const specInfo = numericSpecId != null ? SPEC_BY_ID[numericSpecId] : null;

  return {
    className: resolvedClassId != null ? CLASS_BY_ID[resolvedClassId] || "" : "",
    classFile: resolvedClassId != null ? CLASS_FILE_BY_ID[resolvedClassId] || "" : "",
    specName: specInfo?.name || ""
  };
}

function collectSpellIds(text: unknown): Map<number, number> {
  const ids = new Map<number, number>();
  const pattern = /\{spell:(\d+)\}/gi;
  let match = pattern.exec(String(text || ""));

  while (match) {
    const id = Number(match[1]);
    if (Number.isFinite(id)) {
      ids.set(id, (ids.get(id) || 0) + 1);
    }
    match = pattern.exec(String(text || ""));
  }

  return ids;
}

function collectModifiers(text: unknown): Set<string> {
  const modifiers = new Set<string>();
  const pattern = /\[mod:([^\],\s]+)/gi;
  let match = pattern.exec(String(text || ""));

  while (match) {
    modifiers.add(String(match[1]).trim().toLowerCase());
    match = pattern.exec(String(text || ""));
  }

  return modifiers;
}

function walkActionTexts(actions: LooseRecord[] | null | undefined, output: string[]): void {
  for (const action of actions || []) {
    if (!action || typeof action !== "object") {
      continue;
    }

    if (action.type === "action" && action.macro) {
      output.push(String(action.macro));
    } else if (action.type === "loop") {
      walkActionTexts(action.children, output);
    } else if (action.type === "if") {
      walkActionTexts(action.then, output);
      walkActionTexts(action.else, output);
      if (action.variable) {
        output.push(String(action.variable));
      }
    } else if (action.type === "embed" && action.sequence) {
      output.push(`/embed ${action.sequence}`);
    }
  }
}

function collectSequenceTexts(sequence: LooseRecord) {
  const texts: string[] = [];

  for (const version of sequence.versions || []) {
    if (version.keyPress) {
      texts.push(String(version.keyPress));
    }
    if (version.keyRelease) {
      texts.push(String(version.keyRelease));
    }
    walkActionTexts(version.actions, texts);
  }

  return texts;
}

function collectReferencedVariables(texts: string[]): string[] {
  const names = new Set<string>();
  const pattern = /~([^~\s]+)~/g;

  for (const text of texts) {
    let match = pattern.exec(text);
    while (match) {
      names.add(match[1]);
      match = pattern.exec(text);
    }
  }

  return [...names].sort();
}

function collectEmbedSequences(actions: LooseRecord[] | null | undefined, output: Set<string> = new Set()): Set<string> {
  for (const action of actions || []) {
    if (!action || typeof action !== "object") {
      continue;
    }
    if (action.type === "embed" && action.sequence) {
      output.add(String(action.sequence).trim());
    } else if (action.type === "loop") {
      collectEmbedSequences(action.children, output);
    } else if (action.type === "if") {
      collectEmbedSequences(action.then, output);
      collectEmbedSequences(action.else, output);
    }
  }
  return output;
}

function buildDependencies(sequence: LooseRecord, model: LooseRecord): LooseRecord | null {
  const texts = collectSequenceTexts(sequence);
  const variables = collectReferencedVariables(texts);
  const embeds = [...collectEmbedSequences(sequence.versions?.flatMap((version: LooseRecord) => version.actions || []))].sort();
  const macros = (model.standaloneMacros || [])
    .map((item: LooseRecord) => String(item.name || "").trim())
    .filter(Boolean)
    .sort();

  const dependencies: LooseRecord = {};
  if (variables.length) {
    dependencies.Variables = variables;
  }
  if (embeds.length) {
    dependencies.Sequences = embeds;
  }
  if (macros.length) {
    dependencies.Macros = macros;
  }

  return Object.keys(dependencies).length ? dependencies : null;
}

function buildInsights(sequence: LooseRecord, builtVersions: LooseRecord[]): LooseRecord {
  const texts = collectSequenceTexts(sequence);
  const spellCounts = new Map<number, number>();
  const modifiers = new Set<string>();

  for (const text of texts) {
    for (const [id, count] of collectSpellIds(text)) {
      spellCounts.set(id, (spellCounts.get(id) || 0) + count);
    }
    for (const modifier of collectModifiers(text)) {
      modifiers.add(modifier);
    }
  }

  const defaultIndex = Math.min(
    Math.max(0, Number(sequence.defaultVersion) || 1) - 1,
    (builtVersions || []).length - 1
  );
  const defaultVersion = builtVersions?.[defaultIndex];

  return {
    stepCount: defaultVersion?.steps?.length || 0,
    stepCounts: (builtVersions || []).map((version: LooseRecord) => version.steps?.length || 0),
    spellsUsed: [...spellCounts.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([id, count]) => ({ id, count })),
    modifiersUsed: [...modifiers].sort()
  };
}

function getExportMetaAuthor(exportMeta: LooseRecord = {}) {
  const lockedAuthor = String(exportMeta.lockedAuthor || "").trim();
  if (exportMeta.authorLocked && lockedAuthor) {
    return lockedAuthor;
  }
  return String(exportMeta.author || "").trim();
}

function resolveExportAuthor(model: LooseRecord, sequence: LooseRecord = {}) {
  const exportMeta = model?.exportMeta || {};
  const lockedAuthor = String(exportMeta.lockedAuthor || "").trim();
  if (exportMeta.authorLocked && lockedAuthor) {
    return lockedAuthor;
  }
  return String(sequence.author || exportMeta.author || "").trim();
}

function buildSequenceProvenanceFields(model: LooseRecord, sequence: LooseRecord = {}): LooseRecord {
  const exportMeta = model?.exportMeta || {};
  const privacyMode = String(exportMeta.privacyMode || "public").trim().toLowerCase();
  const lockedAuthor = String(exportMeta.lockedAuthor || "").trim();
  const storedOriginal = String(exportMeta.originalAuthor || "").trim();
  const authorName = String(exportMeta.author || "").trim();
  const originalAuthor = lockedAuthor || storedOriginal || authorName;
  const originalAuthorRealm = String(
    exportMeta.originalAuthorRealm || exportMeta.exporterRealm || ""
  ).trim();
  const pseudonym = String(exportMeta.pseudonym || "Anonymous").trim();

  const fields: LooseRecord = { privacyMode };

  if (originalAuthor) {
    fields.originalAuthor = originalAuthor;
    if (privacyMode === "public" && originalAuthorRealm) {
      fields.originalAuthorRealm = originalAuthorRealm;
    }
    fields.provenanceSource = exportMeta.authorLocked ? "native" : "lazygrip";
    fields.signatureAlgorithm = "ALG_V0_DJB2";
  }

  if (privacyMode === "pseudonymous") {
    fields.author = pseudonym || originalAuthor || "Anonymous";
  } else if (privacyMode === "private") {
    fields.author = originalAuthor ? "Anonymous" : "";
  } else {
    fields.author = originalAuthor;
  }

  if (!fields.author) {
    delete fields.author;
  }

  return fields;
}

function buildExportedBy(exportMeta: LooseRecord): LooseRecord | null {
  const mode = String(exportMeta.privacyMode || "public").trim().toLowerCase();
  if (mode === "private") {
    return null;
  }

  const author = getExportMetaAuthor(exportMeta);
  const name = mode === "pseudonymous"
    ? String(exportMeta.pseudonym || author || "Anonymous").trim()
    : String(exportMeta.exporterName || author || "").trim();
  if (!name) {
    return null;
  }

  const exportedBy: LooseRecord = { name, mode };
  if (mode === "public") {
    const realm = String(exportMeta.exporterRealm || "").trim();
    if (realm) {
      exportedBy.realm = realm;
    }
  }

  return exportedBy;
}

function buildEnvelopeFields(model: LooseRecord): LooseRecord {
  const exportMeta = model.exportMeta || {};
  const envelope: LooseRecord = {
    schemaRev: EXPORT_SCHEMA_REV,
    addonVersion: String(exportMeta.addonVersion || LAZYGRIP_TARGET_ADDON_VERSION).trim() || LAZYGRIP_TARGET_ADDON_VERSION,
    exportedAt: Math.floor(Date.now() / 1000),
    locale: "enUS"
  };

  const wowPatch = String(exportMeta.wowPatch || "").trim();
  if (wowPatch) {
    envelope.wowPatch = wowPatch;
  }

  const wowBuild = String(exportMeta.wowBuild || "").trim();
  if (wowBuild) {
    envelope.wowBuild = wowBuild;
  }

  const wowInterface = Number(exportMeta.wowInterface);
  if (Number.isFinite(wowInterface) && wowInterface > 0) {
    envelope.wowInterface = Math.floor(wowInterface);
  }

  const exportedBy = buildExportedBy(exportMeta);
  if (exportedBy) {
    envelope.exportedBy = exportedBy;
    const region = String(exportMeta.region || "").trim();
    if (region && exportedBy.mode === "public") {
      envelope.region = region;
    }
  }

  return envelope;
}

function buildCollectionExportMeta(model: LooseRecord, builtSequences: LooseRecord[]): LooseRecord {
  const exportMeta = model.exportMeta || {};
  const classIDs = Array.from(new Set<number>(
    (model.sequences || [])
      .map((sequence: LooseRecord) => Number(sequence.classId) || 0)
      .filter((value: number) => value > 0)
  )).sort((a, b) => a - b);
  const specIDs = Array.from(new Set<number>(
    (model.sequences || [])
      .map((sequence: LooseRecord) => Number(sequence.specId))
      .filter((value: number) => Number.isFinite(value) && value > 0)
  )).sort((a, b) => a - b);

  const meta: LooseRecord = {
    collectionName: String(exportMeta.collectionName || "").trim(),
    author: resolveExportAuthor(model),
    description: String(exportMeta.description || "").trim(),
    counts: {
      sequences: builtSequences.length,
      variables: (model.variables || []).length,
      macros: (model.standaloneMacros || []).length
    },
    classIDs,
    specIDs,
    createdAt: Math.floor(Date.now() / 1000)
  };

  const talentString = String(exportMeta.talentString || "").trim();
  if (talentString) {
    meta.talentString = talentString;
  }

  const url = String(exportMeta.url || "").trim();
  if (url) {
    meta.url = url;
  }

  return meta;
}

function variablesToExportMap(variables: LooseRecord[], formatMacro: (text: string) => string, warnings: string[] = []) {
  const map: Record<string, LooseRecord> = {};

  for (const variable of variables || []) {
    const name = String(variable?.name || "").trim();
    if (!name) {
      continue;
    }

    const description = String(variable?.description || "").trim();
    const value = String(variable?.value || "").trim();
    const fn = String(variable?.function || "").trim();
    const type = variable?.type === "text" || variable?.type === "function"
      ? variable.type
      : (value && !fn ? "text" : "function");

    if (type === "text") {
      if (value) {
        warnings.push(
          `Variable "${name}" is plain text — GRIP only imports Lua function variables, so it was omitted from the export. Convert it to a function variable or inline the text in macros.`
        );
      }
      continue;
    }

    if (!fn) {
      continue;
    }

    const entry: LooseRecord = { funct: fn };
    if (description) {
      entry.comments = description;
    }
    const events = String(variable?.events || "").trim();
    if (events) {
      entry.events = events;
    }
    map[name] = entry;
  }

  return map;
}

function macrosToExportMap(macros: LooseRecord[], formatMacro: (text: unknown) => string): Record<string, LooseRecord> {
  const map: Record<string, LooseRecord> = {};

  for (const item of macros || []) {
    const name = String(item?.name || "").trim();
    const text = formatMacro(item?.macro || "");
    if (!name || !text.trim()) {
      continue;
    }

    map[name] = {
      name,
      text,
      icon: Number(item?.icon) || 134400,
      category: String(item?.category || "a").trim() || "a"
    };
  }

  return map;
}

function enrichSequencePayload(sequence: LooseRecord, model: LooseRecord, builtVersions: LooseRecord[]): LooseRecord {
  const exportMeta = model.exportMeta || {};
  const classId = Number(sequence.classId) || 0;
  const specId = sequence.specId ? Number(sequence.specId) : null;
  const names = resolveClassSpecNames(classId, specId);
  const provenance = buildSequenceProvenanceFields(model, sequence);
  const talentFields = buildSequenceTalentFields(sequence, exportMeta);
  const url = String(sequence.url || exportMeta.url || "").trim();
  const contentTypes = Array.isArray(sequence.contentTypes)
    ? sequence.contentTypes.map((value: unknown) => String(value).trim()).filter(Boolean)
    : String(sequence.contentTypes || "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);

  const payload: LooseRecord = {
    versionCount: builtVersions.length,
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
    insights: buildInsights(sequence, builtVersions),
    provenanceSource: "lazygrip"
  };

  const contextOverrides = exportContextOverrides(sequence.contextOverrides, builtVersions.length);
  if (contextOverrides) {
    payload.contextOverrides = contextOverrides;
  }

  Object.assign(payload, provenance);
  if (sequence.description) {
    payload.description = String(sequence.description).trim();
  }
  if (sequence.comments) {
    payload.help = String(sequence.comments).trim();
  }
  if (sequence.help) {
    payload.helplink = String(sequence.help).trim();
  }
  if (sequence.changelog) {
    payload.changelog = String(sequence.changelog).trim();
  }
  Object.assign(payload, talentFields);
  if (url) {
    payload.url = url;
  }
  if (classId > 0) {
    payload.classID = classId;
  }
  if (specId) {
    payload.specID = specId;
  }
  if (names.className) {
    payload.className = names.className;
  }
  if (names.classFile) {
    payload.classFile = names.classFile;
  }
  if (names.specName) {
    payload.specName = names.specName;
  }
  if (contentTypes.length) {
    payload.contentTypes = contentTypes;
  }

  const dependencies = buildDependencies(sequence, model);
  if (dependencies) {
    payload.Dependencies = dependencies;
  }

  return payload;
}

export {
  LAZYGRIP_TARGET_ADDON_VERSION,
  EXPORT_SCHEMA_REV,
  SPEC_BY_ID,
  buildEnvelopeFields,
  buildCollectionExportMeta,
  enrichSequencePayload,
  resolveExportAuthor,
  buildSequenceProvenanceFields,
  variablesToExportMap,
  macrosToExportMap
};
