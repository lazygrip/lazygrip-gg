import fs from "node:fs";
import path from "node:path";

type LooseRecord = Record<string, any>;
interface SpellEntry { id: number; name: string; }
interface CatalogInfo {
  version: string | null;
  source: string | null;
  spellCount: number;
  byClass: Record<string, Record<string, string>> | null;
}

// NOTE: __dirname is unreliable inside Next.js's bundled server output (the
// bundle path at runtime does not match the source file's location on disk).
// This repo keeps its spell catalog data at src/lib/data/, resolved from
// process.cwd() (the project root at build/runtime), which is stable in both
// local dev and Vercel's serverless functions.
function resolveDataDir(): string {
  const candidates = [
    path.join(process.cwd(), "src", "lib", "data"),
    path.join(process.cwd(), "data"),
    path.join(__dirname, "..", "data")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "spell-catalog.json"))) {
      return candidate;
    }
  }
  return candidates[0];
}

const DATA_DIR = resolveDataDir();
const BUNDLED_JSON_PATH = path.join(DATA_DIR, "spell-catalog.json");
const BUNDLED_LUA_PATH = path.join(DATA_DIR, "CrossClassSpellCatalog.lua");
const ADDON_CATALOG_RELATIVE_PATH = path.join("Data", "CrossClassSpellCatalog.lua");

let cachedCatalog: Map<number, string> | null = null;
let cachedNameIndex: Map<string, number> | null = null;
let cachedCatalogInfo: CatalogInfo | null = null;
let cachedByClass: Map<string, SpellEntry[]> | null = null;
let cachedAllSpells: SpellEntry[] | null = null;

const CLASS_ID_TO_CATALOG_KEY: Record<number, string> = {
  1: "warrior",
  2: "paladin",
  3: "hunter",
  4: "rogue",
  5: "priest",
  6: "deathknight",
  7: "shaman",
  8: "mage",
  9: "warlock",
  10: "monk",
  11: "druid",
  12: "demonhunter",
  13: "evoker"
};

function getSpellName(spellId: unknown): string | null {
  const catalog = loadSpellCatalog();
  return catalog.get(Number(spellId)) || null;
}

function getSpellIdByName(spellName: unknown): number | null {
  const name = String(spellName || "").trim();
  if (!name) {
    return null;
  }

  const index = loadNameIndex();
  return index.get(name.toLowerCase()) || null;
}

function getCatalogInfo(): CatalogInfo | null {
  loadSpellCatalog();
  return cachedCatalogInfo ? { ...cachedCatalogInfo } : null;
}

function classIdToCatalogKey(classId: unknown): string | null {
  return CLASS_ID_TO_CATALOG_KEY[Number(classId)] || null;
}

function searchSpells({ query, classId = 0, limit = 12 }: { query?: string; classId?: number; limit?: number } = {}): SpellEntry[] {
  loadSpellCatalog();

  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (normalizedQuery.length < 2) {
    return [];
  }

  const maxResults = Math.min(Math.max(Number(limit) || 12, 1), 30);
  const classKey = classIdToCatalogKey(classId);
  const pool = classKey && cachedByClass?.has(classKey)
    ? cachedByClass.get(classKey)
    : cachedAllSpells;

  const results: SpellEntry[] = [];
  for (const spell of pool || []) {
    if (!spell.name.toLowerCase().includes(normalizedQuery)) {
      continue;
    }

    results.push(spell);
    if (results.length >= maxResults) {
      break;
    }
  }

  return results.sort((left, right) => {
    const leftStarts = left.name.toLowerCase().startsWith(normalizedQuery);
    const rightStarts = right.name.toLowerCase().startsWith(normalizedQuery);
    if (leftStarts !== rightStarts) {
      return leftStarts ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

function translateSpellTokens(macroText: unknown): string {
  const withTags = String(macroText || "").replace(/\{spell:(\d+)\}/gi, (token, spellId) => {
    return getSpellName(spellId) || token;
  });

  return resolveSpellIdsInMacrotext(withTags);
}

function formatMacroForGripExport(macroText: unknown): string {
  return tagMacrotextToSpellIds(String(macroText || ""));
}

function resolveSpellIdsInMacrotext(text: unknown): string {
  if (!text) {
    return String(text ?? "");
  }

  return String(text)
    .split(/\r?\n/)
    .map(line => resolveSpellIdsInLine(line))
    .join("\n");
}

function tagMacrotextToSpellIds(text: unknown, options: { bareIds?: boolean } = {}): string {
  if (!text) {
    return String(text ?? "");
  }

  return String(text)
    .split(/\r?\n/)
    .map(line => tagSpellIdsInLine(line, options))
    .join("\n");
}

function formatMacroToBareSpellIds(macroText: unknown): string {
  return tagMacrotextToSpellIds(String(macroText || ""), { bareIds: true });
}

function resolveSpellIdsInLine(line: string): string {
  const lower = line.toLowerCase();

  if ((lower.startsWith("/cast ") || lower.startsWith("/use ")) && !lower.startsWith("/castsequence")) {
    return resolveCastLine(line, { tagForExport: false });
  }

  if (lower.startsWith("/castsequence")) {
    return resolveCastSequenceLine(line, { tagForExport: false });
  }

  return line;
}

function tagSpellIdsInLine(line: string, options: { bareIds?: boolean } = {}) {
  const lower = line.toLowerCase();

  if ((lower.startsWith("/cast ") || lower.startsWith("/use ")) && !lower.startsWith("/castsequence")) {
    return resolveCastLine(line, { tagForExport: true, ...options });
  }

  if (lower.startsWith("/castsequence")) {
    return resolveCastSequenceLine(line, { tagForExport: true, ...options });
  }

  return line.replace(/\{spell:(\d+)\}/gi, (token, spellId) => {
    if (options.bareIds) {
      return String(spellId);
    }
    return getSpellName(spellId) ? `{spell:${spellId}}` : token;
  });
}

function isInventorySlotNumber(value: string | number | null | undefined): boolean {
  if (!/^\d+$/.test(String(value ?? "").trim())) {
    return false;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 19;
}

function resolveCastLine(line: string, options: { tagForExport?: boolean; bareIds?: boolean }): string {
  const match = line.match(/^(\/\S+\s+)([\s\S]*)$/);
  if (!match) {
    return line;
  }

  const [, command, rest] = match;
  const commandWord = command.trim().toLowerCase();
  const isUseCommand = commandWord === "/use";

  const { conditions, spellPart } = consumeConditions(rest);
  if (!spellPart) {
    return line;
  }

  const resolvedSegments = spellPart.split(";").map(segment => {
    const trimmed = segment.trim();
    if (!trimmed) {
      return trimmed;
    }

    const { conditions: segmentConditions, spellPart: segmentSpell } = consumeConditions(trimmed);
    const formattedSpell = formatSpellReference(segmentSpell, {
      tagForExport: options.tagForExport,
      allowNumericResolution: !isUseCommand,
      bareIds: options.bareIds,
      isUseCommand
    });

    if (segmentConditions) {
      return `${segmentConditions} ${formattedSpell}`.trim();
    }

    return formattedSpell;
  });

  const joined = resolvedSegments.join("; ");
  return conditions ? `${command}${conditions} ${joined}` : `${command}${joined}`;
}

function resolveCastSequenceLine(line: string, options: { tagForExport?: boolean; bareIds?: boolean }): string {
  const match = line.match(/^(\/castsequence\s*)([\s\S]*)$/i);
  if (!match) {
    return line;
  }

  const [, command, rest] = match;
  const trimmedRest = String(rest || "").trimStart();
  if (!trimmedRest) {
    return line;
  }

  const { conditions, spellPart: spellList } = consumeConditions(trimmedRest);
  let prefix = command;
  if (conditions) {
    prefix += `${conditions} `;
  }

  if (!spellList) {
    return line;
  }

  let workingSpellList = spellList;
  const resetMatch = workingSpellList.match(/^(reset=\S+\s+)([\s\S]*)$/i);
  if (resetMatch) {
    prefix += resetMatch[1];
    workingSpellList = resetMatch[2];
  }

  const resolvedEntries = workingSpellList.split(",").map(entry => {
    const trimmed = entry.trim();
    if (!trimmed || trimmed.toLowerCase() === "null") {
      return trimmed;
    }

    return formatSpellReference(trimmed, {
      tagForExport: options.tagForExport,
      allowNumericResolution: true,
      bareIds: options.bareIds
    });
  });

  return `${prefix}${resolvedEntries.join(", ")}`;
}

function formatSpellReference(
  spellRef: unknown,
  options: { tagForExport?: boolean; allowNumericResolution?: boolean; bareIds?: boolean; isUseCommand?: boolean }
): string {
  const value = String(spellRef || "").trim();
  if (!value) {
    return value;
  }

  const { tagForExport = false, allowNumericResolution = false, bareIds = false, isUseCommand = false } = options;

  if (isUseCommand && isInventorySlotNumber(value)) {
    return value;
  }

  const tokenMatch = value.match(/^\{spell:(\d+)\}$/i);
  if (tokenMatch) {
    const numericId = Number(tokenMatch[1]);
    if (isUseCommand && isInventorySlotNumber(numericId)) {
      return String(numericId);
    }
    if (tagForExport) {
      return bareIds ? String(numericId) : `{spell:${numericId}}`;
    }
    return getSpellName(numericId) || value;
  }

  const numericId = readNumericSpellId(value);
  if (numericId !== null) {
    if (isUseCommand && isInventorySlotNumber(numericId)) {
      return String(numericId);
    }
    if (tagForExport) {
      return bareIds ? String(numericId) : `{spell:${numericId}}`;
    }
    if (allowNumericResolution) {
      return getSpellName(numericId) || value;
    }
    return value;
  }

  if (tagForExport) {
    const spellId = getSpellIdByName(value);
    if (spellId) {
      return bareIds ? String(spellId) : `{spell:${spellId}}`;
    }
  }

  return value;
}

function readNumericSpellId(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function consumeConditions(value: unknown) {
  let remainder = String(value || "").trimStart();
  const conditions: string[] = [];

  while (remainder.startsWith("[")) {
    const closingIndex = findMatchingBracket(remainder);
    if (closingIndex === -1) {
      break;
    }

    conditions.push(remainder.slice(0, closingIndex + 1));
    remainder = remainder.slice(closingIndex + 1).trimStart();
  }

  return {
    conditions: conditions.join(""),
    spellPart: remainder.trim()
  };
}

function findMatchingBracket(value: string): number {
  let depth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function loadSpellCatalog(): Map<number, string> {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  cachedCatalog = new Map();
  cachedCatalogInfo = {
    version: null,
    source: null,
    spellCount: 0,
    byClass: null
  };

  for (const candidate of getCatalogCandidates()) {
    try {
      const loaded = candidate.loader(candidate.path);
      mergeCatalogEntries(cachedCatalog, loaded);
      mergeCatalogMetadata(cachedCatalogInfo, loaded);
      if (!cachedCatalogInfo.source) {
        cachedCatalogInfo.source = candidate.label;
        cachedCatalogInfo.version = loaded.version || null;
      }
    } catch (error) {
      if (candidate.required) {
        throw error;
      }
    }
  }

  cachedCatalogInfo.spellCount = cachedCatalog.size;
  rebuildSpellSearchIndexes();
  return cachedCatalog;
}

function rebuildSpellSearchIndexes() {
  cachedAllSpells = [...(cachedCatalog as Map<number, string>).entries()]
    .map(([id, name]) => ({ id: Number(id), name }))
    .sort((left, right) => left.name.localeCompare(right.name));

  cachedByClass = new Map();
  if (!cachedCatalogInfo?.byClass) {
    return;
  }

  for (const [classKey, spells] of Object.entries(cachedCatalogInfo.byClass)) {
    const entries = Object.entries(spells)
      .map(([id, name]) => ({ id: Number(id), name: String(name) }))
      .sort((left, right) => left.name.localeCompare(right.name));
    cachedByClass.set(classKey, entries);
  }
}

function getCatalogCandidates(): Array<{ label: string; path: string; loader: (p: string) => any; required?: boolean }> {
  const candidates: Array<{ label: string; path: string; loader: (p: string) => any; required?: boolean }> = [];

  if (process.env.SPELL_CATALOG_JSON) {
    candidates.push({
      label: process.env.SPELL_CATALOG_JSON,
      path: path.resolve(process.env.SPELL_CATALOG_JSON),
      loader: loadJsonCatalogFile
    });
  }

  if (fs.existsSync(BUNDLED_JSON_PATH)) {
    candidates.push({
      label: "bundled spell-catalog.json",
      path: BUNDLED_JSON_PATH,
      loader: loadJsonCatalogFile
    });
  }

  if (process.env.SPELL_CATALOG_PATH) {
    candidates.push({
      label: process.env.SPELL_CATALOG_PATH,
      path: path.resolve(process.env.SPELL_CATALOG_PATH),
      loader: loadLuaCatalogFile
    });
  }

  if (fs.existsSync(BUNDLED_LUA_PATH)) {
    candidates.push({
      label: "bundled CrossClassSpellCatalog.lua",
      path: BUNDLED_LUA_PATH,
      loader: loadLuaCatalogFile
    });
  }

  if (process.env.GRIP_EMS_ADDON_DIR) {
    candidates.push({
      label: "GRIP_EMS_ADDON_DIR catalog",
      path: path.join(path.resolve(process.env.GRIP_EMS_ADDON_DIR), ADDON_CATALOG_RELATIVE_PATH),
      loader: loadLuaCatalogFile
    });
  }

  return candidates;
}

function loadJsonCatalogFile(filePath: string) {
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const spells = new Map<number, string>();

  for (const [spellId, spellName] of Object.entries(payload.spells || {})) {
    spells.set(Number(spellId), String(spellName));
  }

  return {
    version: payload.version || null,
    spells,
    byClass: payload.byClass || null
  };
}

function loadLuaCatalogFile(filePath: string) {
  const { parseLuaCatalog } = require("./scripts/parseSpellCatalogLua");
  const parsed = parseLuaCatalog(fs.readFileSync(filePath, "utf8"));
  const spells = new Map<number, string>();

  for (const [spellId, spellName] of Object.entries(parsed.spells || {})) {
    spells.set(Number(spellId), String(spellName));
  }

  return {
    version: parsed.version || null,
    spells,
    byClass: parsed.byClass || null
  };
}

function mergeCatalogEntries(target: Map<number, string>, source: any) {
  for (const [spellId, spellName] of source.spells || source) {
    if (!target.has(spellId)) {
      target.set(spellId, spellName);
    }
  }
}

function mergeCatalogMetadata(targetInfo: CatalogInfo, source: any) {
  if (source.byClass && !targetInfo.byClass) {
    targetInfo.byClass = source.byClass;
  }
}

function loadNameIndex(): Map<string, number> {
  if (cachedNameIndex) {
    return cachedNameIndex;
  }

  cachedNameIndex = new Map();
  for (const [spellId, spellName] of loadSpellCatalog()) {
    cachedNameIndex.set(spellName.toLowerCase(), spellId);
  }

  return cachedNameIndex;
}

function unescapeLuaString(value: string): string {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

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
};
