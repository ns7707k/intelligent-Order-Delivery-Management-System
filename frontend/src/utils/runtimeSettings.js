export const SETTINGS_CACHE_KEY = 'odms_settings_cache';

export const DEFAULT_MAP_CENTER = [51.5074, -0.1278];

export const DEFAULT_RUNTIME_SETTINGS = {
  voice_confidence_threshold: 0.8,
  voice_auto_start: true,
  voice_confirmation_required: true,
  default_map_zoom: 13,
  map_style: 'standard',
  show_heatmap_by_default: false,
  refresh_interval: 5,
};

const toBoolean = (value, fallback) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

const toNumber = (value, fallback, min = null, max = null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  let next = parsed;
  if (min != null) {
    next = Math.max(min, next);
  }
  if (max != null) {
    next = Math.min(max, next);
  }

  return next;
};

const normalizeMapStyle = (value) => {
  const nextStyle = String(value || '').toLowerCase();
  if (nextStyle === 'satellite' || nextStyle === 'terrain') {
    return nextStyle;
  }
  return 'standard';
};

export const normalizeRuntimeSettings = (source = {}) => ({
  voice_confidence_threshold: toNumber(
    source.voice_confidence_threshold,
    DEFAULT_RUNTIME_SETTINGS.voice_confidence_threshold,
    0,
    1
  ),
  voice_auto_start: toBoolean(source.voice_auto_start, DEFAULT_RUNTIME_SETTINGS.voice_auto_start),
  voice_confirmation_required: toBoolean(
    source.voice_confirmation_required,
    DEFAULT_RUNTIME_SETTINGS.voice_confirmation_required
  ),
  default_map_zoom: Math.round(
    toNumber(source.default_map_zoom, DEFAULT_RUNTIME_SETTINGS.default_map_zoom, 1, 20)
  ),
  map_style: normalizeMapStyle(source.map_style),
  show_heatmap_by_default: toBoolean(
    source.show_heatmap_by_default,
    DEFAULT_RUNTIME_SETTINGS.show_heatmap_by_default
  ),
  refresh_interval: Math.round(
    toNumber(source.refresh_interval, DEFAULT_RUNTIME_SETTINGS.refresh_interval, 1, 60)
  ),
});

export const readCachedRuntimeSettings = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_RUNTIME_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) {
      return { ...DEFAULT_RUNTIME_SETTINGS };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_RUNTIME_SETTINGS };
    }

    return normalizeRuntimeSettings(parsed);
  } catch {
    return { ...DEFAULT_RUNTIME_SETTINGS };
  }
};

export const mergeRuntimeSettingsIntoCache = (source = {}) => {
  const merged = normalizeRuntimeSettings({
    ...readCachedRuntimeSettings(),
    ...(source && typeof source === 'object' ? source : {}),
  });

  if (typeof window === 'undefined' || !window.localStorage) {
    return merged;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    const safeExisting = existing && typeof existing === 'object' ? existing : {};

    window.localStorage.setItem(
      SETTINGS_CACHE_KEY,
      JSON.stringify({
        ...safeExisting,
        ...merged,
      })
    );
  } catch {
    // Ignore cache write failures.
  }

  return merged;
};
