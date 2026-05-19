import { Injectable, LoggerService } from '@nestjs/common';
import { CorelensService } from './providers';

@Injectable()
export class CorelensNestLogger implements LoggerService {
  constructor(private readonly lensService: CorelensService) {}

  log(message: any, context?: Record<string, any>) {
    this.lensService.logger.info(message, context);
  }
  error(message: any, context?: Record<string, any>) {
    this.lensService.logger.error(message, context);
  }
  warn(message: any, context?: Record<string, any>) {
    this.lensService.logger.warn(message, context);
  }
  debug(message: any, context?: Record<string, any>) {
    this.lensService.logger.debug(message, context);
  }
  verbose(message: any, context?: Record<string, any>) {
    this.lensService.logger.info(message, context);
  }
}
