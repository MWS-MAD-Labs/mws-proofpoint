import assert from "node:assert/strict";
import test from "node:test";

import { applicationUrl } from "@/lib/application-url";

function withPublicUrl(value: string | undefined, run: () => void) {
  const previousAuthUrl = process.env.AUTH_URL;
  const previousNextAuthUrl = process.env.NEXTAUTH_URL;
  delete process.env.AUTH_URL;
  if (value === undefined) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = value;

  try {
    run();
  } finally {
    if (previousAuthUrl === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = previousAuthUrl;
    if (previousNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previousNextAuthUrl;
  }
}

test("uses the configured public origin instead of the container request origin", () => {
  withPublicUrl("https://proof-stg.mws.web.id", () => {
    assert.equal(
      applicationUrl("/dashboard", "https://0.0.0.0:3000/auth/sso").toString(),
      "https://proof-stg.mws.web.id/dashboard",
    );
  });
});

test("preserves redirect query parameters on the public origin", () => {
  withPublicUrl("https://proof-stg.mws.web.id", () => {
    assert.equal(
      applicationUrl(
        "/auth?error=upstream_unavailable",
        "https://0.0.0.0:3000/auth/sso",
      ).toString(),
      "https://proof-stg.mws.web.id/auth?error=upstream_unavailable",
    );
  });
});

test("falls back to the request origin for local development", () => {
  withPublicUrl(undefined, () => {
    assert.equal(
      applicationUrl("/auth/sso", "http://localhost:3001/auth/sso").toString(),
      "http://localhost:3001/auth/sso",
    );
  });
});
