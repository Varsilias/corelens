import {
  logger,
  tracer,
  upstreamDuration,
  upstreamRequestsTotal,
} from '../config/corelens';

export type CatalogRecommendation = {
  sku: string;
  recommendation: string;
  inventory: number;
  traceparentReceived: boolean;
};

export async function fetchCatalogRecommendation(baseUrl: string, sku: string) {
  return tracer.withClientSpan(
    {
      name: 'GET catalog recommendation',
      attributes: {
        'http.method': 'GET',
        'http.route': '/mock/catalog/:sku',
        'catalog.sku': sku,
      },
    },
    async ({ traceparent }) => {
      const start = performance.now();
      const url = new URL(`/mock/catalog/${encodeURIComponent(sku)}`, baseUrl);

      try {
        upstreamRequestsTotal.inc(1, {
          upstream: 'catalog',
          result: 'attempt',
        });
        const response = await fetch(url, {
          headers: {
            traceparent,
            accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`catalog returned ${response.status}`);
        }

        const body = (await response.json()) as CatalogRecommendation;
        upstreamRequestsTotal.inc(1, {
          upstream: 'catalog',
          result: 'success',
        });
        logger.info('Catalog recommendation fetched', {
          sku,
          traceparentForwarded: true,
        });

        return body;
      } catch (error) {
        upstreamRequestsTotal.inc(1, { upstream: 'catalog', result: 'error' });
        logger.error('Catalog recommendation failed', {
          sku,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        upstreamDuration.observe((performance.now() - start) / 1000, {
          upstream: 'catalog',
        });
      }
    },
  );
}
