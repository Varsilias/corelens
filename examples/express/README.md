## Corelen Express Example

### First Pass Test

```bash
 npm run bench

> example-express@1.0.0 bench
> autocannon -c 100 -d 20 http://localhost:3000/api/data

Running 20s test @ http://localhost:3000/api/data
100 connections


┌─────────┬──────┬──────┬───────┬───────┬─────────┬─────────┬────────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%   │ Avg     │ Stdev   │ Max    │
├─────────┼──────┼──────┼───────┼───────┼─────────┼─────────┼────────┤
│ Latency │ 4 ms │ 5 ms │ 9 ms  │ 15 ms │ 5.24 ms │ 7.13 ms │ 383 ms │
└─────────┴──────┴──────┴───────┴───────┴─────────┴─────────┴────────┘
┌───────────┬────────┬────────┬─────────┬─────────┬──────────┬──────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%     │ 97.5%   │ Avg      │ Stdev    │ Min    │
├───────────┼────────┼────────┼─────────┼─────────┼──────────┼──────────┼────────┤
│ Req/Sec   │ 13,191 │ 13,191 │ 18,079  │ 20,079  │ 17,268.6 │ 1,936.21 │ 13,191 │
├───────────┼────────┼────────┼─────────┼─────────┼──────────┼──────────┼────────┤
│ Bytes/Sec │ 3.5 MB │ 3.5 MB │ 4.79 MB │ 5.32 MB │ 4.58 MB  │ 514 kB   │ 3.5 MB │
└───────────┴────────┴────────┴─────────┴─────────┴──────────┴──────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 20

345k requests in 20.02s, 91.5 MB read

{
  "logs": {
    "producedCount": 345487,
    "flushedCount": 345487,
    "backPressureHitCount": 0,
    "drainCount": 0,
    "maxQueueLength": 1,
    "currentQueueLength": 0,
    "isDraining": false,
    "peakQueuedBytes": 186,
    "queuedBytes": 0,
    "droppedCount": 0,
    "acceptedCount": 345487,
    "evictedCount": 0,
    "softLimitHitCount": 0
  }
}
```
