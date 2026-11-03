export type ErrorClassificationType =
  | 'AUTH_INVALID_KEY'
  | 'AUTH_OTHER'
  | 'KEY_RESTRICTION_ERROR'
  | 'PROJECT_DISABLED_ERROR'
  | 'PROJECT_BILLING_ERROR'
  | 'MODEL_PERMISSION_DENIED'
  | 'MODEL_RATE_LIMIT'
  | 'PROJECT_QUOTA_EXHAUSTED'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_UNSUPPORTED_CONFIG'
  | 'INVALID_REQUEST_PAYLOAD'
  | 'TRANSIENT_SERVICE_UNAVAILABLE'
  | 'TRANSIENT_SERVER_ERROR'
  | 'NETWORK_TIMEOUT';

export interface ClassifiedGeminiError {
  type: ErrorClassificationType;
  statusCode: number;
  message: string;
  reason?: string;
  retryAfterSeconds?: number;
  isModelSpecific: boolean;
  isProjectFatal: boolean;
  isPermanentAuth: boolean;
}

interface GoogleRpcErrorInfo {
  '@type'?: string;
  reason?: string;
  domain?: string;
  metadata?: Record<string, string>;
}

interface GoogleRpcQuotaFailure {
  '@type'?: string;
  violations?: Array<{
    subject?: string;
    description?: string;
  }>;
}

interface GoogleRpcBadRequest {
  '@type'?: string;
  fieldViolations?: Array<{
    field?: string;
    description?: string;
  }>;
}

export function classifyGeminiApiError(
  statusCode: number,
  errBody: Record<string, unknown>,
  retryAfterHeader?: string | null
): ClassifiedGeminiError {
  const errObj = ((errBody.error as Record<string, unknown>) || errBody) as {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<GoogleRpcErrorInfo | GoogleRpcQuotaFailure | GoogleRpcBadRequest | Record<string, unknown>>;
  };

  const statusStr = String(errObj.status || '').toUpperCase();
  const rawMessage = String(errObj.message || `HTTP ${statusCode}`);

  // Parse retry-after header if present
  let retryAfterSeconds: number | undefined = undefined;
  if (retryAfterHeader) {
    const parsed = parseInt(retryAfterHeader, 10);
    if (!isNaN(parsed) && parsed > 0) {
      retryAfterSeconds = parsed;
    }
  }

  // Extract structured details
  const details = Array.isArray(errObj.details) ? errObj.details : [];
  let errorInfo: GoogleRpcErrorInfo | undefined;
  let quotaFailure: GoogleRpcQuotaFailure | undefined;
  let badRequest: GoogleRpcBadRequest | undefined;

  for (const d of details) {
    if (typeof d === 'object' && d !== null) {
      const typeStr = String((d as Record<string, unknown>)['@type'] || '');
      if (typeStr.includes('ErrorInfo') || 'reason' in d) {
        errorInfo = d as GoogleRpcErrorInfo;
      } else if (typeStr.includes('QuotaFailure') || 'violations' in d) {
        quotaFailure = d as GoogleRpcQuotaFailure;
      } else if (typeStr.includes('BadRequest') || 'fieldViolations' in d) {
        badRequest = d as GoogleRpcBadRequest;
      }
    }
  }

  const structuredReason = errorInfo?.reason;
  const quotaMetric = errorInfo?.metadata?.quota_metric || '';
  const quotaViolationsDesc = quotaFailure?.violations?.map((v) => v.description || '').join(' ') || '';

  // 1. HTTP 401: Authentication Failures
  if (statusCode === 401 || statusStr === 'UNAUTHENTICATED') {
    if (
      structuredReason === 'API_KEY_INVALID' ||
      rawMessage.includes('API key not valid') ||
      rawMessage.includes('API_KEY_INVALID')
    ) {
      return {
        type: 'AUTH_INVALID_KEY',
        statusCode: 401,
        message: 'Google Gemini API key is invalid, revoked, or unauthenticated.',
        reason: structuredReason || 'API_KEY_INVALID',
        isModelSpecific: false,
        isProjectFatal: true,
        isPermanentAuth: true,
      };
    }
    return {
      type: 'AUTH_OTHER',
      statusCode: 401,
      message: rawMessage || 'Authentication credentials failed.',
      reason: structuredReason,
      isModelSpecific: false,
      isProjectFatal: true,
      isPermanentAuth: true,
    };
  }

  // 2. HTTP 403: Authorization & Restrictions
  if (statusCode === 403 || statusStr === 'PERMISSION_DENIED') {
    if (
      structuredReason?.includes('IP_BLOCKED') ||
      structuredReason?.includes('REFERRER_BLOCKED') ||
      structuredReason?.includes('ANDROID_BLOCKED') ||
      structuredReason?.includes('KEY_RESTRICTION')
    ) {
      return {
        type: 'KEY_RESTRICTION_ERROR',
        statusCode: 403,
        message: 'API key restriction rejected caller IP or referrer.',
        reason: structuredReason,
        isModelSpecific: false,
        isProjectFatal: true,
        isPermanentAuth: true,
      };
    }
    if (structuredReason === 'SERVICE_DISABLED' || structuredReason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT') {
      return {
        type: 'PROJECT_DISABLED_ERROR',
        statusCode: 403,
        message: 'Generative Language API is disabled on this Google Cloud project.',
        reason: structuredReason,
        isModelSpecific: false,
        isProjectFatal: true,
        isPermanentAuth: false,
      };
    }
    if (structuredReason === 'BILLING_DISABLED' || rawMessage.toLowerCase().includes('billing')) {
      return {
        type: 'PROJECT_BILLING_ERROR',
        statusCode: 403,
        message: 'Google Cloud project billing is inactive or disabled.',
        reason: structuredReason || 'BILLING_DISABLED',
        isModelSpecific: false,
        isProjectFatal: true,
        isPermanentAuth: false,
      };
    }
    // Model permission or general permission denied
    return {
      type: 'MODEL_PERMISSION_DENIED',
      statusCode: 403,
      message: 'Permission denied for this model on the current project.',
      reason: structuredReason || 'PERMISSION_DENIED',
      isModelSpecific: true,
      isProjectFatal: false,
      isPermanentAuth: false,
    };
  }

  // 3. HTTP 404: Model Not Found or Retired
  if (statusCode === 404 || statusStr === 'NOT_FOUND') {
    return {
      type: 'MODEL_NOT_FOUND',
      statusCode: 404,
      message: 'Model is not found or has been retired from Google Gemini API.',
      reason: structuredReason || 'NOT_FOUND',
      isModelSpecific: true,
      isProjectFatal: false,
      isPermanentAuth: false,
    };
  }

  // 4. HTTP 429: Rate Limits vs Project Quota
  if (statusCode === 429 || statusStr === 'RESOURCE_EXHAUSTED') {
    const isDailyOrProjectWide =
      (structuredReason === 'QUOTA_EXCEEDED' || rawMessage.toLowerCase().includes('quota exceeded')) &&
      (quotaMetric.includes('per_day') ||
        quotaMetric.includes('queries_per_day') ||
        quotaViolationsDesc.toLowerCase().includes('queries per day') ||
        quotaViolationsDesc.toLowerCase().includes('daily limit') ||
        rawMessage.toLowerCase().includes('queries per day') ||
        rawMessage.toLowerCase().includes('daily limit') ||
        rawMessage.toLowerCase().includes('queries per project'));

    if (isDailyOrProjectWide) {
      return {
        type: 'PROJECT_QUOTA_EXHAUSTED',
        statusCode: 429,
        message: 'Project-wide daily quota exhausted (Queries per day).',
        reason: structuredReason || 'QUOTA_EXCEEDED',
        retryAfterSeconds: retryAfterSeconds || 86400,
        isModelSpecific: false,
        isProjectFatal: true,
        isPermanentAuth: false,
      };
    }

    // Otherwise model-level rate limit (RPM/TPM for this model)
    return {
      type: 'MODEL_RATE_LIMIT',
      statusCode: 429,
      message: 'Per-model rate limit reached (RPM/TPM limit).',
      reason: structuredReason || 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: retryAfterSeconds || 60,
      isModelSpecific: true,
      isProjectFatal: false,
      isPermanentAuth: false,
    };
  }

  // 5. HTTP 400: Malformed Payload vs Unsupported Configuration
  if (statusCode === 400 || statusStr === 'INVALID_ARGUMENT') {
    const hasConfigViolation =
      badRequest?.fieldViolations?.some(
        (v) =>
          v.field?.includes('generationConfig') ||
          v.field?.includes('responseSchema') ||
          v.field?.includes('responseMimeType') ||
          v.field?.includes('model')
      ) ||
      rawMessage.includes('responseSchema') ||
      rawMessage.includes('generationConfig') ||
      rawMessage.includes('unsupported');

    if (hasConfigViolation) {
      return {
        type: 'MODEL_UNSUPPORTED_CONFIG',
        statusCode: 400,
        message: 'Model does not support requested generation schema or structured JSON parameters.',
        reason: 'UNSUPPORTED_GENERATION_CONFIG',
        isModelSpecific: true,
        isProjectFatal: false,
        isPermanentAuth: false,
      };
    }

    return {
      type: 'INVALID_REQUEST_PAYLOAD',
      statusCode: 400,
      message: 'Malformed request payload or invalid prompt argument.',
      reason: 'INVALID_ARGUMENT',
      isModelSpecific: false,
      isProjectFatal: false,
      isPermanentAuth: false,
    };
  }

  // 6. HTTP 503: Transient Service Unavailable (Capacity / Maintenance)
  if (statusCode === 503 || statusStr === 'UNAVAILABLE') {
    return {
      type: 'TRANSIENT_SERVICE_UNAVAILABLE',
      statusCode: 503,
      message: 'Transient Gemini service unavailability (503). Retrying with backoff.',
      reason: structuredReason || 'UNAVAILABLE',
      retryAfterSeconds: retryAfterSeconds || 10,
      isModelSpecific: true,
      isProjectFatal: false,
      isPermanentAuth: false,
    };
  }

  // 7. HTTP 500/502/504: Other Transient Server Errors
  if (statusCode >= 500 && statusCode <= 504) {
    return {
      type: 'TRANSIENT_SERVER_ERROR',
      statusCode,
      message: `Transient upstream Gemini server error (${statusCode}).`,
      reason: structuredReason || 'INTERNAL_ERROR',
      retryAfterSeconds: retryAfterSeconds || 10,
      isModelSpecific: true,
      isProjectFatal: false,
      isPermanentAuth: false,
    };
  }

  // Fallback
  return {
    type: 'MODEL_UNSUPPORTED_CONFIG',
    statusCode,
    message: rawMessage,
    isModelSpecific: true,
    isProjectFatal: false,
    isPermanentAuth: false,
  };
}
