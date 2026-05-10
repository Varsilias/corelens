# Contributing

Thanks for taking the time to improve Corelens. The project is meant to stay small enough to understand, but solid enough for real Node.js services.

## Project Goals

- Provide logs, metrics, and traces behind one practical SDK.
- Keep production behavior predictable under load.
- Make shutdown, exporter failure, and queue overflow behavior explicit.
- Support framework adapters without forcing framework dependencies on every user.
- Stay honest about scope. Corelens should work well for its supported paths instead of pretending to be every observability tool at once.

## Local Setup

```sh
git clone https://github.com/Varsilias/corelens.git
cd corelens
npm install
npm run build
npm test
```

Corelens requires Node.js 18 or newer.

## Useful Commands

```sh
npm run build
npm test
npm run test:cov
npm run lint
npm run bench
npm run version:patch
npm run version:minor
npm run version:major
npm pack --dry-run
```

The package is CommonJS output with TypeScript declaration files generated into `dist/`.

Use the version scripts before release work that changes the published package version. They update `package.json` and `package-lock.json` together.

## Running Examples

Each example has its own README:

- `examples/express`
- `examples/fastify`
- `examples/hono`

Start with the README in the example you are changing. Keep the example focused on the framework behavior it is meant to demonstrate.

## Running Benchmarks

Benchmarks live in `bench/`.

```sh
npm run bench
npm run bench:logger
npm run bench:metrics
npm run bench:traces
npm run bench:frameworks
npm run bench:exporter-failure
```

Generated markdown results are written under `bench/result/`. Do not claim Corelens is faster than another library unless the benchmark result in the repo supports that exact claim.

## OTLP Collector Smoke Test

The collector smoke test docs live in `tests/integration/otlp-collector/README.md`.

Typical flow:

```sh
docker compose -f tests/integration/otlp-collector/docker-compose.yml up -d
npx ts-node tests/integration/otlp-collector/smoke-client.ts
docker compose -f tests/integration/otlp-collector/docker-compose.yml logs -f otel-collector
```

Use this when changing OTLP endpoints, export batching, shutdown, or formatter behavior.

## Code Style

- Prefer clear TypeScript over clever abstractions.
- Keep public APIs stable unless there is a real packaging or correctness problem.
- Keep configuration behavior explicit and well tested.
- Avoid large rewrites when a narrow fix is enough.
- Add comments only when they explain non-obvious behavior.

Run formatting and linting before opening a PR.

## Testing Expectations

Add or update tests when changing:

- Config validation or normalization.
- Export destination behavior.
- Retry, circuit breaker, queue, or shutdown logic.
- Logs, metrics, traces, propagation, or sampling behavior.
- Framework adapters.
- Package exports or type declarations.

Prefer small tests that exercise the behavior directly. Add integration tests when cross-module behavior matters.

## Performance Expectations

Corelens code runs in application hot paths. Treat these areas carefully:

- Logger calls.
- Metric recording.
- Span creation and context propagation.
- HTTP adapter middleware/hooks.
- Export queue enqueue/dequeue paths.

Avoid unnecessary serialization, copying, unbounded memory growth, or synchronous work in request paths.

## Adding a Framework Adapter

When adding a new adapter:

1. Keep it in `src/adapter/<framework>/`.
2. Register it explicitly from the host application.
3. Support HTTP metrics and tracing consistently with existing adapters.
4. Preserve route names where the framework exposes them.
5. Ignore configured routes such as `/metrics` and `/health`.
6. Add integration tests under `tests/integration/`.
7. Add an example only if it demonstrates something materially useful.
8. Update package exports only if a new public entry point is needed.

Framework packages should be optional peer dependencies unless Corelens cannot work without them.

## Adding an Exporter

When adding a new exporter:

1. Define the destination config and validation rules.
2. Keep retry, circuit breaker, batching, and shutdown behavior compatible with existing exporters.
3. Ensure exporter failures do not crash user applications.
4. Add tests for success, failure, timeout, malformed config, queue overflow, and shutdown flush.
5. Update README examples only when the exporter is ready for users.

## Reporting Bugs

Open an issue with:

- Corelens version.
- Node.js version.
- Framework and framework version, if relevant.
- Minimal config.
- Expected behavior.
- Actual behavior.
- Logs, `lens.getStats()` output, or reproduction steps when possible.

Security-sensitive reports should avoid posting secrets, tokens, customer data, or private endpoints in public issues.

## Proposing Features

Open an issue describing:

- The production problem you are trying to solve.
- Why existing Corelens APIs do not cover it.
- Expected API shape, if you have one.
- Operational impact, including performance and shutdown behavior.

Features that add runtime dependencies, public API surface, or new background work need a stronger justification than documentation-only improvements.

## Commits and PRs

- Keep PRs focused.
- Include tests or explain why tests do not apply.
- Update docs when user-facing behavior changes.
- Do not mix unrelated refactors with behavior changes.
- Mention any release note or migration impact.

## Security and release policy

Corelens is part of users’ application runtime, so release access is intentionally limited.

Contributors are welcome to submit issues and pull requests, but npm publish access is not granted automatically. New dependencies, lifecycle scripts, exporter changes, and build pipeline changes require extra review.

## License and Attribution

By contributing, you agree that your contribution can be distributed under the project license.

Corelens uses the MIT License. The copyright and permission notice must be preserved in copies or substantial portions of the software. Public acknowledgement or a link back to Corelens is appreciated when your work is based on this project, and forks should not imply official maintainer endorsement unless approved.
