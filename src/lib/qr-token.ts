import crypto from "crypto";

/**
 * Signed QR token for event tickets.
 * Format: `ticketId.hmac` where hmac = HMAC-SHA256(secret, ticketId) base64url-encoded.
 *
 * The secret is read from `TICKET_QR_SECRET` env var. In production it MUST be
 * set to a secure random value; we validate lazily (only when sign/verify is
 * actually called) so module import never throws — that way the build can
 * still collect page data even if the env var is missing.
 */

const DEV_FALLBACK_SECRET = "dev-only-do-not-use-in-prod-eaf2c1d8b6";

function getSecret(): string {
  const envSecret = process.env.TICKET_QR_SECRET;
  if (envSecret && envSecret.length > 0) return envSecret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("TICKET_QR_SECRET must be set in production");
  }
  return DEV_FALLBACK_SECRET;
}

function sign(ticketId: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(ticketId)
    .digest("base64url");
}

/** Generate a signed QR token for a ticket UUID. */
export function generateQrToken(ticketId: string): string {
  return `${ticketId}.${sign(ticketId)}`;
}

/**
 * Verify a QR token. Returns the ticketId if valid, null otherwise.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyQrToken(token: string): string | null {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex < 1) return null;

  const ticketId = token.slice(0, dotIndex);
  const providedHmac = token.slice(dotIndex + 1);

  // Validate UUID shape (36 chars: 8-4-4-4-12)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId)) {
    return null;
  }

  const expectedHmac = sign(ticketId);

  // Constant-time comparison
  if (providedHmac.length !== expectedHmac.length) return null;
  try {
    const eq = crypto.timingSafeEqual(
      Buffer.from(providedHmac, "utf-8"),
      Buffer.from(expectedHmac, "utf-8"),
    );
    return eq ? ticketId : null;
  } catch {
    return null;
  }
}
