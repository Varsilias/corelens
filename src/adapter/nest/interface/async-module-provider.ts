import { FactoryProvider, ModuleMetadata } from '@nestjs/common';
import { CorelensConfig } from '../../../core';

export interface CorelensModuleAsyncOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  /**
   * Function returning options (or a Promise resolving to options) to configure the
   * module.
   */
  useFactory: (...args: any[]) => Promise<CorelensConfig> | CorelensConfig;
  /**
   * Dependencies that a Factory may inject.
   */
  inject?: FactoryProvider['inject'];
}
