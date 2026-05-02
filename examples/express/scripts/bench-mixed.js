#!/usr/bin/env node

const {
  baseUrl,
  connections,
  durationSeconds,
  orderProductPool,
  rate,
} = require('./lib/config');
const { requestJson } = require('./lib/http');
const { runLoad } = require('./lib/load-runner');
const { productPayload, seedProducts } = require('./lib/products');

async function main() {
  const products = await seedProducts(orderProductPool, `mixed-seed-${Date.now()}`);
  const writePrefix = `mixed-write-${Date.now()}`;

  await runLoad({
    name: 'mixed ecommerce API',
    connections,
    durationSeconds,
    rate,
    task: async ({ workerId, requestNumber }) => {
      const selector = requestNumber % 10;

      if (selector < 5) {
        await requestJson(`${baseUrl}/api/products`);
        return;
      }

      if (selector < 8) {
        const product = products[requestNumber % products.length];
        await requestJson(`${baseUrl}/api/orders`, {
          method: 'POST',
          body: JSON.stringify({
            customerEmail: `mixed-${workerId}-${requestNumber}@example.com`,
            items: [{ productId: product.id, quantity: 1 }],
          }),
        });
        return;
      }

      await requestJson(`${baseUrl}/api/products`, {
        method: 'POST',
        body: JSON.stringify(
          productPayload(writePrefix, `${workerId}-${requestNumber}-${Date.now()}`),
        ),
      });
    },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
