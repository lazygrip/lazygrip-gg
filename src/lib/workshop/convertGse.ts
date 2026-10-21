// Turns a pasted GSE export into a GRIP-EMS export, with a report of what happened.
//
// This is a thin layer over the import path the builder already uses (decode the
// GSE data, map its blocks to GRIP actions, lock the author), so the Convert page,
// the builder and the decoder all read GSE strings the same way. What this file adds
// is the report: who the sequence belongs to, what came across, and what to check.
//
// ATTRIBUTION IS NOT OPTIONAL HERE. The author named in the source string is carried
// into the converted export and locked to it through the same signed author lock the
// builder enforces, so converting never hands a sequence to whoever pasted it. A source
// with no author is reported as such and is never given one. Encrypted or protected
// GSE strings are refused by the decoder and stay refused.
import { detectExportFormat } from "./serialization";
import {
  importToBuilderModel,
  attachAuthorLockToken,
  enforceAuthorLock,
  buildGripFromModel,
  decodeEMSExport
} from "./index";

export interface ConvertedSequenceSummary {
  name: string;
  className: string;
  specName: string;
  versionCount: number;
  stepCount: number;
}

export interface ConvertReport {
  /** The converted !GRIP1! export, ready to paste into GRIP-EMS with /gems import. */
  export: string;
  /** What the pasted string was: GSE3 or FRG1 (a GRIP Forge export of GSE sequences). */
  source: "GSE3" | "FRG1";
  sequences: ConvertedSequenceSummary[];
  /** The author named in the source string, or null when the source names none. */
  author: string | null;
  /** Plain-language notes from the conversion that the person should read. */
  warnings: string[];
}

type Loose = Record<string, any>;

export class ConvertInputError extends Error {}

export function convertGseToEms(input: unknown): ConvertReport {
  const code = String(input || "").trim();
  if (!code) {
    throw new ConvertInputError("Paste a GSE export first.");
  }

  const format = detectExportFormat(code);
  if (format === "EMS1" || format === "GRIP1") {
    throw new ConvertInputError(
      "That is already a GRIP-EMS export, so there is nothing to convert. You can paste it into GRIP-EMS with /gems import, or open it in the Decode tool to look inside."
    );
  }
  if (format === "GSE3_ENCRYPTED") {
    // Falls through to the decoder, whose own message explains why these are refused.
    importToBuilderModel(code);
  }
  if (format !== "GSE3" && format !== "FRG1") {
    throw new ConvertInputError(
      "That does not look like a GSE export. A GSE export starts with !GSE3!. If it is plain macro text, the builder can import it."
    );
  }

  // importToBuilderModel throws the decoder's own plain-language errors, including the
  // refusal for encrypted GSE sequences, and those pass straight through.
  const imported = importToBuilderModel(code) as Loose;
  const model = imported.model as Loose;
  attachAuthorLockToken(model);
  enforceAuthorLock(model);

  const built = buildGripFromModel(model as any) as Loose;
  const decoded = decodeEMSExport(built.export) as Loose;

  const author = String(model.exportMeta?.author || "").trim() || null;

  const sequences: ConvertedSequenceSummary[] = (decoded.sequences || []).map((seq: Loose) => {
    const versions: Loose[] = Array.isArray(seq.versions) ? seq.versions : [];
    const stepCount = versions.reduce((total, v) => {
      const count = Array.isArray(v.steps) ? v.steps.length : Array.isArray(v.actions) ? v.actions.length : 0;
      return total + count;
    }, 0);
    return {
      name: String(seq.name || "Untitled"),
      className: String(seq.class || ""),
      specName: String(seq.spec || ""),
      versionCount: versions.length,
      stepCount
    };
  });

  const warnings: string[] = [...(imported.warnings || []), ...(built.warnings || [])].map(String);
  if (!author) {
    warnings.unshift(
      "The source string does not name an author, so the converted sequence has none either. If you know who wrote it, credit them when you share it."
    );
  }

  return {
    export: String(built.export),
    source: format,
    sequences,
    author,
    warnings
  };
}
