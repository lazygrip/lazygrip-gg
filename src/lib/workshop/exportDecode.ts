import { detectExportFormat, FORMAT_ERRORS } from "./serialization";
import { decodeEMSExport } from "./emsDecoder";
import { decodeGSEExport } from "./gseDecoder";
import { decodeForgeForInspect } from "./forgeImport";
import { decodeCvarProfileExport } from "./cvarProfileDecoder";
import type { DecodeResult } from "./types";

// Route any supported export prefix to the correct decoder for the inspect view.
export function decodeExport(code: unknown): DecodeResult {
  const format = detectExportFormat(code);

  switch (format) {
    case "EMS1":
    case "GRIP1":
      return decodeEMSExport(code);
    case "GSE3":
      return decodeGSEExport(code);
    case "FRG1":
      return decodeForgeForInspect(code);
    case "GEMSCP1":
      return decodeCvarProfileExport(code);
    case "GSE3_ENCRYPTED":
      throw new Error(FORMAT_ERRORS.GSE3_ENCRYPTED);
    default:
      throw new Error(FORMAT_ERRORS.UNKNOWN);
  }
}
