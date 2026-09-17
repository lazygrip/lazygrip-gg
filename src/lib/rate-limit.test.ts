// src/lib/rate-limit.test.ts
//
// getClientIp decides the bucket key for every limiter in this module, so if a
// caller can choose it, there is no rate limit. These cases were run against the
// old leftmost-element implementation first and three of them failed; the red
// run is recorded in the pull request.

import { describe, expect, it } from "vitest";
import { getClientIp } from "./rate-limit";

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://lazygrip.net/api/workshop/decode", { headers });
}

describe("getClientIp", () => {
  it("ignores a spoofed leftmost element and takes the rightmost", () => {
    // The shape a caller sends: their own value, with the real peer appended on
    // the right by the proxy. Reproduced against Supabase in supabase/supabase
    // discussion 34647 as `spoofed,68.65.164.215`.
    expect(getClientIp(reqWith({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("is not defeated by a caller stuffing the chain with many values", () => {
    const stuffed = `${Array.from({ length: 50 }, (_u, i) => `10.0.0.${i}`).join(", ")}, 203.0.113.7`;
    expect(getClientIp(reqWith({ "x-forwarded-for": stuffed }))).toBe("203.0.113.7");
  });

  it("prefers x-vercel-forwarded-for over the chain entirely", () => {
    // A single value written by Vercel's edge. No chain to parse means no chain
    // length to be wrong about.
    expect(getClientIp(reqWith({
      "x-vercel-forwarded-for": "203.0.113.9",
      "x-forwarded-for": "1.2.3.4, 198.51.100.1",
    }))).toBe("203.0.113.9");
  });

  it("returns the single value when the platform overwrites the header", () => {
    // The control that shows the change is never WORSE than what it replaced:
    // where the header holds one value, rightmost and leftmost are the same.
    expect(getClientIp(reqWith({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("trims whitespace around the element it picks", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": "1.2.3.4,   203.0.113.7   " }))).toBe("203.0.113.7");
  });

  it("falls back past a chain whose rightmost element is empty", () => {
    // A trailing comma must not produce an empty bucket key that every caller
    // shares.
    expect(getClientIp(reqWith({
      "x-forwarded-for": "1.2.3.4,",
      "x-real-ip": "203.0.113.5",
    }))).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip, then to a shared unknown bucket", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "203.0.113.5" }))).toBe("203.0.113.5");
    expect(getClientIp(reqWith({}))).toBe("unknown");
  });
});
