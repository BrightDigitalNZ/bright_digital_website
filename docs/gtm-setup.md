# GTM dashboard setup checklist

The site already pushes four signals to `window.dataLayer`. GTM picks them up and forwards them to GA4. Configure each step below in the GTM container linked to the site.

## 0. Prerequisites

- A Google account.
- A GA4 property created at https://analytics.google.com → Admin → Create property. Note the **Measurement ID** (`G-XXXXXXX`).
- A GTM container created at https://tagmanager.google.com → Create Account → Container. Container ID looks like `GTM-XXXXXXX`.
- Once you have the GTM container ID, paste it into Cloudflare Pages → Settings → Environment Variables as `PUBLIC_GTM_ID`. Trigger a new deploy. The snippet activates only when this var is set, so previews stay clean during testing.

## 1. Pre-wired dataLayer events

The site already pushes these. You don't need to add anything to the codebase.

| Event name | Fires when | Payload |
| --- | --- | --- |
| `contact_submission` | The contact form on `/contact` POSTs successfully. | `form_name: 'contact'` |
| `calculator_use` | A user changes any input in the ROI or ROAS calculator (fires once per calculator per page load). | `calculator_name: 'roi'` or `'roas'` |
| `blog_read_30s` | A blog post page has been visible for 30 seconds. Paused while the tab is in background. | `post_slug: '<slug>'` |

Page views are auto-tracked by GTM's built-in **History Change** trigger if you enable it, but this site has no client-side routing so the standard **Page View** trigger covers everything.

## 2. GTM tags to create

### Tag 1: GA4 Configuration (Page Views)

- Tag Type: **Google Analytics: GA4 Configuration**
- Measurement ID: `G-XXXXXXX` (from your GA4 property)
- Trigger: **All Pages** (built-in)

### Tag 2: GA4 Event — Contact Submission

- Tag Type: **Google Analytics: GA4 Event**
- Configuration Tag: select the GA4 Configuration tag above
- Event Name: `contact_submission`
- Event Parameters:
  - `form_name` → `{{dlv - form_name}}` (variable created in step 3)
- Trigger: **Custom Event** named `Event - Contact Submission`, event name `contact_submission`

### Tag 3: GA4 Event — Calculator Use

- Tag Type: **Google Analytics: GA4 Event**
- Configuration Tag: GA4 Configuration tag
- Event Name: `calculator_use`
- Event Parameters:
  - `calculator_name` → `{{dlv - calculator_name}}`
- Trigger: **Custom Event** named `Event - Calculator Use`, event name `calculator_use`

### Tag 4: GA4 Event — Blog Read 30s

- Tag Type: **Google Analytics: GA4 Event**
- Configuration Tag: GA4 Configuration tag
- Event Name: `blog_read_30s`
- Event Parameters:
  - `post_slug` → `{{dlv - post_slug}}`
- Trigger: **Custom Event** named `Event - Blog Read 30s`, event name `blog_read_30s`

## 3. GTM variables to create

Workspace → Variables → New → User-Defined Variable. Type: **Data Layer Variable**.

| Variable name | Data Layer Variable Name |
| --- | --- |
| `dlv - form_name` | `form_name` |
| `dlv - calculator_name` | `calculator_name` |
| `dlv - post_slug` | `post_slug` |

## 4. GTM triggers to create

Workspace → Triggers → New → **Custom Event**.

| Trigger name | Event name (regex off) |
| --- | --- |
| `Event - Contact Submission` | `contact_submission` |
| `Event - Calculator Use` | `calculator_use` |
| `Event - Blog Read 30s` | `blog_read_30s` |

## 5. Mark custom events as conversions in GA4

In GA4 → Admin → Events. Once events have fired at least once and appear in the list, toggle "Mark as conversion" for:

- `contact_submission` (primary lead source)
- `calculator_use` (engaged visitor signal)
- Optional: `blog_read_30s` (content engagement)

You can also create **Audiences** for each (e.g. "Calculator users") for remarketing.

## 6. Verify

1. Open GTM → **Preview** mode.
2. Visit a deploy preview URL of the site.
3. Submit the contact form → confirm `contact_submission` appears in the Tag Assistant timeline.
4. Type into the ROI calculator → confirm `calculator_use` fires.
5. Open a blog post and wait 30 seconds → confirm `blog_read_30s` fires.
6. Once happy, click **Submit** in GTM to publish the workspace.

## 7. Privacy and consent

Australia and New Zealand don't have GDPR-style consent requirements, but if you ever take EU traffic at scale, add a consent banner (Cloudflare offers a free one, or use Cookiebot/CookieYes) and configure GTM's **Consent Mode v2**.
