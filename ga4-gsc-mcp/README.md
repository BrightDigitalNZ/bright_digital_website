# GA4 + Search Console MCP server

A small local server that lets **Claude Desktop** read your **Google Analytics 4**
and **Google Search Console** data, using **OAuth sign-in** (no service-account
keys). All access is **read-only** — it can look at your data, never change it.

It exposes four tools to Claude:

| Tool | What it does |
| --- | --- |
| `ga4_report` | Run a GA4 report (metrics × dimensions over a date range) |
| `ga4_realtime` | Current realtime active users |
| `gsc_search_analytics` | Search Console clicks, impressions, CTR, position |
| `gsc_list_sites` | List the Search Console properties you can access |

Default GA4 property: **48563680** (you can override per request or via an
environment variable).

---

## What you need first

- A Mac (these instructions use macOS paths).
- **Python 3.10 or newer** (check with `python3 --version`).
- The OAuth client config you downloaded from Google Cloud Console (the
  `client_secret_….json` file in your Downloads).
- In Google Cloud Console, the **Google Analytics Data API** and the
  **Search Console API** must be enabled for the same project as that client.

> All terminal commands below assume you are *inside this folder*. Open Terminal
> and run `cd` to this folder first, e.g.
> `cd ~/path/to/bright_digital_website/ga4-gsc-mcp`

---

## Step 1 — Create a virtual environment and install dependencies

A "virtual environment" is just a private folder of Python packages so this
project doesn't interfere with anything else on your Mac.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

When the environment is active your prompt starts with `(.venv)`.

## Step 2 — Add your OAuth client secret

Copy the file you downloaded from Google into this folder and name it
`client_secret.json`:

```bash
cp ~/Downloads/client_secret_903538338298-ugi4vvbe5qoit1cspl7jsjlkal01l9qf.apps.googleusercontent.com.json client_secret.json
```

(If you'd rather leave it in Downloads, you can instead set
`GOOGLE_CLIENT_SECRET_FILE` to its full path.)

This file and the token created in the next step are **git-ignored**, so they
can never be committed.

## Step 3 — Sign in once

```bash
python authorize.py
```

Your browser opens. Sign in with the Google account that has access to your
Analytics and Search Console, and approve the read-only access. When it says you
can close the tab, you're done — a `token.json` is saved here so you won't have
to sign in again.

## Step 4 — (Optional) sanity-check the tools

```bash
python smoke_test.py
```

This lists your Search Console sites and pulls a tiny GA4 report, just to prove
the sign-in worked. It prints data, not errors, if everything is wired up.

## Step 5 — Connect it to Claude Desktop

Add the server to Claude Desktop's config file at:

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

The exact block to add is shown in **`claude_desktop_config.snippet.json`** in
this folder. Paste the `"ga4-gsc"` entry inside the `"mcpServers"` object (create
`mcpServers` if it isn't there yet), then **fully quit and reopen Claude
Desktop**. The four tools will appear in the tools menu.

---

## Using the tools (examples to ask Claude)

- "Use `ga4_report` for the last 28 days with metrics sessions and totalUsers,
  broken down by sessionDefaultChannelGroup."
- "Run `ga4_report` with dimensions pagePath and metric screenPageViews for May."
- "What's my `ga4_realtime` active users right now, by country?"
- "List my sites with `gsc_list_sites`."
- "Run `gsc_search_analytics` for `https://brightdigital.co.nz/` for last month,
  dimensions query and page."

## Environment variables (all optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `GA4_PROPERTY_ID` | `48563680` | Default GA4 property |
| `GOOGLE_CLIENT_SECRET_FILE` | `./client_secret.json` | OAuth client config |
| `GOOGLE_TOKEN_FILE` | `./token.json` | Where the saved token lives |

## Troubleshooting

- **"No saved token found"** — run `python authorize.py` again.
- **403 / permission errors** — make sure the Google account you signed in with
  has access to that GA4 property / Search Console site, and that both APIs are
  enabled in Google Cloud Console.
- **Claude doesn't show the tools** — confirm the paths in the config block are
  absolute and correct, then fully quit and reopen Claude Desktop. You can also
  check Claude Desktop's MCP logs in `~/Library/Logs/Claude/`.
