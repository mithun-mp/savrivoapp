import { config } from '../../config/env';
import { GeminiModelManager, defaultModelManager } from './gemini-model-manager';
import { GeminiKeyManager, defaultKeyManager } from './gemini-key-manager';
import {
  classifyGeminiApiError,
  type ClassifiedGeminiError,
} from './gemini-error-classifier';
import type {
  TwoLevelDiagnosticsSummary,
  RotationAttemptStep,
  EnrichedProductData,
} from './product-import.types';

const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiRotationService {
  private keyManager: GeminiKeyManager;
  private modelManager: GeminiModelManager;
  private timeoutMs: number;

  // Rotation telemetry
  private lastSuccessfulSlot: number | null = null;
  private lastSuccessfulModel: string | null = null;
  private currentSlot: number | null = null;
  private currentModel: string | null = null;
  private lastAttemptBreadcrumb = '';
  private attemptHistory: RotationAttemptStep[] = [];

  constructor(
    keyManager: GeminiKeyManager = defaultKeyManager,
    modelManager: GeminiModelManager = defaultModelManager
  ) {
    this.keyManager = keyManager;
    this.modelManager = modelManager;
    this.timeoutMs = config.gemini?.timeoutMs ?? 20000;
  }

  /**
   * Executes two-level model-first rotation:
   * Level 1: Model rotation on the current API key project.
   * Level 2: API-key/project rotation when eligible models on current key fail or project-wide quota is exhausted.
   */
  public async executeStructuredGeneration(
    prompt: string,
    schemaProperties: Record<string, unknown>,
    requiredProperties: string[]
  ): Promise<{ data: EnrichedProductData; breadcrumb: string }> {
    if (!this.keyManager.hasConfiguredKeys()) {
      throw new Error('No Gemini API keys are configured in environment (GEMINI_API_KEY_1/2/3).');
    }

    const eligibleSlots = this.keyManager.getEligibleSlots();
    if (eligibleSlots.length === 0) {
      throw new Error(
        'All configured Gemini API keys are unavailable (unhealthy credentials, project restrictions, or active quota exhaustion).'
      );
    }

    const models = this.modelManager.getOrderedModels();
    const breadcrumbParts: string[] = [];
    const localAttemptHistory: RotationAttemptStep[] = [];
    let attemptNumber = 0;

    // LEVEL 2 OUTER LOOP: For each eligible API key/project
    for (const slotNumber of eligibleSlots) {
      this.currentSlot = slotNumber;
      const apiKey = this.keyManager.getSlotKey(slotNumber);
      let projectSkipRequested = false;

      // LEVEL 1 INNER LOOP: For each configured model in strict priority order
      for (const modelId of models) {
        if (projectSkipRequested) {
          break; // Project-wide quota/auth failure: skip remaining models on this project
        }

        // Atomically check eligibility and acquire in-flight concurrency slot.
        // Prevents check-then-act race conditions between simultaneous callers.
        if (!this.modelManager.tryAcquireInFlight(slotNumber, modelId)) {
          // Model is either cooling down, unsupported on this project, or currently at max concurrency capacity (load-shedding)
          continue;
        }

        attemptNumber++;
        this.currentModel = modelId;
        const startTime = Date.now();

        try {
          const result = await this.callGeminiApi(
            apiKey,
            modelId,
            prompt,
            schemaProperties,
            requiredProperties
          );

          const durationMs = Date.now() - startTime;
          this.lastSuccessfulSlot = slotNumber;
          this.lastSuccessfulModel = modelId;

          this.keyManager.reportSuccess(slotNumber);
          this.modelManager.reportSuccess(slotNumber, modelId);
          this.keyManager.advancePointer();

          const step: RotationAttemptStep = {
            attemptNumber,
            slot: slotNumber,
            model: modelId,
            status: 'success',
            message: 'Enrichment successful',
            durationMs,
          };
          localAttemptHistory.push(step);
          this.attemptHistory = localAttemptHistory.slice(-15);

          breadcrumbParts.push(`Key ${slotNumber} (${modelId}) → Success`);
          this.lastAttemptBreadcrumb = breadcrumbParts.join(' → ');

          return { data: result, breadcrumb: this.lastAttemptBreadcrumb };
        } catch (err: unknown) {
          const durationMs = Date.now() - startTime;
          const errorObj = err as Error & { classified?: ClassifiedGeminiError };
          const classified = errorObj.classified || {
            type: 'NETWORK_TIMEOUT' as const,
            statusCode: 0,
            message: errorObj.message || 'Network timeout or failure',
            isModelSpecific: true,
            isProjectFatal: false,
            isPermanentAuth: false,
          };

          // 1. Model-Specific Rate Limit (429 RPM/TPM)
          if (
            classified.type === 'MODEL_RATE_LIMIT' ||
            (classified.type as string) === 'MODEL_SPECIFIC_ERROR'
          ) {
            this.modelManager.reportCooldown(
              slotNumber,
              modelId,
              classified.retryAfterSeconds || 60
            );

            breadcrumbParts.push(`Key ${slotNumber} (${modelId}) → 429 Model Rate Limit`);
            localAttemptHistory.push({
              attemptNumber,
              slot: slotNumber,
              model: modelId,
              status: 'model_rate_limited',
              message: classified.message,
              durationMs,
            });

            // Continue to NEXT MODEL on the SAME KEY!
            continue;
          }

          // 2. Model Not Found, Model Unsupported Config, or Model Permission Denied
          if (
            classified.type === 'MODEL_NOT_FOUND' ||
            classified.type === 'MODEL_UNSUPPORTED_CONFIG' ||
            classified.type === 'MODEL_PERMISSION_DENIED'
          ) {
            this.modelManager.reportUnsupported(slotNumber, modelId);

            breadcrumbParts.push(`Key ${slotNumber} (${modelId}) → Unsupported/Denied`);
            localAttemptHistory.push({
              attemptNumber,
              slot: slotNumber,
              model: modelId,
              status: 'model_unsupported',
              message: classified.message,
              durationMs,
            });

            // Continue to NEXT MODEL on the SAME KEY!
            continue;
          }

          // 3. Project-Wide Quota or Billing Exhaustion (Level 2 Trigger)
          if (
            classified.type === 'PROJECT_QUOTA_EXHAUSTED' ||
            (classified.type as string) === 'PROJECT_QUOTA_LIMIT' ||
            classified.type === 'PROJECT_BILLING_ERROR'
          ) {
            this.keyManager.reportProjectQuotaExhausted(
              slotNumber,
              classified.retryAfterSeconds || 86400,
              classified.message
            );

            breadcrumbParts.push(`Key ${slotNumber} → Project Quota/Billing Exhausted`);
            localAttemptHistory.push({
              attemptNumber,
              slot: slotNumber,
              model: modelId,
              status: 'project_quota_exhausted',
              message: classified.message,
              durationMs,
            });

            projectSkipRequested = true;
            break; // Skip remaining models for this project, advance to next key!
          }

          // 4. Invalid API Key or Permanent Project/Key Restriction
          if (
            classified.type === 'AUTH_INVALID_KEY' ||
            classified.type === 'AUTH_OTHER' ||
            (classified.type as string) === 'AUTH_ERROR' ||
            classified.type === 'KEY_RESTRICTION_ERROR' ||
            classified.type === 'PROJECT_DISABLED_ERROR'
          ) {
            this.keyManager.reportInvalidKey(slotNumber, classified.message);

            breadcrumbParts.push(`Key ${slotNumber} → Invalid Key/Project Disabled`);
            localAttemptHistory.push({
              attemptNumber,
              slot: slotNumber,
              model: modelId,
              status: 'auth_failed',
              message: classified.message,
              durationMs,
            });

            projectSkipRequested = true;
            break; // Skip remaining models for this key, advance to next key!
          }

          // 5. Invalid Request Payload (400) - Fail Fast
          if (
            classified.type === 'INVALID_REQUEST_PAYLOAD' ||
            (classified.type as string) === 'INVALID_REQUEST'
          ) {
            breadcrumbParts.push(`Key ${slotNumber} (${modelId}) → 400 Bad Request`);
            localAttemptHistory.push({
              attemptNumber,
              slot: slotNumber,
              model: modelId,
              status: 'invalid_request',
              message: classified.message,
              durationMs,
            });

            this.lastAttemptBreadcrumb = breadcrumbParts.join(' → ');
            this.attemptHistory = localAttemptHistory.slice(-15);
            // Strictly stop: do not rotate through all keys for malformed client payload
            throw new Error(`Gemini Bad Request (400): ${classified.message}`);
          }

          // 6. Transient Service Unavailability (503) or Server Error (500/502/504)
          if (
            classified.type === 'TRANSIENT_SERVICE_UNAVAILABLE' ||
            classified.type === 'TRANSIENT_SERVER_ERROR'
          ) {
            // Transient cooldown on model for this slot
            this.modelManager.reportCooldown(slotNumber, modelId, classified.retryAfterSeconds || 15);

            breadcrumbParts.push(`Key ${slotNumber} (${modelId}) → ${classified.statusCode} Transient Unavailable`);
            localAttemptHistory.push({
              attemptNumber,
              slot: slotNumber,
              model: modelId,
              status: 'server_error',
              message: classified.message,
              durationMs,
            });

            // Continue to NEXT MODEL on the SAME KEY!
            continue;
          }

          // 7. Network or Timeout Failure
          breadcrumbParts.push(`Key ${slotNumber} (${modelId}) → Network Timeout`);
          localAttemptHistory.push({
            attemptNumber,
            slot: slotNumber,
            model: modelId,
            status: 'network_error',
            message: classified.message,
            durationMs,
          });
          continue;
        } finally {
          this.modelManager.releaseInFlight(slotNumber, modelId);
        }
      }
    }

    breadcrumbParts.push('All Combinations Exhausted');
    this.lastAttemptBreadcrumb = breadcrumbParts.join(' → ');
    this.attemptHistory = localAttemptHistory.slice(-15);

    throw new Error(
      `All eligible Gemini models and API key combinations failed: [${this.lastAttemptBreadcrumb}]`
    );
  }

  private async callGeminiApi(
    apiKey: string,
    modelId: string,
    prompt: string,
    schemaProperties: Record<string, unknown>,
    requiredProperties: string[]
  ): Promise<EnrichedProductData> {
    const url = `${GEMINI_API_ENDPOINT}/${modelId}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: schemaProperties,
          required: requiredProperties,
        },
      },
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      const networkErr = new Error(`Network failure calling Gemini: ${(err as Error).message}`);
      (networkErr as Error & { classified: ClassifiedGeminiError }).classified = {
        type: 'NETWORK_TIMEOUT',
        statusCode: 0,
        message: (err as Error).message,
        isModelSpecific: true,
        isProjectFatal: false,
        isPermanentAuth: false,
      };
      throw networkErr;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const retryAfter = res.headers.get('retry-after');
      const classified = classifyGeminiApiError(res.status, errBody, retryAfter);

      const err = new Error(classified.message) as Error & { classified: ClassifiedGeminiError };
      err.classified = classified;
      throw err;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      const emptyErr = new Error('Gemini returned an empty candidate response.');
      (emptyErr as Error & { classified: ClassifiedGeminiError }).classified = {
        type: 'MODEL_UNSUPPORTED_CONFIG',
        statusCode: 200,
        message: 'Empty candidate text',
        isModelSpecific: true,
        isProjectFatal: false,
        isPermanentAuth: false,
      };
      throw emptyErr;
    }

    try {
      return JSON.parse(textContent) as EnrichedProductData;
    } catch (parseErr) {
      const jsonErr = new Error(
        `Failed to parse Gemini structured JSON: ${(parseErr as Error).message}`
      );
      (jsonErr as Error & { classified: ClassifiedGeminiError }).classified = {
        type: 'MODEL_UNSUPPORTED_CONFIG',
        statusCode: 200,
        message: 'Malformed JSON output',
        isModelSpecific: true,
        isProjectFatal: false,
        isPermanentAuth: false,
      };
      throw jsonErr;
    }
  }

  /**
   * Safe diagnostics summary matching TwoLevelDiagnosticsSummary schema.
   */
  public getDiagnostics(): TwoLevelDiagnosticsSummary {
    return {
      activeSlot: this.currentSlot,
      currentModel: this.currentModel,
      lastSuccessfulSlot: this.lastSuccessfulSlot,
      lastSuccessfulModel: this.lastSuccessfulModel,
      totalConfiguredKeys: this.keyManager.getTotalConfigured(),
      totalHealthyKeys: this.keyManager.getTotalHealthy(),
      modelPriorityOrder: this.modelManager.getOrderedModels(),
      keySlots: this.keyManager.getDiagnostics(),
      modelStatuses: this.modelManager.getModelDiagnostics(),
      lastAttemptBreadcrumb: this.lastAttemptBreadcrumb,
      attemptHistory: this.attemptHistory,
    };
  }

  public resetTelemetry(): void {
    this.lastSuccessfulSlot = null;
    this.lastSuccessfulModel = null;
    this.currentSlot = null;
    this.currentModel = null;
    this.lastAttemptBreadcrumb = '';
    this.attemptHistory = [];
  }
}

export const defaultRotationService = new GeminiRotationService();
export { classifyGeminiApiError } from './gemini-error-classifier';

export const classifyGeminiError = (
  statusCode: number,
  errBody: Record<string, unknown>,
  retryAfterHeader?: string | null
) => {
  const result = classifyGeminiApiError(statusCode, errBody, retryAfterHeader);
  return {
    ...result,
    type:
      result.type === 'MODEL_RATE_LIMIT'
        ? ('MODEL_SPECIFIC_ERROR' as const)
        : result.type === 'PROJECT_QUOTA_EXHAUSTED'
        ? ('PROJECT_QUOTA_EXHAUSTED' as const)
        : result.type === 'AUTH_INVALID_KEY'
        ? ('AUTH_INVALID_KEY' as const)
        : result.type === 'INVALID_REQUEST_PAYLOAD'
        ? ('INVALID_REQUEST' as const)
        : result.type,
  };
};
