// src/lib/url-safety.test.ts
//
// Fixtures for audit F7.1 (CSS injection through banner_url) and M7 (upload
// extension allowlist). Every case here BITES: each was observed failing
// against the code as it stood on `main` at 36d8174 before the fix, and the
// red run is quoted in the pull request that introduced this file.
//
// THE PAYLOAD. `EXPLOIT_URL` below is not invented for the test. It is the
// exact string PART 7 of the 2026-09-15 audit measured surviving
// `URL.toString()` on this toolchain, re-measured against the live site on
// 2026-09-17 before this file was written:
//
//     new URL(EXPLOIT_URL).toString() === EXPLOIT_URL     // true
//     new URL(EXPLOIT_URL).host === <project>.supabase.co // true
//
// Those two lines ARE the old sanitizeBannerUrl -- it was parseHttps, a host
// equality check, and `.toString()`, nothing else -- so the payload reached
// `background: url(${value})` unchanged and closed the declaration on every
// public profile. `"` percent-encodes and `(`/`)`/`;` do not, which is why the
// old shape was injectable at all and why the fix rejects rather than escapes.
//
// The host in the fixtures has to match NEXT_PUBLIC_SUPABASE_URL, which
// url-safety.ts reads at module load, so it is set before the import below
// rather than hard-coded to the production project.

import { beforeAll, describe, expect, it, vi } from "vitest";

const HOST = "test-project.supabase.co";
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${HOST}`);

type UrlSafety = typeof import("./url-safety");
let mod: UrlSafety;

beforeAll(async () => {
  mod = await import("./url-safety");
});

const UUID = "c2374192-e541-4636-9baf-84fc192cff52";
const BANNER = (key: string) => `https://${HOST}/storage/v1/object/public/banners/${key}`;
const AVATAR = (key: string) => `https://${HOST}/storage/v1/object/public/avatars/${key}`;

// The literal audit payload: a real banner object key with a CSS declaration
// break appended.
const EXPLOIT_URL = BANNER(`${UUID}.png);color:red;x:url(y`);

describe("sanitizeBannerUrl / sanitizeAvatarUrl -- F7.1 and M7", () => {
  it("accepts the shape the upload handler actually mints", () => {
    const real = BANNER(`${UUID}.png`);
    expect(mod.sanitizeBannerUrl(real)).toBe(real);
  });

  it("accepts the ?t= cache-buster the handler appends", () => {
    const busted = BANNER(`${UUID}.png?t=1789434484345`);
    expect(mod.sanitizeBannerUrl(busted)).toBe(busted);
  });

  // Measured on the live corpus 2026-09-17: one avatar key ends `.PNG`. It has
  // to keep rendering, which is why the extension compare is lowercased rather
  // than a literal set membership on the raw suffix.
  it("accepts the one uppercase extension the live corpus carries", () => {
    const upper = AVATAR(`${UUID}.PNG`);
    expect(mod.sanitizeAvatarUrl(upper)).toBe(upper);
  });

  // RED before the fix: the old sanitizer returned this string unchanged,
  // because it checked the host and nothing else.
  it("rejects the audit's CSS-breakout payload", () => {
    expect(mod.sanitizeBannerUrl(EXPLOIT_URL)).toBeNull();
  });

  it.each([
    ["no extension at all", BANNER(UUID)],
    ["a non-image extension", BANNER(`${UUID}.svg`)],
    ["an executable extension", BANNER(`${UUID}.html`)],
    ["a nested path", BANNER(`${UUID}/../avatars/${UUID}.png`)],
    ["a percent-encoded separator", BANNER(`${UUID}%2Fextra.png`)],
    ["a non-uuid key", BANNER("not-a-uuid.png")],
    ["the wrong bucket", AVATAR(`${UUID}.png`)],
    ["a foreign host", `https://evil.example/storage/v1/object/public/banners/${UUID}.png`],
    ["http rather than https", BANNER(`${UUID}.png`).replace("https:", "http:")],
  ])("rejects %s", (_label, value) => {
    expect(mod.sanitizeBannerUrl(value)).toBeNull();
  });

  // The two sanitizers stopped being the same function on 2026-09-17. An
  // avatars/ key must not validate as a banner and vice versa -- if this fails,
  // someone has re-aliased them.
  it("does not treat the two buckets as interchangeable", () => {
    expect(mod.sanitizeBannerUrl(AVATAR(`${UUID}.png`))).toBeNull();
    expect(mod.sanitizeAvatarUrl(BANNER(`${UUID}.png`))).toBeNull();
  });
});

describe("cssUrl -- the second, independent layer", () => {
  it("returns a complete quoted token, never a bare value", () => {
    const real = BANNER(`${UUID}.png`);
    expect(mod.cssUrl(real)).toBe(`url("${real}")`);
  });

  // This is the case that matters: even if the path check above is ever
  // loosened, the payload still cannot reach a stylesheet.
  it("rejects the audit payload on its own, without the path check", () => {
    expect(mod.cssUrl(EXPLOIT_URL)).toBeNull();
  });

  it.each([
    ['a double quote', 'https://x.test/a"b.png'],
    ["a close paren", "https://x.test/a).png"],
    ["an open paren", "https://x.test/a(.png"],
    ["a semicolon", "https://x.test/a;b.png"],
    ["a backslash", "https://x.test/a\\b.png"],
    ["a newline", "https://x.test/a\nb.png"],
    ["a carriage return", "https://x.test/a\rb.png"],
    ["a form feed", "https://x.test/a\fb.png"],
    ["a single quote", "https://x.test/a'b.png"],
  ])("rejects %s", (_label, value) => {
    expect(mod.cssUrl(value)).toBeNull();
  });

  it.each([[null], [undefined], [""], ["   "]])("returns null for %p", (value) => {
    expect(mod.cssUrl(value as string | null | undefined)).toBeNull();
  });
});

describe("allowedUploadExtension -- M7's write half", () => {
  it.each([
    ["banner.png", "image/png", "png"],
    ["BANNER.PNG", "image/png", "png"],
    ["photo.jpeg", "image/jpeg", "jpeg"],
    ["photo.jpg", "image/jpeg", "jpg"],
    ["anim.gif", "image/gif", "gif"],
    ["modern.avif", "image/avif", "avif"],
    ["modern.webp", "image/webp", "webp"],
    ["dots.in.the.name.png", "image/png", "png"],
  ])("accepts %s and lowercases it", (name, type, expected) => {
    expect(mod.allowedUploadExtension(name, type)).toBe(expected);
  });

  it("accepts an allowlisted extension when the browser reports no type", () => {
    expect(mod.allowedUploadExtension("banner.png", "")).toBe("png");
    expect(mod.allowedUploadExtension("banner.png", null)).toBe("png");
  });

  // RED before the fix: `'evil'.split('.').pop()` returns 'evil', so a file
  // with no dot minted the key `<uuid>.evil` rather than being refused.
  it("refuses a file name with no extension", () => {
    expect(mod.allowedUploadExtension("evil", "image/png")).toBeNull();
  });

  it.each([
    ["an SVG", "logo.svg", "image/svg+xml"],
    ["an HTML file", "page.html", "text/html"],
    ["a script", "x.js", "text/javascript"],
    ["a trailing dot", "trailing.", "image/png"],
    ["a dotfile", ".png", "image/png"],
  ])("refuses %s", (_label, name, type) => {
    expect(mod.allowedUploadExtension(name, type)).toBeNull();
  });

  // The rename case. Extension says png, the browser says svg.
  it("refuses a renamed file whose MIME type disagrees with its extension", () => {
    expect(mod.allowedUploadExtension("evil.png", "image/svg+xml")).toBeNull();
    expect(mod.allowedUploadExtension("evil.png", "text/html")).toBeNull();
  });

  it("tolerates a charset parameter on the MIME type", () => {
    expect(mod.allowedUploadExtension("a.png", "image/png; charset=binary")).toBe("png");
  });
});

// The whole point of the pair: what the uploader is allowed to write must be
// exactly what the reader is willing to render. A future change that widens one
// without the other reopens M7 from whichever side was left behind.
describe("the write allowlist and the read allowlist agree", () => {
  it.each(["png", "jpg", "jpeg", "webp", "gif", "avif"])(
    "a %s minted by the upload path validates on the way back out",
    (ext) => {
      const accepted = mod.allowedUploadExtension(`file.${ext}`, null);
      expect(accepted).toBe(ext);
      const url = BANNER(`${UUID}.${accepted}`);
      expect(mod.sanitizeBannerUrl(url)).toBe(url);
      expect(mod.cssUrl(mod.sanitizeBannerUrl(url))).toBe(`url("${url}")`);
    },
  );

  it("refuses svg on both sides", () => {
    expect(mod.allowedUploadExtension("logo.svg", "image/svg+xml")).toBeNull();
    expect(mod.sanitizeBannerUrl(BANNER(`${UUID}.svg`))).toBeNull();
  });
});
