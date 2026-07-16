const CONTEXT_GROUPS = [
  { name: "Raids", keys: ["Raid", "RaidLFR", "RaidHeroic", "RaidMythic"] },
  {
    name: "Dungeons",
    keys: [
      "Dungeon",
      "Heroic",
      "Mythic",
      "MythicPlus",
      "MythicPlusLow",
      "MythicPlusMid",
      "MythicPlusHigh"
    ]
  },
  {
    name: "PvP",
    keys: ["Arena", "RatedArena", "SoloShuffle", "PVP", "RatedBG", "BattlegroundBlitz"]
  },
  {
    name: "Arena Maps",
    keys: [
      "Arena_BladesEdge",
      "Arena_Nagrand",
      "Arena_Lordaeron",
      "Arena_Dalaran",
      "Arena_TigersPeak",
      "Arena_TolViron",
      "Arena_BlackRook",
      "Arena_Ashamane",
      "Arena_HookPoint",
      "Arena_Mugambala",
      "Arena_Empyrean",
      "Arena_Enigma",
      "Arena_Nokhudon",
      "Arena_Maldraxxus",
      "Arena_Robodrome"
    ]
  },
  {
    name: "Battleground Maps",
    keys: [
      "BG_AlteracValley",
      "BG_WarsongGulch",
      "BG_ArathiBasin",
      "BG_EyeOfTheStorm",
      "BG_IsleOfConquest",
      "BG_TwinPeaks",
      "BG_Gilneas",
      "BG_TempleOfKotmogu",
      "BG_DeepwindGorge",
      "BG_Ashran",
      "BG_SilvershardMines",
      "BG_SeethingShore",
      "BG_Wintergrasp"
    ]
  },
  {
    name: "Other",
    keys: [
      "Timewalking",
      "TimewalkingRaid",
      "Delves",
      "DelvesLow",
      "DelvesHigh",
      "Party",
      "Solo",
      "Scenario"
    ]
  }
];

const CONTEXT_LABELS: Record<string, string> = {
  Raid: "Raid",
  RaidLFR: "Raid: LFR",
  RaidHeroic: "Raid: Heroic",
  RaidMythic: "Raid: Mythic",
  Arena: "Arena",
  RatedArena: "Rated Arena",
  SoloShuffle: "Solo Shuffle",
  PVP: "Battleground",
  RatedBG: "Rated Battleground",
  BattlegroundBlitz: "BG Blitz",
  MythicPlus: "Mythic+",
  MythicPlusLow: "Mythic+ (Low Key)",
  MythicPlusMid: "Mythic+ (Mid Key)",
  MythicPlusHigh: "Mythic+ (High Key)",
  Mythic: "Mythic Dungeon",
  Heroic: "Heroic Dungeon",
  Dungeon: "Normal Dungeon",
  Timewalking: "Timewalking",
  TimewalkingRaid: "Timewalking Raid",
  Delves: "Delves",
  DelvesLow: "Delves (Low Tier)",
  DelvesHigh: "Delves (High Tier)",
  Party: "Party (World)",
  Solo: "Solo (World)",
  Scenario: "Scenario",
  Arena_BladesEdge: "Blade's Edge Arena",
  Arena_Nagrand: "Nagrand Arena",
  Arena_Lordaeron: "Ruins of Lordaeron",
  Arena_Dalaran: "Dalaran Sewers",
  Arena_TigersPeak: "Tiger's Peak",
  Arena_TolViron: "Tol'Viron Arena",
  Arena_BlackRook: "Black Rook Hold Arena",
  Arena_Ashamane: "Ashamane's Fall",
  Arena_HookPoint: "Hook Point",
  Arena_Mugambala: "Mugambala",
  Arena_Empyrean: "Empyrean Domain",
  Arena_Enigma: "Enigma Crucible",
  Arena_Nokhudon: "Nokhudon Proving Grounds",
  Arena_Maldraxxus: "Maldraxxus Coliseum",
  Arena_Robodrome: "The Robodrome",
  BG_AlteracValley: "Alterac Valley",
  BG_WarsongGulch: "Warsong Gulch",
  BG_ArathiBasin: "Arathi Basin",
  BG_EyeOfTheStorm: "Eye of the Storm",
  BG_IsleOfConquest: "Isle of Conquest",
  BG_TwinPeaks: "Twin Peaks",
  BG_Gilneas: "Battle for Gilneas",
  BG_TempleOfKotmogu: "Temple of Kotmogu",
  BG_DeepwindGorge: "Deepwind Gorge",
  BG_Ashran: "Ashran",
  BG_SilvershardMines: "Silvershard Mines",
  BG_SeethingShore: "Seething Shore",
  BG_Wintergrasp: "Wintergrasp"
};

const CONTEXT_KEYS = new Set(CONTEXT_GROUPS.flatMap(group => group.keys));

function normalizeContextOverrides(raw: unknown, versionCount = 50): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const maxVersion = Math.max(1, Math.min(50, Math.floor(Number(versionCount) || 50)));
  const normalized: Record<string, number> = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!CONTEXT_KEYS.has(key)) {
      continue;
    }

    const versionIndex = Math.floor(Number(value));
    if (versionIndex >= 1 && versionIndex <= maxVersion) {
      normalized[key] = versionIndex;
    }
  }

  return normalized;
}

function exportContextOverrides(contextOverrides: unknown, versionCount?: number): Record<string, number> | null {
  const normalized = normalizeContextOverrides(contextOverrides, versionCount);
  return Object.keys(normalized).length ? normalized : null;
}

function adjustContextOverridesAfterVersionDelete(
  contextOverrides: Record<string, number> | null | undefined,
  deletedIndex: number
): Record<string, number> {
  const deleted = Math.floor(Number(deletedIndex));
  if (!deleted || deleted < 1) {
    return { ...(contextOverrides || {}) };
  }

  const adjusted: Record<string, number> = {};

  for (const [key, value] of Object.entries(contextOverrides || {})) {
    const versionIndex = Math.floor(Number(value));
    if (versionIndex === deleted) {
      continue;
    }
    if (versionIndex > deleted) {
      adjusted[key] = versionIndex - 1;
    } else if (versionIndex >= 1) {
      adjusted[key] = versionIndex;
    }
  }

  return adjusted;
}

function summarizeContextOverrides(
  contextOverrides: unknown,
  versions: Array<{ name?: string }> = []
): string {
  const normalized = normalizeContextOverrides(contextOverrides, versions.length || 50);
  const entries = Object.entries(normalized);
  if (!entries.length) {
    return "";
  }

  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, versionIndex]) => {
      const version = versions[versionIndex - 1];
      const versionLabel = version?.name || `Version ${versionIndex}`;
      return `${CONTEXT_LABELS[key] || key} → ${versionLabel}`;
    })
    .join(", ");
}

export {
  CONTEXT_GROUPS,
  CONTEXT_LABELS,
  CONTEXT_KEYS,
  normalizeContextOverrides,
  exportContextOverrides,
  adjustContextOverridesAfterVersionDelete,
  summarizeContextOverrides
};
