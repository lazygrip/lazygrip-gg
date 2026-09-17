import zlib from "node:zlib";
import { encodeCbor } from "./cborEncode";
import { CborReader } from "./emsDecoder";
import {
  assertEncodedExportWithinLimit,
  EXPORT_TOO_LARGE_MESSAGE,
  INFLATE_LIMITS,
  isOutputLimitError
} from "./limits";

export const EMS_PREFIX = "!EMS1!";
export const GRIP_PREFIX = "!GRIP1!";
export const GRIP_FORMAT_VERSION = 5;

export function encodeEMSExport(payload: unknown, prefix: string = EMS_PREFIX): string {
  const encoded = Buffer.from(encodeCbor(payload as Parameters<typeof encodeCbor>[0]));
  const compressed = zlib.deflateRawSync(encoded);
  return `${prefix}${compressed.toString("base64")}`;
}

// THIS FUNCTION WAS NOT ON THE AUDIT'S LIST OF ZLIB CALL SITES, and it is
// reachable: gripImport.ts calls it three times, and gripImport is what
// /api/workshop/import runs. Capping its siblings and leaving this one open
// would have left the class unfixed at the site nobody was looking at.
export function decodeEMSPayload(exportString: unknown): unknown {
  const cleaned = String(exportString || "").trim().replace(/\s+/g, "");
  assertEncodedExportWithinLimit(cleaned);
  const payload = cleaned.replace(/^!(EMS1|GRIP1)!/i, "");
  let inflated: Buffer;
  try {
    inflated = zlib.inflateRawSync(Buffer.from(payload, "base64"), INFLATE_LIMITS);
  } catch (error) {
    if (isOutputLimitError(error)) {
      throw new Error(EXPORT_TOO_LARGE_MESSAGE);
    }
    throw error;
  }
  return new CborReader(inflated).decode();
}
