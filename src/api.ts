import type { MarketSnapshot, SearchResult } from './types';

export type InsiderKillerApiClient = {
  searchMarkets: (query: string) => Promise<SearchResult[]>;
  fetchMarketSnapshot: (slug: string, outcomeIndex?: number | null) => Promise<MarketSnapshot>;
};

function normalizeBaseUrl(value?: string) {
  if (!value) {
    return '';
  }
  return value.replace(/\/+$/, '');
}

function buildUrl(pathname: string, apiBaseUrl?: string) {
  const base = normalizeBaseUrl(apiBaseUrl);
  return base ? `${base}${pathname}` : pathname;
}

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || 'Request failed');
  }
  return response.json();
}

export function createApiClient(apiBaseUrl?: string): InsiderKillerApiClient {
  return {
    async searchMarkets(query: string) {
      const data = await request<{ results: SearchResult[] }>(
        buildUrl(`/api/search?query=${encodeURIComponent(query)}`, apiBaseUrl)
      );
      return data.results;
    },

    async fetchMarketSnapshot(slug: string, outcomeIndex?: number | null) {
      const params = new URLSearchParams({ slug });
      if (typeof outcomeIndex === 'number' && Number.isFinite(outcomeIndex)) {
        params.set('outcomeIndex', String(outcomeIndex));
      }
      return request<MarketSnapshot>(buildUrl(`/api/market?${params.toString()}`, apiBaseUrl));
    }
  };
}

const defaultClient = createApiClient();

export async function searchMarkets(query: string): Promise<SearchResult[]> {
  return defaultClient.searchMarkets(query);
}

export async function fetchMarketSnapshot(slug: string, outcomeIndex?: number | null): Promise<MarketSnapshot> {
  return defaultClient.fetchMarketSnapshot(slug, outcomeIndex);
}
