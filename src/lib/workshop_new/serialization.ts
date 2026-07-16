import zlib from "node:zlib";
import { CborReader } from "./emsDecoder";
import type { ExportFormat } from "./types";

// Prefix constants matching GRIP-EMS Data/Defaults.lua + Import/Serialization.lua.
export const PREFIXES: Record<ExportFormat, string> = {
  EMS1: "!EMS1!",
  GSE3_ENCRYPTED: "!GSE3!+",
  GSE3: "!GSE3!",
  GRIP1: "!GRIP1!",
  FRG1: "!FRG1!",
  GEMSCP1: "!GEMSCP1!"
};

// Detection order must match Serialization.DetectFormat (longest/specific first).
const DETECT_ORDER: ExportFormat[] = [
  "EMS1",
  "GSE3_ENCRYPTED",
  "GSE3",
  "GRIP1",
  "FRG1",
  "GEMSCP1"
];

export const FORMAT_ERRORS = {
  GSE3_ENCRYPTED:
    "This is an encrypted GSE sequence and cannot be imported. The source sequencer "
    + "locks protected and subscriber-only content so other tools cannot read it. "
    + "Plain !GSE3! legacy sequences still import normally.",
  GEMSCP1_MACRO:
    "This is a GRIP CVar profile export (!GEMSCP1!), not a macro sequence. "
    + "Import it in-game via GRIP-EMS Settings → CVar Profiles.",
  UNKNOWN:
    "Unknown export format. Expected !EMS1!, !GRIP1!, !GSE3!, !FRG1!, or !GEMSCP1!."
} as const;

export function cleanExportCode(code: unknown): string {
  return String(code || "").trim().replace(/\s+/g, "");
}

export function detectExportFormat(code: unknown): ExportFormat | null {
  const cleaned = cleanExportCode(code);
  if (!cleaned) {
    return null;
  }

  for (const name of DETECT_ORDER) {
    const prefix = PREFIXES[name];
    if (
      cleaned.length >= prefix.length
      && cleaned.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase()
    ) {
      return name;
    }
  }

  return null;
}

export function getPrefixLength(format: ExportFormat): number {
  switch (format) {
    case "EMS1":
      return PREFIXES.EMS1.length;
    case "GSE3":
    case "GSE3_ENCRYPTED":
      return PREFIXES.GSE3.length;
    case "GRIP1":
      return PREFIXES.GRIP1.length;
    case "FRG1":
      return PREFIXES.FRG1.length;
    case "GEMSCP1":
      return PREFIXES.GEMSCP1.length;
    default:
      throw new Error(`Unknown export format: ${format as string}`);
  }
}

export function inflateCompressedPayload(compressed: Buffer): Buffer {
  const attempts = [
    () => zlib.inflateRawSync(compressed),
    () => zlib.inflateSync(compressed),
    () => zlib.unzipSync(compressed)
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return attempt();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

// Strip a known prefix, base64-decode, inflate, and CBOR-decode.
export function decodeCborExport(input: unknown, format?: ExportFormat): unknown {
  const cleaned = cleanExportCode(input);
  const detected = format || detectExportFormat(cleaned);

  if (!detected) {
    throw new Error(FORMAT_ERRORS.UNKNOWN);
  }

  if (detected === "GSE3_ENCRYPTED") {
    throw new Error(FORMAT_ERRORS.GSE3_ENCRYPTED);
  }

  const prefixLen = getPrefixLength(detected);
  const payload = cleaned.slice(prefixLen);
  const compressed = Buffer.from(payload, "base64");

  if (!compressed.length) {
    throw new Error("The export payload is empty or not valid Base64.");
  }

  let inflated: Buffer;
  try {
    inflated = inflateCompressedPayload(compressed);
  } catch (error) {
    throw new Error(`The ${detected} export payload could not be inflated.`);
  }

  try {
    return new CborReader(inflated).decode();
  } catch (error) {
    throw new Error(`The ${detected} export payload is not valid CBOR data.`);
  }
}

export function isExportFormat(code: unknown, format: ExportFormat): boolean {
  return detectExportFormat(code) === format;
}
