import { describe, expect, it } from 'vitest';
import { builderReaders } from './index';
import { BUILDER_VALIDATION_STATUS } from './types';

describe('BUILDER_VALIDATION_STATUS', () => {
  it('has a validation status for every registered builder', () => {
    for (const id of Object.keys(builderReaders)) {
      expect(BUILDER_VALIDATION_STATUS).toHaveProperty(id);
    }
  });
});
