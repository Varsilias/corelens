import type { Hono } from 'hono';

import { gatewayRequestsTotal, logger } from '../config/corelens';
import { fetchCatalogRecommendation } from '../services/catalog-client';

export function registerGatewayRoutes(app: Hono, upstreamBaseUrl: string) {
  app.get('/api/products/:sku/recommendations', async (c) => {
    const sku = c.req.param('sku');
    gatewayRequestsTotal.inc(1, {
      route: 'GET /api/products/:sku/recommendations',
    });

    const recommendation = await fetchCatalogRecommendation(
      upstreamBaseUrl,
      sku,
    );

    return c.json({
      product: sku,
      recommendation,
    });
  });

  app.get('/mock/catalog/:sku', (c) => {
    const sku = c.req.param('sku');
    const traceparent = c.req.header('traceparent');

    logger.info('Mock catalog handled request', {
      sku,
      traceparentReceived: Boolean(traceparent),
    });

    return c.json({
      sku,
      recommendation: `Bundle ${sku} with priority shipping`,
      inventory: 42,
      traceparentReceived: Boolean(traceparent),
    });
  });
}
