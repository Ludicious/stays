# Known Issues

---

## [RESOLVED] Quick Add — Google Maps load-order race (cold-load crash)

**Status:** Fixed (shipped in Session 8 — `quick-add/PlacesAutocomplete.tsx`)

**Symptom:** On a fresh (cold) server load, the Quick Add page caused repeated render errors that thrashed the Hostinger process ceiling (~120 processes). Users saw 503s. The Hostinger dashboard showed Max Processes spiking to the account limit within seconds of the page loading.

**Root cause:** `layout.tsx` injects the Google Maps script with `strategy="afterInteractive"`, meaning it loads asynchronously after the page is interactive. `PlacesAutocomplete` called `usePlacesAutocomplete()` unconditionally on mount. On a cold load the hook ran before `window.google.maps.places` existed, threw on every re-render, and — because an error during server-side rendering can restart the Node process — thrashed the Hostinger process manager into a crash loop.

**Why production hid it:** The primary instance (`stays.noteworthynomads.com`) had a warm Maps-script browser cache from regular use. The Google Maps JS was already present by the time the hook ran. The fresh AR instance (`stays-ar.noteworthynomads.com`) had no cache and hit the race on every cold incognito load.

**Fix:** A `useMapsReady()` guard polls for `window.google.maps.places` and renders a disabled placeholder input until the library is confirmed present. Only then is the inner `PlacesInput` component (which calls `usePlacesAutocomplete()`) mounted. This prevents the hook from running against an absent library.

**Key lesson:** A thrown error during a React render can thrash server processes on Hostinger. Any client-side hook that depends on an asynchronously loaded external script **must** be guarded behind a readiness check. Production warm-cache can mask this class of bug entirely — reproduce with an incognito cold load on a fresh instance.

**Correct reproduction method:** Open Quick Add in an incognito window on a freshly deployed instance (no prior page loads). Watch the Hostinger process count; without the fix it slams the ceiling within seconds.

---

## [OPEN] Google Places AutocompleteService deprecation

**Status:** Backlogged — non-urgent, tracked here

**Background:** Google deprecated the legacy `AutocompleteService` API for new API key holders as of March 1 2025. The existing API key is on an existing-customer grace period (12+ months notice), so the current integration continues to work.

**Affected code:** `use-places-autocomplete` relies on `AutocompleteService` under the hood. Eventually this library or the underlying API call will need to migrate to `google.maps.places.AutocompleteSuggestion` (the replacement API).

**Action:** Migrate Quick Add's Places integration from `use-places-autocomplete` / `AutocompleteService` to `google.maps.places.AutocompleteSuggestion` in a dedicated future session. Do not attempt this migration while any friend-test or new instance onboarding is in progress — the change will require testing the full Quick Add → save flow end-to-end.

**Urgency:** Low. Monitor the Google Maps JS changelog for end-of-life announcements for the existing key's grace period.
