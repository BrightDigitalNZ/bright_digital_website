"""
MCP server exposing Google Analytics 4 + Google Search Console (read-only).

Tools:
  - ga4_report            : run a GA4 Data API report (metrics x dimensions)
  - ga4_realtime          : current realtime active users
  - gsc_search_analytics  : Search Console performance (clicks/impressions/etc.)
  - gsc_list_sites        : list Search Console properties you can access

Authentication is handled in auth.py via OAuth (read-only scopes only).
"""

import os
from typing import Any

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    RunRealtimeReportRequest,
    RunReportRequest,
)
from googleapiclient.discovery import build
from mcp.server.fastmcp import FastMCP

from auth import load_credentials

mcp = FastMCP("ga4-gsc")

# Default GA4 property if a tool call doesn't specify one.
DEFAULT_GA4_PROPERTY_ID = os.environ.get("GA4_PROPERTY_ID", "48563680")


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------
def _as_list(value: Any) -> list[str]:
    """Accept either a real list or a comma-separated string and return a list."""
    if value is None:
        return []
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return [str(item).strip() for item in value if str(item).strip()]


def _normalize_property(property_id: str | None) -> str:
    pid = str(property_id or DEFAULT_GA4_PROPERTY_ID).strip()
    # The GA4 Data API expects the form "properties/<id>".
    return pid if pid.startswith("properties/") else f"properties/{pid}"


def _ga4_client() -> BetaAnalyticsDataClient:
    return BetaAnalyticsDataClient(credentials=load_credentials())


def _gsc_service():
    return build(
        "searchconsole",
        "v1",
        credentials=load_credentials(),
        cache_discovery=False,
    )


# --------------------------------------------------------------------------
# GA4 tools
# --------------------------------------------------------------------------
@mcp.tool()
def ga4_report(
    start_date: str = "28daysAgo",
    end_date: str = "yesterday",
    metrics: Any = "sessions,totalUsers",
    dimensions: Any = "sessionDefaultChannelGroup",
    property_id: str | None = None,
    limit: int = 100,
) -> dict:
    """
    Run a Google Analytics 4 report.

    Args:
        start_date: Start of range. ISO date (YYYY-MM-DD) or relative like
            "7daysAgo", "28daysAgo", "today", "yesterday".
        end_date: End of range, same formats as start_date.
        metrics: Metric names. Examples: sessions, totalUsers, newUsers,
            conversions, screenPageViews, engagementRate, averageSessionDuration.
            Accepts a list or a comma-separated string.
        dimensions: Dimension names. Examples: sessionDefaultChannelGroup,
            pagePath, country, deviceCategory, date, city, browser.
            Accepts a list or a comma-separated string. May be empty.
        property_id: GA4 property id (digits, or "properties/<id>"). Defaults
            to the configured property if omitted.
        limit: Max rows to return (default 100).

    Returns:
        Dict with the resolved property, requested metrics/dimensions, a row
        count, and a list of row dicts (one key per dimension and metric).
    """
    metric_names = _as_list(metrics)
    dimension_names = _as_list(dimensions)
    prop = _normalize_property(property_id)

    request = RunReportRequest(
        property=prop,
        date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
        metrics=[Metric(name=m) for m in metric_names],
        dimensions=[Dimension(name=d) for d in dimension_names],
        limit=int(limit),
    )

    response = _ga4_client().run_report(request)

    rows = []
    for row in response.rows:
        record: dict[str, Any] = {}
        for header, value in zip(response.dimension_headers, row.dimension_values):
            record[header.name] = value.value
        for header, value in zip(response.metric_headers, row.metric_values):
            record[header.name] = value.value
        rows.append(record)

    return {
        "property": prop,
        "date_range": {"start_date": start_date, "end_date": end_date},
        "metrics": metric_names,
        "dimensions": dimension_names,
        "row_count": len(rows),
        "rows": rows,
    }


@mcp.tool()
def ga4_realtime(
    metrics: Any = "activeUsers",
    dimensions: Any = None,
    property_id: str | None = None,
    limit: int = 100,
) -> dict:
    """
    Pull GA4 realtime data (last ~30 minutes), e.g. current active users.

    Args:
        metrics: Realtime metric names (default "activeUsers"). Accepts a list
            or comma-separated string.
        dimensions: Optional realtime dimensions, e.g. country, deviceCategory,
            unifiedScreenName. Accepts a list or comma-separated string.
        property_id: GA4 property id. Defaults to the configured property.
        limit: Max rows to return.

    Returns:
        Dict with the resolved property, row count, and row dicts.
    """
    metric_names = _as_list(metrics) or ["activeUsers"]
    dimension_names = _as_list(dimensions)
    prop = _normalize_property(property_id)

    request = RunRealtimeReportRequest(
        property=prop,
        metrics=[Metric(name=m) for m in metric_names],
        dimensions=[Dimension(name=d) for d in dimension_names],
        limit=int(limit),
    )

    response = _ga4_client().run_realtime_report(request)

    rows = []
    for row in response.rows:
        record: dict[str, Any] = {}
        for header, value in zip(response.dimension_headers, row.dimension_values):
            record[header.name] = value.value
        for header, value in zip(response.metric_headers, row.metric_values):
            record[header.name] = value.value
        rows.append(record)

    return {
        "property": prop,
        "metrics": metric_names,
        "dimensions": dimension_names,
        "row_count": len(rows),
        "rows": rows,
    }


# --------------------------------------------------------------------------
# Search Console tools
# --------------------------------------------------------------------------
@mcp.tool()
def gsc_search_analytics(
    site_url: str,
    start_date: str,
    end_date: str,
    dimensions: Any = "query",
    row_limit: int = 100,
) -> dict:
    """
    Query Search Console Search Analytics (organic search performance).

    Args:
        site_url: The Search Console property, exactly as listed by
            gsc_list_sites. For URL-prefix properties this looks like
            "https://example.com/"; for domain properties "sc-domain:example.com".
        start_date: Start date, YYYY-MM-DD.
        end_date: End date, YYYY-MM-DD.
        dimensions: One or more of: query, page, country, device, date,
            searchAppearance. Accepts a list or comma-separated string.
        row_limit: Max rows (default 100, API max 25000).

    Returns:
        Dict with the resolved query plus rows containing the requested
        dimension keys and clicks, impressions, ctr, and position.
    """
    dimension_names = _as_list(dimensions)

    body = {
        "startDate": start_date,
        "endDate": end_date,
        "dimensions": dimension_names,
        "rowLimit": int(row_limit),
    }

    response = (
        _gsc_service()
        .searchanalytics()
        .query(siteUrl=site_url, body=body)
        .execute()
    )

    rows = []
    for row in response.get("rows", []):
        record: dict[str, Any] = {}
        for name, key in zip(dimension_names, row.get("keys", [])):
            record[name] = key
        record["clicks"] = row.get("clicks")
        record["impressions"] = row.get("impressions")
        record["ctr"] = row.get("ctr")
        record["position"] = row.get("position")
        rows.append(record)

    return {
        "site_url": site_url,
        "date_range": {"start_date": start_date, "end_date": end_date},
        "dimensions": dimension_names,
        "row_count": len(rows),
        "rows": rows,
    }


@mcp.tool()
def gsc_list_sites() -> dict:
    """
    List the Search Console properties (sites) your account can access.

    Returns:
        Dict with a list of sites, each with its siteUrl and permission level.
    """
    response = _gsc_service().sites().list().execute()
    sites = [
        {
            "site_url": entry.get("siteUrl"),
            "permission_level": entry.get("permissionLevel"),
        }
        for entry in response.get("siteEntry", [])
    ]
    return {"site_count": len(sites), "sites": sites}


if __name__ == "__main__":
    # Communicates with Claude Desktop over stdio.
    mcp.run()
