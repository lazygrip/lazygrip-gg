import { beforeAll, describe, expect, it, vi } from "vitest";

// authorLock.ts refuses to load without its signing secret, so the secret is set before
// the workshop modules are imported. This is a test value, not the site's secret.
vi.stubEnv("LAZYGRIP_AUTHOR_LOCK_SECRET", "test-secret-for-convert-gse");

type Mods = {
  convert: typeof import("./convertGse");
  idx: typeof import("./index");
  gse: typeof import("./gseDecoder");
};
let m: Mods;

beforeAll(async () => {
  m = {
    convert: await import("./convertGse"),
    idx: await import("./index"),
    gse: await import("./gseDecoder"),
  };
});

function gseString(author: string | undefined) {
  return m.gse.encodeGSEExport({
    Sequences: {
      TestSeq: {
        MetaData: { Name: "TestSeq", ...(author ? { Author: author } : {}), Help: "help", ClassID: 11, SpecID: 104, Default: 1 },
        Versions: {
          "1": { Actions: ["/cast Mangle", "/cast Thrash", "/cast Ironfur"], StepFunction: "Sequential", KeyPress: "/startattack" },
        },
      },
    },
  });
}

describe("convertGseToEms", () => {
  it("carries the source author into the converted export", () => {
    const report = m.convert.convertGseToEms(gseString("Someone-Realm"));
    expect(report.source).toBe("GSE3");
    expect(report.author).toBe("Someone-Realm");
    expect(report.export.startsWith("!GRIP1!")).toBe(true);
    expect(report.sequences).toHaveLength(1);
    expect(report.sequences[0]).toMatchObject({ name: "TestSeq", className: "Druid", specName: "Guardian", stepCount: 3 });

    const decoded: any = m.idx.decodeEMSExport(report.export);
    expect(decoded.meta.envelope.exportedBy.name).toBe("Someone-Realm");
  });

  it("keeps the author when the converted export is imported again", () => {
    const report = m.convert.convertGseToEms(gseString("Someone-Realm"));
    const again: any = m.idx.importToBuilderModel(report.export);
    expect(again.model.exportMeta.author).toBe("Someone-Realm");
    expect(again.model.exportMeta.authorLocked).toBe(true);
  });

  it("will not let the author be stripped or replaced on a converted export", () => {
    const report = m.convert.convertGseToEms(gseString("Someone-Realm"));
    const again: any = m.idx.importToBuilderModel(report.export);
    m.idx.attachAuthorLockToken(again.model);
    again.model.exportMeta.author = "Somebody Else";
    again.model.exportMeta.originalAuthor = "";
    again.model.exportMeta.authorLocked = false;
    delete again.model.exportMeta.lockedAuthor;
    m.idx.enforceAuthorLock(again.model);
    expect(again.model.exportMeta.author).toBe("Someone-Realm");
    expect(again.model.exportMeta.authorLocked).toBe(true);
  });

  it("reports a source with no author instead of inventing one", () => {
    const report = m.convert.convertGseToEms(gseString(undefined));
    expect(report.author).toBeNull();
    expect(report.warnings[0]).toMatch(/does not name an author/i);
    const decoded: any = m.idx.decodeEMSExport(report.export);
    expect(decoded.meta.envelope.exportedBy).toBeNull();
  });

  it("says plainly when the input is already a GRIP-EMS export", () => {
    const report = m.convert.convertGseToEms(gseString("Someone-Realm"));
    expect(() => m.convert.convertGseToEms(report.export)).toThrow(/already a GRIP-EMS export/);
  });

  it("rejects empty input and text that is not an export", () => {
    expect(() => m.convert.convertGseToEms("")).toThrow(m.convert.ConvertInputError);
    expect(() => m.convert.convertGseToEms("/cast Mangle")).toThrow(/does not look like a GSE export/);
  });

  it("keeps refusing encrypted GSE sequences", () => {
    expect(() => m.convert.convertGseToEms("!GSE3!+AAAA")).toThrow(/encrypted GSE sequence/);
  });
});
