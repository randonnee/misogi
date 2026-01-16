import { Effect } from "effect";
import { describe, it, expect } from "bun:test";
import type { ScrapeClient } from "./scrape-client";
import { ScrapeClientImpl } from "./scrape-client";

describe("ScrapeClient", () => {
  describe("constructor", () => {
    it("should create instance with default delay", () => {
      const client = new ScrapeClientImpl();
      expect(client).toBeInstanceOf(ScrapeClientImpl);
    });

    it("should create instance with custom delay", () => {
      const client = new ScrapeClientImpl(100);
      expect(client).toBeInstanceOf(ScrapeClientImpl);
    });
  });

  describe("rate limiting", () => {
    it("should enforce delay between requests", async () => {
      const client = new ScrapeClientImpl(10); // 10ms delay for fast tests
      let requestCount = 0;

      // Mock fetch to increment counter and return simple response
      const mockFetch = async () => {
        requestCount++;
        return new Response("test", { status: 200 });
      };

      // Store original fetch
      const originalFetch = global.fetch;
      // @ts-ignore
      global.fetch = mockFetch;

      const startTime = Date.now();

      // Make two requests
      await Effect.runPromise(client.get("https://example.com/1"));
      await Effect.runPromise(client.get("https://example.com/2"));

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Restore original fetch
      // @ts-ignore
      global.fetch = originalFetch;

      // Should take at least 10ms due to delay
      expect(elapsed).toBeGreaterThanOrEqual(10);
      expect(requestCount).toBe(2);
    });

    it("should not delay when enough time has passed", async () => {
      const client = new ScrapeClientImpl(50); // 50ms delay
      let requestCount = 0;

      const mockFetch = async () => {
        requestCount++;
        return new Response("test", { status: 200 });
      };

      const originalFetch = global.fetch;
      // @ts-ignore
      global.fetch = mockFetch;

      const startTime = Date.now();

      // Make first request
      await Effect.runPromise(client.get("https://example.com/1"));

      // Wait longer than delay period
      await new Promise(resolve => setTimeout(resolve, 60));

      // Make second request
      await Effect.runPromise(client.get("https://example.com/2"));

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // @ts-ignore
      global.fetch = originalFetch;

      // Should take more than 60ms but less than 110ms
      expect(elapsed).toBeGreaterThan(60);
      expect(elapsed).toBeLessThan(110);
      expect(requestCount).toBe(2);
    });
  });

  describe("error handling", () => {
    it("should handle network errors in Effect", async () => {
      const client = new ScrapeClientImpl(0); // No delay for error tests

      const mockFetch = async () => {
        throw new Error("Network error");
      };

      const originalFetch = global.fetch;
      // @ts-ignore
      global.fetch = mockFetch;

      const result = await Effect.runPromise(
        Effect.either(client.get("https://example.com"))
      );

      // @ts-ignore
      global.fetch = originalFetch;

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.message).toBe("Network error");
      }
    });

    it("should handle non-Error objects", async () => {
      const client = new ScrapeClientImpl(0);

      const mockFetch = async () => {
        throw "String error";
      };

      const originalFetch = global.fetch;
      // @ts-ignore
      global.fetch = mockFetch;

      const result = await Effect.runPromise(
        Effect.either(client.get("https://example.com"))
      );

      // @ts-ignore
      global.fetch = originalFetch;

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.message).toBe("String error");
      }
    });

    it("should handle HTTP error responses", async () => {
      const client = new ScrapeClientImpl(0);

      const mockFetch = async () => {
        return new Response("", { status: 404, statusText: "Not Found" });
      };

      const originalFetch = global.fetch;
      // @ts-ignore
      global.fetch = mockFetch;

      const result = await Effect.runPromise(
        Effect.either(client.get("https://example.com"))
      );

      // @ts-ignore
      global.fetch = originalFetch;

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.message).toContain("404 Not Found");
      }
    });
  });

  describe("successful requests", () => {
    it("should handle successful HTTP response", async () => {
      const client = new ScrapeClientImpl(0);

      const mockFetch = async () => {
        return new Response("<html>test</html>", {
          status: 200,
          statusText: "OK"
        });
      };

      const originalFetch = global.fetch;
      // @ts-ignore
      global.fetch = mockFetch;

      const result = await Effect.runPromise(client.get("https://example.com"));

      // @ts-ignore
      global.fetch = originalFetch;

      expect(result).toBe("<html>test</html>");
    });

    it("should include proper headers", async () => {
      const client = new ScrapeClientImpl(0);
      let capturedOptions: RequestInit | undefined;

      const mockFetch = async (url: string | URL | Request, options: RequestInit) => {
        capturedOptions = options;
        return new Response("<html>test</html>", {
          status: 200,
          statusText: "OK"
        });
      };

      const originalFetch = global.fetch;
      // @ts-ignore
      global.fetch = mockFetch;

      await Effect.runPromise(client.get("https://example.com"));

      // @ts-ignore
      global.fetch = originalFetch;

      const headers = capturedOptions?.headers;
      if (headers instanceof Headers) {
        expect(headers.get("User-Agent")).toContain("Mozilla/5.0");
      }
    });
  });
});
