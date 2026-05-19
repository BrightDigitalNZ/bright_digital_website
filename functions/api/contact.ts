// Cloudflare Pages Function. Deployed automatically with the static site;
// available at https://brightdigital.co.nz/api/contact.
//
// Setup once the site is live:
//   1. Sign up at https://resend.com (free, 3000 emails/month).
//   2. Verify brightdigital.co.nz (DNS records: SPF + DKIM). Until then,
//      Resend will deliver test emails from onboarding@resend.dev.
//   3. Cloudflare Pages dashboard -> Settings -> Environment Variables:
//        RESEND_API_KEY   = re_xxx
//        CONTACT_TO       = tineke@brightdigital.co.nz
//        CONTACT_FROM     = "Bright Digital <hello@brightdigital.co.nz>"
//                           (use onboarding@resend.dev until DNS is verified)
//
// Without RESEND_API_KEY the function still accepts submissions and logs them
// to the Cloudflare dashboard, so the form is usable from day one.

interface Env {
  RESEND_API_KEY?: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
}

interface ContactContext {
  request: Request;
  env: Env;
}

const TO_DEFAULT = 'tineke@brightdigital.co.nz';
const FROM_DEFAULT = 'Bright Digital <onboarding@resend.dev>';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function redirect(url: string, status = 303): Response {
  return new Response(null, { status, headers: { Location: url } });
}

export async function onRequestPost(context: ContactContext): Promise<Response> {
  const { request, env } = context;
  const accept = request.headers.get('Accept') ?? '';
  const wantsJson = accept.includes('application/json');

  // Accept either form-encoded (native form post) or JSON (fetch).
  let data: Record<string, string> = {};
  const contentType = request.headers.get('Content-Type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const parsed = await request.json();
      if (parsed && typeof parsed === 'object') {
        data = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
        );
      }
    } else {
      const form = await request.formData();
      for (const [k, v] of form.entries()) {
        data[k] = typeof v === 'string' ? v : '';
      }
    }
  } catch {
    return wantsJson
      ? jsonResponse(400, { error: 'Could not read submission.' })
      : redirect('/contact?status=error');
  }

  // Honeypot: if the hidden "company" field is filled, silently accept.
  if (data.company && data.company.trim() !== '') {
    return wantsJson ? jsonResponse(200, { ok: true }) : redirect('/contact?status=sent');
  }

  const name = (data.name ?? '').trim();
  const email = (data.email ?? '').trim();
  const phone = (data.phone ?? '').trim();
  const message = (data.message ?? '').trim();

  if (!name || !email || !message) {
    return wantsJson
      ? jsonResponse(400, { error: 'Please complete name, email and message.' })
      : redirect('/contact?status=error');
  }
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return wantsJson
      ? jsonResponse(400, { error: 'Please enter a valid email address.' })
      : redirect('/contact?status=error');
  }
  if (message.length > 5000) {
    return wantsJson
      ? jsonResponse(400, { error: 'Message is too long.' })
      : redirect('/contact?status=error');
  }

  const to = env.CONTACT_TO ?? TO_DEFAULT;
  const from = env.CONTACT_FROM ?? FROM_DEFAULT;

  const html = `
    <h2>New enquiry from brightdigital.co.nz</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ''}
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
  `;
  const text = [
    'New enquiry from brightdigital.co.nz',
    `Name: ${name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    '',
    message,
  ].filter(Boolean).join('\n');

  // If Resend isn't configured yet, log and acknowledge so the form is usable.
  if (!env.RESEND_API_KEY) {
    console.log('[contact] no RESEND_API_KEY set; submission received:', { name, email, phone, message });
    return wantsJson ? jsonResponse(200, { ok: true, mode: 'logged' }) : redirect('/contact?status=sent');
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `Website enquiry from ${name}`,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error('[contact] Resend rejected submission:', res.status, errBody);
      return wantsJson
        ? jsonResponse(502, { error: 'Could not send email. Please try again or email us directly.' })
        : redirect('/contact?status=error');
    }
  } catch (err) {
    console.error('[contact] Resend fetch failed:', err);
    return wantsJson
      ? jsonResponse(502, { error: 'Could not reach our mail service. Please email tineke@brightdigital.co.nz.' })
      : redirect('/contact?status=error');
  }

  return wantsJson ? jsonResponse(200, { ok: true }) : redirect('/contact?status=sent');
}

export function onRequestGet(): Response {
  return jsonResponse(405, { error: 'POST only.' });
}
