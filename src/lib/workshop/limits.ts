// src/lib/workshop/limits.ts
//
// The bounds that stop a decode or a build from being turned into a denial of
// service. One module, because the same two numbers have to hold at eight
// separate zlib call sites and four separate decoder entry points, and a
// constant copied eight times is a constant that will disagree with itself.
//
// WHAT WAS UNBOUNDED BEFORE THIS FILE, all of it reachable unauthenticated at
// /api/workshop/decode, /api/decode-grip and /api/workshop/import:
//
//   * No inflate call passed maxOutputLength, so Node's default applied, which
//     is buffer.kMaxLength -- gigabytes, far above any serverless memory
//     ceiling. Measured on this repo's own toolchain: 4 MiB of zeros deflates
//     to 4,080 bytes, a ratio of about 1028 to 1. A few hundred kilobytes of
//     crafted input therefore inflates toward hundreds of megabytes.
//
//   * exportDecode.ts caps pasted text at 20,000 characters and 500 lines, but
//     that cap sits inside decodePlainMacroText, which is the NO-PREFIX
//     fallback branch. Prefixing a payload with !EMS1! routes around it
//     entirely.
//
//   * The worst reach is second-order and not a route at all. The same decoder
//     runs server-side over STORED grip_string values in
//     notify-discord/route.ts and admin/sequence-thread/route.ts, so one
//     malicious stored sequence is a bomb that detonates on every publish
//     notification.
//
// WHERE THESE NUMBERS COME FROM, and what they are not. They are derived
// bounds, not measurements of the live corpus -- a service-role or direct
// database read would be needed to measure the largest real grip_string, and
// neither was available when this landed. They are therefore deliberately
// generous: the failure mode of a cap set too low is a legitimate import
// breaking, which is worse than a cap set loosely but finitely. Both can be
// tightened once the corpus is measured, and the tests assert against these
// constants rather than against literals so that tightening them is a one-line
// change.

// 1 MiB of encoded text. This bounds the work done before anything is
// allocated, which is the only cap that acts before the decompressor runs.
//
// IT IS DELIBERATELY LOOSE, AND THE REASON IS A COUPLING THAT IS EASY TO MISS.
// /api/workshop/build:28 calls decodeEMSExport on the builder's OWN OUTPUT, so
// this ceiling is not only a bound on what a caller may paste -- it is also a
// bound on what a legitimate build may produce. Measured on the uncapped
// builder, a five-deep loop nest at repeat 50 emits an export of 364,487
// characters, and that shape is refused by the step budget rather than by this
// number. A build that stays inside MAX_BUILD_STEPS with 5,000 distinct macro
// lines lands in the low hundreds of kilobytes, which is why a ceiling of
// 256 KiB was raised to 1 MiB before it shipped: a cap that turns a successful
// build into a 422 on its own decode step would be a regression wearing a
// security label.
//
// Almost nothing is given up by the loosening. At the measured 1028:1 ratio,
// even a 256 KiB ceiling still permits a nine-figure inflated output, so this
// number was never what stopped a bomb. MAX_INFLATED_BYTES is.
export const MAX_ENCODED_EXPORT_CHARS = 1_048_576;

// 16 MiB of inflated output. This is the cap that actually stops a bomb, since
// at the measured 1028:1 ratio the encoded ceiling above still permits a
// nine-figure output on its own. 16 MiB is roughly 1.5% of a 1 GB serverless
// instance, so it cannot exhaust one, and it is three orders of magnitude above
// any real export.
//
// The limit is INCLUSIVE, measured rather than assumed: an output of exactly
// maxOutputLength bytes succeeds and one byte more throws.
export const MAX_INFLATED_BYTES = 16 * 1024 * 1024;

// Nesting depth for the builder's action tree. gseDecoder's unwrapCborValue and
// its action normalizer already stop at 8, so this is the codebase's own
// existing number rather than a new opinion. A macro nested eight loops deep is
// not a macro anyone wrote by hand.
export const MAX_BUILD_DEPTH = 8;

// Total flattened steps a single build may emit. The site's longest published
// sequences run 30 to 32 steps, which exportDecode.ts:8-13 already records, so
// 5,000 is well over two orders of magnitude of headroom.
//
// This is the cap that defeats the multiplication, and it has to be checked on
// every push rather than at the end: clampLoopRepeat bounds ONE loop at 50, but
// walk() recursed into child loops without a depth counter, so five nested
// loops at repeat 50 is 50^5 = 312,500,000 pushes from a request body under 400
// bytes, and six levels is 15.6 billion. Checked per push, that becomes 5,000
// pushes and a 422.
export const MAX_BUILD_STEPS = 5_000;

// Node signals an exceeded maxOutputLength with a RangeError carrying
// ERR_BUFFER_TOO_LARGE and the message "Cannot create a Buffer larger than N
// bytes". Measured, not assumed, across inflateRawSync, inflateSync and
// unzipSync.
//
// This predicate exists so the catch blocks around the inflate calls can tell a
// REFUSED payload from a CORRUPT one. Without it every decoder's catch reports
// its generic "could not be inflated" message, and a bomb becomes
// indistinguishable from a truncated paste -- which is safe, but it means
// nothing can prove the cap is what stopped it, in a log or in a test.
export function isOutputLimitError(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && (error as { code?: unknown }).code === "ERR_BUFFER_TOO_LARGE"
  );
}

export const EXPORT_TOO_LARGE_MESSAGE =
  "That export is too large to decode. It exceeds the size limit for an import payload.";

// Throws on an encoded payload over the ceiling. Called by each decoder entry
// point AFTER it has cleaned the input, because the cleaning collapses
// whitespace and a caller padding a payload with megabytes of spaces should be
// measured on what is left rather than on what was sent.
export function assertEncodedExportWithinLimit(cleaned: string): void {
  if (cleaned.length > MAX_ENCODED_EXPORT_CHARS) {
    throw new Error(EXPORT_TOO_LARGE_MESSAGE);
  }
}

// The options object every inflate call in this directory passes. A named
// export rather than an inline literal so that grepping for the cap finds all
// eight call sites, and so a new call site added later is one import away from
// being correct.
export const INFLATE_LIMITS = { maxOutputLength: MAX_INFLATED_BYTES } as const;
