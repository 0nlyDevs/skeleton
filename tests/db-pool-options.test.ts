/**
 * `DATABASE_URL` → driver options.
 *
 * `active=0 idle=0` in the pool's complaint means no connection was ever opened.
 * These cases spell out the parameters that cause that, so the next person to
 * deploy does not have to rediscover it from a 15-second timeout.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONNECTION_LIMIT,
  DEFAULT_CONNECT_TIMEOUT_SECONDS,
  DEFAULT_POOL_TIMEOUT_SECONDS,
  toPoolOptions,
} from "@/lib/db/pool-options";

const AIVEN = "mysql://avnadmin:secret@db.example.aivencloud.com:12873/defaultdb?ssl-mode=REQUIRED";

describe("toPoolOptions", () => {
  it("reads host, port, credentials and database", () => {
    expect(toPoolOptions(AIVEN)).toMatchObject({
      host: "db.example.aivencloud.com",
      port: 12873,
      user: "avnadmin",
      password: "secret",
      database: "defaultdb",
    });
  });

  it("decodes percent-encoded credentials", () => {
    const options = toPoolOptions("mysql://user:p%40ss%3Aword@db.internal:3306/app");
    expect(options.user).toBe("user");
    expect(options.password).toBe("p@ss:word");
  });

  it("falls back to defaults instead of throwing on an unparsable URL", () => {
    expect(toPoolOptions("not a url")).toMatchObject({
      host: "localhost",
      port: 3306,
      connectionLimit: DEFAULT_CONNECTION_LIMIT,
      acquireTimeout: DEFAULT_POOL_TIMEOUT_SECONDS * 1000,
      connectTimeout: DEFAULT_CONNECT_TIMEOUT_SECONDS * 1000,
    });
  });

  describe("pool sizing", () => {
    it("keeps the v6 parameter names working", () => {
      const options = toPoolOptions("mysql://u:p@h:3306/db?connection_limit=12&pool_timeout=30");
      expect(options.connectionLimit).toBe(12);
      expect(options.acquireTimeout).toBe(30_000);
    });

    it("ignores nonsense values instead of handing them to the driver", () => {
      const options = toPoolOptions("mysql://u:p@h:3306/db?connection_limit=0&pool_timeout=abc");
      expect(options.connectionLimit).toBe(DEFAULT_CONNECTION_LIMIT);
      expect(options.acquireTimeout).toBe(DEFAULT_POOL_TIMEOUT_SECONDS * 1000);
    });
  });

  describe("timeouts", () => {
    it("outlives the driver's one-second default", () => {
      // A remote TLS handshake takes 2-3s; at the driver's 1000ms default every
      // attempt dies and the pool never fills a slot.
      expect(toPoolOptions(AIVEN).connectTimeout).toBeGreaterThan(3_000);
      expect(toPoolOptions(AIVEN).connectTimeout).toBe(
        DEFAULT_CONNECT_TIMEOUT_SECONDS * 1000,
      );
    });

    it("separates the connect budget from the acquire budget", () => {
      const options = toPoolOptions("mysql://u:p@h:3306/db?connect_timeout=5&pool_timeout=30");
      expect(options.connectTimeout).toBe(5_000);
      expect(options.acquireTimeout).toBe(30_000);
    });

    it("ignores a zero or negative connect_timeout", () => {
      expect(toPoolOptions("mysql://u:p@h:3306/db?connect_timeout=0").connectTimeout).toBe(
        DEFAULT_CONNECT_TIMEOUT_SECONDS * 1000,
      );
    });
  });

  describe("TLS", () => {
    it("defaults to plain TCP for a local or cPanel database", () => {
      expect(toPoolOptions("mysql://u:p@localhost:3306/webcup").ssl).toBeUndefined();
    });

    it("encrypts without verifying for ssl-mode=REQUIRED", () => {
      // MySQL's semantics: encrypt, do not verify. A self-signing managed host
      // is unreachable with rejectUnauthorized: true.
      expect(toPoolOptions(AIVEN).ssl).toEqual({ rejectUnauthorized: false });
    });

    it("verifies the CA for VERIFY_CA and VERIFY_IDENTITY", () => {
      for (const mode of ["VERIFY_CA", "VERIFY_IDENTITY"]) {
        expect(toPoolOptions(`mysql://u:p@h:3306/db?ssl-mode=${mode}`).ssl).toEqual({
          rejectUnauthorized: true,
        });
      }
    });

    it("accepts the older sslaccept and ssl spellings", () => {
      expect(toPoolOptions("mysql://u:p@h:3306/db?sslaccept=require").ssl).toEqual({
        rejectUnauthorized: false,
      });
      expect(toPoolOptions("mysql://u:p@h:3306/db?sslaccept=accept").ssl).toEqual({
        rejectUnauthorized: false,
      });
      expect(toPoolOptions("mysql://u:p@h:3306/db?sslaccept=disable").ssl).toBeUndefined();
      expect(toPoolOptions("mysql://u:p@h:3306/db?ssl=true").ssl).toEqual({
        rejectUnauthorized: false,
      });
      expect(toPoolOptions("mysql://u:p@h:3306/db?ssl=false").ssl).toBeUndefined();
    });

    it("passes an explicit CA through to the driver", () => {
      const options = toPoolOptions("mysql://u:p@h:3306/db?ssl-mode=VERIFY_CA&ssl-ca=/etc/ssl/aiven.pem");
      expect(options.ssl).toEqual({ rejectUnauthorized: true, ca: "/etc/ssl/aiven.pem" });
    });

    it("ignores unknown parameters rather than forwarding them", () => {
      const options = toPoolOptions("mysql://u:p@h:3306/db?ssl-mode=REQUIRED&charset=utf8mb4");
      expect(options.ssl).toEqual({ rejectUnauthorized: false });
      expect(options).not.toHaveProperty("charset");
    });

    it("prefers ssl-mode when several spellings are present", () => {
      const options = toPoolOptions("mysql://u:p@h:3306/db?ssl=false&ssl-mode=REQUIRED");
      expect(options.ssl).toEqual({ rejectUnauthorized: false });
    });
  });
});
