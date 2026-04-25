import crypto from "crypto";

/**
 * Signed QR token for event tickets.
 * Format: `ticketId.hmac` where hmac = HMAC-SHA256(secret, ticketId) base64url-encoded.
 *
 * The secret is `TICKET_QR_SECRET` env var (falls back to a dev-only constant).
 * In production this MUST be set to a secure random value.
 */

const SECRET =
  process.env.TICKET_QR_SECRET ||
  // dev-only fallback so local dev works; warn loudly
  (() => {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "TICKET_QR_SECRET must be set in production",
      );
    }
    return "dev-only-do-not-use-in-prod-eaf2c1d8b6";
  })();

function sign(ticketId: string): string {
  return crypto
    .createHmac("sha256", SECRET)
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
