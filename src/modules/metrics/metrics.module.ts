import { Module } from '../../core/modules';
import { ModuleContext } from '../../core/context';

export class MetricsModule implements Module {
  constructor(private config: ModuleContext) {}

  init(): void {
    // console.log('MetricsModule initialised');
  }
  start(): void {
    // console.log('MetricsModule started');
  }
  async stop(): Promise<void> {
    // console.log('MetricsModule stopped');
  }
}
