import type { MarketSnapshot, Settings, WatchItem } from './types';

const WATCHLIST_KEY = 'spread-watch-cn.watchlist';
const SNAPSHOTS_KEY = 'spread-watch-cn.snapshots';
const SETTINGS_KEY = 'spread-watch-cn.settings';
const MIN_AUTO_REFRESH_MINUTES = 3;
const LEGACY_DEFAULT_AUTO_REFRESH_MINUTES = 5;

export const defaultSettings: Settings = {
  probabilityChangeThreshold: 6,
  spreadJumpThresholdPct: 80,
  volumeSurgeFactor: 1.5,
  newsLookbackHours: 24,
  autoRefreshMinutes: 10,
  autoRefreshEnabled: true
};

export function normalizeSettings(value: Settings): Settings {
  return {
    ...value,
    probabilityChangeThreshold: Math.max(1, Number(value.probabilityChangeThreshold) || defaultSettings.probabilityChangeThreshold),
    spreadJumpThresholdPct: Math.max(10, Number(value.spreadJumpThresholdPct) || defaultSettings.spreadJumpThresholdPct),
    volumeSurgeFactor: Math.max(1.1, Number(value.volumeSurgeFactor) || defaultSettings.volumeSurgeFactor),
    newsLookbackHours: Math.max(1, Number(value.newsLookbackHours) || defaultSettings.newsLookbackHours),
    autoRefreshMinutes: Math.max(
      MIN_AUTO_REFRESH_MINUTES,
      Number(value.autoRefreshMinutes) || defaultSettings.autoRefreshMinutes
    ),
    autoRefreshEnabled: Boolean(value.autoRefreshEnabled)
  };
}

export function loadWatchlist(): WatchItem[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(value: WatchItem[]) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(value));
}

export function loadSnapshots(): Record<string, MarketSnapshot> {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSnapshots(value: Record<string, MarketSnapshot>) {
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(value));
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return defaultSettings;
    }

    const merged = { ...defaultSettings, ...JSON.parse(raw) };
    if (merged.autoRefreshMinutes === LEGACY_DEFAULT_AUTO_REFRESH_MINUTES) {
      merged.autoRefreshMinutes = defaultSettings.autoRefreshMinutes;
    }

    return normalizeSettings(merged);
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(value: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(value)));
}
