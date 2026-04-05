# MCP Server: Tri-System Astrology

This MCP (Model Context Protocol) server exposes the shared tri-system astrology engine as local tools for AI assistants like Claude Desktop, Cursor, and VS Code Copilot.

The MCP server is separate from the Railway-deployed HTTP API. It runs locally over stdio and imports the same logic from `lib/`, so it stays aligned with the API without making network calls back into your own service.

## Tools

### `calculate_charts`
Calculate Western (Tropical), Vedic (Sidereal), and Chinese (BaZi) birth charts.

**Parameters:**
- `date` (required): Birth date in YYYY-MM-DD format
- `time` (optional): Birth time in HH:MM 24h format (defaults to 12:00)
- `location` (optional): Location name — geocodes internally
- `lat`, `lng`, `timezone` (optional): Direct coordinates (skip geocoding)
- `gender` (optional): "male" or "female" — affects Chinese Luck Pillars
- `summary` (optional): If true, returns condensed data

### `geocode_location`
Look up a location by name and return coordinates + timezone.

**Parameters:**
- `query` (required): Location search string (min 2 chars)

## Requirements

- Node.js 20+
- `npm install` completed in the repo root
- Internet access for Nominatim geocoding and BigDataCloud timezone lookup

No authentication or Railway deployment is required for MCP usage.

## Run Directly

From the repository root:

```bash
npm run mcp
```

That starts the stdio transport server defined in `mcp/server.ts`.

## Setup

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "astrology": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "/absolute/path/to/tri-system-astrology"
    }
  }
}
```

### VS Code / Cursor

Add to `.vscode/mcp.json` in the workspace:

```json
{
  "servers": {
    "astrology": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

Or add to VS Code settings (`settings.json`):

```json
{
  "mcp": {
    "servers": {
      "astrology": {
        "command": "npx",
        "args": ["tsx", "mcp/server.ts"],
        "cwd": "/absolute/path/to/tri-system-astrology"
      }
    }
  }
}
```

### Using npm script

You can also run the MCP server directly:

```bash
npm run mcp
```

## Example Usage

Once configured, ask your AI assistant:

> "Calculate a birth chart for someone born on May 15, 1990 at 2:30 PM in New York City"

The AI will:
1. Call `geocode_location` with "New York City" to get coordinates
2. Call `calculate_charts` with the date, time, and coordinates
3. Interpret the chart data and provide an astrological reading

## Notes

- Use `summary: true` when you want a smaller payload for limited-context assistants.
- The MCP server does not require `ASTRO_API_KEY` or Upstash.
- If geocoding is not needed, provide `lat`, `lng`, and `timezone` directly to avoid an external lookup.
- The MCP server is ideal for local IDE workflows; the Railway API is the correct integration point for Custom GPT Actions.
