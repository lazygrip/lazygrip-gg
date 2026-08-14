// The one place the browser asks the site to post a sequence card to Discord.
//
// WHY THIS IS A MODULE AND NOT SEVEN LINES INSIDE A PAGE. It lived inside
// src/app/post/page.tsx and was fine there for exactly as long as that page was
// the only thing that could change a published sequence. It is not, and finding
// out which the hard way is what this file exists to stop happening again.
//
// THREE PAGES CAN CHANGE WHAT A PUBLISHED SEQUENCE CONTAINS:
//
//   /post?edit=<id>            the versioned branch, which called this
//   /post?edit=<id>            the minor-edit branch, which did NOT until
//                              2026-08-14; nine live rows went through it in
//                              two days with no card and a null
//                              last_discord_notified_at
//   /sequences/<slug>/update   publish_sequence_version, a whole new version
//                              with an author-chosen label, which did NOT
//
// The third is how 1207-mfdoom-fury-warrior-mqpmd9gx published version v2.0 on
// 2026-08-14 at 00:55:31Z and reached the forum with nothing at all. That case
// was investigated for a day as a failure of the Discord route, on the
// reasonable assumption that a versioned publish must have called it. Nothing
// called it. Its version row is the tell and is worth recording: version_number
// 2 carrying the label "v2.0", where update_sequence_with_version would have
// written "1.1", because that function builds its label as
// '1.' || (version_number - 1) and this page takes the label from a form field.
//
// The precedent for the extraction is src/lib/public-name.ts and
// src/lib/discord-embed.ts, both pulled out of notify-discord's route the day a
// second caller arrived for the same decision. A copied fetch drifts the first
// time somebody adds a header, a retry or a field in one file and not the
// other, and here the drift would be silent in the worst way: the site would
// keep working and the forum would quietly stop hearing about one kind of
// change.
//
// FIRE AND FORGET, DELIBERATELY, and every caller depends on it. The publish
// or the RPC has already committed by the time this runs, so a Discord outage
// must not surface as a failed save. The route it calls answers immediately and
// does the slow half in after(); the .catch here only stops an unhandled
// rejection reaching the console on a network failure.
//
// keepalive is what lets the request survive the navigation that follows it.
// Every call site is immediately followed by a router.push, and without this a
// browser is entitled to cancel an in-flight fetch when the page goes away.
export function notifyDiscord(payload: Record<string, unknown>) {
  fetch('/api/notify-discord', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify(payload),
  }).catch(err => console.error('[notify-discord] fetch failed:', err))
}
