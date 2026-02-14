## 🚀 `@varsilias/otel`

A minimal, centralized OpenTelemetry utility for Node.js based services and applications. Supports logging, metrics, and tracing with out-of-the-box configuration for the **Grafana observability stack** (Tempo, Loki, Prometheus). This package is designed to work seamlessly in NestJS, Express & Fastify apps more framework supports are currently being developed.

---

## 📆 Features

- ✅ Centralized setup for tracing, metrics, and logs
- ✅ Supports OTLP exports to Grafana Tempo (tracing) and Prometheus (metrics)
- ✅ Loki transport integrated with Winston logger
- ✅ Auto instrumentation of supported Node.js libraries
- ✅ Plug-and-play support for NestJS with `LoggerService`

---

## 🔧 Local Development Setup

### 1. Clone the Repo & Install Dependencies

```bash
git clone git@github.com:Varsilias/otel.git
cd otel
npm install
```

### 2. Build for Local Testing

```bash
npm run build
```

### 3. Run a Sample Script

Create a `test.ts`:

```ts
import { setupOpenTelemetry, setupMetrics, setupLogger } from './dist';

setupOpenTelemetry('test-service');
setupMetrics('test-service');
const logger = setupLogger('test-service');

// main.ts
 const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
  });

  // example.service.ts
  private readonly logger = new Logger(ExampleService.ame)
  this.logger.log('Test log');
```

Then:

```bash
ts-node test.ts
```

---

## 🚀 Usage in a NestJS App

### 1. Install the Package

```bash
npm install @chorus-ng/opentelemetry
```

> If using a private Azure DevOps registry, configure `.npmrc` (see instructions below).

### 2. Instrument in `main.ts`

```ts
import { setupOpenTelemetry, setupLogger } from '@chorus-ng/opentelemetry';

const serviceName = 'gateway-service';
const logger = setupLogger(serviceName);

const app = await NestFactory.create(AppModule, {
  logger,
});

setupOpenTelemetry(serviceName);
```

### 3. Add Metrics Collection

```ts
import { setupMetrics } from '@chorus-ng/opentelemetry';

const meter = setupMetrics('gateway-service');
const requestCounter = meter.createCounter('requests_total');

app.use((req, res, next) => {
  requestCounter.add(1, {
    path: req.path,
    method: req.method,
  });
  next();
});
```

### 4. Use the Logger

```ts
const logger = setupLogger('user-service');
logger.info('User login successful');
```

### 5. Use Span Helpers

```ts
import { createSpan, runWithSpan } from '@chorus-ng/opentelemetry';

const span = createSpan('custom-operation');
doSomething();
span.end();
```

Or:

```ts
await runWithSpan('wrapped-task', async (span) => {
  await someTask();
  span.end();
});
```

---

## ⚙️ Required Project Setup

1. **Environment Variables**:

| Name                                  | Description                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT`         | OTLP trace export endpoint (e.g. `http://otel-collector:4318/v1/traces`)    |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | OTLP metrics export endpoint (e.g. `http://otel-collector:4318/v1/metrics`) |
| `LOKI_URL`                            | Loki endpoint for logs (e.g. `http://loki:3100`)                            |
| `SERVICE_NAME`                        | Name of the current service                                                 |

2. **Grafana/Tempo/Loki/Prometheus** must be configured and running in the same Docker network, accepting OTLP input (typically via OpenTelemetry Collector).

3. **NestJS Logging**: Use the `setupLogger()` return value in NestFactory.

---

## 🔮 Testing the Setup

- ✅ View traces: open Grafana and use Tempo datasource
- ✅ View metrics: query via Prometheus UI (`http://localhost:9090`)
- ✅ View logs: query `job=chorus-core-app` in Grafana Loki dashboard

Ensure that your services emit logs, span, and metric data under actual HTTP or Kafka operations.

---

## 🧑‍💻 Contribution Guide

1. **Clone and Branch**

```bash
git checkout -b feat/your-feature
```

2. **Make Your Changes**

Update code inside `src/` and run:

```bash
npm run build
```

3. **Test**

Write a script in `test.ts` or add a Jest test.

4. **Open a PR**

Push your branch and create a pull request against `main` on Azure DevOps.

Include:

- Description of changes
- Testing steps
- Optional screenshot/log samples

---

## 🔐 Publishing to Azure DevOps Registry

1. In your `.npmrc` file:

```ini
@chorus-ng:registry=https://pkgs.dev.azure.com/Chorus-Project/_packaging/chorus-internal-packages/npm/registry/
```

2. Authenticate with:

```bash
npm login --registry=https://pkgs.dev.azure.com/Chorus-Project/_packaging/chorus-internal-packages/npm/registry/
```

3. Publish:

```bash
npm publish --access restricted
```
