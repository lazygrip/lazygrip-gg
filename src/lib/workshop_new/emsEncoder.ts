import zlib from "node:zlib";
import { encodeCbor } from "./cborEncode";
import { CborReader } from "./emsDecoder";

export const EMS_PREFIX = "!EMS1!";
export const GRIP_PREFIX = "!GRIP1!";
export const GRIP_FORMAT_VERSION = 5;

export function encodeEMSExport(payload: unknown, prefix: string = EMS_PREFIX): string {
  const encoded = Buffer.from(encodeCbor(payload as Parameters<typeof encodeCbor>[0]));
  const compressed = zlib.deflateRawSync(encoded);
  return `${prefix}${compressed.toString("base64")}`;
}

export function decodeEMSPayload(exportString: unknown): unknown {
  const cleaned = String(exportString || "").trim().replace(/\s+/g, "");
  const payload = cleaned.replace(/^!(EMS1|GRIP1)!/i, "");
  const inflated = zlib.inflateRawSync(Buffer.from(payload, "base64"));
  return new CborReader(inflated).decode();
}
