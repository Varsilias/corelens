## Corelen Hono Example

### First Pass Test

```bash
 npm run bench

> example-hono@1.0.0 bench
> autocannon -c 100 -d 20 http://localhost:3200/api/data

Running 20s test @ http://localhost:3200/api/data
100 connections


┌─────────┬──────┬──────┬───────┬──────┬─────────┬─────────┬────────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%  │ Avg     │ Stdev   │ Max    │
├─────────┼──────┼──────┼───────┼──────┼─────────┼─────────┼────────┤
│ Latency │ 1 ms │ 1 ms │ 4 ms  │ 5 ms │ 1.61 ms │ 5.24 ms │ 433 ms │
└─────────┴──────┴──────┴───────┴──────┴─────────┴─────────┴────────┘
┌───────────┬─────────┬─────────┬─────────┬────────┬──────────┬──────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%  │ Avg      │ Stdev    │ Min     │
├───────────┼─────────┼─────────┼─────────┼────────┼──────────┼──────────┼─────────┤
│ Req/Sec   │ 29,599  │ 29,599  │ 50,175  │ 55,231 │ 47,878.8 │ 5,715.83 │ 29,597  │
├───────────┼─────────┼─────────┼─────────┼────────┼──────────┼──────────┼─────────┤
│ Bytes/Sec │ 5.36 MB │ 5.36 MB │ 9.08 MB │ 10 MB  │ 8.67 MB  │ 1.03 MB  │ 5.36 MB │
└───────────┴─────────┴─────────┴─────────┴────────┴──────────┴──────────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 20

958k requests in 20.02s, 173 MB read

# Statistics
{
  "logs": {
    "producedCount": 957695,
    "flushedCount": 957695,
    "backPressureHitCount": 0,
    "drainCount": 0,
    "maxQueueLength": 1,
    "currentQueueLength": 0,
    "isDraining": false,
    "peakQueuedBytes": 146,
    "queuedBytes": 0,
    "droppedCount": 0,
    "acceptedCount": 957695,
    "evictedCount": 0,
    "softLimitHitCount": 0
  }
}
```
