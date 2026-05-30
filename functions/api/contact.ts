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

  // Honeypot: real users won't see/fill bd_extra_notes. If it has content, drop
  // the submission silently. We log it so we can tell genuine bot hits apart
  // from accidental autofill triggers when diagnosing.
  if (data.bd_extra_notes && data.bd_extra_notes.trim() !== '') {
    console.log('[contact] honeypot tripped, dropping submission:', {
      hp: data.bd_extra_notes,
      name: data.name,
      email: data.email,
    });
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

  const payload = {
    secret: env.APPS_SCRIPT_SHARED_SECRET,
    name,
    email,
    phone,
    message,
  };

  const payload = {
    secret: env.APPS_SCRIPT_SHARED_SECRET,
    name,
    email,
    phone,
    message,
  };

  try {
    const { res, reachedDoPost } = await postFollowingRedirects(env.APPS_SCRIPT_URL, payload);

    if (res) {
      // Best case: we got a clean JSON response with the ok flag.
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (body && typeof body.ok === 'boolean') {
        if (body.ok) {
          return wantsJson ? jsonResponse(200, { ok: true }) : redirect('/contact?status=sent');
        }
        console.error('[contact] Apps Script returned ok=false:', body);
        return wantsJson
          ? jsonResponse(502, { error: body.error ?? 'Could not send. Please email tineke@brightdigital.co.nz directly.' })
          : redirect('/contact?status=error');
      }
    }

    // Apps Script's redirect chain often ends in a 405/200 from a cached-content
    // endpoint whose body isn't parseable as JSON. By that point doPost has
    // already run and the email is sent. So if we POSTed to googleusercontent
    // successfully, treat the form submission as a success.
    if (reachedDoPost) {
      console.log('[contact] no parseable response body, but POST to googleusercontent succeeded -> assuming doPost ran');
      return wantsJson ? jsonResponse(200, { ok: true }) : redirect('/contact?status=sent');
    }

    console.error('[contact] Apps Script chain ended without reaching doPost. status:', res?.status);
    return wantsJson
      ? jsonResponse(502, { error: 'Could not reach mail service. Please email tineke@brightdigital.co.nz directly.' })
      : redirect('/contact?status=error');
  } catch (err) {
    console.error('[contact] Apps Script fetch failed:', err);
    return wantsJson
      ? jsonResponse(502, { error: 'Network error. Please email tineke@brightdigital.co.nz.' })
      : redirect('/contact?status=error');
  }
}

// Apps Script's web-app endpoint produces a chain of redirects. The first two
// hops carry the POST body (so doPost can run); after that, subsequent hops
// are Google's cached-content redirects that only accept GET and sometimes
// return 405 even when doPost has already executed cleanly. We track whether
// we POSTed successfully to script.googleusercontent.com so the caller can
// treat the submission as a success even if the cached-content retrieval
// returns something weird.
async function postFollowingRedirects(
  initialUrl: string,
  payload: Record<string, unknown>,
): Promise<{ res: Response | null; reachedDoPost: boolean }> {
  let url = initialUrl;
  let reachedDoPost = false;
  for (let i = 0; i < 5; i++) {
    const usePost = i < 2;
    const res = await fetch(url, {
      method: usePost ? 'POST' : 'GET',
      headers: usePost ? { 'Content-Type': 'application/json' } : {},
      body: usePost ? JSON.stringify(payload) : undefined,
      redirect: 'manual',
    });
    console.log(`[contact] hop ${i}: ${usePost ? 'POST' : 'GET'} ${url.slice(0, 80)} -> ${res.status}`);
    if (usePost && url.includes('script.googleusercontent.com') && res.status < 500) {
      reachedDoPost = true;
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('Location');
      if (!location) return { res, reachedDoPost };
      url = location;
      continue;
    }
    return { res, reachedDoPost };
  }
  return { res: null, reachedDoPost };
}

export function onRequestGet(): Response {
  return jsonResponse(405, { error: 'POST only.' });
}
