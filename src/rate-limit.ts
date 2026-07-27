export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export class FixedWindowRateLimiter {
  readonly #buckets = new Map<string, Bucket>();

  public constructor(
    private readonly maximum: number,
    private readonly windowMs: number
  ) {}

  public consume(key: string, now = Date.now()): RateLimitDecision {
    const existing = this.#buckets.get(key);
    const bucket =
      existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + this.windowMs };

    bucket.count += 1;
    this.#buckets.set(key, bucket);

    if (this.#buckets.size > 10_000) {
      this.prune(now);
    }

    return {
      allowed: bucket.count <= this.maximum,
      remaining: Math.max(0, this.maximum - bucket.count),
      retryAfterMs: Math.max(0, bucket.resetAt - now)
    };
  }

  public prune(now = Date.now()): void {
    for (const [key, bucket] of this.#buckets) {
      if (bucket.resetAt <= now) {
        this.#buckets.delete(key);
      }
    }
  }
}
