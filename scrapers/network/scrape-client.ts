import { Effect } from "effect";

export interface ScrapeClient {
  get(url: string): Effect.Effect<string, Error>;
}

export class ScrapeClientImpl implements ScrapeClient {
  private static readonly DEFAULT_DELAY_MS = 1000;
  private static readonly USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  
  private lastRequestTime = 0;
  private readonly delayMs: number;

  constructor(delayMs: number = ScrapeClientImpl.DEFAULT_DELAY_MS) {
    this.delayMs = delayMs;
  }

  private async enforceDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.delayMs) {
      const delayNeeded = this.delayMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
    
    this.lastRequestTime = Date.now();
  }

  get(url: string): Effect.Effect<string, Error> {
    return Effect.tryPromise({
      try: async () => {
        await this.enforceDelay();
        
        const response = await fetch(url, {
          headers: {
            "User-Agent": ScrapeClientImpl.USER_AGENT,
          },
        });
        
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.text();
      },
      catch: (error): Error => {
        return error instanceof Error
          ? error
          : new Error(String(error));
      },
    });
  }
}