import type { TermMapping } from '../types/domain';

/** Pure transition functions for a single term's mapping. Shared by the
 * global reducer and each taxonomy row's local state so a row can update
 * itself instantly (see MappingsTab/TermRow) without waiting for a full
 * app-state round trip, while staying byte-for-byte consistent with what
 * the reducer would have computed. */

export function setTargetTable(
  existing: TermMapping | undefined,
  oldDomain: string,
  oldNicename: string,
  targetTableId: string | null,
): TermMapping {
  return {
    oldDomain,
    oldNicename,
    targetTableId,
    targetTermIds: [],
    excluded: existing?.excluded ?? false,
    origin: 'user',
  };
}

export function addDestination(existing: TermMapping | undefined, targetTermId: string): TermMapping | undefined {
  if (!existing || existing.targetTermIds.includes(targetTermId)) return existing;
  return {
    ...existing,
    targetTermIds: [...existing.targetTermIds, targetTermId],
    origin: 'user',
  };
}

export function removeDestination(existing: TermMapping | undefined, targetTermId: string): TermMapping | undefined {
  if (!existing) return existing;
  return {
    ...existing,
    targetTermIds: existing.targetTermIds.filter((id) => id !== targetTermId),
    origin: 'user',
  };
}

export function setExcluded(
  existing: TermMapping | undefined,
  oldDomain: string,
  oldNicename: string,
  excluded: boolean,
): TermMapping {
  return {
    oldDomain,
    oldNicename,
    targetTableId: existing?.targetTableId ?? null,
    targetTermIds: existing?.targetTermIds ?? [],
    excluded,
    origin: 'user',
  };
}
