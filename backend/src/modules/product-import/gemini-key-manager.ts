import type { KeySlotStatus } from './product-import.types';
import { config } from '../../config/env';

export interface SlotInternal {
  slot: number;
  key: string;
  isConfigured: boolean;
  isHealthy: boolean;
  isQuotaExhausted: boolean;
  quotaExhaustedUntil: number;
  cooldownUntil: number;
  failureCount: number;
  lastError?: string;
}

export class GeminiKeyManager {
  private slots: SlotInternal[];
  private currentPointer = 0;

  constructor(keys?: { key1?: string; key2?: string; key3?: string }) {
    const k1 = keys?.key1 !== undefined ? keys.key1 : config.gemini?.apiKey1 || '';
    const k2 = keys?.key2 !== undefined ? keys.key2 : config.gemini?.apiKey2 || '';
    const k3 = keys?.key3 !== undefined ? keys.key3 : config.gemini?.apiKey3 || '';

    this.slots = [
      {
        slot: 1,
        key: k1.trim(),
        isConfigured: Boolean(k1 && k1.trim().length > 0),
        isHealthy: true,
        isQuotaExhausted: false,
        quotaExhaustedUntil: 0,
        cooldownUntil: 0,
        failureCount: 0,
      },
      {
        slot: 2,
        key: k2.trim(),
        isConfigured: Boolean(k2 && k2.trim().length > 0),
        isHealthy: true,
        isQuotaExhausted: false,
        quotaExhaustedUntil: 0,
        cooldownUntil: 0,
        failureCount: 0,
      },
      {
        slot: 3,
        key: k3.trim(),
        isConfigured: Boolean(k3 && k3.trim().length > 0),
        isHealthy: true,
        isQuotaExhausted: false,
        quotaExhaustedUntil: 0,
        cooldownUntil: 0,
        failureCount: 0,
      },
    ];

    // Detect if slots share the exact same key to prevent redundant project pools
    this.markDuplicateKeys();
  }

  private markDuplicateKeys(): void {
    const seenKeys = new Map<string, number>();
    for (const slot of this.slots) {
      if (!slot.isConfigured) continue;
      if (seenKeys.has(slot.key)) {
        // Mark as alias of previous slot
        slot.lastError = `Duplicate of Key Slot ${seenKeys.get(slot.key)}`;
      } else {
        seenKeys.set(slot.key, slot.slot);
      }
    }
  }

  public hasConfiguredKeys(): boolean {
    return this.slots.some((s) => s.isConfigured);
  }

  public getTotalConfigured(): number {
    return this.slots.filter((s) => s.isConfigured).length;
  }

  public getTotalHealthy(): number {
    const now = Date.now();
    return this.slots.filter(
      (s) => s.isConfigured && s.isHealthy && !s.isQuotaExhausted && s.cooldownUntil <= now
    ).length;
  }

  public getSlotKey(slotNumber: number): string {
    const slot = this.slots.find((s) => s.slot === slotNumber);
    if (!slot || !slot.isConfigured) {
      throw new Error(`Gemini key slot ${slotNumber} is not configured.`);
    }
    return slot.key;
  }

  /**
   * Returns list of eligible slot numbers in round-robin order.
   * If all slots are in cooldown, returns the one whose cooldown expires earliest.
   */
  public getEligibleSlots(): number[] {
    const configured = this.slots.filter((s) => s.isConfigured && s.isHealthy);
    if (configured.length === 0) {
      return [];
    }

    const now = Date.now();
    // Filter out quota-exhausted or cooling down slots
    const ready = configured.filter(
      (s) => (!s.isQuotaExhausted || s.quotaExhaustedUntil <= now) && s.cooldownUntil <= now
    );

    if (ready.length > 0) {
      // Reorder starting from current round-robin pointer
      const count = ready.length;
      const startIndex = this.currentPointer % count;
      const ordered: number[] = [];
      for (let i = 0; i < count; i++) {
        ordered.push(ready[(startIndex + i) % count].slot);
      }
      return ordered;
    }

    // If all healthy slots are in cooldown, return slot that recovers earliest
    const sorted = [...configured].sort((a, b) => {
      const aTime = Math.max(a.cooldownUntil, a.quotaExhaustedUntil);
      const bTime = Math.max(b.cooldownUntil, b.quotaExhaustedUntil);
      return aTime - bTime;
    });

    return sorted.map((s) => s.slot);
  }

  /**
   * Advance the round-robin pointer after an import request.
   */
  public advancePointer(): void {
    const configured = this.slots.filter((s) => s.isConfigured && s.isHealthy);
    if (configured.length > 0) {
      this.currentPointer = (this.currentPointer + 1) % configured.length;
    }
  }

  /**
   * Report successful request on slot.
   */
  public reportSuccess(slotNumber: number): void {
    const slot = this.slots.find((s) => s.slot === slotNumber);
    if (slot) {
      slot.isHealthy = true;
      slot.isQuotaExhausted = false;
      slot.quotaExhaustedUntil = 0;
      slot.cooldownUntil = 0;
      slot.failureCount = 0;
      slot.lastError = undefined;
    }
  }

  /**
   * Report project-wide quota exhaustion (e.g. daily limit or account resource exhausted).
   * Do not waste attempts on other models for this key/project.
   */
  public reportProjectQuotaExhausted(slotNumber: number, durationSeconds = 86400, reason = 'Project quota exhausted'): void {
    const slot = this.slots.find((s) => s.slot === slotNumber);
    if (slot) {
      slot.isQuotaExhausted = true;
      const ms = Math.max(60, durationSeconds) * 1000;
      slot.quotaExhaustedUntil = Date.now() + ms;
      slot.lastError = `Project Quota Exhausted: ${reason}`;
    }
  }

  /**
   * Report invalid/unauthorized API key (401/403 API_KEY_INVALID).
   */
  public reportInvalidKey(slotNumber: number, reason = 'API key invalid or revoked'): void {
    const slot = this.slots.find((s) => s.slot === slotNumber);
    if (slot) {
      slot.isHealthy = false;
      slot.lastError = `Permanent Auth Failure: ${reason}`;
    }
  }

  /**
   * Report transient server error or cooldown for key slot.
   */
  public reportTransientFailure(slotNumber: number, durationSeconds = 30, reason = 'Transient server error'): void {
    const slot = this.slots.find((s) => s.slot === slotNumber);
    if (slot) {
      slot.failureCount += 1;
      const ms = Math.max(5, durationSeconds) * 1000;
      slot.cooldownUntil = Date.now() + ms;
      slot.lastError = `Cooldown (${durationSeconds}s): ${reason}`;
    }
  }

  /**
   * Returns safe diagnostics without leaking any key strings.
   */
  public getDiagnostics(): KeySlotStatus[] {
    const now = Date.now();
    return this.slots.map((s) => {
      const isRateLimited = s.cooldownUntil > now;
      const isQuotaExhausted = s.isQuotaExhausted && s.quotaExhaustedUntil > now;
      const maxCooldown = Math.max(s.cooldownUntil, isQuotaExhausted ? s.quotaExhaustedUntil : 0);
      const remainingSec = maxCooldown > now ? Math.ceil((maxCooldown - now) / 1000) : 0;

      return {
        slot: s.slot,
        configured: s.isConfigured,
        healthy: s.isHealthy,
        rateLimited: isRateLimited,
        quotaExhausted: isQuotaExhausted,
        cooldownSecondsRemaining: remainingSec,
        failureCount: s.failureCount,
        lastError: s.lastError,
      };
    });
  }

  public reset(): void {
    for (const slot of this.slots) {
      slot.isHealthy = true;
      slot.isQuotaExhausted = false;
      slot.quotaExhaustedUntil = 0;
      slot.cooldownUntil = 0;
      slot.failureCount = 0;
      slot.lastError = undefined;
    }
  }
}

export const defaultKeyManager = new GeminiKeyManager();
