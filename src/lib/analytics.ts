// Thin wrapper around gtag for the site's own custom GA4 events. Everything
// else GA4 sees (page_view, scroll, session_start, the enhanced-measurement
// form_submit/view_search_results events) fires automatically off the
// gtag.js snippet in layout.tsx -- this file is only for events call sites
// choose to send explicitly, and every call site below fires on a genuine
// success (a sequence actually went live, a GRIP string was actually copied,
// a save actually landed, a comment actually got inserted, onboarding
// actually finished), never on a click or a form submit that could still
// fail downstream. That distinction is what makes these safe to mark as GA4
// Key events later -- a Key event is supposed to mean something happened,
// not that someone attempted it.
//
// window.gtag is installed by the inline <Script> tags in layout.tsx
// (strategy="afterInteractive"), so it can be undefined for a moment on a
// very early interaction -- guarded here rather than assumed present.
type GtagEventParams = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function trackEvent(name: string, params?: GtagEventParams): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}
