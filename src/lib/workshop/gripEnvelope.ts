import { normalizeContextOverrides } from "./gripContextOverrides";

type LooseRecord = Record<string, any>;

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

function firstString(record: LooseRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function firstNumber(record: LooseRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(record[key]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function mapEntriesToArray(value: unknown, mapper: (entry: unknown, key?: string | number) => unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.map(mapper).filter(Boolean);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value)
    .map(([key, entry]) => mapper(entry, key))
    .filter(Boolean);
}

function readExportedBy(raw: unknown): LooseRecord | null {
  const record = normalizeRecord(raw);
  const mode = String(record.mode || record.Mode || "public").toLowerCase();
  const name = firstString(record, ["name", "Name"]);
  const identity = firstString(record, ["identity", "Identity"]);
  const realm = firstString(record, ["realm", "Realm"]);

  if (!name && !identity) {
    return null;
  }

  return {
    name,
    identity,
    realm: mode === "public" ? realm : "",
    mode
  };
}

function readInsights(raw: unknown): LooseRecord | null {
  const record = normalizeRecord(raw);
  if (!Object.keys(record).length) {
    return null;
  }

  const spellsUsed = mapEntriesToArray(record.spellsUsed || record.SpellsUsed, (entry: unknown) => {
    const node = normalizeRecord(entry);
    const id = firstNumber(node, ["id", "Id", "spellId", "SpellId"]);
    if (!id) {
      return null;
    }
    return {
      id,
      count: firstNumber(node, ["count", "Count"]) || 0
    };
  });

  const tempoRaw = normalizeRecord(record.tempo || record.Tempo);
  const tempo = Object.keys(tempoRaw).length
    ? {
      recommendedMs: firstNumber(tempoRaw, ["recommendedMs", "RecommendedMs"]),
      theoreticalMs: firstNumber(tempoRaw, ["theoreticalMs", "TheoreticalMs"]),
      blendedMs: firstNumber(tempoRaw, ["blendedMs", "BlendedMs"]),
      complexity: firstString(tempoRaw, ["complexity", "Complexity"]),
      confidence: firstString(tempoRaw, ["confidence", "Confidence"]),
      offGCDCount: firstNumber(tempoRaw, ["offGCDCount", "OffGCDCount"]),
      unknownCount: firstNumber(tempoRaw, ["unknownCount", "UnknownCount"])
    }
    : null;

  const healthRaw = normalizeRecord(record.health || record.Health);
  const health = Object.keys(healthRaw).length
    ? {
      critical: firstNumber(healthRaw, ["critical", "Critical"]) || 0,
      error: firstNumber(healthRaw, ["error", "Error"]) || 0,
      warning: firstNumber(healthRaw, ["warning", "Warning"]) || 0
    }
    : null;

  return {
    stepCount: firstNumber(record, ["stepCount", "StepCount"]),
    stepCounts: Array.isArray(record.stepCounts || record.StepCounts)
      ? (record.stepCounts || record.StepCounts).map((value: unknown) => Number(value) || 0)
      : [],
    spellsUsed,
    modifiersUsed: Array.isArray(record.modifiersUsed || record.ModifiersUsed)
      ? (record.modifiersUsed || record.ModifiersUsed).map((value: unknown) => String(value).trim()).filter(Boolean)
      : [],
    tempo,
    health
  };
}

function readDependencies(raw: unknown): LooseRecord | null {
  const record = normalizeRecord(raw);
  if (!Object.keys(record).length) {
    return null;
  }

  const readList = (key: string): string[] => {
    const value = record[key] || record[key.charAt(0).toUpperCase() + key.slice(1)];
    return Array.isArray(value) ? value.map((item: unknown) => String(item).trim()).filter(Boolean) : [];
  };

  const dependencies = {
    macros: readList("macros"),
    sequences: readList("sequences"),
    variables: readList("variables")
  };

  if (!dependencies.macros.length && !dependencies.sequences.length && !dependencies.variables.length) {
    return null;
  }

  return dependencies;
}

function readEnvelopeMeta(decoded: unknown): LooseRecord {
  const record = normalizeRecord(decoded);
  const exportedBy = readExportedBy(record.exportedBy || record.ExportedBy);
  const schemaRev = firstNumber(record, ["schemaRev", "SchemaRev"]);

  return {
    schemaRev,
    enriched: schemaRev !== null && schemaRev >= 2,
    addonVersion: firstString(record, ["addonVersion", "AddonVersion"]),
    exportedAt: firstNumber(record, ["exportedAt", "ExportedAt"]),
    wowPatch: firstString(record, ["wowPatch", "WowPatch"]),
    wowBuild: firstString(record, ["wowBuild", "WowBuild"]),
    wowInterface: firstNumber(record, ["wowInterface", "WowInterface"]),
    region: firstString(record, ["region", "Region"]),
    exportedBy
  };
}

function enrichExportMeta(exportMeta: unknown, decoded: unknown): LooseRecord {
  const meta = normalizeRecord(exportMeta);
  const countsRaw = normalizeRecord(meta.counts || meta.Counts);

  return {
    collectionName: firstString(meta, ["collectionName", "CollectionName"]),
    author: firstString(meta, ["author", "Author"]),
    description: firstString(meta, ["description", "Description"]),
    url: firstString(meta, ["url", "Url"]),
    talentString: firstString(meta, ["talentString", "TalentString"]) || null,
    createdAt: firstNumber(meta, ["createdAt", "CreatedAt"]),
    counts: Object.keys(countsRaw).length
      ? {
        sequences: firstNumber(countsRaw, ["sequences", "Sequences"]) || 0,
        variables: firstNumber(countsRaw, ["variables", "Variables"]) || 0,
        macros: firstNumber(countsRaw, ["macros", "Macros"]) || 0
      }
      : null,
    classIDs: Array.isArray(meta.classIDs || meta.ClassIDs)
      ? (meta.classIDs || meta.ClassIDs).map((value: unknown) => Number(value)).filter(Number.isFinite)
      : [],
    specIDs: Array.isArray(meta.specIDs || meta.SpecIDs)
      ? (meta.specIDs || meta.SpecIDs).map((value: unknown) => Number(value)).filter(Number.isFinite)
      : []
  };
}

function extractFirstUrl(text: unknown): string {
  const match = String(text || "").match(/https?:\/\/[^\s<>"')\]]+/i);
  if (!match) {
    return "";
  }

  return match[0].replace(/[.,;]+$/, "");
}

function looksLikeUrl(value: unknown): boolean {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }

  if (/^https?:\/\//i.test(text)) {
    return true;
  }

  return /^[\w.-]+\.[a-z]{2,}([/:][^\s]*)?$/i.test(text);
}

function stripEmbeddedUrl(text: unknown, url: string): string {
  if (!url) {
    return String(text || "").trim();
  }

  return String(text || "")
    .replace(url, "")
    .replace(/\s+/g, " ")
    .replace(/[:\s]+$/, "")
    .trim();
}

function resolveSequenceHelpAndComments(record: unknown): { help: string; comments: string; description: string } {
  const normalized = normalizeRecord(record);
  const explicitComments = firstString(normalized, ["comments", "Comments"]);
  const helplink = firstString(normalized, ["helplink", "Helplink", "helpLink", "HelpLink"]);
  const rawHelp = firstString(normalized, ["help", "Help", "helpText", "HelpText"]);
  const rawDescription = firstString(normalized, ["description", "Description"]);

  let help = helplink;
  let comments = explicitComments;
  let description = rawDescription;

  if (looksLikeUrl(rawHelp)) {
    help = help || rawHelp;
  } else if (rawHelp) {
    comments = comments || rawHelp;
  }

  if (!help) {
    const urlFromDescription = extractFirstUrl(description);
    if (urlFromDescription) {
      help = urlFromDescription;
      description = stripEmbeddedUrl(description, urlFromDescription);
    }
  }

  return { help, comments, description };
}

function enrichSequence(rawSequence: unknown): LooseRecord {
  const record = normalizeRecord(rawSequence);
  const talentString = firstString(record, ["talentString", "TalentString"]);
  const talentBuild = firstString(record, ["talentBuild", "TalentBuild"]);
  const { help, comments, description } = resolveSequenceHelpAndComments(record);
  const url = firstString(record, ["url", "Url"]);

  return {
    author: firstString(record, ["author", "Author", "originalAuthor", "OriginalAuthor"]),
    changelog: firstString(record, ["changelog", "Changelog"]),
    help,
    comments,
    description,
    url,
    className: firstString(record, ["className", "ClassName", "classFile", "ClassFile"]),
    specName: firstString(record, ["specName", "SpecName"]),
    role: firstString(record, ["role", "Role"]),
    heroSpecId: firstNumber(record, ["heroSpecID", "heroSpecId", "HeroSpecID", "HeroSpecId"]),
    heroSpecName: firstString(record, ["heroSpecName", "HeroSpecName"]),
    talentString: talentString || null,
    talentBuild: talentBuild || null,
    contentTypes: Array.isArray(record.contentTypes || record.ContentTypes)
      ? (record.contentTypes || record.ContentTypes).map((value: unknown) => String(value).trim()).filter(Boolean)
      : [],
    versionCount: firstNumber(record, ["versionCount", "VersionCount"]),
    createdAt: firstNumber(record, ["createdAt", "CreatedAt"]),
    updatedAt: firstNumber(record, ["updatedAt", "UpdatedAt"]),
    playerLevel: firstNumber(record, ["playerLevel", "PlayerLevel"]),
    privacyMode: firstString(record, ["privacyMode", "PrivacyMode"]),
    originalAuthor: firstString(record, ["originalAuthor", "OriginalAuthor"]),
    originalAuthorRealm: firstString(record, ["originalAuthorRealm", "OriginalAuthorRealm"]),
    lastModifier: firstString(record, ["lastModifier", "LastModifier", "lastModifierName", "LastModifierName"]),
    lastModifiedAt: firstNumber(record, ["lastModifiedAt", "LastModifiedAt"]),
    insights: readInsights(record.insights || record.Insights),
    dependencies: readDependencies(record.Dependencies || record.dependencies),
    contextOverrides: normalizeContextOverrides(
      record.contextOverrides || record.ContextOverrides,
      firstNumber(record, ["versionCount", "VersionCount"]) || 50
    )
  };
}

function parseVariableEvents(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map((value: unknown) => String(value).trim()).filter(Boolean).join(", ");
  }

  return String(raw || "").trim();
}

function variablesFromPayload(variables: unknown): unknown[] {
  return mapEntriesToArray(variables, (entry: unknown, key?: string | number) => {
    const node = normalizeRecord(entry);
    const name = firstString(node, ["name", "Name"]) || String(key || "").trim();
    if (!name) {
      return null;
    }

    const fn = firstString(node, [
      "funct",
      "Funct",
      "function",
      "Function",
      "body",
      "Body"
    ]);
    const value = firstString(node, ["value", "Value", "text", "Text"]);
    const description = firstString(node, ["comments", "Comments", "description", "Description"]);
    const disabled = Boolean(node.disabled || node.Disabled);
    const localeRisk = Boolean(node.localeRisk || node.LocaleRisk);

    if (value && !fn) {
      return { name, description, value, type: "text", disabled, localeRisk };
    }

    return {
      name,
      description,
      function: fn,
      events: parseVariableEvents(node.events || node.Events),
      author: firstString(node, ["author", "Author"]),
      version: firstNumber(node, ["version", "Version"]),
      disabled,
      localeRisk,
      type: "function"
    };
  });
}

function macrosFromPayload(macros: unknown): unknown[] {
  return mapEntriesToArray(macros, (entry: unknown, key?: string | number) => {
    const node = normalizeRecord(entry);
    const name = firstString(node, ["name", "Name"]) || String(key || "").trim();
    const text = firstString(node, ["text", "Text", "macro", "Macro", "body", "Body"]);
    if (!name || !text) {
      return null;
    }

    return {
      name,
      text,
      icon: firstNumber(node, ["icon", "Icon"]),
      category: firstString(node, ["category", "Category"])
    };
  });
}

function resolveTalentString(sources: unknown[]): string | null {
  for (const source of sources) {
    const value = String(source || "").trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function resolveSequenceTalent(sequence: LooseRecord = {}, collectionTalent = "") {
  const authorTalent = String(sequence.talentString || sequence.TalentString || "").trim();
  if (authorTalent) {
    return { value: authorTalent, source: "author" };
  }

  const liveTalent = String(sequence.talentBuild || sequence.TalentBuild || "").trim();
  if (liveTalent) {
    return { value: liveTalent, source: "live" };
  }

  const fallbackTalent = String(collectionTalent || "").trim();
  if (fallbackTalent) {
    return { value: fallbackTalent, source: "collection" };
  }

  return { value: "", source: null };
}

function buildSequenceTalentFields(sequence: LooseRecord = {}, exportMeta: LooseRecord = {}) {
  const authorTalent = String(sequence.talentString || "").trim();
  const liveTalent = String(sequence.talentBuild || "").trim();
  const collectionTalent = String(exportMeta.talentString || "").trim();

  if (authorTalent) {
    return { talentString: authorTalent };
  }
  if (liveTalent) {
    return { talentBuild: liveTalent };
  }
  if (collectionTalent) {
    return { talentString: collectionTalent };
  }
  return {};
}

function formatEpoch(epoch: unknown): string {
  const value = Number(epoch);
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  try {
    return new Date(value * 1000).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export {
  normalizeRecord,
  readEnvelopeMeta,
  enrichExportMeta,
  enrichSequence,
  resolveSequenceHelpAndComments,
  looksLikeUrl,
  extractFirstUrl,
  parseVariableEvents,
  variablesFromPayload,
  macrosFromPayload,
  resolveTalentString,
  resolveSequenceTalent,
  buildSequenceTalentFields,
  formatEpoch
};
