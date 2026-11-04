/** An HTTP export that reached the collector and was answered with a non-2xx status. */
export class ExportHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ExportHttpError';
  }
}

/**
 * True when the collector rejected the payload itself (4xx other than 408/429).
 * Resending the same batch cannot succeed, so it should be dropped rather than retried.
 */
export function isPermanentExportError(error: unknown): boolean {
  if (!(error instanceof ExportHttpError)) return false;
  const { status } = error;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}
