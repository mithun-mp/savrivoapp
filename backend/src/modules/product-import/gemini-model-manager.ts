import { config } from '../../config/env';
import type { ModelSlotStatus } from './product-import.types';

export const DEFAULT_MODEL_PRIORITY: string[] = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
];

/**
 * Dynamic pointer aliases that shift over time (e.g., pointing to unannounced updates).
 * These are explicitly rejected from the static fallback chain because dynamic aliases
 * do not have stable, distinct performance boundaries or SLA guarantees, and can mask
 * independent failure domains.
 */
export const REJECTED_DYNAMIC_ALIASES = new Set([
  'gemini-flash-latest',
  'gemini-pro-latest',
  'gemini-latest',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
  'gemini-2.0-flash-latest',
]);

/**
 * Known official deprecated model version aliases that automatically route
 * to an underlying canonical model in Google's API infrastructure.
 * Resolving these to their canonical targets avoids treating aliases
 * of the same underlying model as independent fallback capacity.
 */
export const KNOWN_DEPRECATED_MODEL_ALIASES: Record<string, string> = {
  'gemini-3.7-flash': 'gemini-3.8-flash',
  'gemini-3.5-flash': 'gemini-3.6-flash',
  'gemini-3-flash-preview': 'gemini-3.6-flash',
  'gemini-3.5-flash-preview': 'gemini-3.6-flash',
};

export const KNOWN_MODEL_ALIASES = KNOWN_DEPRECATED_MODEL_ALIASES;

const MODEL_ID_REGEX = /^[a-zA-Z0-9][-a-zA-Z0-9._]*$/;

export class GeminiModelManager {
  private orderedModels: string[];
  // Cooldown map: key = `${slot}:${model}`, value = timestamp in ms
  private cooldowns: Map<string, number> = new Map();
  // Unsupported/inaccessible models map per slot: key = `${slot}:${model}`
  private unsupportedModels: Set<string> = new Set();
  // Failure counters: key = `${slot}:${model}`
  private failures: Map<string, number> = new Map();
  // In-flight concurrency tracking: key = `${slot}:${model}`
  private inFlightRequests: Map<string, number> = new Map();
  // Peak in-flight concurrency observed: key = `${slot}:${model}`
  private peakInFlightObserved: Map<string, number> = new Map();
  // Maximum simultaneous in-flight requests per slot+model before shedding load to next model
  public static readonly MAX_CONCURRENT_PER_MODEL = 3;

  constructor(customModels?: string[]) {
    if (customModels && customModels.length > 0) {
      this.orderedModels = this.validateAndDeduplicate(customModels);
    } else {
      // Check if comma-separated GEMINI_MODELS is specified
      const commaSeparated = config.gemini?.modelsList
        ? config.gemini.modelsList.split(',').map((s) => s.trim())
        : [];

      const candidates = [
        ...commaSeparated,
        config.gemini?.modelPrimary,
        config.gemini?.modelSecondary,
        config.gemini?.modelTertiary,
        config.gemini?.modelQuaternary,
        config.gemini?.modelPreview1,
        config.gemini?.modelAdvanced,
        config.gemini?.modelFallback,
      ];
      this.orderedModels = this.validateAndDeduplicate(candidates);
    }

    if (this.orderedModels.length === 0) {
      this.orderedModels = [...DEFAULT_MODEL_PRIORITY];
    }
  }

  /**
   * Validates model IDs, rejects dynamic pointer aliases with diagnostics,
   * resolves deprecated aliases to canonical targets, and deduplicates
   * preserving strict priority order.
   */
  private validateAndDeduplicate(rawModels: (string | undefined)[]): string[] {
    const list: string[] = [];
    const seen = new Set<string>();

    for (const raw of rawModels) {
      if (!raw || typeof raw !== 'string') continue;
      let clean = raw.trim();
      if (!clean) continue;

      // 1. Explicitly reject dynamic pointer aliases (*-latest) from fallback chain
      if (REJECTED_DYNAMIC_ALIASES.has(clean) || clean.endsWith('-latest')) {
        console.warn(
          `[GeminiModelManager] Dynamic alias "${clean}" rejected from fallback chain: ` +
          `dynamic aliases point to shifting underlying targets and do not provide independent fallback capacity.`
        );
        continue;
      }

      // 2. Collapse redundant deprecated version aliases to their underlying canonical model
      if (clean in KNOWN_DEPRECATED_MODEL_ALIASES) {
        clean = KNOWN_DEPRECATED_MODEL_ALIASES[clean];
      }

      if (!MODEL_ID_REGEX.test(clean)) {
        // Skip invalid model identifiers that violate API naming format
        continue;
      }

      if (!seen.has(clean)) {
        seen.add(clean);
        list.push(clean);
      }
    }

    return list;
  }

  /**
   * Returns configured models in strict priority order.
   */
  public getOrderedModels(): string[] {
    return [...this.orderedModels];
  }

  /**
   * Checks if a model is currently eligible for a given key/project slot.
   * Model accessibility is verified independently per project.
   */
  public isModelEligible(slot: number, model: string): boolean {
    const key = `${slot}:${model}`;
    if (this.unsupportedModels.has(key)) {
      return false;
    }

    const cooldownUntil = this.cooldowns.get(key) || 0;
    if (cooldownUntil > Date.now()) {
      return false;
    }

    // Load-shedding coordination: if model has saturated concurrent in-flight capacity,
    // let concurrent callers attempt the next configured model in priority order
    const inFlight = this.inFlightRequests.get(key) || 0;
    if (inFlight >= GeminiModelManager.MAX_CONCURRENT_PER_MODEL) {
      return false;
    }

    return true;
  }

  /**
   * Atomically checks model eligibility (not unsupported, not on cooldown, under concurrency limit)
   * and increments the in-flight counter in a single synchronous turn of the Node event loop.
   * Eliminates check-then-act race conditions between simultaneous callers.
   * Returns true if slot was acquired, false otherwise.
   */
  public tryAcquireInFlight(slot: number, model: string): boolean {
    const key = `${slot}:${model}`;
    if (this.unsupportedModels.has(key)) {
      return false;
    }

    const cooldownUntil = this.cooldowns.get(key) || 0;
    if (cooldownUntil > Date.now()) {
      return false;
    }

    const inFlight = this.inFlightRequests.get(key) || 0;
    if (inFlight >= GeminiModelManager.MAX_CONCURRENT_PER_MODEL) {
      return false;
    }

    const nextCount = inFlight + 1;
    this.inFlightRequests.set(key, nextCount);

    const prevPeak = this.peakInFlightObserved.get(key) || 0;
    if (nextCount > prevPeak) {
      this.peakInFlightObserved.set(key, nextCount);
    }

    return true;
  }

  /**
   * Acquire an in-flight slot for a specific model and key slot.
   */
  public acquireInFlight(slot: number, model: string): void {
    const key = `${slot}:${model}`;
    const nextCount = (this.inFlightRequests.get(key) || 0) + 1;
    this.inFlightRequests.set(key, nextCount);
    const prevPeak = this.peakInFlightObserved.get(key) || 0;
    if (nextCount > prevPeak) {
      this.peakInFlightObserved.set(key, nextCount);
    }
  }

  /**
   * Release an in-flight slot for a specific model and key slot.
   */
  public releaseInFlight(slot: number, model: string): void {
    const key = `${slot}:${model}`;
    const count = this.inFlightRequests.get(key) || 0;
    if (count <= 1) {
      this.inFlightRequests.delete(key);
    } else {
      this.inFlightRequests.set(key, count - 1);
    }
  }

  /**
   * Gets active in-flight count for a slot+model.
   */
  public getInFlightCount(slot: number, model: string): number {
    return this.inFlightRequests.get(`${slot}:${model}`) || 0;
  }

  /**
   * Gets peak in-flight concurrency observed for a slot+model.
   */
  public getPeakInFlight(slot: number, model: string): number {
    return this.peakInFlightObserved.get(`${slot}:${model}`) || 0;
  }

  /**
   * Gets remaining cooldown seconds for a model on a specific slot.
   */
  public getCooldownRemaining(slot: number, model: string): number {
    const key = `${slot}:${model}`;
    const cooldownUntil = this.cooldowns.get(key) || 0;
    const now = Date.now();
    return cooldownUntil > now ? Math.ceil((cooldownUntil - now) / 1000) : 0;
  }

  /**
   * Record successful call for this model and slot.
   */
  public reportSuccess(slot: number, model: string): void {
    const key = `${slot}:${model}`;
    this.cooldowns.delete(key);
    this.failures.delete(key);
  }

  /**
   * Record rate limit or capacity cooldown for this model on this specific slot.
   * Incorporates bounded exponential backoff with randomized jitter to prevent retry storms.
   */
  public reportCooldown(slot: number, model: string, cooldownSeconds = 60): void {
    const key = `${slot}:${model}`;
    const failures = (this.failures.get(key) || 0) + 1;
    this.failures.set(key, failures);

    // Exponential backoff: 1x, 2x, 4x, 8x (capped at 600s = 10 min)
    const multiplier = Math.min(Math.pow(2, failures - 1), 8);
    // 1-4s randomized jitter to desynchronize simultaneous callers
    const jitter = Math.floor(Math.random() * 4) + 1;
    const effectiveSeconds = Math.min(600, cooldownSeconds * multiplier + jitter);
    const ms = Math.max(5, effectiveSeconds) * 1000;

    // Never shorten an already active longer cooldown
    const currentCooldown = this.cooldowns.get(key) || 0;
    const newCooldown = Date.now() + ms;
    this.cooldowns.set(key, Math.max(currentCooldown, newCooldown));
  }

  /**
   * Record model unsupported or permission denied on this specific project slot.
   * Does not assume the model is unsupported on other project slots.
   */
  public reportUnsupported(slot: number, model: string): void {
    const key = `${slot}:${model}`;
    this.unsupportedModels.add(key);
  }

  /**
   * Returns diagnostics for all configured models across slots.
   */
  public getModelDiagnostics(slots = [1, 2, 3]): ModelSlotStatus[] {
    return this.orderedModels.map((model) => {
      const cooldownSecondsBySlot: Record<number, number> = {};
      let isSupportedOverall = true;

      for (const slot of slots) {
        const key = `${slot}:${model}`;
        if (this.unsupportedModels.has(key)) {
          isSupportedOverall = false;
        }
        cooldownSecondsBySlot[slot] = this.getCooldownRemaining(slot, model);
      }

      return {
        model,
        isSupported: isSupportedOverall,
        cooldownSecondsBySlot,
      };
    });
  }

  /**
   * Resets all cooldowns and status caches (useful in tests).
   */
  public reset(): void {
    this.cooldowns.clear();
    this.unsupportedModels.clear();
    this.failures.clear();
    this.inFlightRequests.clear();
    this.peakInFlightObserved.clear();
  }
}

export const defaultModelManager = new GeminiModelManager();
