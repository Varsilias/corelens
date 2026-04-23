import { Module } from '../../core/modules';
import { ModuleContext } from '../../core/context';

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
