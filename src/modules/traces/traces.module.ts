import { Module } from '../../core/config';
import { ModuleContext } from '../../core/config';

export class TracesModule implements Module {
  constructor(private config: ModuleContext) {}

  init(): void {
    // console.log('TracesModule initialised');
  }
  start(): void {
    // console.log('TracesModule started');
  }
  async stop(): Promise<void> {
    // console.log('TracesModule stopped');
  }
}
