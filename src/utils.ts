import type { AlertItem, MarketSnapshot, NewsItem, Settings } from './types';

export type Locale = 'zh' | 'en';

const EMPTY_VALUE = '--';
const CENT_SIGN = '\u00a2';

const compactNumber = {
  zh: new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 1
  }),
  en: new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  })
};

const currencyCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1
});

export function formatCurrency(value: number | null) {
  if (value == null) {
    return EMPTY_VALUE;
  }
  return currencyCompact.format(value);
}

export function formatCompact(value: number | null, locale: Locale = 'zh') {
  if (value == null) {
    return EMPTY_VALUE;
  }
  return compactNumber[locale].format(value);
}

export function formatPercent(value: number | null, digits = 1) {
  if (value == null) {
    return EMPTY_VALUE;
  }
  return `${value.toFixed(digits)}%`;
}

export function formatPoints(value: number | null, digits = 1) {
  if (value == null) {
    return EMPTY_VALUE;
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}pt`;
}

export function formatSpread(value: number | null) {
  if (value == null) {
    return EMPTY_VALUE;
  }
  return `${value.toFixed(1)}${CENT_SIGN}`;
}

export function formatTimeAgo(value: string, locale: Locale = 'zh') {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) {
    return locale === 'zh' ? '\u521a\u521a' : 'just now';
  }

  if (minutes < 60) {
    return locale === 'zh' ? `${minutes} \u5206\u949f\u524d` : `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return locale === 'zh' ? `${hours} \u5c0f\u65f6\u524d` : `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return locale === 'zh' ? `${days} \u5929\u524d` : `${days}d ago`;
}

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function isRecent(item: NewsItem, hours: number) {
  return Date.now() - new Date(item.publishedAt).getTime() <= hours * 60 * 60 * 1000;
}

function isTweetCategory(category: string | undefined) {
  if (!category) {
    return false;
  }
  const normalized = category.trim().toLowerCase();
  return normalized === 'tweet' || category === '\u63a8\u6587';
}

export function evaluateAlerts(
  current: MarketSnapshot,
  previous: MarketSnapshot | undefined,
  settings: Settings,
  locale: Locale = 'zh'
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const now = new Date().toISOString();

  if (Math.abs(current.probabilityChange24h) >= settings.probabilityChangeThreshold) {
    alerts.push({
      key: `probability:${current.slug}:${Math.round(current.probabilityChange24h * 10)}`,
      type: 'probability',
      severity: Math.abs(current.probabilityChange24h) >= settings.probabilityChangeThreshold * 1.5 ? 'high' : 'medium',
      title: locale === 'zh' ? '24 \u5c0f\u65f6\u6982\u7387\u5f02\u52a8' : '24h probability move',
      detail:
        locale === 'zh'
          ? `${current.currentOutcomeLabel} \u8fc7\u53bb 24 \u5c0f\u65f6${current.probabilityChange24h > 0 ? '\u4e0a\u5347' : '\u4e0b\u964d'} ${Math.abs(
              current.probabilityChange24h
            ).toFixed(1)} \u4e2a\u70b9`
          : `${current.currentOutcomeLabel} moved ${current.probabilityChange24h > 0 ? 'up' : 'down'} ${Math.abs(
              current.probabilityChange24h
            ).toFixed(1)} points over the last 24h`,
      createdAt: now
    });
  }

  const recentNews = current.recentImportantNews.filter((item) => isRecent(item, settings.newsLookbackHours));
  if (recentNews.length > 0) {
    const previousKeys = new Set(previous?.recentNewsKeys || []);
    const newItems = recentNews.filter((item) => !previousKeys.has(item.signature));
    if (newItems.length > 0) {
      alerts.push({
        key: `news:${current.slug}:${newItems.map((item) => item.signature).join('|')}`,
        type: 'news',
        severity: newItems.some((item) => !isTweetCategory(item.category)) ? 'high' : 'medium',
        title: locale === 'zh' ? '\u51fa\u73b0\u65b0\u8d44\u8baf' : 'New coverage',
        detail: locale === 'zh' ? `${newItems.length} \u6761\u65b0\u5185\u5bb9` : `${newItems.length} new items`,
        createdAt: now
      });
    }
  }

  if (previous?.spread != null && current.spread != null && previous.spread > 0) {
    const spreadChangePct = ((current.spread - previous.spread) / previous.spread) * 100;
    if (spreadChangePct >= settings.spreadJumpThresholdPct) {
      alerts.push({
        key: `spread:${current.slug}:${Math.round(current.spread * 10)}`,
        type: 'spread',
        severity: current.spread >= 5 ? 'high' : 'medium',
        title: locale === 'zh' ? '\u4ef7\u5dee\u660e\u663e\u653e\u5927' : 'Spread widened',
        detail:
          locale === 'zh'
            ? `\u4ef7\u5dee\u4ece ${formatSpread(previous.spread)} \u6269\u5927\u5230 ${formatSpread(current.spread)}`
            : `Spread widened from ${formatSpread(previous.spread)} to ${formatSpread(current.spread)}`,
        createdAt: now
      });
    }
  }

  if (previous?.volume24h != null && current.volume24h != null && previous.volume24h > 0) {
    if (current.volume24h / previous.volume24h >= settings.volumeSurgeFactor) {
      alerts.push({
        key: `volume:${current.slug}:${Math.round(current.volume24h)}`,
        type: 'volume',
        severity: current.volume24h > previous.volume24h * (settings.volumeSurgeFactor + 0.5) ? 'high' : 'medium',
        title: locale === 'zh' ? '24h \u6210\u4ea4\u989d\u653e\u5927' : '24h volume surge',
        detail:
          locale === 'zh'
            ? `24h \u6210\u4ea4\u989d\u4ece ${formatCurrency(previous.volume24h)} \u5347\u5230 ${formatCurrency(current.volume24h)}`
            : `24h volume rose from ${formatCurrency(previous.volume24h)} to ${formatCurrency(current.volume24h)}`,
        createdAt: now
      });
    }
  }

  return alerts;
}
