import { describe, expect, it } from 'vitest';
import { FAQ, findFaq } from './faq';

describe('findFaq', () => {
  it('maps real sync errors to their explanation', () => {
    expect(FAQ[findFaq('Network error while contacting the worker: Failed to fetch')].question).toMatch(/reach/);
    expect(FAQ[findFaq('Server rejected the write (401 Unauthorized)')].question).toMatch(/401/);
    expect(FAQ[findFaq('This sync ID is not allowed by the worker (403)')].question).toMatch(/403/);
  });

  it('returns -1 for no error or an unknown one', () => {
    expect(findFaq(null)).toBe(-1);
    expect(findFaq('something else entirely')).toBe(-1);
  });
});
