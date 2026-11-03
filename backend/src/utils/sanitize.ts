/**
 * Utilities for sanitizing sensitive credentials from MongoDB connection URIs,
 * error messages, and stack traces.
 */

/**
 * Regular expression matching MongoDB connection URIs with credentials.
 * Restricts matching exclusively to mongodb:// and mongodb+srv:// schemes.
 * Does not match or alter arbitrary non-MongoDB URLs (e.g., http, https, postgres, redis).
 *
 * Group 1: Scheme (mongodb:// or mongodb+srv://)
 * Group 2: Username (URL-encoded or plain characters up to ':')
 * Group 3: Password (URL-encoded or plain characters up to '@', including empty password)
 */
const MONGO_CREDENTIALS_REGEX = /(mongodb(?:\+srv)?:\/\/)([^:\s/?#@]+):([^@\s]*)@/gi;

/**
 * Strips user passwords from any string or error message containing one or more
 * MongoDB connection URIs.
 *
 * - Strictly matches mongodb:// and mongodb+srv:// schemes only.
 * - Supports multiple MongoDB URIs embedded within a single message or stack trace.
 * - Handles URL-encoded special characters in passwords (e.g., %40 for '@', %21 for '!', %23 for '#').
 * - Handles empty passwords (e.g., mongodb://user:@host).
 * - Preserves usernames, hostnames, ports, database names, query parameters, error codes,
 *   and all surrounding error context untouched.
 * - Leaves non-MongoDB URLs (http://, https://, postgres://, etc.) completely unaltered.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') return '';
  return message.replace(MONGO_CREDENTIALS_REGEX, '$1$2:****@');
}

/**
 * Strips password and sensitive credentials from a MongoDB URI for safe logging.
 * Returns '[NOT_SET]' if uri is empty or not provided.
 */
export function sanitizeMongoUri(uri?: string | null): string {
  if (!uri || typeof uri !== 'string') return '[NOT_SET]';
  return sanitizeErrorMessage(uri);
}

/**
 * Creates a sanitized copy of an Error object without mutating the original object.
 *
 * Copies the prototype chain and own property descriptors (error name, message, stack,
 * and custom properties like code, status, etc.). Recursively sanitizes nested cause if present.
 * Leaves the input error object unaltered.
 * Note: Error subclasses that rely on internal engine slots or private fields (#privateField)
 * are not supported by prototype-descriptor cloning.
 */
export function sanitizeError<T>(err: T): T {
  if (!err) return err;

  if (err instanceof Error) {
    const sanitizedMessage = sanitizeErrorMessage(err.message);
    const sanitizedStack = typeof err.stack === 'string' ? sanitizeErrorMessage(err.stack) : undefined;
    const sanitizedCause = 'cause' in err && err.cause ? sanitizeError(err.cause) : undefined;

    // Create a new object sharing the exact same prototype chain as the original error
    const cloned = Object.create(Object.getPrototypeOf(err)) as Error & Record<string, unknown>;

    // Copy all own property descriptors (both enumerable and non-enumerable) from the original error
    const descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(err);

    // Update descriptors with sanitized values, removing any getter/setter accessors
    if (descriptors.message) {
      delete descriptors.message.get;
      delete descriptors.message.set;
      descriptors.message.value = sanitizedMessage;
      descriptors.message.writable = true;
    } else {
      descriptors.message = {
        value: sanitizedMessage,
        writable: true,
        enumerable: false,
        configurable: true,
      };
    }

    if (sanitizedStack !== undefined) {
      if (descriptors.stack) {
        delete descriptors.stack.get;
        delete descriptors.stack.set;
        descriptors.stack.value = sanitizedStack;
        descriptors.stack.writable = true;
      } else {
        descriptors.stack = {
          value: sanitizedStack,
          writable: true,
          enumerable: false,
          configurable: true,
        };
      }
    }

    if (sanitizedCause !== undefined) {
      if (descriptors.cause) {
        delete descriptors.cause.get;
        delete descriptors.cause.set;
        descriptors.cause.value = sanitizedCause;
        descriptors.cause.writable = true;
      } else {
        descriptors.cause = {
          value: sanitizedCause,
          writable: true,
          enumerable: false,
          configurable: true,
        };
      }
    }

    Object.defineProperties(cloned, descriptors);

    // Ensure error name is preserved
    if (!cloned.name) {
      cloned.name = err.name;
    }

    return cloned as unknown as T;
  }

  if (typeof err === 'string') {
    return sanitizeErrorMessage(err) as unknown as T;
  }

  if (typeof err === 'object') {
    const copy = { ...err } as Record<string, unknown>;
    if (typeof copy.message === 'string') {
      copy.message = sanitizeErrorMessage(copy.message);
    }
    if (typeof copy.stack === 'string') {
      copy.stack = sanitizeErrorMessage(copy.stack);
    }
    return copy as unknown as T;
  }

  return err;
}
