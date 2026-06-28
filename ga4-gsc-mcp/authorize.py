"""
One-time sign-in script.

Run this ONCE (`python authorize.py`). It will:
  1. Open your web browser.
  2. Let you sign in to your Google account and approve read-only access.
  3. Save a refresh token to token.json so you never have to sign in again.

You only need to re-run this if you delete token.json or change the scopes.
"""

from google_auth_oauthlib.flow import InstalledAppFlow

from auth import SCOPES, client_secret_path, token_path


def main() -> None:
    secret = client_secret_path()
    if not secret.exists():
        raise SystemExit(
            f"Could not find your OAuth client secret at:\n  {secret}\n\n"
            "Copy the JSON you downloaded from Google Cloud Console to that "
            "path (or set GOOGLE_CLIENT_SECRET_FILE to point at it), then "
            "run this again."
        )

    flow = InstalledAppFlow.from_client_secrets_file(str(secret), SCOPES)

    # access_type=offline + prompt=consent guarantees Google returns a
    # refresh token (the thing that lets us skip future sign-ins).
    creds = flow.run_local_server(
        port=0,
        access_type="offline",
        prompt="consent",
        authorization_prompt_message=(
            "Opening your browser to sign in to Google. If it does not open, "
            "visit this URL:\n{url}"
        ),
        success_message=(
            "Success! You can close this tab and return to the terminal."
        ),
    )

    tp = token_path()
    tp.write_text(creds.to_json())
    print(f"\n✅ Signed in. Token saved to: {tp}")
    print("You can now use the MCP server. You won't need to sign in again.")


if __name__ == "__main__":
    main()
