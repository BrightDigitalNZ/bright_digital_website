"""
Quick check that authentication works and the APIs respond.

Run AFTER `python authorize.py`:
    python smoke_test.py

It prints your Search Console sites and a tiny GA4 report. If you see data
(not errors), the server is ready to connect to Claude Desktop.
"""

from server import gsc_list_sites, ga4_report


def main() -> None:
    print("== Search Console sites ==")
    sites = gsc_list_sites()
    print(f"Found {sites['site_count']} site(s):")
    for site in sites["sites"]:
        print(f"  - {site['site_url']}  ({site['permission_level']})")

    print("\n== GA4 report (last 7 days, sessions by channel) ==")
    report = ga4_report(
        start_date="7daysAgo",
        end_date="yesterday",
        metrics="sessions,totalUsers",
        dimensions="sessionDefaultChannelGroup",
        limit=10,
    )
    print(f"Property: {report['property']}, rows: {report['row_count']}")
    for row in report["rows"]:
        print(f"  {row}")


if __name__ == "__main__":
    main()
