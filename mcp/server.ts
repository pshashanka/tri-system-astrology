/**
 * MCP Server for Tri-System Astrology
 * Exposes chart calculation and geocoding as MCP tools.
 * Uses stdio transport — works with Claude Desktop, Cursor, VS Code, etc.
 *
 * Run: npx tsx mcp/server.ts
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v4';
import { calculateAllCharts } from '../lib/charts.js';
import { summarizeCharts } from '../lib/summarize.js';
import { geocode } from '../lib/geocode.js';

const server = new McpServer({
  name: 'tri-system-astrology',
  version: '1.0.0',
});

// Tool 1: Calculate birth charts across all 3 systems
server.registerTool('calculate_charts', {
  title: 'Calculate Tri-System Birth Charts',
  description:
    'Calculate Western (Tropical), Vedic (Sidereal/Jyotish), and Chinese (BaZi/Four Pillars) birth charts from birth data. Returns structured chart data for astrological interpretation.',
  inputSchema: z.object({
    date: z.string().describe('Birth date in YYYY-MM-DD format'),
    time: z.string().optional().describe('Birth time in HH:MM 24h format. Defaults to 12:00 if unknown.'),
    location: z.string().optional().describe('Birth location name (e.g. "New York, NY"). Geocodes internally. Provide this OR lat/lng/timezone.'),
    lat: z.number().optional().describe('Latitude (-90 to 90). Use with lng and timezone to skip geocoding.'),
    lng: z.number().optional().describe('Longitude (-180 to 180). Use with lat and timezone.'),
    timezone: z.string().optional().describe('IANA timezone (e.g. "America/New_York"). Use with lat/lng.'),
    gender: z.enum(['male', 'female']).optional().describe('Affects Chinese Da Yun (Luck Pillar) direction. Defaults to male.'),
    summary: z.boolean().optional().describe('If true, returns condensed chart data (~3-5KB instead of ~15-30KB). Recommended for large context windows.'),
  }),
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
}, async ({ date, time, location, lat, lng, timezone, gender, summary }) => {
  try {
    const result = await calculateAllCharts({ date, time, location, lat, lng, timezone, gender });
    const charts = summary ? summarizeCharts(result.charts) : result.charts;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              birthData: result.birthData,
              charts,
              warnings: result.warnings,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (err: any) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// Tool 2: Geocode a location
server.registerTool('geocode_location', {
  title: 'Geocode Location',
  description:
    'Look up a location by name and return coordinates and timezone. Use this to resolve ambiguous locations before calculating charts, or to get coordinates for the calculate_charts tool.',
  inputSchema: z.object({
    query: z
      .string()
      .min(2)
      .max(200)
      .describe('Location search query (e.g. "London" or "Tokyo, Japan")'),
  }),
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
}, async ({ query }) => {
  try {
    const result = await geocode(query);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              lat: result.lat,
              lng: result.lng,
              displayName: result.displayName,
              timezone: result.timezone,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (err: any) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
