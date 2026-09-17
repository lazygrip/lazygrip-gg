import zlib from "node:zlib";
import { CborReader } from "./emsDecoder";
import type { ExportFormat } from "./types";
import {
  assertEncodedExportWithinLimit,
  EXPORT_TOO_LARGE_MESSAGE,
  INFLATE_LIMITS,
  isOutputLimitError
} from "./limits";

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
  LEGACY_IMPORT_UNAVAILABLE:
    "Importing legacy program exports into the builder isn't available right now. "
    + "You can still use Decode to view a legacy program export's loops and steps.",
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
  // All three attempts carry the output cap, not just the first. A cap on
  // inflateRawSync alone is bypassed by any payload that fails raw inflation
  // and succeeds as a zlib or gzip stream, which is exactly what the fallback
  // chain exists to accept.
  const attempts = [
    () => zlib.inflateRawSync(compressed, INFLATE_LIMITS),
    () => zlib.inflateSync(compressed, INFLATE_LIMITS),
    () => zlib.unzipSync(compressed, INFLATE_LIMITS)
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return attempt();
    } catch (error) {
      // FAIL FAST ON THE CAP, and this is load-bearing rather than an
      // optimisation. Without it, a payload refused by attempt one for being
      // too large goes on to fail attempts two and three for a WRONG HEADER,
      // lastError ends up holding the header error, and the caller reports a
      // corrupt paste instead of a refused one. The cap would still hold and
      // nothing could prove it did. It also stops a bomb being inflated up to
      // the ceiling three times over.
      if (isOutputLimitError(error)) {
        throw new Error(EXPORT_TOO_LARGE_MESSAGE);
      }
      lastError = error;
    }
  }

  throw lastError;
}

// Strip a known prefix, base64-decode, inflate, and CBOR-decode.
export function decodeCborExport(input: unknown, format?: ExportFormat): unknown {
  const cleaned = cleanExportCode(input);

  // Before the format is even resolved. This is the only guard that acts before
  // any allocation, so it goes as early as the cleaned string exists.
  assertEncodedExportWithinLimit(cleaned);

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
    // A refusal for size must not be reported as a corrupt payload. Everything
    // else keeps the message it always had.
    if (error instanceof Error && error.message === EXPORT_TOO_LARGE_MESSAGE) {
      throw error;
    }
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
