// Cloudflare Pages Function. Deployed automatically with the static site;
// available at https://brightdigital.co.nz/api/contact.
//
// Forwards submissions to a Google Apps Script web app, which sends email via
// the connected Google Workspace account (tineke@brightdigital.co.nz). Apps
// Script setup lives in docs/contact-form-apps-script.gs.
//
// Cloudflare Pages env vars required for emails to actually send:
//   APPS_SCRIPT_URL              The /exec URL of the deployed Apps Script web app
//   APPS_SCRIPT_SHARED_SECRET    A random string that must match the SHARED_SECRET
//                                property inside the Apps Script
//
// Without those env vars the function still accepts submissions and logs them
// to the Cloudflare dashboard, so the form is never visibly broken.

interface Env {
  APPS_SCRIPT_URL?: string;
  APPS_SCRIPT_SHARED_SECRET?: string;
}

interface ContactContext {
  request: Request;
  env: Env;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // If Apps Script isn't configured yet, log and acknowledge so the form is usable.
  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_SHARED_SECRET) {
    console.log('[contact] APPS_SCRIPT_URL/SHARED_SECRET not set; submission logged only:', {
      name, email, phone, message,
    });
    return wantsJson ? jsonResponse(200, { ok: true, mode: 'logged' }) : redirect('/contact?status=sent');
  }

  try {
    const res = await fetch(env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.APPS_SCRIPT_SHARED_SECRET,
        name,
        email,
        phone,
        message,
      }),
      // Apps Script's exec URL bounces through script.googleusercontent.com.
      // Workers' default follows redirects, but POST -> 302 becomes GET; that's
      // fine here because the redirect target also accepts the original POST
      // body when sent via Apps Script's web app endpoint.
      redirect: 'follow',
    });

    // Apps Script always returns HTTP 200; the success/error flag lives in the body.
    const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !payload?.ok) {
      console.error('[contact] Apps Script rejected submission:', res.status, payload);
      return wantsJson
        ? jsonResponse(502, { error: 'Could not send. Please email tineke@brightdigital.co.nz directly.' })
        : redirect('/contact?status=error');
    }
  } catch (err) {
    console.error('[contact] Apps Script fetch failed:', err);
    return wantsJson
      ? jsonResponse(502, { error: 'Network error. Please email tineke@brightdigital.co.nz.' })
      : redirect('/contact?status=error');
  }

  return wantsJson ? jsonResponse(200, { ok: true }) : redirect('/contact?status=sent');
}

export function onRequestGet(): Response {
  return jsonResponse(405, { error: 'POST only.' });
}
