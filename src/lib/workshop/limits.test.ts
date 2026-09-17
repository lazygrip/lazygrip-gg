// src/lib/workshop/limits.test.ts
//
// Every test here is a fixture that BITES. Each one was written against the
// uncapped code first and observed to fail, then the cap was added and it was
// observed to pass -- a test that passed before the change would prove nothing
// about the change. The red run is recorded in the pull request that introduced
// this file, naming each failure.
//
// The assertions import the constants from ./limits rather than restating the
// numbers, so tightening a cap once the live corpus has been measured is a
// one-line change in one file and not a hunt through fixtures.

import { describe, expect, it } from "vitest";
import zlib from "node:zlib";

import {
  EXPORT_TOO_LARGE_MESSAGE,
  MAX_BUILD_DEPTH,
  MAX_BUILD_STEPS,
  MAX_ENCODED_EXPORT_CHARS,
  MAX_INFLATED_BYTES,
} from "./limits";
import { inflateCompressedPayload, decodeCborExport } from "./serialization";
import { decodeEMSExport } from "./emsDecoder";
import { decodeGSEExport } from "./gseDecoder";
import { decodeEMSPayload } from "./emsEncoder";
import { buildGripFromModel } from "./gripBuilder";

// A real decompression bomb, not a mock: zeros deflate at roughly 1028 to 1 on
// this toolchain, so a payload that inflates past the cap is a few kilobytes of
// base64. That size matters -- it is what makes this fixture prove the OUTPUT
// cap rather than the encoded-length cap, since it sits far under the latter.
function bombBase64(inflatedBytes: number, mode: "raw" | "zlib" | "gzip" = "raw"): string {
  const source = Buffer.alloc(inflatedBytes, 0);
  const compressed =
    mode === "raw"
      ? zlib.deflateRawSync(source)
      : mode === "zlib"
        ? zlib.deflateSync(source)
        : zlib.gzipSync(source);
  return compressed.toString("base64");
}

const OVER_CAP_BYTES = MAX_INFLATED_BYTES + 1024;

function actionBlock(macro = "/cast Fireball"): Record<string, unknown> {
  return { type: "action", macro };
}

// A loop chain `depth` levels deep with one action at the bottom. repeat is 1
// throughout, so this fixture can only ever produce a single step -- it tests
// DEPTH in isolation and cannot trip the step budget.
function nestedLoops(depth: number, repeat = 1): Record<string, unknown> {
  let node: Record<string, unknown> = actionBlock();
  for (let i = 0; i < depth; i += 1) {
    node = { type: "loop", repeat, children: [node] };
  }
  return node;
}

function modelWithActions(actions: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    sequences: [{ name: "Fixture", versions: [{ actions }] }],
  };
}

describe("inflate output cap (H3)", () => {
  it("refuses a payload that inflates past MAX_INFLATED_BYTES", () => {
    const compressed = Buffer.from(bombBase64(OVER_CAP_BYTES), "base64");
    expect(() => inflateCompressedPayload(compressed)).toThrow();
  });

  it("still inflates a payload that lands exactly on the cap", () => {
    // The limit is inclusive. Measured, not assumed: an output of exactly
    // maxOutputLength bytes succeeds. This is the half that proves the cap does
    // not break legitimate input.
    const compressed = Buffer.from(bombBase64(MAX_INFLATED_BYTES), "base64");
    expect(inflateCompressedPayload(compressed).length).toBe(MAX_INFLATED_BYTES);
  });

  it("caps the zlib and gzip fallbacks, not only inflateRaw", () => {
    // inflateCompressedPayload tries inflateRaw, then inflate, then unzip. A cap
    // on only the first attempt would be silently bypassed by a payload that
    // fails raw inflation and succeeds on one of the other two.
    for (const mode of ["zlib", "gzip"] as const) {
      const compressed = Buffer.from(bombBase64(OVER_CAP_BYTES, mode), "base64");
      expect(() => inflateCompressedPayload(compressed)).toThrow();
    }
  });

  it("refuses a bombed !EMS1! payload at the EMS decoder entry", () => {
    expect(() => decodeEMSExport(`!EMS1!${bombBase64(OVER_CAP_BYTES)}`)).toThrow(
      EXPORT_TOO_LARGE_MESSAGE,
    );
  });

  it("refuses a bombed !GSE3! payload at the GSE decoder entry", () => {
    expect(() => decodeGSEExport(`!GSE3!${bombBase64(OVER_CAP_BYTES)}`)).toThrow(
      EXPORT_TOO_LARGE_MESSAGE,
    );
  });

  it("refuses a bombed !FRG1! payload through decodeCborExport", () => {
    expect(() => decodeCborExport(`!FRG1!${bombBase64(OVER_CAP_BYTES)}`)).toThrow(
      EXPORT_TOO_LARGE_MESSAGE,
    );
  });

  it("refuses a bombed payload through decodeEMSPayload, the site the audit missed", () => {
    // emsEncoder.decodeEMSPayload was not among the call sites the 2026-09-15
    // audit listed, and it is reachable: gripImport.ts calls it three times, and
    // gripImport is what /api/workshop/import runs. Capping its siblings and
    // leaving this one open would have left the class unfixed.
    expect(() => decodeEMSPayload(`!EMS1!${bombBase64(OVER_CAP_BYTES)}`)).toThrow(
      EXPORT_TOO_LARGE_MESSAGE,
    );
  });
});

describe("encoded length cap (H3)", () => {
  // These fixtures are deliberately NOT valid base64 deflate streams. That is
  // the point: if the size refusal arrives for input that would otherwise fail
  // to inflate, the size check demonstrably ran BEFORE the decompressor, which
  // is the only place a cap on input length is worth anything.
  const overLength = "A".repeat(MAX_ENCODED_EXPORT_CHARS + 1);

  it("refuses an over-length !EMS1! string before inflating it", () => {
    expect(() => decodeEMSExport(`!EMS1!${overLength}`)).toThrow(EXPORT_TOO_LARGE_MESSAGE);
  });

  it("refuses an over-length !GSE3! string before inflating it", () => {
    expect(() => decodeGSEExport(`!GSE3!${overLength}`)).toThrow(EXPORT_TOO_LARGE_MESSAGE);
  });

  it("refuses an over-length !FRG1! string before inflating it", () => {
    expect(() => decodeCborExport(`!FRG1!${overLength}`)).toThrow(EXPORT_TOO_LARGE_MESSAGE);
  });

  it("refuses an over-length string through decodeEMSPayload", () => {
    expect(() => decodeEMSPayload(`!EMS1!${overLength}`)).toThrow(EXPORT_TOO_LARGE_MESSAGE);
  });

  it("measures the cleaned string, so whitespace padding cannot inflate the count", () => {
    // cleanExportCode collapses all whitespace, so a caller padding a short
    // payload out with newlines must be judged on what survives cleaning. An
    // implementation that checked the raw input would refuse this.
    const padded = `!EMS1!${"A".repeat(64)}${"\n".repeat(MAX_ENCODED_EXPORT_CHARS)}`;
    expect(() => decodeEMSExport(padded)).toThrow();
    expect(() => decodeEMSExport(padded)).not.toThrow(EXPORT_TOO_LARGE_MESSAGE);
  });

  it("does not refuse a string sitting exactly on the ceiling", () => {
    // Inclusive boundary, same shape as the output cap. This one fails for a
    // different reason -- it is not a valid stream -- and asserting it is NOT
    // the size message is what pins the off-by-one.
    const atCeiling = "A".repeat(MAX_ENCODED_EXPORT_CHARS - "!EMS1!".length);
    expect(() => decodeEMSExport(`!EMS1!${atCeiling}`)).not.toThrow(EXPORT_TOO_LARGE_MESSAGE);
  });
});

describe("builder depth cap (H2)", () => {
  it("refuses a loop nest deeper than MAX_BUILD_DEPTH", () => {
    expect(() => buildGripFromModel(modelWithActions([nestedLoops(MAX_BUILD_DEPTH + 1)]) as never))
      .toThrow(/too deep|nested/i);
  });

  it("still builds a nest that sits exactly on MAX_BUILD_DEPTH", () => {
    // The half that proves the cap is not simply "refuse nesting".
    expect(() => buildGripFromModel(modelWithActions([nestedLoops(MAX_BUILD_DEPTH)]) as never))
      .not.toThrow();
  });

  it("counts if-blocks toward depth as well as loops", () => {
    // Both branches of an if recurse, so a chain of ifs is the same unbounded
    // recursion wearing a different type field.
    let node: Record<string, unknown> = actionBlock();
    for (let i = 0; i < MAX_BUILD_DEPTH + 1; i += 1) {
      node = { type: "if", variable: "= true", then: [node], else: [] };
    }
    expect(() => buildGripFromModel(modelWithActions([node]) as never)).toThrow(/too deep|nested/i);
  });
});

describe("builder total step cap (H2)", () => {
  it("refuses the multiplying nest instead of expanding 50^5 steps", () => {
    // Five loops at repeat 50 with one action inside is 312,500,000 pushes from
    // a request body under 400 bytes. Depth 5 is within MAX_BUILD_DEPTH, so only
    // the step budget can stop this one, which is why the two fixtures are kept
    // separate.
    expect(() => buildGripFromModel(modelWithActions([nestedLoops(5, 50)]) as never))
      .toThrow(/too many steps|step limit/i);
  });

  it("shares one budget across sequences and versions", () => {
    // model.sequences and versions are uncapped arrays, so a per-version budget
    // multiplies right back out. Each version here emits 1,000 steps, which is
    // comfortably under MAX_BUILD_STEPS on its own; six of them are not.
    const version = { actions: [{ type: "loop", repeat: 50, children: Array.from({ length: 20 }, () => actionBlock()) }] };
    const model = {
      sequences: [
        { name: "A", versions: [version, version] },
        { name: "B", versions: [version, version] },
        { name: "C", versions: [version, version] },
      ],
    };
    expect(() => buildGripFromModel(model as never)).toThrow(/too many steps|step limit/i);
  });

  it("still builds a realistic sequence well under the budget", () => {
    // The site's longest published sequences run 30 to 32 steps. If this one
    // ever fails, the cap has been set below the thing it is protecting.
    const actions = Array.from({ length: 32 }, (_unused, i) => actionBlock(`/cast Spell${i + 1}`));
    const result = buildGripFromModel(modelWithActions(actions) as never);
    expect(result.export.startsWith("!GRIP1!")).toBe(true);
    expect(MAX_BUILD_STEPS).toBeGreaterThan(32);
  });
});
