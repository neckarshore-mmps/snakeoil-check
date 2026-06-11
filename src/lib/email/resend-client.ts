// Resend sender for the confirm-email (Task 3.6). Lazy client construction so
// no env is read at build time. Throws (fail-loud) if misconfigured.

import { Resend } from 'resend';

const CONFIRM_SUBJECT = 'Bestätige deine E-Mail für den Snake-Oil-Check';

function confirmHtml(confirmUrl: string): string {
  return [
    '<p>Fast geschafft — bestätige deine E-Mail-Adresse, um deinen kostenlosen Check zu starten:</p>',
    `<p><a href="${confirmUrl}">E-Mail bestätigen</a></p>`,
    '<p>Der Link ist 30 Minuten gültig. Wenn du das nicht angefordert hast, ignoriere diese Mail.</p>',
  ].join('');
}

/** Send the confirm mail via Resend; returns the provider message id. */
export async function sendConfirmMail(to: string, confirmUrl: string): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY / RESEND_FROM not configured');
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: CONFIRM_SUBJECT,
    html: confirmHtml(confirmUrl),
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
  return { id: data?.id ?? '' };
}
