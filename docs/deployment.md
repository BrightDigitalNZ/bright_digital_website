# Deployment and DNS cutover

End-to-end runbook to take the new site live on Cloudflare Pages and move `brightdigital.co.nz` from GoDaddy to Cloudflare DNS. Plan for ~60 minutes of active work, then leave it to propagate.

## Stage 0. Prerequisites

- A Cloudflare account (free): https://dash.cloudflare.com → Sign Up
- Access to the GoDaddy account where brightdigital.co.nz is registered
- A Google account with access (or new access) to Google Search Console
- A Resend account if you want the contact form to send email (see `functions/api/contact.ts` header for setup)

## Stage 1. Connect Cloudflare Pages to GitHub

This deploys the static site automatically every time we push to GitHub.

1. https://dash.cloudflare.com → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. Authorize the **Cloudflare Pages** GitHub app, scope it to `BrightDigitalNZ/bright_digital_website`
3. Select that repo. **Project name**: `bright-digital` (this becomes `bright-digital.pages.dev`).
4. Production branch: **main**. We'll merge `claude/rebuild-bright-digital-vlamU` into main when you're happy.
5. Build settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: leave blank
6. Environment variables (Production):
   - `NODE_VERSION` = `22` (Cloudflare's default is older; this matches our local stack)
   - `PUBLIC_GTM_ID` = leave blank for now, fill in once you have a container ID
   - `RESEND_API_KEY` = leave blank for now, fill in after Stage 5
   - `CONTACT_TO` = `tineke@brightdigital.co.nz`
   - `CONTACT_FROM` = `Bright Digital <onboarding@resend.dev>` (swap to your domain after Stage 5)
7. **Save and Deploy**. The first build takes ~2 minutes. You'll get a URL like `https://bright-digital.pages.dev`.

**Verify the preview deploy works** before going further. Click through nav, submit the contact form (you'll get a 200 even without Resend configured — the function logs the submission to the Cloudflare dashboard), test both calculators, open a blog post.

## Stage 2. Add brightdigital.co.nz to Cloudflare

Don't change DNS at GoDaddy yet. We're just adding the zone to Cloudflare so it's ready.

1. https://dash.cloudflare.com → **Add a domain** → enter `brightdigital.co.nz` → **Free plan** → Continue
2. Cloudflare scans the existing DNS records at GoDaddy and imports them. Review the imported records:
   - **Keep**: MX records (so email still works), any TXT records you recognise (SPF, Google site verification, etc.)
   - **Remove**: any `A` or `CNAME` record for `@` (root) and `www` that points to the current site — we'll replace these.
3. Cloudflare gives you two nameservers, e.g. `kira.ns.cloudflare.com` and `ned.ns.cloudflare.com`. **Copy them** and keep this tab open.

## Stage 3. Point brightdigital.co.nz at the Pages project

Still inside Cloudflare's DNS panel for the new zone, add two records:

1. `CNAME @` → `bright-digital.pages.dev` (Proxy status: orange cloud ON)
2. `CNAME www` → `bright-digital.pages.dev` (Proxy status: orange cloud ON)

(Cloudflare allows CNAME at apex for proxied records — this is the "CNAME flattening" feature.)

Then attach the domain to the Pages project:

1. https://dash.cloudflare.com → Workers & Pages → `bright-digital` → **Custom domains** → **Set up a custom domain**
2. Add `brightdigital.co.nz`
3. Repeat for `www.brightdigital.co.nz`
4. Cloudflare will say "CNAME record already exists" and confirm activation immediately because the DNS lives in Cloudflare.

The Pages site is now reachable at `brightdigital.co.nz` **from within Cloudflare's network**, but the public internet still resolves the domain via GoDaddy's nameservers. That's Stage 4.

## Stage 4. Switch nameservers at GoDaddy

This is the cutover. After this step, your DNS is managed at Cloudflare, not GoDaddy.

1. Log into https://godaddy.com → **My Products** → Domains → click `brightdigital.co.nz`
2. **Manage DNS** → **Nameservers** → **Change** → **I'll use my own nameservers**
3. Paste the two Cloudflare nameservers from Stage 2.
4. Save.

Propagation is usually 5-30 minutes for `.co.nz`. Sometimes up to 24 hours in edge cases.

**Verify**: in a terminal, run `dig NS brightdigital.co.nz +short` until you see the Cloudflare nameservers (not the GoDaddy ones). On macOS, `scutil --dns | grep nameserver` flushes too if needed.

Once nameservers have switched, opening https://brightdigital.co.nz should serve the new Pages site with a valid SSL certificate (Cloudflare provisions it automatically).

## Stage 5. Wire up Resend (custom from-address)

Now that DNS is in Cloudflare, completing Resend domain verification is fast.

1. https://resend.com → **Domains** → **Add Domain** → enter `brightdigital.co.nz`
2. Resend shows you 4-5 DNS records (SPF, DKIM, optional DMARC).
3. In Cloudflare DNS for `brightdigital.co.nz`, add each record exactly as shown. **Proxy status: DNS only (grey cloud)** for these — they must be queryable directly.
4. Back in Resend, click **Verify Domain**. Usually instant.
5. Once verified, in Cloudflare Pages → Settings → Environment Variables, set `CONTACT_FROM = Bright Digital <hello@brightdigital.co.nz>` (or whatever sender alias you want).
6. Also set `RESEND_API_KEY` with your `re_xxx` key.
7. Trigger a redeploy (Pages → Deployments → Retry last deployment).
8. Test: submit the contact form, confirm you receive the email at `tineke@brightdigital.co.nz` within 30 seconds.

## Stage 6. Google Search Console

### 6.1 Verify the property (DNS TXT method)

1. https://search.google.com/search-console → **Add property** → **Domain** (not "URL prefix") → enter `brightdigital.co.nz` → Continue
2. Google shows a TXT record like `google-site-verification=xxxxxxxxxxxx`. Copy the value.
3. In Cloudflare DNS, add a `TXT @` record with that value. Proxy status: not applicable for TXT.
4. Back in Search Console, click **Verify**. Usually instant; occasionally needs 5 minutes.

### 6.2 Submit the sitemap

1. In Search Console → **Sitemaps** (left sidebar)
2. Enter `sitemap-index.xml` (relative path — Search Console appends the domain automatically)
3. Click **Submit**. Status should change to "Success" within a few minutes.

### 6.3 Request indexing of key pages

For each of these URLs, in Search Console use the **URL Inspection** tool (top search bar) → paste URL → if status is "URL is not on Google", click **Request indexing**:

- https://brightdigital.co.nz/
- https://brightdigital.co.nz/services/
- https://brightdigital.co.nz/calculators/
- https://brightdigital.co.nz/about/

You can only request indexing for ~10 URLs/day, so prioritise top revenue pages first. The rest will be discovered via the sitemap.

## Stage 7. 24-hour post-launch checklist

Run through this list during the first business day after cutover. Set a calendar reminder.

### Day of launch

- [ ] Hit every page from the main nav: home, services, calculators, blog, about, contact. Confirm everything loads.
- [ ] Submit a test contact form. Confirm the email arrives.
- [ ] Use both calculators (ROI and ROAS). Confirm numbers update as you type.
- [ ] On a phone, check the nav hamburger and all CTAs.
- [ ] In GTM Preview mode, fire each of the four tracked events (page view, contact submission, calculator use, blog 30s read).
- [ ] Cloudflare Analytics dashboard (free tier) — confirm traffic is hitting the new origin.
- [ ] Check old internal links if any third-party site links to old paths (`#home`, `#services` etc.). Those still work because the home page hash routes do nothing harmful, but if you find broken inbound links, set up 301 redirects in Cloudflare → Rules → Redirect Rules.

### Within 24 hours

- [ ] Search Console → **Indexing** → **Pages**: at least one page should show "Indexed".
- [ ] Search Console → **Sitemaps**: status "Success", "Discovered URLs" matches 20 (or 19 if you keep the 404 out of the sitemap, which is automatic — sitemap excludes the 404 by default).
- [ ] Run Lighthouse against three top pages: `npx lighthouse https://brightdigital.co.nz --view` (repeat for `/services/seo` and `/blog`). Performance, Accessibility, Best Practices and SEO should all be 95+. If any score is lower, share the screenshot.
- [ ] GA4 → Realtime: confirm page views are coming in.
- [ ] GA4 → Events: confirm `contact_submission`, `calculator_use`, `blog_read_30s` are recorded.

### Within 7 days

- [ ] Search Console → Performance: baseline impressions and clicks.
- [ ] Search Console → Coverage: 0 errors.
- [ ] If you're running paid traffic to the old site, update destination URLs in Google Ads and Meta Ads Manager to the new equivalents.
- [ ] Cloudflare Analytics: confirm 404 rate is < 1% of total requests. If higher, identify the top 404 paths and add redirects.

### Rollback plan (if something goes seriously wrong)

The fastest rollback is to switch nameservers back to GoDaddy:

1. GoDaddy → Domains → brightdigital.co.nz → Nameservers → **Default GoDaddy Nameservers**
2. Restore old A/CNAME records in GoDaddy DNS pointing at the previous host
3. Propagation: 5-30 minutes again.

We don't expect to need this. The static Cloudflare Pages deploy is identical to what we've been previewing for weeks of work.
