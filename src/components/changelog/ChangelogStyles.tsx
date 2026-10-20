// Colour carries meaning on every changelog page: one hue per kind of change (added, changed,
// removed, fixed) and one hue per area of the addon. Every tint is mixed from the same variable,
// so a hue reads the same on a chip, a bar segment, a card edge and a table row, in both themes.
const CSS = `
:root {
  --cl-added: #2dd4a0; --cl-changed: #7aa7ff; --cl-removed: #ff7b85; --cl-fixed: #f0b84a; --cl-other: #a9a6c4;
  --cl-a0: #c792ff; --cl-a1: #5fd0e8; --cl-a2: #ff9f5a; --cl-a3: #ff7fb0; --cl-a4: #9be564;
  --cl-a5: #6ea8ff; --cl-a6: #f0d35a; --cl-a7: #ff7b7b; --cl-a8: #5fe0b0; --cl-a9: #a9a6c4;
}
[data-theme="light"] {
  --cl-added: #0f7a5a; --cl-changed: #2f58c8; --cl-removed: #c0303d; --cl-fixed: #8f6200; --cl-other: #5a5a55;
  --cl-a0: #7a3fd0; --cl-a1: #0b7f96; --cl-a2: #b9560f; --cl-a3: #b82f6b; --cl-a4: #4a7d10;
  --cl-a5: #2f58c8; --cl-a6: #8a6d00; --cl-a7: #c0303d; --cl-a8: #0f7a5a; --cl-a9: #5a5a55;
}
.cl-t-added { --c: var(--cl-added); } .cl-t-changed { --c: var(--cl-changed); }
.cl-t-removed { --c: var(--cl-removed); } .cl-t-fixed { --c: var(--cl-fixed); } .cl-t-other { --c: var(--cl-other); }
.cl-a-0 { --c: var(--cl-a0); } .cl-a-1 { --c: var(--cl-a1); } .cl-a-2 { --c: var(--cl-a2); } .cl-a-3 { --c: var(--cl-a3); }
.cl-a-4 { --c: var(--cl-a4); } .cl-a-5 { --c: var(--cl-a5); } .cl-a-6 { --c: var(--cl-a6); } .cl-a-7 { --c: var(--cl-a7); }
.cl-a-8 { --c: var(--cl-a8); } .cl-a-9 { --c: var(--cl-a9); }

.cl-bar { display: flex; gap: 3px; height: 8px; }
.cl-bar i { display: block; flex: var(--n) 1 0; min-width: 6px; border-radius: 99px; background: var(--c); }

.cl-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); gap: 10px; }
.cl-tile { display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; border-radius: 12px; text-decoration: none;
  border: 1px solid color-mix(in srgb, var(--c) 38%, transparent);
  background: color-mix(in srgb, var(--c) 11%, var(--bg-secondary)); transition: border-color .15s, background .15s; }
.cl-tile:hover { border-color: var(--c); background: color-mix(in srgb, var(--c) 18%, var(--bg-secondary)); }
.cl-tile:focus-visible, .cl-chip:focus-visible, .cl-btn:focus-visible { outline: 2px solid var(--c, var(--accent)); outline-offset: 2px; }
.cl-tile b { font-family: var(--font-mono); font-size: 30px; line-height: 1.1; font-weight: 600; color: var(--c); }
.cl-tile span { font-size: var(--text-sm); color: var(--text-secondary); }

.cl-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 99px; cursor: pointer;
  font: inherit; font-size: var(--text-xs); font-weight: 600; color: var(--c); text-decoration: none;
  border: 1px solid color-mix(in srgb, var(--c) 40%, transparent); background: color-mix(in srgb, var(--c) 9%, transparent); }
.cl-chip small { font-family: var(--font-mono); font-size: inherit; font-weight: 400; color: var(--text-secondary); }
.cl-chip[aria-pressed="true"] { background: var(--c); color: var(--bg-primary); }
.cl-chip[aria-pressed="true"] small { color: inherit; }
.cl-pill { display: inline-block; padding: 1px 9px; border-radius: 99px; font-size: var(--text-xs); font-weight: 600; color: var(--c);
  background: color-mix(in srgb, var(--c) 15%, transparent); white-space: nowrap; }

.cl-card { border: 1px solid var(--border-strong); border-left: 4px solid var(--c); border-radius: 12px; padding: 16px 20px; background: var(--bg-secondary); }
.cl-head { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; }
.cl-ico { display: inline-flex; width: 30px; height: 30px; flex: none; align-items: center; justify-content: center; border-radius: 9px;
  color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); }
.cl-h3 { margin: 0; font-size: var(--text-base); font-weight: 600; color: var(--text-primary); line-height: 1.3; }

.cl-kbd { font-family: var(--font-mono); font-size: .86em; padding: 1px 7px; border-radius: 6px; white-space: nowrap;
  border: 1px solid var(--border-strong); border-bottom-width: 2px; background: var(--bg-tertiary); color: var(--text-primary); }

.cl-diff { margin: 12px 0 4px; border-radius: 10px; overflow: hidden; font-family: var(--font-mono); font-size: var(--text-xs); line-height: 1.5; border: 1px solid var(--border-strong); }
.cl-diff div { padding: 6px 14px; }
.cl-diff .old { background: color-mix(in srgb, var(--cl-removed) 13%, transparent); color: var(--cl-removed); }
.cl-diff .new { background: color-mix(in srgb, var(--cl-added) 13%, transparent); color: var(--cl-added); }

.cl-tablewrap { margin: 12px 0 4px; overflow-x: auto; border-radius: 10px; border: 1px solid var(--border-strong); }
.cl-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.cl-table th { text-align: left; padding: 9px 14px; font-weight: 600; color: var(--text-primary); background: var(--bg-tertiary); }
.cl-table td { padding: 8px 14px; color: var(--text-secondary); border-top: 1px solid var(--border); }
.cl-table td:first-child { color: var(--text-primary); }
.cl-table tr.none td:last-child { color: var(--cl-removed); }

.cl-area { border: 1px solid var(--border-strong); border-left: 4px solid var(--c); border-radius: 12px; background: var(--bg-secondary); }
.cl-area > summary { list-style: none; display: flex; align-items: center; gap: 10px; padding: 12px 16px; cursor: pointer; }
.cl-area > summary::-webkit-details-marker { display: none; }
.cl-area > summary::after { content: ''; margin-left: auto; width: 8px; height: 8px; border-right: 2px solid var(--text-muted); border-bottom: 2px solid var(--text-muted); transform: rotate(45deg); transition: transform .15s; }
.cl-area[open] > summary::after { transform: rotate(-135deg); }
.cl-area > summary:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; border-radius: 10px; }
.cl-entries { display: flex; flex-direction: column; gap: 14px; padding: 4px 18px 18px 20px; }
.cl-entry { display: flex; gap: 12px; align-items: flex-start; scroll-margin-top: 90px; }
.cl-entry::before { content: ''; flex: none; width: 7px; height: 7px; margin-top: 9px; border-radius: 50%; background: var(--c); }
.cl-entry:target { background: color-mix(in srgb, var(--c) 10%, transparent); border-radius: 8px; box-shadow: 0 0 0 6px color-mix(in srgb, var(--c) 10%, transparent); }
.cl-lead { color: var(--text-primary); font-weight: 600; }
.cl-anchor { color: var(--text-muted); text-decoration: none; font-weight: 400; margin-left: 4px; }
.cl-btn { padding: 5px 12px; border-radius: 8px; font: inherit; font-size: var(--text-xs); font-weight: 600; cursor: pointer; color: var(--text-secondary);
  background: var(--bg-tertiary); border: 1px solid var(--border-strong); }
.cl-field { width: 100%; padding: 9px 12px; font: inherit; font-size: var(--text-sm); background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-strong); border-radius: 8px; }
.cl-field:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.cl-rel { display: block; text-decoration: none; padding: 16px 20px; border-radius: 12px; border: 1px solid var(--border-strong); background: var(--bg-secondary); transition: border-color .15s, background .15s; }
.cl-rel:hover { border-color: var(--accent); background: var(--bg-tertiary); }
.cl-rel:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cl-rel-latest { border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: color-mix(in srgb, var(--accent) 7%, var(--bg-secondary)); }
.cl-grab { margin: 40px 0 0; padding-top: 24px; border-top: 1px solid var(--border-strong); }
.cl-spoiler { margin-top: 18px; }
.cl-spoiler button { all: unset; box-sizing: border-box; display: block; width: 100%; cursor: pointer; border-radius: 10px; padding: 14px 16px;
  border: 1px dashed var(--border-strong); background: var(--bg-secondary); }
.cl-spoiler button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cl-spoiler-hint { display: block; margin-bottom: 8px; font-size: var(--text-xs); font-weight: 600; color: var(--accent-text, var(--accent)); }
.cl-spoiler-body { display: block; font-size: var(--text-sm); line-height: 1.65; color: var(--text-secondary); filter: blur(7px); user-select: none; transition: filter .2s; }
.cl-spoiler button.open .cl-spoiler-body { filter: none; user-select: text; }
.cl-spoiler button.open { border-style: solid; cursor: default; }
.cl-month { margin: 8px 0 2px; font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
.cl-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; }
@media (max-width: 560px) { .cl-card { padding: 14px 14px; } .cl-entries { padding: 4px 12px 14px 14px; } .cl-tile b { font-size: 24px; } }
@media (prefers-reduced-motion: reduce) { .cl-tile, .cl-rel, .cl-area > summary::after, .cl-spoiler-body { transition: none; } }
`

export default function ChangelogStyles() {
  return <style>{CSS}</style>
}
