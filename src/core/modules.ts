import { NormalisedConfig } from './config';

export interface Module {
  init(): void;
  start(): void;
  stop(): void;
}
