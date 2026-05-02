const baseUrl = process.env.BENCH_BASE_URL || 'http://localhost:3000';

function intEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

module.exports = {
  baseUrl,
  durationSeconds: intEnv('BENCH_DURATION_SECONDS', 20),
  connections: intEnv('BENCH_CONNECTIONS', 100),
  rate: intEnv('BENCH_RATE', 0),
  productCount: intEnv('BENCH_PRODUCT_COUNT', 50),
  orderProductPool: intEnv('BENCH_ORDER_PRODUCT_POOL', 25),
  loggerMessages: intEnv('BENCH_LOGGER_MESSAGES', 100000),
};
