/*
 * Bright Digital — contact form receiver (Google Apps Script web app)
 *
 * Receives POSTs from functions/api/contact.ts on Cloudflare Pages and sends
 * the enquiry by email from tineke@brightdigital.co.nz (the Workspace
 * account that owns/deploys this script).
 *
 * SETUP CHECKLIST
 *
 * 1.  Sign in to https://script.google.com with the Workspace account that
 *     owns tineke@brightdigital.co.nz.
 * 2.  Click "+ New project".
 * 3.  Replace the boilerplate `function myFunction() {}` with the entire
 *     contents of this file.
 * 4.  Click the project title at the top (default "Untitled project") and
 *     rename to "Bright Digital Contact Form".
 * 5.  Save (Cmd+S / Ctrl+S, or the floppy-disk icon).
 *
 * 6.  Click the gear icon (Project Settings) in the left sidebar.
 *     Under "Script Properties" click "Add script property" and add:
 *
 *       Name:  SHARED_SECRET
 *       Value: <a long random string — generate one at https://1password.com/generate-password
 *               or via `openssl rand -hex 24` in a terminal. Treat it like a password>
 *
 *     Optionally also add (defaults shown):
 *       CONTACT_TO    = tineke@brightdigital.co.nz
 *       CONTACT_NAME  = Bright Digital Website
 *
 *     Click "Save script properties".
 *
 * 7.  Back in the Editor, click "Deploy" (top right) -> "New deployment".
 *     Click the gear next to "Select type" -> "Web app".
 *     Fill in:
 *       Description:      Contact form receiver
 *       Execute as:       Me (tineke@brightdigital.co.nz)
 *       Who has access:   Anyone
 *     Click "Deploy".
 *
 * 8.  Authorize: a popup appears -> "Authorize access" -> pick your account.
 *     You'll see a "Google hasn't verified this app" screen. This is normal
 *     for personal scripts. Click "Advanced" -> "Go to Bright Digital Contact
 *     Form (unsafe)" -> "Allow".
 *
 * 9.  Copy the Web app URL (looks like
 *     https://script.google.com/macros/s/AKfycb.../exec). Keep it.
 *
 * 10. In Cloudflare -> Workers & Pages -> bright-digital-website -> Settings
 *     -> Environment Variables, add (Production):
 *
 *       APPS_SCRIPT_URL            = the URL from step 9
 *       APPS_SCRIPT_SHARED_SECRET  = the same SHARED_SECRET value from step 6
 *
 *     Save, then Deployments -> Retry latest deployment.
 *
 * 11. Submit the contact form on the live site. An email should arrive in
 *     tineke@brightdigital.co.nz within ~10 seconds.
 *
 * REDEPLOYING AFTER EDITS
 *
 * If you later change this script, click Deploy -> Manage deployments ->
 * pencil icon -> Version: New version -> Deploy. Apps Script keeps the same
 * /exec URL across versions, so Cloudflare needs no changes.
 */

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const expected = props.getProperty('SHARED_SECRET');
    if (!expected) {
      return jsonResponse({ ok: false, error: 'server not configured' });
    }

    const data = JSON.parse(e.postData.contents);

    if (!data || data.secret !== expected) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }

    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim();
    const phone = String(data.phone || '').trim();
    const message = String(data.message || '').trim();

    if (!name || !email || !message) {
      return jsonResponse({ ok: false, error: 'missing fields' });
    }

    const to = props.getProperty('CONTACT_TO') || 'tineke@brightdigital.co.nz';
    const senderName = props.getProperty('CONTACT_NAME') || 'Bright Digital Website';
    const subject = 'Website enquiry from ' + name;

    const lines = [
      'New enquiry from brightdigital.co.nz',
      '',
      'Name:    ' + name,
      'Email:   ' + email,
    ];
    if (phone) lines.push('Phone:   ' + phone);
    lines.push('');
    lines.push(message);

    GmailApp.sendEmail(to, subject, lines.join('\n'), {
      replyTo: email,
      name: senderName,
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: 'internal error' });
  }
}

function doGet() {
  return jsonResponse({ ok: false, error: 'POST only' });
}

function jsonResponse(obj) {
  // Apps Script web apps always return HTTP 200; the "ok" boolean signals
  // success or failure. The Cloudflare Worker reads this field.
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
