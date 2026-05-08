const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { Writable } = require('node:stream');

class NullWritable extends Writable {
  _write(_chunk, _encoding, callback) {
    callback();
  }
}

function resolveOptional(packageName) {
  try {
    return require(packageName);
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      return undefined;
    }
    throw error;
  }
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

async function measure(name, fn, options = {}) {
  const iterations = options.iterations ?? 100_000;
  const warmup =
    options.warmup ?? Math.min(10_000, Math.floor(iterations / 10));

  for (let i = 0; i < warmup; i++) {
    await fn(i);
  }

  const memoryBefore = process.memoryUsage().heapUsed;
  const durations = [];
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const itemStart = performance.now();
    await fn(i);
    durations.push(performance.now() - itemStart);
  }

  const durationMs = performance.now() - start;
  const memoryAfter = process.memoryUsage().heapUsed;

  return {
    name,
    status: 'ok',
    iterations,
    durationMs,
    operationsPerSecond: (iterations / durationMs) * 1000,
    averageUs: (durationMs * 1000) / iterations,
    p50Us: percentile(durations, 50) * 1000,
    p95Us: percentile(durations, 95) * 1000,
    p99Us: percentile(durations, 99) * 1000,
    heapDeltaBytes: memoryAfter - memoryBefore,
  };
}

function skipped(name, reason) {
  return {
    name,
    status: 'skipped',
    reason,
    iterations: 0,
    durationMs: 0,
    operationsPerSecond: 0,
    averageUs: 0,
    p50Us: 0,
    p95Us: 0,
    p99Us: 0,
    heapDeltaBytes: 0,
  };
}

function markdownTable(rows) {
  const lines = [
    '| Benchmark | Status | Iterations | ops/sec | avg us/op | p95 us | p99 us | heap delta | Notes |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];

  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.status,
        row.iterations.toLocaleString(),
        row.operationsPerSecond
          ? Math.round(row.operationsPerSecond).toLocaleString()
          : '-',
        row.averageUs ? row.averageUs.toFixed(2) : '-',
        row.p95Us ? row.p95Us.toFixed(2) : '-',
        row.p99Us ? row.p99Us.toFixed(2) : '-',
        `${Math.round(row.heapDeltaBytes / 1024).toLocaleString()} KiB`,
        row.reason ?? '',
      ].join(' | '),
    );
  }

  return `${lines.join('\n')}\n`;
}

function writeReport({
  title,
  description,
  rows,
  outputFile,
  metadata = [],
  notes = [],
}) {
  const now = new Date().toISOString();
  const content = [
    `# ${title}`,
    '',
    description,
    '',
    '## Run Metadata',
    '',
    `- Generated: ${now}`,
    `- Node.js: ${process.version}`,
    `- Platform: ${os.platform()} ${os.release()} ${os.arch()}`,
    `- CPU: ${os.cpus()[0]?.model ?? 'unknown'}`,
    `- Logical cores: ${os.cpus().length}`,
    ...metadata.map((item) => `- ${item}`),
    '',
    '## Results',
    '',
    markdownTable(rows),
    '',
    '## Reading These Numbers',
    '',
    '- Higher `ops/sec` is better.',
    '- Lower `avg`, `p95`, and `p99` microseconds per operation are better.',
    '- These are local process benchmarks, not a replacement for load tests in a real service.',
    ...notes.map((item) => `- ${item}`),
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, content);
  return content;
}

function repoPath(...parts) {
  return path.join(__dirname, '..', '..', ...parts);
}

function resultPath(fileName) {
  return repoPath('bench', 'result', fileName);
}

module.exports = {
  NullWritable,
  measure,
  markdownTable,
  repoPath,
  resultPath,
  resolveOptional,
  skipped,
  writeReport,
};
