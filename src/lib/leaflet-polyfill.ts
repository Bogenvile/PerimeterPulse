// Leaflet iframe polyfill — must run BEFORE leaflet is imported.
// In some iframe environments, window.frameElement is undefined (not null),
// which causes Leaflet's Browser.frame to crash with
// "Cannot read properties of undefined (reading 'frame')".
// We define it as a non-configurable getter that returns null so Leaflet
// sees it as "no frame element" and skips its iframe detection logic.

if (typeof window !== "undefined") {
  try {
    // Only patch if frameElement is truly undefined (not already set)
    if (!("frameElement" in window) || window.frameElement === undefined) {
      Object.defineProperty(window, "frameElement", {
        get: () => null,
        configurable: true,
      });
    }
  } catch {
    // Ignore if we can't define it
  }

  // Also ensure L.Browser exists for older Leaflet versions
  try {
    if (!window.frameElement) {
      Object.defineProperty(window, "frameElement", {
        get: () => null,
        configurable: true,
      });
    }
  } catch {
    // ignore
  }
}