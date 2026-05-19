import { CorelensConfig as CorelensModuleOptions } from '../../core';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { CorelensService } from './providers';
import { CORELENS_CONFIG } from './token';
import { CorelensModuleAsyncOptions } from './interface/async-module-provider';
import { CorelensNestLogger } from './logger';
import { CorelensHttpInterceptor } from './interceptor';

@Module({})
export class CorelensModule {
  static forRoot(config: CorelensModuleOptions): DynamicModule {
    return {
      global: true,
      module: CorelensModule,
      providers: [
        {
          provide: CORELENS_CONFIG,
          useValue: config,
        },
        CorelensService,
        CorelensNestLogger,
        CorelensHttpInterceptor,
      ],
      exports: [CorelensService, CorelensNestLogger, CorelensHttpInterceptor],
    };
  }
  static forRootAsync(config: CorelensModuleAsyncOptions): DynamicModule {
    return {
      imports: config.imports ?? [],
      global: true,
      module: CorelensModule,
      providers: [
        ...this.createAsyncProviders(config),
        CorelensService,
        CorelensNestLogger,
        CorelensHttpInterceptor,
      ],
      exports: [CorelensService, CorelensNestLogger, CorelensHttpInterceptor],
    };
  }

  private static createAsyncProviders(
    options: CorelensModuleAsyncOptions,
  ): Provider[] {
    const { inject, useFactory } = options;
    return [
      {
        provide: CORELENS_CONFIG,
        useFactory,
        inject,
      },
    ] as Provider[];
  }
}
