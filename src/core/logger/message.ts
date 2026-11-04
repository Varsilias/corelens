/** Convert runtime logger inputs to a string before they enter the log pipeline. */
export function normalizeLogMessage(message: unknown): string {
  if (typeof message === 'string') return message;
  if (message instanceof Error) return `${message.name}: ${message.message}`;

  if (typeof message === 'object' && message !== null) {
    try {
      const json = JSON.stringify(message);
      if (json !== undefined) return json;
    } catch {
      // Circular references and BigInt values fall through to String().
    }
  }

  try {
    return String(message);
  } catch {
    return '[unserializable log message]';
  }
}

/**
 * Merge OTel `exception.*` attributes for an Error log message into its context,
 * so the stack trace survives export. Caller-supplied keys win; the input is not mutated.
 */
export function withExceptionContext(error: Error, context?: unknown) {
  const exception: Record<string, string> = {
    'exception.type': error.name,
    'exception.message': error.message,
  };
  if (error.stack) exception['exception.stacktrace'] = error.stack;

  if (context === undefined || context === null) return exception;
  if (typeof context === 'object' && !Array.isArray(context)) {
    return { ...exception, ...context };
  }
  // Non-object contexts (e.g. Nest's string context) keep their existing `context` key.
  return { ...exception, context };
}
