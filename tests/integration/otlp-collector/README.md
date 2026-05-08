# Corelens OTLP Collector Smoke Harness

This folder is a small local lab for proving that Corelens can talk to a real OpenTelemetry Collector over OTLP/HTTP.

It is intentionally separate from the Jest suite. Docker startup, Collector health checks, file exporter flushing, and container logs are external process lifecycle concerns. They are valuable release checks, but they should not make normal unit tests slower or flaky.

## What This Harness Gives You

The Docker Compose file starts one OpenTelemetry Collector Contrib container with:

- OTLP/HTTP receiver on `http://127.0.0.1:4318`
- Collector health check on `http://127.0.0.1:13133`
- Trace, metrics, and logs pipelines
- `debug` exporter so received telemetry appears in Collector logs
- `file` exporters so received telemetry is written under `otel-output/`

The smoke client sends:

- one trace span named `corelens smoke span`
- one log message named `corelens smoke log`
- one counter named `corelens_smoke_requests_total`
- one histogram named `corelens_smoke_duration_seconds`
- custom OTLP header `x-corelens-smoke: true`

## Why You May See A JSON Log Line First

The smoke client enables Corelens logs. Corelens always writes application logs to its primary stdout pipeline, so this line is expected:

```json
{"level":"info","message":"corelens smoke log",...}
```

That line only proves the local Corelens logger ran. It does not prove the log reached the Collector.

The smoke client now also writes a separate result line to stderr:

```text
CORELENS_OTLP_SMOKE_RESULT={...}
```

That result contains `lens.getStats()` and the shutdown result. Look there for `failedExportCount`, `lastExportError`, queue lengths, and shutdown errors.

## Start The Collector

From this folder:

```bash
mkdir -p otel-output
docker compose up -d
```

If you are running Docker Compose commands from the repository root instead, pass the Compose file explicitly:

```bash
docker compose -f tests/integration/otlp-collector/docker-compose.yml up -d
docker compose -f tests/integration/otlp-collector/docker-compose.yml logs -f otel-collector
```

Running `docker compose logs -f otel-collector` from the repository root without `-f tests/integration/otlp-collector/docker-compose.yml` will fail with:

```text
no configuration file provided: not found
```

That error means Docker Compose could not find the Compose file in your current directory. It does not tell you whether the Collector is healthy.

Check health:

```bash
curl -fsS http://127.0.0.1:13133/
```

If this command fails, stop there. The smoke client cannot prove anything useful until the Collector health endpoint is reachable.

Follow Collector logs in another terminal:

```bash
docker compose logs -f otel-collector
```

## Run The Smoke Client

From the repo root:

```bash
npx ts-node tests/integration/otlp-collector/smoke-client.ts
```

Expected terminal behavior:

- stdout shows the normal Corelens application log line.
- stderr shows `CORELENS_OTLP_SMOKE_RESULT=...`.
- stderr shows `CORELENS_OTLP_SMOKE_STATUS=ok`.
- the process exits with code `0`.

The smoke client now performs a health preflight against `http://127.0.0.1:13133/`. If the Collector is not reachable, it exits before emitting telemetry and prints a direct error.

## Inspect Collector Output

Give the Collector a moment to flush its batch processor and file exporters:

```bash
sleep 3
ls -lah tests/integration/otlp-collector/otel-output
```

Then inspect:

```bash
cat tests/integration/otlp-collector/otel-output/traces.json
cat tests/integration/otlp-collector/otel-output/metrics.json
cat tests/integration/otlp-collector/otel-output/logs.json
```

You are looking for:

- `corelens smoke span` in `traces.json`
- `corelens_smoke_requests_total` in `metrics.json`
- `corelens_smoke_duration_seconds` in `metrics.json`
- `corelens smoke log` in `logs.json`

## If The Files Are Empty

First check the smoke result line:

```text
CORELENS_OTLP_SMOKE_RESULT={...}
```

If `failedExportCount` is `0` for logs, metrics, and traces, Corelens successfully POSTed to the Collector and the Collector accepted the requests. Empty files then usually mean the issue is on the Collector/exporter side, not the SDK client side.

In your specific run, this was the most important clue:

```bash
curl -fsS http://127.0.0.1:13133/
# curl: (7) Failed to connect
```

That means the Collector was not reachable on the host at the time you checked. The empty files are expected in that state.

Work through these checks:

1. Confirm the Collector is healthy:

```bash
curl -fsS http://127.0.0.1:13133/
```

Also confirm Compose still sees the container:

```bash
cd tests/integration/otlp-collector
docker compose ps
```

or from the repository root:

```bash
docker compose -f tests/integration/otlp-collector/docker-compose.yml ps
```

2. Watch Collector logs while running the smoke client.

From this folder:

```bash
docker compose logs -f otel-collector
```

From the repository root:

```bash
docker compose -f tests/integration/otlp-collector/docker-compose.yml logs -f otel-collector
```

The `debug` exporter should print received telemetry. If debug output appears but files are empty, the receiver and pipelines are working and the issue is likely file exporter path, permissions, or flush timing.

3. Confirm the output directory is mounted into the container:

```bash
docker compose exec otel-collector ls -lah /tmp/otel-output
```

From the repository root:

```bash
docker compose -f tests/integration/otlp-collector/docker-compose.yml exec otel-collector ls -lah /tmp/otel-output
```

4. Stop the Collector to force final file exporter cleanup, then inspect again:

```bash
docker compose stop otel-collector
ls -lah otel-output
cat otel-output/traces.json
cat otel-output/metrics.json
cat otel-output/logs.json
```

5. If the files are still empty, remove the old files and restart cleanly.

From this folder:

```bash
docker compose down
rm -rf otel-output
mkdir -p otel-output
docker compose up -d
```

From the repository root:

```bash
docker compose -f tests/integration/otlp-collector/docker-compose.yml down
rm -rf tests/integration/otlp-collector/otel-output
mkdir -p tests/integration/otlp-collector/otel-output
docker compose -f tests/integration/otlp-collector/docker-compose.yml up -d
```

6. If the smoke result has failures, inspect `lastExportError`. Common causes:

- Collector is not listening on `127.0.0.1:4318`.
- Another process is using port `4318`.
- Docker published the port differently.
- The Collector config failed to load.
- The Collector image does not include the `file` exporter. Use the contrib image.

## If The Smoke Client Does Not Print Stats

The smoke client prints stats to stderr, not stdout. This keeps the normal application log line separate from the smoke result.

Run:

```bash
npx ts-node tests/integration/otlp-collector/smoke-client.ts \
  > /tmp/corelens-smoke-stdout.log \
  2> /tmp/corelens-smoke-stderr.log
```

Then:

```bash
cat /tmp/corelens-smoke-stdout.log
cat /tmp/corelens-smoke-stderr.log
```

If stderr does not contain `CORELENS_OTLP_SMOKE_RESULT=...`, then either:

- you are running an older copy of `smoke-client.ts`;
- `ts-node` is resolving a stale compiled file unexpectedly;
- the process exits before reaching shutdown;
- the Collector health preflight failed before telemetry was emitted.

The current smoke client exits non-zero if Corelens reports failed exports or retained queue items.

## If You Only See The Application Log

If your only visible output is:

```json
{"level":"info","message":"corelens smoke log",...}
```

run the smoke client again and redirect stderr/stdout separately:

```bash
npx ts-node tests/integration/otlp-collector/smoke-client.ts \
  > /tmp/corelens-smoke-stdout.log \
  2> /tmp/corelens-smoke-stderr.log

cat /tmp/corelens-smoke-stdout.log
cat /tmp/corelens-smoke-stderr.log
```

The `CORELENS_OTLP_SMOKE_RESULT=...` line should be in stderr.

## What A Passing Run Means

A passing local run means:

- Corelens generated all three signals.
- Corelens formatted OTLP trace, metric, and log payloads well enough for the Collector to accept them.
- Custom headers did not break export.
- Shutdown flushed queued telemetry.
- The Collector processed all three pipelines.

It does not prove backend-specific behavior for vendors such as Honeycomb, Grafana Cloud, Datadog, New Relic, or Tempo/Mimir/Loki. Those should each have their own endpoint/header examples later.

## Release-Gate Plan

Use this as a manual release gate until Docker is explicitly available in CI.

1. Start clean:

```bash
cd tests/integration/otlp-collector
docker compose down
rm -rf otel-output
mkdir -p otel-output
docker compose up -d
```

2. Wait for health:

```bash
curl -fsS http://127.0.0.1:13133/
```

3. Run the smoke client from the repo root:

```bash
npx ts-node tests/integration/otlp-collector/smoke-client.ts
```

4. Verify the smoke client exits with code `0`.
5. Verify `CORELENS_OTLP_SMOKE_RESULT` contains no failed exports for logs, metrics, or traces.
6. Verify `CORELENS_OTLP_SMOKE_STATUS=ok`.
7. Wait three seconds for Collector flush.
8. Verify the three output files contain the expected signal names.
9. Stop the Collector.
10. Record the Collector image tag and host platform in release notes.

## Adapting This For Your Own Collector

For a real application, you usually keep the same Corelens shape:

```ts
corelens({
  serviceName: 'my-service',
  export: {
    enabled: true,
    destination: {
      type: 'otlp-http',
      endpoint: 'http://otel-collector:4318',
      headers: {
        authorization: 'Bearer <token>',
      },
      timeoutMs: 3000,
    },
    signals: {
      logs: { enabled: true },
      metrics: { enabled: true },
      traces: { enabled: true },
    },
  },
});
```

Important details:

- Use the Collector base endpoint, for example `http://otel-collector:4318`.
- Do not include `/v1/traces`, `/v1/metrics`, or `/v1/logs` in the base endpoint. Corelens resolves those per signal.
- Keep timeouts short enough that shutdown cannot hang forever.
- Enable retry and circuit breaker for production.
- Start with all three signals enabled, then disable signals intentionally if your backend does not support one of them.

## Cleanup

From this folder:

```bash
docker compose down
```

To remove generated output:

```bash
rm -rf otel-output
```

## Notes

- The current Compose file uses `otel/opentelemetry-collector-contrib:latest` for convenience. Pin a known-good tag before using this as a CI or release gate.
- The file exporter requires the contrib Collector image.
- The Collector batch processor is intentionally enabled because most real deployments use it. This means file output may appear shortly after the client exits rather than instantly.
