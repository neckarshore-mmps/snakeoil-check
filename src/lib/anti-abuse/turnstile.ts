// Anti-Abuse Layer 1 — Cloudflare Turnstile server-side verification.
//
// Posts the client-submitted Turnstile token to Cloudflare's siteverify
// endpoint together with the secret key. Fails closed: any transport error
// is treated as a failed verification (block), never as a pass.

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResult {
  success: boolean;
  /** Customer data round-tripped through the widget (e.g. a session id). */
  cdata?: string;
  /** Cloudflare error codes (e.g. 'timeout-or-duplicate'), or our own 'network-error'. */
  errorCodes?: string[];
}

interface SiteverifyResponse {
  success: boolean;
  cdata?: string;
  'error-codes'?: string[];
}

/**
 * Verify a Turnstile token against Cloudflare's siteverify API.
 *
 * @param token    The `cf-turnstile-response` token from the client widget.
 * @param remoteIp Optional end-user IP for additional signal.
 * @throws If `TURNSTILE_SECRET_KEY` is not configured (config error — surfaced loudly).
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new Error('Missing required env var: TURNSTILE_SECRET_KEY');
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  let data: SiteverifyResponse;
  try {
    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    data = (await res.json()) as SiteverifyResponse;
  } catch {
    // Fail closed: if Cloudflare is unreachable we cannot prove the user is
    // human, so we block rather than let abuse through.
    return { success: false, errorCodes: ['network-error'] };
  }

  return {
    success: data.success === true,
    cdata: data.cdata,
    errorCodes: data['error-codes'],
  };
}
