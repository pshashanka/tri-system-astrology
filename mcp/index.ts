import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { calculateAllCharts } from '../lib/charts.js';
import { summarizeCharts } from '../lib/summarize.js';
import { geocode } from '../lib/geocode.js';

export function createMcpServer() {
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
    // The per-system chart bodies are deliberately loose: their internals differ
    // between full and summary mode, and a strict shape here would reject valid
    // results at runtime rather than just describing them.
    outputSchema: z.object({
      birthData: z.object({
        date: z.string().describe('Resolved birth date in YYYY-MM-DD format.'),
        time: z.string().describe('Resolved birth time in HH:MM 24h format.'),
        location: z.string().describe('Resolved location name.'),
        coordinates: z.object({
          lat: z.number(),
          lng: z.number(),
        }).describe('Resolved birth coordinates in decimal degrees.'),
        timezone: z.string().nullable().describe('IANA timezone, or null if it could not be resolved.'),
      }).describe('The birth data actually used for the calculation, after geocoding and defaulting.'),
      charts: z.object({
        western: z.looseObject({}).describe('Western (Tropical) chart: planets, houses, aspects.'),
        vedic: z.looseObject({}).describe('Vedic (Sidereal/Jyotish) chart: planets, houses, dashas.'),
        chinese: z.looseObject({}).describe('Chinese (BaZi/Four Pillars) chart: pillars and luck pillars.'),
      }).describe('Condensed chart data when summary is true, otherwise full chart data.'),
      warnings: z.array(z.string()).describe('Non-fatal issues, e.g. a defaulted birth time reducing accuracy.'),
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  }, async ({ date, time, location, lat, lng, timezone, gender, summary }) => {
    try {
      const result = await calculateAllCharts({ date, time, location, lat, lng, timezone, gender });
      const charts = summary ? summarizeCharts(result.charts) : result.charts;

      const payload = {
        birthData: result.birthData,
        charts,
        warnings: result.warnings,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload,
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
    outputSchema: z.object({
      lat: z.number().describe('Latitude in decimal degrees.'),
      lng: z.number().describe('Longitude in decimal degrees.'),
      displayName: z.string().describe('Full resolved place name.'),
      timezone: z.string().nullable().describe('IANA timezone, or null if it could not be resolved.'),
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  }, async ({ query }) => {
    try {
      const result = await geocode(query);

      const payload = {
        lat: result.lat,
        lng: result.lng,
        displayName: result.displayName,
        timezone: result.timezone,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload,
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  });

  return server;
}
