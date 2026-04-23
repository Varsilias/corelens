export interface Module {
  init(): void;
  start(): void;
  stop(): Promise<void>;
}
