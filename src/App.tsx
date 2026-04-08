import { startTransition, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createApiClient } from './api';
import {
  defaultSettings,
  loadSettings,
  normalizeSettings,
  loadSnapshots,
  loadWatchlist,
  saveSettings,
  saveSnapshots,
  saveWatchlist
} from './storage';
import type { AlertItem, MarketSnapshot, SearchResult, Settings, WatchItem } from './types';
import {
  classNames,
  evaluateAlerts,
  formatCompact,
  formatCurrency,
  formatPercent,
  formatPoints,
  formatSpread,
  formatTimeAgo,
  type Locale
} from './utils';

type Copy = (typeof UI_COPY)[Locale];
export type InsiderKillerAppProps = {
  apiBaseUrl?: string;
  initialLocale?: Locale;
  className?: string;
};

const LOCALE_KEY = 'spread-watch-cn.locale';
const BRAND_LINKS = {
  twitterHref: 'https://x.com/youknow028'
};

const UI_COPY = {
  zh: {
    brandName: '\u5185\u5e55\u6740\u624b',
    heroEyebrow: '\u5e02\u573a\u96f7\u8fbe',
    heroTitle: '\u5185\u5e55\u6740\u624b',
    heroCopy: '\u5e2e\u4f60\u627e\u5230\u6240\u6709\u7684\u9634\u8c0b\u5c0f\u4eba',
    topLinks: {
      twitter: 'X / \u63a8\u7279'
    },
    actions: {
      search: '\u641c\u7d22\u5e02\u573a',
      settings: '\u63d0\u9192\u8bbe\u7f6e',
      refresh: '\u7acb\u5373\u5237\u65b0',
      refreshing: '\u5237\u65b0\u4e2d...',
      openMarket: '\u6253\u5f00\u5e02\u573a',
      remove: '\u79fb\u9664',
      close: '\u5173\u95ed',
      prev: '\u4e0a\u4e00\u9875',
      next: '\u4e0b\u4e00\u9875'
    },
    toggle: {
      zh: '\u4e2d\u6587',
      en: 'English'
    },
    stats: {
      watchlist: '\u89c2\u5bdf\u5217\u8868',
      watchlistNote: '\u5df2\u52a0\u5165\u5e02\u573a',
      alerts: '\u6d3b\u8dc3\u63d0\u9192',
      alertsNote: '\u9700\u8981\u4f18\u5148\u5904\u7406\u7684\u5f02\u52a8',
      move: '\u5e73\u5747\u6ce2\u52a8',
      moveNote: '\u89c2\u5bdf\u5217\u8868 24h \u7edd\u5bf9\u53d8\u52a8',
      coverage: '\u8d44\u8baf\u8986\u76d6',
      coverageNote: '\u6709\u5185\u5bb9\u53ef\u770b'
    },
    alertCenter: {
      title: '\u63d0\u9192\u4e2d\u5fc3',
      note: '\u547d\u4e2d\u7684\u63d0\u9192\u4f1a\u663e\u793a\u5728\u8fd9\u91cc',
      empty: '\u8fd8\u6ca1\u6709\u63d0\u9192\uff0c\u6dfb\u52a0\u5e02\u573a\u540e\u5237\u65b0\u770b\u770b\u3002'
    },
    marketList: {
      eyebrow: '\u5217\u8868',
      title: '\u5e02\u573a\u5217\u8868',
      note: '\u70b9\u4e00\u4e0b\u5c31\u80fd\u5207\u6362'
    },
    empty: {
      noMarket: '\u8fd8\u6ca1\u6709\u5e02\u573a\uff0c\u5148\u641c\u4e00\u4e2a\u52a0\u8fdb\u6765\u3002',
      title: '\u5148\u52a0\u51e0\u4e2a\u5e02\u573a',
      note: '\u70b9\u4e0a\u9762\u7684\u201c\u641c\u7d22\u5e02\u573a\u201d\uff0c\u627e\u5230\u540e\u76f4\u63a5\u52a0\u5165\u5217\u8868\u3002'
    },
    search: {
      title: '\u641c\u7d22\u5e02\u573a',
      subtitle: '\u8f93\u5165\u5173\u952e\u8bcd\u6216 Polymarket \u94fe\u63a5\uff0c\u641c\u7d22\u540e\u76f4\u63a5\u52a0\u5165\u89c2\u5bdf\u5217\u8868\u3002',
      placeholder: '\u4f8b\u5982\uff1abitcoin / trump / Polymarket \u94fe\u63a5',
      search: '\u641c\u7d22',
      searching: '\u641c\u7d22\u4e2d...',
      add: '\u52a0\u5165',
      added: '\u5df2\u52a0\u5165',
      active: '\u8fdb\u884c\u4e2d',
      closed: '\u5df2\u7ed3\u675f'
    },
    settings: {
      title: '\u63d0\u9192\u8bbe\u7f6e',
      subtitle: '\u8c03\u6574\u5237\u65b0\u548c\u63d0\u9192\u9608\u503c\u3002',
      probability: '24 \u5c0f\u65f6\u4ef7\u683c\u53d8\u5316\u63d0\u9192',
      probabilityHelp: '\u8fbe\u5230\u8fd9\u4e2a\u503c\u5c31\u63d0\u9192\u3002',
      spread: '\u4ef7\u5dee\u653e\u5927\u63d0\u9192',
      spreadHelp: '\u6bd4\u4e0a\u6b21\u5237\u65b0\u6269\u5927\u5230\u8fd9\u4e2a\u6bd4\u4f8b\u5c31\u63d0\u9192\u3002',
      volume: '24 \u5c0f\u65f6\u6210\u4ea4\u989d\u63d0\u9192',
      volumeHelp: '\u6bd4\u4e0a\u6b21\u5237\u65b0\u653e\u5927\u5230\u8fd9\u4e2a\u500d\u6570\u5c31\u63d0\u9192\u3002',
      newsWindow: '\u65b0\u5185\u5bb9\u65f6\u95f4\u8303\u56f4',
      newsWindowHelp: '\u53ea\u7edf\u8ba1\u8fd9\u6bb5\u65f6\u95f4\u5185\u7684\u65b0\u5185\u5bb9\u3002',
      refresh: '\u81ea\u52a8\u5237\u65b0\u95f4\u9694',
      refreshHelp: '\u5efa\u8bae 10 \u5206\u949f\u4ee5\u4e0a\uff0c\u6700\u4f4e 3 \u5206\u949f\u3002',
      autoRefresh: '\u81ea\u52a8\u5237\u65b0',
      notificationReady: '\u901a\u77e5\u5df2\u5f00\u542f',
      notificationUnsupported: '\u5f53\u524d\u73af\u5883\u4e0d\u652f\u6301\u901a\u77e5',
      notificationRequest: '\u5f00\u542f\u901a\u77e5'
    },
    footer: {
      aboutTitle: '\u5185\u5e55\u6740\u624b',
      aboutText: '\u76ef\u4f4f\u9884\u6d4b\u5e02\u573a\u91cc\u7684\u6982\u7387\u5f02\u52a8\u3001\u8d44\u8baf\u6d41\u548c\u6301\u4ed3\u53d8\u5316\u3002',
      twitterTitle: 'X / \u63a8\u7279',
      twitterText: '\u6211\u7684 X \u8d26\u53f7\uff0c\u9879\u76ee\u52a8\u6001\u548c\u8054\u7cfb\u65b9\u5f0f\u90fd\u5728\u8fd9\u91cc\u3002',
      collabTitle: '\u5408\u4f5c',
      collabText: '\u72ec\u7acb\u5f00\u53d1\u8005\uff0c\u9884\u6d4b\u5e02\u573a\u3001DEX \u4ea4\u6613\u3001Meme \u5de5\u5177\u3001\u91cf\u5316\u5de5\u5177\u548c\u5b9a\u5236\u5316\u5f00\u53d1\u90fd\u53ef\u4ee5\u505a\u3002\u60f3\u6cd5\u7075\u6d3b\uff0c\u6709\u9700\u6c42\u53ef\u4ee5\u76f4\u63a5\u627e\u6211\u3002',
      rights: '\u4fdd\u7559\u6240\u6709\u6743\u5229'
    }
  },
  en: {
    brandName: 'Insider Killer',
    heroEyebrow: 'market radar',
    heroTitle: 'Insider Killer',
    heroCopy: 'Find every schemer hiding behind the story.',
    topLinks: {
      twitter: 'X / Twitter'
    },
    actions: {
      search: 'Search markets',
      settings: 'Alert settings',
      refresh: 'Refresh now',
      refreshing: 'Refreshing...',
      openMarket: 'Open market',
      remove: 'Remove',
      close: 'Close',
      prev: 'Prev',
      next: 'Next'
    },
    toggle: {
      zh: '\u4e2d\u6587',
      en: 'English'
    },
    stats: {
      watchlist: 'Watchlist',
      watchlistNote: 'Markets added',
      alerts: 'Active alerts',
      alertsNote: 'Moves worth checking first',
      move: 'Average move',
      moveNote: 'Absolute 24h move across watchlist',
      coverage: 'Coverage',
      coverageNote: 'Markets with content'
    },
    alertCenter: {
      title: 'Alert center',
      note: 'Matched alerts will show up here',
      empty: 'No alerts yet. Add markets and refresh to check again.'
    },
    marketList: {
      eyebrow: 'list',
      title: 'Market list',
      note: 'Click a card to switch'
    },
    empty: {
      noMarket: 'No market yet. Search and add one first.',
      title: 'Add a few markets',
      note: 'Use Search markets above and add what you want to track.'
    },
    search: {
      title: 'Search markets',
      subtitle: 'Enter a keyword or a Polymarket link, then add results straight into your watchlist.',
      placeholder: 'For example: bitcoin / trump / Polymarket link',
      search: 'Search',
      searching: 'Searching...',
      add: 'Add',
      added: 'Added',
      active: 'Live',
      closed: 'Closed'
    },
    settings: {
      title: 'Alert settings',
      subtitle: 'Adjust refresh cadence and trigger thresholds.',
      probability: '24h price move alert',
      probabilityHelp: 'Trigger when the move reaches this level.',
      spread: 'Spread expansion alert',
      spreadHelp: 'Trigger when spread expands by this percentage since last refresh.',
      volume: '24h volume surge alert',
      volumeHelp: 'Trigger when 24h volume grows by this multiple.',
      newsWindow: 'Fresh content window',
      newsWindowHelp: 'Only count new items within this time range.',
      refresh: 'Auto refresh interval',
      refreshHelp: 'Recommended 10 minutes or more. Minimum is 3 minutes.',
      autoRefresh: 'Auto refresh',
      notificationReady: 'Notifications enabled',
      notificationUnsupported: 'Notifications not supported here',
      notificationRequest: 'Enable notifications'
    },
    footer: {
      aboutTitle: 'Insider Killer',
      aboutText: 'Track odds moves, coverage flow, and holder shifts across prediction markets.',
      twitterTitle: 'X / Twitter',
      twitterText: 'My X account for updates, shipping notes, and direct contact.',
      collabTitle: 'Partnerships',
      collabText: 'Independent developer. I build for prediction markets, DEX trading, meme tools, quant workflows, and custom utilities. If you need something built, reach out.',
      rights: 'All rights reserved'
    }
  }
} as const;

function loadLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_KEY);
    return raw === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

function saveLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // ignore
  }
}

function truncateMiddle(value: string, left = 6, right = 4) {
  if (value.length <= left + right + 3) {
    return value;
  }
  return `${value.slice(0, left)}...${value.slice(-right)}`;
}

function truncateTitle(value: string, max = 24) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}...`;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatBucketDate(value?: string) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatBucketTime(value?: string) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatBucketRange(bucket: MarketSnapshot['tweetBucketsAll'][number], locale: Locale) {
  const startDate = formatBucketDate(bucket.startAt);
  const startTime = formatBucketTime(bucket.startAt);
  const endTime = formatBucketTime(bucket.endAt);

  return {
    day: startDate || (locale === 'zh' ? `\u65f6\u6bb5 ${bucket.slot + 1}` : `Slot ${bucket.slot + 1}`),
    time: startTime && endTime ? `${startTime}-${endTime}` : locale === 'zh' ? '\u65f6\u95f4\u672a\u77e5' : 'Unknown time'
  };
}

const tweetBarPalette = [
  {
    background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.98), rgba(14, 165, 233, 0.84))',
    shadow: 'rgba(56, 189, 248, 0.2)'
  },
  {
    background: 'linear-gradient(180deg, rgba(45, 212, 191, 0.98), rgba(13, 148, 136, 0.84))',
    shadow: 'rgba(45, 212, 191, 0.2)'
  },
  {
    background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.98), rgba(126, 34, 206, 0.84))',
    shadow: 'rgba(168, 85, 247, 0.2)'
  },
  {
    background: 'linear-gradient(180deg, rgba(251, 191, 36, 0.98), rgba(245, 158, 11, 0.84))',
    shadow: 'rgba(251, 191, 36, 0.2)'
  },
  {
    background: 'linear-gradient(180deg, rgba(244, 114, 182, 0.98), rgba(236, 72, 153, 0.84))',
    shadow: 'rgba(244, 114, 182, 0.2)'
  },
  {
    background: 'linear-gradient(180deg, rgba(251, 146, 60, 0.98), rgba(234, 88, 12, 0.84))',
    shadow: 'rgba(251, 146, 60, 0.2)'
  }
];

function getTweetBarStyle(index: number, count: number, max: number) {
  const tone = tweetBarPalette[index % tweetBarPalette.length];
  const glow = 0.16 + (count / max) * 0.12;

  return {
    background: tone.background,
    boxShadow: `0 12px 28px ${tone.shadow.replace('0.2)', `${glow})`)}`
  };
}

function formatMarketTileMeta(snapshot: MarketSnapshot | undefined) {
  if (!snapshot) {
    return '...';
  }
  return `${snapshot.currentOutcomeLabel} ${formatPercent(snapshot.currentProbability)}`;
}

function resolveTweetBuckets(snapshot: MarketSnapshot | undefined) {
  if (!snapshot) {
    return [];
  }
  return (
    (snapshot as MarketSnapshot & { tweetBuckets24h?: MarketSnapshot['tweetBucketsAll'] }).tweetBucketsAll ??
    (snapshot as MarketSnapshot & { tweetBuckets24h?: MarketSnapshot['tweetBucketsAll'] }).tweetBuckets24h ??
    []
  );
}

function resolveNewsFeed(snapshot: MarketSnapshot | undefined) {
  if (!snapshot) {
    return [];
  }
  return (
    (snapshot as MarketSnapshot & { newsFeed?: MarketSnapshot['newsFeed'] }).newsFeed ?? snapshot.recentImportantNews ?? []
  );
}

function formatMoveValue(value: number | null) {
  if (value == null) {
    return '—';
  }

  const abs = Math.abs(value);
  const digits = abs >= 1 ? 2 : abs >= 0.1 ? 2 : 3;
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${abs.toFixed(digits)}pt`;
}

function getMoveTone(value: number | null) {
  if (value == null || Math.abs(value) < 0.01) {
    return 'flat' as const;
  }
  return value > 0 ? ('up' as const) : ('down' as const);
}

function getMoveLabel(value: number | null, locale: Locale) {
  const tone = getMoveTone(value);
  if (tone === 'up') {
    return locale === 'zh' ? '\u4e0a\u6da8' : 'Up';
  }
  if (tone === 'down') {
    return locale === 'zh' ? '\u4e0b\u8dcc' : 'Down';
  }
  return locale === 'zh' ? '\u51e0\u4e4e\u4e0d\u53d8' : 'Flat';
}

function formatSpreadBandLabel(value: string | null | undefined, locale: Locale) {
  if (!value) {
    return locale === 'zh' ? '\u6682\u65e0' : 'Unavailable';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === '\u7d27\u5bc6' || normalized === 'tight') {
    return locale === 'zh' ? '\u7d27\u5bc6' : 'Tight';
  }
  if (normalized === '\u4e00\u822c' || normalized === 'normal') {
    return locale === 'zh' ? '\u4e00\u822c' : 'Normal';
  }
  if (normalized === '\u504f\u8584' || normalized === 'thin') {
    return locale === 'zh' ? '\u504f\u8584' : 'Thin';
  }
  return value;
}

function formatCorrelationLabel(value: string | undefined, locale: Locale) {
  const normalized = (value || 'related').toLowerCase();
  if (normalized === 'up') {
    return locale === 'zh' ? '\u5229\u591a' : 'up';
  }
  if (normalized === 'down') {
    return locale === 'zh' ? '\u5229\u7a7a' : 'down';
  }
  return locale === 'zh' ? '\u76f8\u5173' : 'related';
}

function HeatmapChart({ cells, locale }: { cells: MarketSnapshot['heatmap24h']; locale: Locale }) {
  if (!cells.length) {
    return <div className="viz-empty">{locale === 'zh' ? '\u6682\u65e0 24h \u8d70\u52bf' : 'No trend data'}</div>;
  }

  const values = cells.map((cell) => cell.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const startValue = cells[0]?.value ?? min;
  const endValue = cells[cells.length - 1]?.value ?? max;
  const isFlat = Math.abs(max - min) < 0.1;

  return (
    <div className="viz-card">
      <div className="viz-head">
        <h4>{locale === 'zh' ? '24h \u8d70\u52bf' : '24h Trend'}</h4>
        <span>{locale === 'zh' ? '\u5de6\u4e0a\u89d2\u66f4\u65e9\uff0c\u53f3\u4e0b\u89d2\u66f4\u65b0' : 'Top left is older, bottom right is newer'}</span>
      </div>
      <div className="heatmap-legend">
        <span className="heatmap-legend-item">
          <i className="legend-dot legend-dot-up" />
          {locale === 'zh' ? '\u4e0a\u6da8' : 'Up'}
        </span>
        <span className="heatmap-legend-item">
          <i className="legend-dot legend-dot-down" />
          {locale === 'zh' ? '\u4e0b\u8dcc' : 'Down'}
        </span>
        <span className="heatmap-legend-item">
          <i className="legend-dot legend-dot-flat" />
          {locale === 'zh' ? '\u6a2a\u76d8' : 'Flat'}
        </span>
      </div>
      <div className="heatmap-grid">
        {cells.map((cell) => {
          const intensity = 0.18 + ((cell.value - min) / range) * 0.82;
          const isFlatCell = Math.abs(cell.change) < 0.05 || isFlat;
          const isPositive = cell.change > 0;
          return (
            <div
              className="heatmap-cell"
              key={`heat-${cell.slot}`}
              style={{
                opacity: Number.isFinite(intensity) ? intensity : 0.2,
                background: isFlatCell
                  ? 'linear-gradient(135deg, rgba(111, 122, 138, 0.34), rgba(74, 84, 97, 0.12))'
                  : isPositive
                    ? 'linear-gradient(135deg, rgba(30, 143, 224, 0.96), rgba(58, 160, 232, 0.32))'
                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(245, 158, 11, 0.28))'
              }}
                title={
                  locale === 'zh'
                    ? `\u7b2c ${cell.slot + 1} \u683c\uff0c\u5747\u503c ${cell.value.toFixed(1)}%\uff0c\u53d8\u52a8 ${formatPoints(cell.change)}`
                    : `Slot ${cell.slot + 1}, avg ${cell.value.toFixed(1)}%, move ${formatPoints(cell.change)}`
                }
              />
            );
          })}
      </div>
      <div className="heatmap-axis">
        <span>{locale === 'zh' ? '24h\u524d' : '24h ago'}</span>
        <span>{locale === 'zh' ? '18h\u524d' : '18h ago'}</span>
        <span>{locale === 'zh' ? '12h\u524d' : '12h ago'}</span>
        <span>{locale === 'zh' ? '6h\u524d' : '6h ago'}</span>
        <span>{locale === 'zh' ? '\u73b0\u5728' : 'Now'}</span>
      </div>
      <div className="viz-footer">
        {isFlat ? (
          <span>{locale === 'zh' ? `\u5927\u81f4\u6a2a\u76d8\u5728 ${formatPercent(endValue)} \u9644\u8fd1` : `Mostly flat near ${formatPercent(endValue)}`}</span>
        ) : (
          <span>
            {formatPercent(startValue)} {'->'} {formatPercent(endValue)}
          </span>
        )}
        <span>{locale === 'zh' ? `\u533a\u95f4 ${formatPercent(min)} / ${formatPercent(max)}` : `Low ${formatPercent(min)} / High ${formatPercent(max)}`}</span>
      </div>
    </div>
  );
}

function TweetBarChart({
  buckets,
  totalCount,
  locale
}: {
  buckets: MarketSnapshot['tweetBucketsAll'];
  totalCount: number;
  locale: Locale;
}) {
  if (!buckets.length || buckets.every((bucket) => bucket.count === 0)) {
    return <div className="viz-empty">{locale === 'zh' ? '\u6682\u65e0\u63a8\u6587\u5206\u5e03' : 'No tweet distribution data'}</div>;
  }

  const activeBuckets = buckets.filter((bucket) => bucket.count > 0);
  const displayedBuckets = activeBuckets.length ? activeBuckets : buckets;
  const max = Math.max(...displayedBuckets.map((bucket) => bucket.count), 1);
  const hiddenEmptyBuckets = buckets.length - displayedBuckets.length;

  return (
    <div className="viz-card">
      <div className="viz-head">
        <h4>{locale === 'zh' ? '\u63a8\u6587\u5206\u5e03' : 'Tweet distribution'}</h4>
        <span>{locale === 'zh' ? `\u5171 ${totalCount} \u6761` : `${totalCount} total`}</span>
      </div>
      <div className="tweet-summary">
        <span>{locale === 'zh' ? `\u6709\u5185\u5bb9\u7684\u65f6\u6bb5 ${displayedBuckets.length} / ${buckets.length}` : `Active slots ${displayedBuckets.length} / ${buckets.length}`}</span>
        {hiddenEmptyBuckets > 0 ? (
          <span>{locale === 'zh' ? `\u7701\u7565\u4e86 ${hiddenEmptyBuckets} \u4e2a\u7a7a\u65f6\u6bb5` : `${hiddenEmptyBuckets} empty slots hidden`}</span>
        ) : (
          <span>{locale === 'zh' ? '\u6bcf\u4e2a\u65f6\u6bb5\u90fd\u6709\u5185\u5bb9' : 'Every slot has content'}</span>
        )}
      </div>
      <div className="tweet-axis-note">
        <span>{locale === 'zh' ? '\u5de6\u8fb9\u66f4\u65e9' : 'Earlier'}</span>
        <span>{locale === 'zh' ? '\u53f3\u8fb9\u66f4\u65b0' : 'Later'}</span>
      </div>
      <div className="tweet-bars">
        {displayedBuckets.map((bucket, index) => {
          const range = formatBucketRange(bucket, locale);
          return (
            <div className="tweet-bar-wrap" key={`tweet-${bucket.slot}`}>
              <div className="tweet-bar-copy">
                <span className="tweet-bar-value">{bucket.count}</span>
                <span className="tweet-bar-day">{range.day}</span>
                <span className="tweet-bar-range">{range.time}</span>
              </div>
              <div className="tweet-bar-track">
                <div
                  className="tweet-bar-fill"
                  style={{
                    height: `${(bucket.count / max) * 100}%`,
                    ...getTweetBarStyle(index, bucket.count, max)
                  }}
                  title={locale === 'zh' ? `${bucket.count} \u6761\u63a8\u6587` : `${bucket.count} tweets`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="tweet-footer">{locale === 'zh' ? '\u6bcf\u5217\u4ee3\u8868\u4e00\u4e2a\u65f6\u95f4\u6bb5\u3002' : 'Each column is a time slot.'}</div>
    </div>
  );
}

function HolderTableCard({ summary, locale }: { summary: MarketSnapshot['holders']; locale: Locale }) {
  if (!summary.holders.length) {
    return <div className="viz-empty">{locale === 'zh' ? '\u6682\u65e0\u6301\u4ed3\u6570\u636e' : 'No holder data'}</div>;
  }

  const totalTracked = summary.totalTrackedAmount || summary.holders.reduce((sum, holder) => sum + holder.amount, 0);
  const holderCount = summary.holderCount ?? summary.holders.length;
  const isComplete = summary.isComplete === true;

  return (
    <div className="viz-card">
      <div className="viz-head">
        <h4>{locale === 'zh' ? '\u524d\u6392\u6301\u4ed3\u8868' : 'Top holders'}</h4>
        <span>{isComplete ? (locale === 'zh' ? `\u5171 ${holderCount} \u4e2a\u5730\u5740` : `${holderCount} addresses`) : (locale === 'zh' ? 'API \u6700\u591a\u8fd4\u56de 500 \u4e2a\u5730\u5740' : 'Up to 500 addresses shown')}</span>
      </div>
      <div className="holder-mini-table">
        <div className={classNames('holder-mini-head', !isComplete && 'holder-mini-head-compact')}>
          <span>{locale === 'zh' ? '\u5730\u5740' : 'Address'}</span>
          <span>{locale === 'zh' ? '\u6301\u4ed3' : 'Holding'}</span>
          {isComplete ? <span>{locale === 'zh' ? '\u5360\u6bd4' : 'Share'}</span> : null}
        </div>
        {summary.holders.slice(0, 5).map((holder, index) => {
          const label = holder.name || truncateMiddle(holder.proxyWallet || '', 8, 6) || (locale === 'zh' ? '\u672a\u77e5\u5730\u5740' : 'Unknown address');
          const share = totalTracked > 0 ? holder.amount / totalTracked : 0;

          return (
            <a
              className={classNames('holder-mini-row', !isComplete && 'holder-mini-row-compact')}
              key={`holder-mini-${holder.proxyWallet}`}
              href={`https://polymarket.com/profile/${holder.proxyWallet}`}
              target="_blank"
              rel="noreferrer"
              title={holder.proxyWallet}
            >
              <div className="holder-mini-main">
                <span className="holder-mini-rank">#{index + 1}</span>
                <div className="holder-mini-copy">
                  <strong>{label}</strong>
                  <span>{truncateMiddle(holder.proxyWallet || '', 10, 8)}</span>
                </div>
              </div>
              <span>{locale === 'zh' ? `${formatCompact(holder.amount, 'zh')} \u80a1` : `${formatCompact(holder.amount, 'en')} shares`}</span>
              {isComplete ? <span>{formatPercent(share * 100)}</span> : null}
            </a>
          );
        })}
      </div>
      {!isComplete ? <div className="holder-mini-note">{locale === 'zh' ? '\u8fd9\u4e00\u4fa7\u7684\u5168\u91cf\u5360\u6bd4\u62ff\u4e0d\u5230\u3002' : 'Full market share is unavailable for this side.'}</div> : null}
    </div>
  );
}

function NewsFeedCard({
  items,
  currentPage,
  onPageChange,
  marketUrl,
  covered,
  locale
}: {
  items: MarketSnapshot['newsFeed'];
  currentPage: number;
  onPageChange: (page: number) => void;
  marketUrl: string;
  covered: boolean;
  locale: Locale;
}) {
  if (!items.length) {
    return (
      <div className="news-list">
        <div className="panel-head">
          <h4>{locale === 'zh' ? '\u8d44\u8baf\u5217\u8868' : 'Coverage'}</h4>
          <span className="panel-note">{covered ? (locale === 'zh' ? '\u6700\u8fd1\u6ca1\u6709\u66f4\u65b0' : 'No recent updates') : (locale === 'zh' ? '\u6682\u65e0\u8986\u76d6' : 'No coverage')}</span>
        </div>
        <div className="muted-note">{locale === 'zh' ? '\u73b0\u5728\u6ca1\u6709\u53ef\u5c55\u793a\u7684\u5185\u5bb9\u3002' : 'Nothing to show right now.'}</div>
      </div>
    );
  }

  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), pageCount);
  const pageItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="news-list">
      <div className="news-list-top">
        <div className="panel-head">
          <h4>{locale === 'zh' ? '\u8d44\u8baf\u5217\u8868' : 'Coverage'}</h4>
          <span className="panel-note">{covered ? (locale === 'zh' ? `\u5171 ${items.length} \u6761` : `${items.length} items`) : (locale === 'zh' ? '\u6682\u65e0\u8986\u76d6' : 'No coverage')}</span>
        </div>
        {pageCount > 1 ? (
          <div className="news-pagination">
            <button className="ghost-button news-page-button" type="button" onClick={() => onPageChange(safePage - 1)} disabled={safePage === 1}>
              {locale === 'zh' ? '\u4e0a\u4e00\u9875' : 'Prev'}
            </button>
            <span className="news-page-indicator">
              {safePage} / {pageCount}
            </span>
            <button className="ghost-button news-page-button" type="button" onClick={() => onPageChange(safePage + 1)} disabled={safePage === pageCount}>
              {locale === 'zh' ? '\u4e0b\u4e00\u9875' : 'Next'}
            </button>
          </div>
        ) : null}
      </div>
      <div className="news-compact-list">
        {pageItems.map((item) => (
          <a className="news-item news-item-compact" key={item.signature} href={item.url || marketUrl} target="_blank" rel="noreferrer">
            <div className="news-item-copy">
              <span className="news-meta">
                {item.category} · {item.source} · {formatTimeAgo(item.publishedAt, locale)}
              </span>
              <strong>{item.title}</strong>
            </div>
            <span className={classNames('correlation-badge', item.correlation === 'up' && 'corr-up', item.correlation === 'down' && 'corr-down')}>
              {formatCorrelationLabel(item.correlation, locale)}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function DraggableModal({
  open,
  title,
  subtitle,
  closeLabel = 'Close',
  position,
  onPositionChange,
  onClose,
  children,
  wide = false
}: {
  open: boolean;
  title: string;
  subtitle: string;
  closeLabel?: string;
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      if (!dragRef.current.active) {
        return;
      }

      onPositionChange({
        x: dragRef.current.originX + (event.clientX - dragRef.current.startX),
        y: dragRef.current.originY + (event.clientY - dragRef.current.startY)
      });
    }

    function handlePointerUp() {
      dragRef.current.active = false;
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [open, onPositionChange]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={classNames('modal-shell', wide && 'modal-wide')}
        style={{ transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))` }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div
            className="modal-drag-zone"
            onPointerDown={(event) => {
              dragRef.current = {
                active: true,
                startX: event.clientX,
                startY: event.clientY,
                originX: position.x,
                originY: position.y
              };
            }}
          >
            <p className="eyebrow">Panel</p>
            <h3>{title}</h3>
            <p className="panel-note">{subtitle}</p>
          </div>
          <button className="ghost-button modal-close-button" type="button" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function BubbleNavigator({
  watchlist,
  snapshots,
  selectedSlug,
  onSelect,
  emptyText
}: {
  watchlist: WatchItem[];
  snapshots: Record<string, MarketSnapshot>;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  emptyText?: string;
}) {
  if (!watchlist.length) {
    return <div className="empty-box">{emptyText || 'No market yet.'}</div>;
  }

  return (
    <div className="market-tile-grid">
      {watchlist.map((item) => {
        const snapshot = snapshots[item.slug];

        return (
          <button className={classNames('market-tile', selectedSlug === item.slug && 'market-tile-active')} key={item.slug} type="button" onClick={() => onSelect(item.slug)} title={item.question}>
            <strong>{item.question}</strong>
            <span className="market-tile-meta">{formatMarketTileMeta(snapshot)}</span>
          </button>
        );
      })}
    </div>
  );
}

function SearchModalBody({
  query,
  onQueryChange,
  onSearch,
  searching,
  searchError,
  results,
  watchlist,
  onAdd,
  copy
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  searching: boolean;
  searchError: string;
  results: SearchResult[];
  watchlist: WatchItem[];
  onAdd: (result: SearchResult) => void;
  copy: Copy;
}) {
  return (
    <section className="panel modal-panel">
      <form className="search-form" onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
        <input className="input" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={copy.search.placeholder} />
        <button className="primary-button" type="submit" disabled={searching}>
          {searching ? copy.search.searching : copy.search.search}
        </button>
      </form>
      {searchError ? <div className="error-box">{searchError}</div> : null}
      <div className="search-results modal-search-results">
        {results.map((result) => {
          const added = watchlist.some((item) => item.slug === result.slug);
          const previewTags = (result.tags || []).slice(0, 2);
          const remainingTags = Math.max((result.tags || []).length - previewTags.length, 0);

          return (
            <article className="result-card" key={result.slug}>
              <div className="result-top">
                {result.icon ? <img className="result-icon" src={result.icon} alt="" /> : <div className="result-icon fallback-icon">{result.question.slice(0, 1)}</div>}
                <div className="result-copy">
                  <div className="result-title-row">
                    <h3>{result.question}</h3>
                    <button className={classNames('ghost-button', 'result-add-button', added && 'result-add-button-added')} type="button" onClick={() => onAdd(result)} disabled={added}>
                      {added ? copy.search.added : copy.search.add}
                    </button>
                  </div>
                  <p className="result-slug" title={result.slug}>{truncateMiddle(result.slug, 20, 8)}</p>
                  <div className="result-meta">
                    {previewTags.map((tag) => <span className="tag" key={`${result.slug}-${tag}`}>{tag}</span>)}
                    {remainingTags ? <span className="tag tag-muted">+{remainingTags}</span> : null}
                    <span className="result-state">{result.active ? copy.search.active : copy.search.closed}</span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SettingsModalBody({
  settings,
  onSettingsChange,
  notificationPermission,
  onRequestNotification,
  copy
}: {
  settings: Settings;
  onSettingsChange: (next: Settings) => void;
  notificationPermission: NotificationPermission | 'unsupported';
  onRequestNotification: () => void;
  copy: Copy;
}) {
  return (
    <section className="panel modal-panel">
      <div className="settings-grid">
        <label className="field">
          <span>{copy.settings.probability}</span>
          <small className="field-help">{copy.settings.probabilityHelp}</small>
          <input className="input" type="number" min="1" value={settings.probabilityChangeThreshold} onChange={(event) => onSettingsChange({ ...settings, probabilityChangeThreshold: Number(event.target.value) || defaultSettings.probabilityChangeThreshold })} />
        </label>

        <label className="field">
          <span>{copy.settings.spread}</span>
          <small className="field-help">{copy.settings.spreadHelp}</small>
          <input className="input" type="number" min="10" value={settings.spreadJumpThresholdPct} onChange={(event) => onSettingsChange({ ...settings, spreadJumpThresholdPct: Number(event.target.value) || defaultSettings.spreadJumpThresholdPct })} />
        </label>

        <label className="field">
          <span>{copy.settings.volume}</span>
          <small className="field-help">{copy.settings.volumeHelp}</small>
          <input className="input" type="number" min="1.1" step="0.1" value={settings.volumeSurgeFactor} onChange={(event) => onSettingsChange({ ...settings, volumeSurgeFactor: Number(event.target.value) || defaultSettings.volumeSurgeFactor })} />
        </label>

        <label className="field">
          <span>{copy.settings.newsWindow}</span>
          <small className="field-help">{copy.settings.newsWindowHelp}</small>
          <input className="input" type="number" min="1" value={settings.newsLookbackHours} onChange={(event) => onSettingsChange({ ...settings, newsLookbackHours: Number(event.target.value) || defaultSettings.newsLookbackHours })} />
        </label>

        <label className="field">
          <span>{copy.settings.refresh}</span>
          <small className="field-help">{copy.settings.refreshHelp}</small>
          <input className="input" type="number" min="3" value={settings.autoRefreshMinutes} onChange={(event) => onSettingsChange({ ...settings, autoRefreshMinutes: Number(event.target.value) || defaultSettings.autoRefreshMinutes })} />
        </label>

        <label className="toggle settings-toggle">
          <input type="checkbox" checked={settings.autoRefreshEnabled} onChange={(event) => onSettingsChange({ ...settings, autoRefreshEnabled: event.target.checked })} />
          <span>{copy.settings.autoRefresh}</span>
        </label>
      </div>

      <button className="secondary-button" type="button" onClick={onRequestNotification}>
        {notificationPermission === 'granted' ? copy.settings.notificationReady : notificationPermission === 'unsupported' ? copy.settings.notificationUnsupported : copy.settings.notificationRequest}
      </button>
    </section>
  );
}

export default function App({ apiBaseUrl, initialLocale, className }: InsiderKillerAppProps = {}) {
  const [query, setQuery] = useState('bitcoin');
  const [locale, setLocale] = useState<Locale>(() => initialLocale ?? loadLocale());
  const [watchlist, setWatchlist] = useState<WatchItem[]>(() => loadWatchlist());
  const [snapshots, setSnapshots] = useState<Record<string, MarketSnapshot>>(() => loadSnapshots());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [refreshing, setRefreshing] = useState<string[]>([]);
  const [marketErrors, setMarketErrors] = useState<Record<string, string>>({});
  const [searchInitialized, setSearchInitialized] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(() => loadWatchlist()[0]?.slug || null);
  const [newsPages, setNewsPages] = useState<Record<string, number>>({});
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [searchModalPosition, setSearchModalPosition] = useState({ x: -120, y: 0 });
  const [settingsModalPosition, setSettingsModalPosition] = useState({ x: 120, y: 10 });
  const refreshInFlightRef = useRef(false);
  const outcomeCacheRef = useRef<Record<string, Record<number, MarketSnapshot>>>({});
  const outcomeFetchRef = useRef<Partial<Record<string, Promise<void>>>>({});
  const apiClientRef = useRef(createApiClient(apiBaseUrl));
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const copy = UI_COPY[locale];

  useEffect(() => {
    apiClientRef.current = createApiClient(apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    if (initialLocale) {
      setLocale(initialLocale);
    }
  }, [initialLocale]);

  useEffect(() => {
    saveLocale(locale);
  }, [locale]);

  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);

  useEffect(() => {
    saveSnapshots(snapshots);
  }, [snapshots]);

  useEffect(() => {
    Object.values(snapshots).forEach((snapshot) => {
      outcomeCacheRef.current[snapshot.slug] = {
        ...(outcomeCacheRef.current[snapshot.slug] || {}),
        [snapshot.selectedOutcomeIndex]: snapshot
      };
    });
  }, [snapshots]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  function applySettings(next: Settings) {
    setSettings(normalizeSettings(next));
  }

  function updateWatchItemOutcome(slug: string, outcomeIndex: number) {
    setWatchlist((current) =>
      current.map((item) => (item.slug === slug ? { ...item, selectedOutcomeIndex: outcomeIndex } : item))
    );
  }

  function getComparableSnapshot(previous: MarketSnapshot | undefined, next: MarketSnapshot) {
    return previous?.selectedOutcomeIndex === next.selectedOutcomeIndex ? previous : undefined;
  }

  function rememberOutcomeSnapshot(snapshot: MarketSnapshot) {
    outcomeCacheRef.current[snapshot.slug] = {
      ...(outcomeCacheRef.current[snapshot.slug] || {}),
      [snapshot.selectedOutcomeIndex]: snapshot
    };
  }

  function getCachedOutcomeSnapshot(slug: string, outcomeIndex: number) {
    return outcomeCacheRef.current[slug]?.[outcomeIndex];
  }

  function prefetchOutcomes(slug: string, snapshot: MarketSnapshot) {
    const targets = snapshot.outcomes
      .map((_, index) => index)
      .filter((index) => index !== snapshot.selectedOutcomeIndex && !getCachedOutcomeSnapshot(slug, index))
      .slice(0, 3);

    targets.forEach((outcomeIndex, offset) => {
      const taskKey = `${slug}:${outcomeIndex}`;
      if (outcomeFetchRef.current[taskKey]) {
        return;
      }

      outcomeFetchRef.current[taskKey] = (async () => {
        if (offset) {
          await sleep(120 * offset);
        }
        try {
      const fresh = await apiClientRef.current.fetchMarketSnapshot(slug, outcomeIndex);
          rememberOutcomeSnapshot({
            ...fresh,
            alerts: []
          });
        } catch {
          return;
        } finally {
          delete outcomeFetchRef.current[taskKey];
        }
      })();
    });
  }

  useEffect(() => {
    if (searchInitialized) {
      return;
    }
    setSearchInitialized(true);
    void handleSearch('bitcoin');
  }, [searchInitialized]);

  useEffect(() => {
    if (!watchlist.length) {
      setSelectedSlug(null);
      return;
    }
    void refreshAll(false);
  }, []);

  useEffect(() => {
    if (!watchlist.length) {
      setSelectedSlug(null);
      return;
    }

    if (selectedSlug && !watchlist.some((item) => item.slug === selectedSlug)) {
      setSelectedSlug(watchlist[0].slug);
    }

    if (!selectedSlug) {
      setSelectedSlug(watchlist[0].slug);
    }
  }, [watchlist, selectedSlug]);

  useEffect(() => {
    if (!settings.autoRefreshEnabled || !watchlist.length) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshAll(true);
    }, settings.autoRefreshMinutes * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [watchlist, settings.autoRefreshEnabled, settings.autoRefreshMinutes, snapshots]);

  async function handleSearch(nextQuery?: string) {
    const actualQuery = (nextQuery ?? query).trim();
    if (!actualQuery || searching) {
      return;
    }

    setSearching(true);
    setSearchError('');

    try {
      const found = await apiClientRef.current.searchMarkets(actualQuery);
      setResults(found);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : locale === 'zh' ? '\u641c\u7d22\u5931\u8d25' : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function refreshAll(silentAlerts: boolean) {
    if (!watchlist.length || refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;

    setRefreshing(watchlist.map((item) => item.slug));

    try {
      const queue = [...watchlist];
      const settled: Array<
        | {
            ok: true;
            item: WatchItem;
            previous: MarketSnapshot | undefined;
            nextSnapshot: MarketSnapshot;
            silentAlerts: boolean;
          }
        | {
            ok: false;
            item: WatchItem;
            error: string;
          }
      > = [];

      async function worker() {
        while (queue.length) {
          const item = queue.shift();
          if (!item) {
            return;
          }

          if (settled.length) {
            await sleep(180);
          }

          try {
            const fresh = await apiClientRef.current.fetchMarketSnapshot(item.slug, item.selectedOutcomeIndex);
            const previous = snapshots[item.slug];
            const comparablePrevious = getComparableSnapshot(previous, fresh);
            const alerts = comparablePrevious ? evaluateAlerts(fresh, comparablePrevious, settings, locale) : [];
            settled.push({
              ok: true,
              item,
              previous,
              nextSnapshot: {
                ...fresh,
                alerts
              },
              silentAlerts
            });
          } catch (error) {
            settled.push({
              ok: false,
              item,
              error: error instanceof Error ? error.message : locale === 'zh' ? '\u5237\u65b0\u5931\u8d25' : 'Refresh failed'
            });
          }
        }
      }

      const workerCount = Math.min(2, watchlist.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      const nextSnapshots = { ...snapshots };
      const nextErrors = { ...marketErrors };
      const notificationQueue: AlertItem[] = [];
      let nextWatchlist = watchlist;

      for (const result of settled) {
        if (result.ok) {
          const { item, previous, nextSnapshot, silentAlerts: silent } = result;
          nextSnapshots[item.slug] = nextSnapshot;
          delete nextErrors[item.slug];
          rememberOutcomeSnapshot(nextSnapshot);
          prefetchOutcomes(item.slug, nextSnapshot);
          if (item.selectedOutcomeIndex !== nextSnapshot.selectedOutcomeIndex) {
            nextWatchlist = nextWatchlist.map((watchItem) =>
              watchItem.slug === item.slug
                ? { ...watchItem, selectedOutcomeIndex: nextSnapshot.selectedOutcomeIndex }
                : watchItem
            );
          }

          if (!silent && notificationPermission === 'granted') {
            const comparablePrevious = getComparableSnapshot(previous, nextSnapshot);
            const previousAlertKeys = new Set(comparablePrevious?.alerts?.map((alert) => alert.key) || []);
            const newAlerts = (nextSnapshot.alerts || []).filter((alert) => !previousAlertKeys.has(alert.key));
            notificationQueue.push(...newAlerts.map((alert) => ({ ...alert, detail: `${item.question}: ${alert.detail}` })));
          }
        } else {
          nextErrors[result.item.slug] = result.error;
        }
      }

      startTransition(() => {
        setWatchlist(nextWatchlist);
        setSnapshots(nextSnapshots);
        setMarketErrors(nextErrors);
        setRefreshing([]);
      });

      notificationQueue.slice(0, 3).forEach((alert) => {
        new Notification(alert.title, {
          body: alert.detail
        });
      });
    } finally {
      refreshInFlightRef.current = false;
      setRefreshing((current) => (current.length ? [] : current));
    }
  }

  async function addToWatchlist(result: SearchResult) {
    if (watchlist.some((item) => item.slug === result.slug)) {
      setSelectedSlug(result.slug);
      return;
    }

    const nextItem: WatchItem = {
      ...result,
      addedAt: new Date().toISOString()
    };

    setWatchlist((current) => [nextItem, ...current]);
    setSelectedSlug(nextItem.slug);
    setNewsPages((current) => ({ ...current, [nextItem.slug]: 1 }));
    setRefreshing((current) => [...current, nextItem.slug]);

    try {
      const fresh = await apiClientRef.current.fetchMarketSnapshot(nextItem.slug, nextItem.selectedOutcomeIndex);
      updateWatchItemOutcome(nextItem.slug, fresh.selectedOutcomeIndex);
      rememberOutcomeSnapshot(fresh);
      prefetchOutcomes(nextItem.slug, fresh);
      startTransition(() => {
        setSnapshots((current) => ({
          ...current,
          [nextItem.slug]: {
            ...fresh,
            alerts: evaluateAlerts(fresh, undefined, settings, locale)
          }
        }));
      });
    } catch (error) {
      setMarketErrors((current) => ({
        ...current,
        [nextItem.slug]: error instanceof Error ? error.message : locale === 'zh' ? '\u52a0\u8f7d\u5931\u8d25' : 'Failed to load'
      }));
    } finally {
      setRefreshing((current) => current.filter((slug) => slug !== nextItem.slug));
    }
  }

  async function changeOutcome(slug: string, outcomeIndex: number) {
    const target = watchlist.find((item) => item.slug === slug);
    const previousSnapshot = snapshots[slug];
    if (!target || refreshing.includes(slug)) {
      return;
    }

    if (target.selectedOutcomeIndex === outcomeIndex && previousSnapshot?.selectedOutcomeIndex === outcomeIndex) {
      return;
    }

    const cached = getCachedOutcomeSnapshot(slug, outcomeIndex);
    if (cached) {
      updateWatchItemOutcome(slug, outcomeIndex);
      setMarketErrors((current) => {
        const next = { ...current };
        delete next[slug];
        return next;
      });
      startTransition(() => {
        setSnapshots((current) => ({
          ...current,
          [slug]: cached
        }));
      });
      prefetchOutcomes(slug, cached);
      return;
    }

    setRefreshing((current) => (current.includes(slug) ? current : [...current, slug]));

    try {
      const fresh = await apiClientRef.current.fetchMarketSnapshot(slug, outcomeIndex);
      updateWatchItemOutcome(slug, fresh.selectedOutcomeIndex);
      rememberOutcomeSnapshot(fresh);
      prefetchOutcomes(slug, fresh);
      setMarketErrors((current) => {
        const next = { ...current };
        delete next[slug];
        return next;
      });
      startTransition(() => {
        setSnapshots((current) => ({
          ...current,
          [slug]: {
            ...fresh,
            alerts: []
          }
        }));
      });
    } catch (error) {
      setMarketErrors((current) => ({
        ...current,
        [slug]: error instanceof Error ? error.message : '鍒囨崲澶辫触'
      }));
    } finally {
      setRefreshing((current) => current.filter((itemSlug) => itemSlug !== slug));
    }
  }

  function removeFromWatchlist(slug: string) {
    const nextWatchlist = watchlist.filter((item) => item.slug !== slug);
    const nextSnapshots = { ...snapshots };
    const nextErrors = { ...marketErrors };
    const nextPages = { ...newsPages };
    delete nextSnapshots[slug];
    delete nextErrors[slug];
    delete nextPages[slug];

    setWatchlist(nextWatchlist);
    setSnapshots(nextSnapshots);
    setMarketErrors(nextErrors);
    setNewsPages(nextPages);

    if (selectedSlug === slug) {
      setSelectedSlug(nextWatchlist[0]?.slug || null);
    }
  }

  async function requestNotificationAccess() {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  const allSnapshots = Object.values(snapshots);
  const totalAlerts = allSnapshots.reduce((sum, snapshot) => sum + (snapshot.alerts?.length || 0), 0);
  const avgMove =
    allSnapshots.length > 0
      ? allSnapshots.reduce((sum, snapshot) => sum + Math.abs(snapshot.probabilityChange24h), 0) / allSnapshots.length
      : 0;
  const coveredCount = allSnapshots.filter((snapshot) => snapshot.newsCoverage).length;
  const allAlerts = Object.entries(snapshots)
    .flatMap(([slug, snapshot]) =>
      (snapshot.alerts || []).map((alert) => ({
        ...alert,
        slug,
        question: snapshot.question
      }))
    )
    .sort((a, b) => {
      const severityScore = a.severity === 'high' ? 1 : 0;
      const nextSeverityScore = b.severity === 'high' ? 1 : 0;
      if (severityScore !== nextSeverityScore) {
        return nextSeverityScore - severityScore;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const selectedItem = watchlist.find((item) => item.slug === selectedSlug) || watchlist[0] || null;
  const selectedSnapshot = selectedItem ? snapshots[selectedItem.slug] : undefined;
  const selectedError = selectedItem ? marketErrors[selectedItem.slug] : '';
  const selectedRefreshing = selectedItem ? refreshing.includes(selectedItem.slug) : false;
  const selectedTweetBuckets = resolveTweetBuckets(selectedSnapshot);
  const selectedNewsFeed = resolveNewsFeed(selectedSnapshot);
  const selectedNewsPage = selectedItem ? newsPages[selectedItem.slug] || 1 : 1;
  const selectedOutcomeIndex = selectedSnapshot?.selectedOutcomeIndex ?? selectedItem?.selectedOutcomeIndex ?? 0;
  const moveTone = getMoveTone(selectedSnapshot?.probabilityChange24h ?? null);
  const probability24hAgo = selectedSnapshot
    ? Math.max(0, Math.min(100, selectedSnapshot.currentProbability - selectedSnapshot.probabilityChange24h))
    : null;

  useEffect(() => {
    document.title = selectedItem?.question
      ? `${truncateTitle(selectedItem.question)} | ${copy.brandName}`
      : `${copy.brandName} | ${copy.heroEyebrow}`;
  }, [copy.brandName, copy.heroEyebrow, selectedItem]);

  useEffect(() => {
    if (!selectedItem || !selectedSnapshot) {
      return;
    }
    prefetchOutcomes(selectedItem.slug, selectedSnapshot);
  }, [selectedItem, selectedSnapshot]);

  return (
    <div className={classNames('app-shell', className)}>
      <div className="app-backdrop" />

      <main className="content content-wide">
        <section className="workspace-hero">
          <div className="brand-card brand-card-inline">
            <div className="hero-copy-stack">
              <div>
                <p className="eyebrow">{copy.heroEyebrow}</p>
                <h1>{copy.heroTitle}</h1>
                <p className="brand-copy">{copy.heroCopy}</p>
              </div>
              <div className="hero-meta-row">
                <div className="brand-links-row">
                  <a className="brand-link-chip brand-link-chip-muted" href={BRAND_LINKS.twitterHref} target="_blank" rel="noreferrer">
                    {copy.topLinks.twitter}
                  </a>
                </div>
              </div>
            </div>
            <div className="hero-actions">
              <div className="launcher-row">
                <div className="locale-switch" role="tablist" aria-label="Language switch">
                  <button className={classNames('locale-pill', locale === 'zh' && 'locale-pill-active')} type="button" onClick={() => setLocale('zh')}>
                    {copy.toggle.zh}
                  </button>
                  <button className={classNames('locale-pill', locale === 'en' && 'locale-pill-active')} type="button" onClick={() => setLocale('en')}>
                    {copy.toggle.en}
                  </button>
                </div>
                <button className="launcher-button" type="button" onClick={() => setSearchModalOpen(true)}>
                  {copy.actions.search}
                </button>
                <button className="launcher-button launcher-button-muted" type="button" onClick={() => setSettingsModalOpen(true)}>
                  {copy.actions.settings}
                </button>
                <button className="primary-button" type="button" onClick={() => void refreshAll(false)} disabled={!watchlist.length}>
                  {refreshing.length ? copy.actions.refreshing : copy.actions.refresh}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="hero-grid">
          <article className="hero-tile hero-tile-primary">
            <p>{copy.stats.watchlist}</p>
            <strong>{watchlist.length}</strong>
            <span>{copy.stats.watchlistNote}</span>
          </article>
          <article className="hero-tile">
            <p>{copy.stats.alerts}</p>
            <strong>{totalAlerts}</strong>
            <span>{copy.stats.alertsNote}</span>
          </article>
          <article className="hero-tile">
            <p>{copy.stats.move}</p>
            <strong>{formatPoints(avgMove)}</strong>
            <span>{copy.stats.moveNote}</span>
          </article>
          <article className="hero-tile">
            <p>{copy.stats.coverage}</p>
            <strong>{coveredCount}</strong>
            <span>{copy.stats.coverageNote}</span>
          </article>
        </section>

        <section className="alert-center">
          <div className="panel-head">
            <h2>{copy.alertCenter.title}</h2>
            <span className="panel-note">{copy.alertCenter.note}</span>
          </div>
          {allAlerts.length === 0 ? (
            <div className="empty-box">{copy.alertCenter.empty}</div>
          ) : (
            <div className="alert-list">
              {allAlerts.map((alert) => (
                <article className={classNames('alert-card', alert.severity === 'high' && 'alert-card-high')} key={alert.key}>
                  <div>
                    <p className="alert-title">{alert.title}</p>
                    <h3>{alert.question}</h3>
                    <p className="alert-detail">{alert.detail}</p>
                  </div>
                  <span className="alert-time">{formatTimeAgo(alert.createdAt, locale)}</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="market-switcher">
          <div className="panel-head">
            <div>
              <p className="eyebrow">{copy.marketList.eyebrow}</p>
              <h2>{copy.marketList.title}</h2>
            </div>
            <span className="panel-note">{copy.marketList.note}</span>
          </div>
          <BubbleNavigator watchlist={watchlist} snapshots={snapshots} selectedSlug={selectedItem?.slug || null} onSelect={setSelectedSlug} emptyText={copy.empty.noMarket} />
        </section>

        <section className="market-grid market-grid-single">
          {!selectedItem ? (
            <div className="empty-state">
              <h3>{copy.empty.title}</h3>
              <p>{copy.empty.note}</p>
            </div>
          ) : (
            <article className="market-card market-card-focus" key={selectedItem.slug}>
              <div className="market-head market-head-collapsible">
                <div className="market-header-top">
                  <div className="market-title-wrap">
                    {selectedItem.icon ? (
                      <img className="market-icon" src={selectedItem.icon} alt="" />
                    ) : (
                      <div className="market-icon fallback-icon">{selectedItem.question.slice(0, 1)}</div>
                    )}
                    <div className="market-copy">
                      <p className="eyebrow">{locale === 'zh' ? '\u5e02\u573a\u8be6\u60c5' : 'Market detail'}</p>
                      <h3>{selectedItem.question}</h3>
                      <div className="sub-copy">
                        <span>{selectedSnapshot?.eventTitle || (locale === 'zh' ? '\u672a\u5206\u7ec4' : 'Ungrouped')}</span>
                        <span>{selectedSnapshot ? (locale === 'zh' ? `更新于 ${formatTimeAgo(selectedSnapshot.refreshedAt, 'zh')}` : `Updated ${formatTimeAgo(selectedSnapshot.refreshedAt, 'en')}`) : (locale === 'zh' ? '等待数据' : 'Waiting for data')}</span>
                        {selectedSnapshot?.eventMarketCount ? <span>{locale === 'zh' ? `${selectedSnapshot.eventMarketCount} 个相关市场` : `${selectedSnapshot.eventMarketCount} related markets`}</span> : null}
                      </div>
                    </div>
                  </div>
                  <div className="card-actions">
                    <a
                      className="link-button"
                      href={selectedSnapshot?.marketUrl || `https://polymarket.com/market/${selectedItem.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {copy.actions.openMarket}
                    </a>
                    <button className="ghost-button" type="button" onClick={() => removeFromWatchlist(selectedItem.slug)}>
                      {copy.actions.remove}
                    </button>
                  </div>
                </div>

                {selectedSnapshot && selectedSnapshot.outcomes.length > 1 ? (
                  <div className="market-header-bottom">
                    <div className="market-header-switch">
                      <div className="outcome-switcher">
                        {selectedSnapshot.outcomes.map((outcome, index) => (
                          <button
                            className={classNames('outcome-chip', index === selectedOutcomeIndex && 'outcome-chip-active')}
                            type="button"
                            key={`${selectedItem.slug}-outcome-${outcome.label}-${index}`}
                            onClick={() => void changeOutcome(selectedItem.slug, index)}
                            disabled={selectedRefreshing && index !== selectedOutcomeIndex}
                          >
                            <span>{outcome.label}</span>
                            <strong>{formatPercent(outcome.probability)}</strong>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {selectedError ? <div className="error-box">{selectedError}</div> : null}

              {!selectedSnapshot ? (
                <div className="loading-box">{selectedRefreshing ? (locale === 'zh' ? '\u52a0\u8f7d\u4e2d...' : 'Loading...') : (locale === 'zh' ? '\u7b49\u5f85\u6570\u636e' : 'Waiting for data')}</div>
              ) : (
                <>
                  <div className="metrics-grid">
                    <div className="metric metric-probability">
                      <span>{locale === 'zh' ? '\u5f53\u524d\u6982\u7387' : 'Current odds'}</span>
                      <strong>{formatPercent(selectedSnapshot.currentProbability)}</strong>
                      <small>{selectedSnapshot.currentOutcomeLabel}</small>
                    </div>
                    <div
                      className={classNames(
                        'metric',
                        'metric-move',
                        moveTone === 'up' && 'metric-move-up',
                        moveTone === 'down' && 'metric-move-down',
                        moveTone === 'flat' && 'metric-move-flat'
                      )}
                    >
                      <div className="metric-headline">
                        <span>{locale === 'zh' ? '24h \u53d8\u5316' : '24h move'}</span>
                        <b className={classNames('metric-state-badge', `metric-state-${moveTone}`)}>
                          {getMoveLabel(selectedSnapshot.probabilityChange24h, locale)}
                        </b>
                      </div>
                      <strong className={moveTone === 'flat' ? '' : selectedSnapshot.probabilityChange24h >= 0 ? 'positive' : 'negative'}>
                        {formatMoveValue(selectedSnapshot.probabilityChange24h)}
                      </strong>
                      <div className="metric-move-bar">
                        <div className={classNames('metric-move-fill', `metric-move-fill-${moveTone}`)} />
                      </div>
                      <small>
                        {locale === 'zh' ? '24h\u524d ' : '24h ago '}
                        {formatPercent(probability24hAgo, probability24hAgo != null && probability24hAgo < 1 ? 2 : 1)} {'->'} {locale === 'zh' ? '\u73b0\u5728 ' : 'Now '}
                        {formatPercent(
                          selectedSnapshot.currentProbability,
                          selectedSnapshot.currentProbability < 1 ? 2 : 1
                        )}
                      </small>
                    </div>
                    <div className="metric metric-spread">
                      <span>{locale === 'zh' ? '\u4ef7\u5dee' : 'Spread'}</span>
                      <strong>{formatSpread(selectedSnapshot.spread)}</strong>
                      <small>{formatSpreadBandLabel(selectedSnapshot.liquidityBand, locale)}</small>
                    </div>
                    <div className="metric metric-news">
                      <span>{locale === 'zh' ? '\u8d44\u8baf\u6570\u91cf' : 'Coverage'}</span>
                      <strong>{formatCompact(selectedSnapshot.newsCount, locale)}</strong>
                      <small>{locale === 'zh' ? `${selectedSnapshot.newsCount24h} \u6761\u8fd1 24h` : `${selectedSnapshot.newsCount24h} in the last 24h`}</small>
                    </div>
                    <div className="metric metric-holder">
                      <span>{locale === 'zh' ? '大户集中' : 'Holder concentration'}</span>
                      <strong>{selectedSnapshot.holders.isConcentrated ? (locale === 'zh' ? '偏高' : 'Elevated') : (locale === 'zh' ? '可控' : 'Contained')}</strong>
                      <small>
                        {locale === 'zh'
                          ? `Top1 占${selectedSnapshot.holders.isComplete === true ? '全量仓位' : '已抓取仓位'} ${formatPercent(selectedSnapshot.holders.topOneShare * 100)}`
                          : `Top1 share of ${selectedSnapshot.holders.isComplete === true ? 'all' : 'tracked'} holdings ${formatPercent(selectedSnapshot.holders.topOneShare * 100)}`}
                      </small>
                    </div>
                    <div className="metric metric-volume">
                      <span>{locale === 'zh' ? '24h 成交额' : '24h volume'}</span>
                      <strong>{formatCurrency(selectedSnapshot.volume24h)}</strong>
                      <small>{locale === 'zh' ? `总成交 ${formatCurrency(selectedSnapshot.volumeTotal)}` : `Total ${formatCurrency(selectedSnapshot.volumeTotal)}`}</small>
                    </div>
                  </div>

                  <div className="viz-grid">
                    <HeatmapChart cells={selectedSnapshot.heatmap24h} locale={locale} />
                    <TweetBarChart
                      buckets={selectedTweetBuckets}
                      totalCount={selectedSnapshot.tweetCount ?? selectedTweetBuckets.reduce((sum, bucket) => sum + bucket.count, 0)}
                      locale={locale}
                    />
                    <HolderTableCard summary={selectedSnapshot.holders} locale={locale} />
                  </div>

                  <div className="status-row">
                    {(selectedSnapshot.alerts || []).map((alert) => (
                      <span className={classNames('status-pill', alert.severity === 'high' && 'status-pill-high')} key={alert.key}>
                        {alert.title}
                      </span>
                    ))}
                    {selectedSnapshot.holders.isConcentrated ? <span className="status-pill">{locale === 'zh' ? '\u5927\u6237\u96c6\u4e2d' : 'Holder concentration'}</span> : null}
                    {!selectedSnapshot.newsCoverage ? <span className="status-pill muted">{locale === 'zh' ? '\u6682\u65e0\u8d44\u8baf' : 'No coverage'}</span> : null}
                  </div>

                  <NewsFeedCard
                    items={selectedNewsFeed}
                    currentPage={selectedNewsPage}
                    onPageChange={(page) =>
                      setNewsPages((current) => ({
                        ...current,
                        [selectedItem.slug]: page
                      }))
                    }
                    marketUrl={selectedSnapshot.marketUrl}
                    covered={selectedSnapshot.newsCoverage}
                    locale={locale}
                  />
                </>
              )}
            </article>
          )}
        </section>
      
        <footer className="site-footer">
          <div className="footer-grid">
            <div className="footer-block footer-brand-block">
              <h3>{copy.footer.aboutTitle}</h3>
              <p>{copy.footer.aboutText}</p>
            </div>
            <div className="footer-block footer-links-block">
              <h4>{copy.footer.twitterTitle}</h4>
              <div className="footer-link-stack">
                <div className="footer-link-item">
                  <a className="footer-link" href={BRAND_LINKS.twitterHref} target="_blank" rel="noreferrer">{copy.footer.twitterTitle}</a>
                  <p>{copy.footer.twitterText}</p>
                </div>
              </div>
            </div>
            <div className="footer-block">
              <h4>{copy.footer.collabTitle}</h4>
              <p>{copy.footer.collabText}</p>
            </div>
          </div>
          <div className="footer-bottom">
            <span>{copy.brandName}</span>
            <span>{copy.footer.rights}</span>
          </div>
        </footer>
      </main>

      <DraggableModal
        open={searchModalOpen}
        title={copy.search.title}
        subtitle={copy.search.subtitle}
        closeLabel={copy.actions.close}
        position={searchModalPosition}
        onPositionChange={setSearchModalPosition}
        onClose={() => setSearchModalOpen(false)}
        wide
      >
        <SearchModalBody
          copy={copy}
          query={query}
          onQueryChange={setQuery}
          onSearch={() => void handleSearch()}
          searching={searching}
          searchError={searchError}
          results={results}
          watchlist={watchlist}
          onAdd={(result) => void addToWatchlist(result)}
        />
      </DraggableModal>

      <DraggableModal
        open={settingsModalOpen}
        title={copy.settings.title}
        subtitle={copy.settings.subtitle}
        closeLabel={copy.actions.close}
        position={settingsModalPosition}
        onPositionChange={setSettingsModalPosition}
        onClose={() => setSettingsModalOpen(false)}
      >
        <SettingsModalBody
          copy={copy}
          settings={settings}
          onSettingsChange={applySettings}
          notificationPermission={notificationPermission}
          onRequestNotification={() => void requestNotificationAccess()}
        />
      </DraggableModal>
    </div>
  );
}




