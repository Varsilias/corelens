const { performance } = require('node:perf_hooks');
const { summarize } = require('./stats');

async function runLoad({ name, durationSeconds, connections, rate, task }) {
  const deadline = performance.now() + durationSeconds * 1000;
  const result = {
    requests: 0,
    errors: 0,
    latencies: [],
    elapsedMs: 0,
  };

  let nextAllowedAt = performance.now();
  const intervalMs = rate > 0 ? 1000 / rate : 0;

  async function worker(workerId) {
    while (performance.now() < deadline) {
      if (intervalMs > 0) {
        const now = performance.now();
        if (now < nextAllowedAt) {
          await new Promise((resolve) => setTimeout(resolve, nextAllowedAt - now));
        }
        nextAllowedAt += intervalMs;
      }

      const start = performance.now();
      try {
        await task({ workerId, requestNumber: result.requests });
      } catch (_error) {
        result.errors += 1;
      } finally {
        result.requests += 1;
        result.latencies.push(performance.now() - start);
      }
    }
  }

  const start = performance.now();
  await Promise.all(
    Array.from({ length: connections }, (_, workerId) => worker(workerId)),
  );
  result.elapsedMs = performance.now() - start;

  console.log(JSON.stringify({ name, ...summarize(result) }, null, 2));
}

module.exports = { runLoad };
