#!/usr/bin/env node

const autocannon = require('autocannon');
const { baseUrl, connections, durationSeconds } = require('./lib/config');

const instance = autocannon({
  title: 'GET /api/products',
  url: `${baseUrl}/api/products`,
  connections,
  duration: durationSeconds,
});

autocannon.track(instance, { renderProgressBar: true });

instance.on('done', (result) => {
  console.log(JSON.stringify(result, null, 2));
});
