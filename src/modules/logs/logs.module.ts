import { Module } from '../../core/modules';
import { ModuleContext } from '../../core/context';

export class LogsModule implements Module {
  constructor(private ctx: ModuleContext) {}

  //
  init(): void {
    // console.log('LogsModule initialised');
  }
  start(): void {
    // console.log('LogsModule started');
  }
  stop(): void {
    // console.log('LogsModule stopped');
  }
}
