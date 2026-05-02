#!/usr/bin/env node

const { baseUrl, connections, durationSeconds, rate } = require('./lib/config');
const { requestJson } = require('./lib/http');
const { productPayload } = require('./lib/products');
const { runLoad } = require('./lib/load-runner');

const prefix = `write-${Date.now()}`;

runLoad({
  name: 'POST /api/products',
  connections,
  durationSeconds,
  rate,
  task: async ({ workerId, requestNumber }) => {
    const index = `${workerId}-${requestNumber}-${Date.now()}`;
    await requestJson(`${baseUrl}/api/products`, {
      method: 'POST',
      body: JSON.stringify(productPayload(prefix, index)),
    });
  },
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
