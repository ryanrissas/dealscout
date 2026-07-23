import type { ListingProviderAdapter } from "./types";
import { resoAdapter } from "./reso/resoAdapter";
import { mockFeedAdapter, mockMlsAdapter } from "./mock/mockAdapter";

/**
 * Provider registry.
 *
 * Adapters are consulted in priority order (lower number = more authoritative).
 * The RESO Web API adapter is only used when real credentials are configured
 * (RESO_API_BASE_URL + RESO_API_TOKEN). When it is not configured, the app
 * falls back to the clearly-labeled mock sources so every feature remains
 * demonstrable without violating any data-provider terms.
 *
 * DEALSCOUT_DISABLE_MOCKS=1 removes the mock sources entirely (for production
 * deployments running only on licensed feeds).
 */
export function allAdapters(): ListingProviderAdapter[] {
  const adapters: ListingProviderAdapter[] = [resoAdapter, mockMlsAdapter, mockFeedAdapter];
  return adapters.sort((a, b) => a.priority - b.priority);
}

export function activeAdapters(): ListingProviderAdapter[] {
  const disableMocks = process.env.DEALSCOUT_DISABLE_MOCKS === "1";
  return allAdapters().filter((a) => {
    if (a.kind === "mock" && disableMocks) return false;
    return a.isConfigured();
  });
}

export function adapterByKey(key: string): ListingProviderAdapter | undefined {
  return allAdapters().find((a) => a.key === key);
}
