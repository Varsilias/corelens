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
const { seedProducts } = require('./lib/products');

async function main() {
  const products = await seedProducts(orderProductPool, `order-${Date.now()}`);

  await runLoad({
    name: 'POST /api/orders',
    connections,
    durationSeconds,
    rate,
    task: async ({ workerId, requestNumber }) => {
      const product = products[requestNumber % products.length];
      await requestJson(`${baseUrl}/api/orders`, {
        method: 'POST',
        body: JSON.stringify({
          customerEmail: `bench-${workerId}-${requestNumber}@example.com`,
          items: [{ productId: product.id, quantity: 1 }],
        }),
      });
    },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
