function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}

function summarize(result) {
  const latencies = [...result.latencies].sort((a, b) => a - b);
  const elapsedSeconds = result.elapsedMs / 1000;

  return {
    requests: result.requests,
    errors: result.errors,
    elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
    requestsPerSecond: Number((result.requests / elapsedSeconds).toFixed(2)),
    latencyMs: {
      avg: Number(
        (
          latencies.reduce((sum, value) => sum + value, 0) /
          Math.max(latencies.length, 1)
        ).toFixed(2),
      ),
      p50: Number(percentile(latencies, 50).toFixed(2)),
      p95: Number(percentile(latencies, 95).toFixed(2)),
      p99: Number(percentile(latencies, 99).toFixed(2)),
      max: Number((latencies[latencies.length - 1] || 0).toFixed(2)),
    },
  };
}

module.exports = { summarize };
