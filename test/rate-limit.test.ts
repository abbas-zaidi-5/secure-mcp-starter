import { describe, expect, it } from 'vitest';

import { FixedWindowRateLimiter } from '../src/rate-limit.js';

describe('fixed-window rate limiter', () => {
  it('rejects requests beyond the limit and resets later', () => {
    const limiter = new FixedWindowRateLimiter(2, 1_000);

    expect(limiter.consume('client', 100).allowed).toBe(true);
    expect(limiter.consume('client', 200).remaining).toBe(0);
    expect(limiter.consume('client', 300).allowed).toBe(false);
    expect(limiter.consume('client', 1_101).allowed).toBe(true);
  });

  it('keeps clients isolated and supports pruning', () => {
    const limiter = new FixedWindowRateLimiter(1, 1_000);

    expect(limiter.consume('a', 100).allowed).toBe(true);
    expect(limiter.consume('b', 100).allowed).toBe(true);
    limiter.prune(1_101);
    expect(limiter.consume('a', 1_101).allowed).toBe(true);
  });
});
