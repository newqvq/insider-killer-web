export type SearchResult = {
  slug: string;
  question: string;
  conditionId: string;
  icon: string | null;
  active: boolean;
  endDate: string | null;
  tags: string[];
};

export type WatchItem = SearchResult & {
  addedAt: string;
  selectedOutcomeIndex?: number | null;
};

export type OutcomeSummary = {
  label: string;
  probability: number;
};

export type NewsItem = {
  signature: string;
  category: string;
  title: string;
  source: string;
  correlation: string;
  url: string | null;
  publishedAt: string;
  score: number;
};

export type HolderItem = {
  name: string;
  amount: number;
  proxyWallet: string;
  outcomeIndex: number;
};

export type HolderSummary = {
  holders: HolderItem[];
  topHolderName: string | null;
  topHolderAmount: number;
  holderCount: number;
  totalTrackedAmount: number;
  isComplete: boolean;
  topOneShare: number;
  topThreeShare: number;
  isConcentrated: boolean;
};

export type HistoryPoint = {
  t: number;
  p: number;
};

export type HeatmapCell = {
  slot: number;
  value: number;
  change: number;
};

export type TweetBucket = {
  slot: number;
  count: number;
  startAt?: string;
  endAt?: string;
};

export type AlertItem = {
  key: string;
  type: 'probability' | 'news' | 'spread' | 'volume';
  severity: 'high' | 'medium';
  title: string;
  detail: string;
  createdAt: string;
};

export type MarketSnapshot = {
  slug: string;
  question: string;
  image: string | null;
  conditionId: string;
  marketUrl: string;
  eventTitle: string | null;
  eventSlug: string | null;
  eventMarketCount: number | null;
  currentOutcomeLabel: string;
  selectedOutcomeIndex: number;
  currentProbability: number;
  probabilityChange24h: number;
  probabilityDirection: 'up' | 'down';
  volumeTotal: number;
  volume24h: number | null;
  volume1w: number | null;
  spread: number | null;
  liquidityBand: string;
  outcomes: OutcomeSummary[];
  history24h: HistoryPoint[];
  heatmap24h: HeatmapCell[];
  tweetBucketsAll: TweetBucket[];
  tweetCount: number;
  newsCount: number;
  newsCount24h: number;
  newsCoverage: boolean;
  recentImportantNews: NewsItem[];
  newsFeed: NewsItem[];
  recentNewsKeys: string[];
  holders: HolderSummary;
  refreshedAt: string;
  alerts?: AlertItem[];
};

export type Settings = {
  probabilityChangeThreshold: number;
  spreadJumpThresholdPct: number;
  volumeSurgeFactor: number;
  newsLookbackHours: number;
  autoRefreshMinutes: number;
  autoRefreshEnabled: boolean;
};
