import { detectExportFormat, FORMAT_ERRORS } from "./serialization";
import { decodeEMSExport } from "./emsDecoder";
import { decodeGSEExport } from "./gseDecoder";
import { decodeForgeForInspect } from "./forgeImport";
import { decodeCvarProfileExport } from "./cvarProfileDecoder";
import type { DecodeResult } from "./types";

// Mirrors the ceiling gripImport.ts's importPlainMacro implicitly relies on
// via the site's real sequences (the longest published loops run 30-32
// steps) -- generous headroom for a real macro, but bounded, since this path
// (unlike every other branch below) has no compression/CBOR envelope to
// naturally cap the size of what a caller can paste in.
const PLAIN_TEXT_MAX_LINES = 500;
const PLAIN_TEXT_MAX_CHARS = 20_000;

// No recognized envelope prefix -- treat the paste as bare macro lines, one
// step per line. Mirrors gripImport.ts's importPlainMacro fallback so the
// inspect view and the builder accept the same range of input, just fanned
// out into DecodeResult's flat-steps shape (no accompanying `actions` tree,
// same as any other format's flat fallback) rather than a builder model.
function decodePlainMacroText(input: unknown): DecodeResult {
  const raw = String(input || "");
  if (raw.length > PLAIN_TEXT_MAX_CHARS) {
    throw new Error(`That's too much text to decode at once (max ${PLAIN_TEXT_MAX_CHARS.toLocaleString()} characters).`);
  }

  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error(FORMAT_ERRORS.UNKNOWN);
  }
  if (lines.length > PLAIN_TEXT_MAX_LINES) {
    throw new Error(`That's too many lines to decode at once (max ${PLAIN_TEXT_MAX_LINES}).`);
  }

  return {
    meta: { format: "Plain text", version: null, exportMeta: {} },
    sequences: [{
      name: "Pasted macro",
      description: "",
      class: "",
      classId: null,
      spec: "",
      specId: null,
      defaultVersion: 1,
      metaData: {},
      versions: [{
        index: 1,
        name: "Default",
        stepFunction: "Sequential",
        keyPress: "",
        keyRelease: "",
        steps: lines.map((text, i) => ({ number: i + 1, text })),
      }],
      steps: lines.map((text, i) => ({ number: i + 1, text })),
    }],
  };
}

// Route any supported export prefix to the correct decoder for the inspect view.
// Anything without a recognized prefix falls through to decodePlainMacroText
// rather than an outright rejection, so the inspect view accepts the same
// bare-macro-line input the builder's import already does.
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
      return decodePlainMacroText(code);
  }
}
