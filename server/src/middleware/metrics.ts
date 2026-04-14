// ─── Metrics Plugin ─────────────────────────────────────────
// Exposes Prometheus-compatible metrics at /metrics.
// Tracks request count, latency, and error rates per route.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ─── In-Memory Metrics Store ────────────────────────────────
// In production, use prom-client. This is a lightweight implementation
// that exposes metrics in Prometheus text format.

interface RouteMetric {
  count: number;
  errors: number;
  totalDurationMs: number;
  maxDurationMs: number;
}

const routeMetrics = new Map<string, RouteMetric>();
let totalRequests = 0;
let totalErrors = 0;
const startTime = Date.now();

function getOrCreateMetric(key: string): RouteMetric {
  let metric = routeMetrics.get(key);
  if (!metric) {
    metric = { count: 0, errors: 0, totalDurationMs: 0, maxDurationMs: 0 };
    routeMetrics.set(key, metric);
  }
  return metric;
}

// ─── Plugin ─────────────────────────────────────────────────

export async function metricsPlugin(fastify: FastifyInstance): Promise<void> {
  // Track request timing
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    (request as unknown as Record<string, unknown>)['_startTime'] = process.hrtime.bigint();
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const start = (request as unknown as Record<string, unknown>)['_startTime'] as bigint | undefined;
    if (!start) return;

    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const key = `${request.method} ${request.routeOptions?.url ?? request.url}`;
    const metric = getOrCreateMetric(key);

    metric.count++;
    metric.totalDurationMs += durationMs;
    metric.maxDurationMs = Math.max(metric.maxDurationMs, durationMs);
    totalRequests++;

    if (reply.statusCode >= 400) {
      metric.errors++;
      totalErrors++;
    }
  });

  // ─── GET /metrics — Prometheus scrape endpoint ────────
  fastify.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const lines: string[] = [
      '# HELP http_requests_total Total HTTP requests',
      '# TYPE http_requests_total counter',
      `http_requests_total ${totalRequests}`,
      '',
      '# HELP http_errors_total Total HTTP errors (4xx + 5xx)',
      '# TYPE http_errors_total counter',
      `http_errors_total ${totalErrors}`,
      '',
      '# HELP process_uptime_seconds Process uptime in seconds',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${Math.round((Date.now() - startTime) / 1000)}`,
      '',
      '# HELP http_request_duration_ms Request duration per route',
      '# TYPE http_request_duration_ms summary',
    ];

    for (const [route, metric] of routeMetrics) {
      const avgMs = metric.count > 0 ? (metric.totalDurationMs / metric.count).toFixed(2) : '0';
      const safeRoute = route.replace(/[{}]/g, '');
      lines.push(`http_request_duration_ms{route="${safeRoute}",quantile="avg"} ${avgMs}`);
      lines.push(`http_request_duration_ms{route="${safeRoute}",quantile="max"} ${metric.maxDurationMs.toFixed(2)}`);
      lines.push(`http_request_duration_ms_count{route="${safeRoute}"} ${metric.count}`);
      lines.push(`http_request_errors_total{route="${safeRoute}"} ${metric.errors}`);
    }

    reply.header('Content-Type', 'text/plain; version=0.0.4');
    return reply.send(lines.join('\n') + '\n');
  });
}
