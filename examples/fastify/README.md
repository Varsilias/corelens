## Corelen Fastify Example

### First Pass Test

```bash
 npm run bench

> example-fastify@1.0.0 bench
> autocannon -c 100 -d 20 http://localhost:3100/api/data

Running 20s test @ http://localhost:3100/api/data
100 connections


┌─────────┬──────┬──────┬───────┬──────┬─────────┬────────┬────────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%  │ Avg     │ Stdev  │ Max    │
├─────────┼──────┼──────┼───────┼──────┼─────────┼────────┼────────┤
│ Latency │ 1 ms │ 1 ms │ 4 ms  │ 6 ms │ 1.69 ms │ 4.3 ms │ 372 ms │
└─────────┴──────┴──────┴───────┴──────┴─────────┴────────┴────────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬──────────┬──────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg      │ Stdev    │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼──────────┼─────────┤
│ Req/Sec   │ 31,343  │ 31,343  │ 47,135  │ 49,119  │ 45,033.2 │ 4,778.81 │ 31,337  │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼──────────┼─────────┤
│ Bytes/Sec │ 6.27 MB │ 6.27 MB │ 9.43 MB │ 9.82 MB │ 9.01 MB  │ 956 kB   │ 6.27 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴──────────┴──────────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 20

901k requests in 20.02s, 180 MB read

# Statistics
{
  "logs": {
    "producedCount": 900733,
    "flushedCount": 900733,
    "backPressureHitCount": 0,
    "drainCount": 0,
    "maxQueueLength": 1,
    "currentQueueLength": 0,
    "isDraining": false,
    "peakQueuedBytes": 166,
    "queuedBytes": 0,
    "droppedCount": 0,
    "acceptedCount": 900733,
    "evictedCount": 0,
    "softLimitHitCount": 0
  }
}
```
