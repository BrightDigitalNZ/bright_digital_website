"""
Shared Google OAuth helpers for the GA4 + Search Console MCP server.

We use the OAuth "installed app" flow (NOT a service account key). The first
time you authorise, a browser opens and you sign in. After that, a refresh
token is stored locally so you never have to sign in again.

File locations (all overridable with environment variables):
  - client secret : GOOGLE_CLIENT_SECRET_FILE  (default: ./client_secret.json)
  - saved token   : GOOGLE_TOKEN_FILE          (default: ./token.json)
"""

import os
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

# Read-only scopes ONLY. We can read your data, never change it.
SCOPES = [
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/webmasters.readonly",
]

PROJECT_DIR = Path(__file__).resolve().parent


def _resolve(env_var: str, default_name: str) -> Path:
    value = os.environ.get(env_var)
    if value:
        return Path(value).expanduser()
    return PROJECT_DIR / default_name


def client_secret_path() -> Path:
    return _resolve("GOOGLE_CLIENT_SECRET_FILE", "client_secret.json")


def token_path() -> Path:
    return _resolve("GOOGLE_TOKEN_FILE", "token.json")


def load_credentials() -> Credentials:
    """
    Load saved credentials and refresh them if they have expired.

    This does NOT open a browser. If no token exists yet, it raises a clear
    error telling you to run `authorize.py` once. That keeps the MCP server
    (which Claude Desktop launches in the background) from ever hanging on a
    sign-in prompt.
    """
    tp = token_path()
    if not tp.exists():
        raise RuntimeError(
            f"No saved token found at {tp}.\n"
            "Run the one-time sign-in first:  python authorize.py"
        )

    creds = Credentials.from_authorized_user_file(str(tp), SCOPES)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        tp.write_text(creds.to_json())

    if not creds or not creds.valid:
        raise RuntimeError(
            f"Saved credentials at {tp} are invalid or expired and could not be "
            "refreshed.\nRe-run the one-time sign-in:  python authorize.py"
        )

    return creds
