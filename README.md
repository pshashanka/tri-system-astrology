# Tri-System Astrology API

This repository is an API-first Hono service for tri-system astrology calculations. It exposes chart and geocoding endpoints for Custom GPT Actions, MCP clients, and other HTTP consumers while keeping the astrology logic in reusable TypeScript modules.

## What It Includes

- Western (Tropical) chart calculation
- Vedic (Sidereal/Jyotish) chart calculation
- Chinese (BaZi / Four Pillars) chart calculation
- Optional chart summarization for GPT-sized payloads
- Authenticated HTTP API for external consumers
- MCP server for local AI tools and IDEs

## Scripts

```bash
npm run dev
npm run build
npm start
npm test
npm run mcp
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy environment values from `.env.example` into your local environment.

3. Start the API in development mode:

```bash
npm run dev
```

4. Build and run the production server locally if you want to verify the Railway artifact:

```bash
npm run build
npm start
```

## HTTP Endpoints

- `GET /health`
- `GET /openapi.json`
- `GET /api/v1/geocode`
- `POST /api/v1/charts`

## Environment Variables

Required or recommended runtime configuration lives in `.env.example`:

- `ASTRO_API_KEY`: bearer token for the public API
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST URL for rate limiting
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token
- `OPENAI_API_KEY`: optional, only needed if you later reintroduce server-side reading synthesis
- `OPENAI_MODEL`: optional OpenAI model override
- `CORS_ALLOWED_ORIGINS`: optional comma-separated list of additional browser origins
- `PUBLIC_BASE_URL`: optional public HTTPS base URL for the published OpenAPI spec, recommended when using a custom domain

If Upstash is not configured, rate limiting falls back to allow-all mode. If `ASTRO_API_KEY` is not configured, authentication falls back to allow-all mode.

## Docker

Build and run the same container image that Railway will use:

```bash
docker build -t tri-system-astrology-api .
docker run --rm -p 3000:3000 \
	-e ASTRO_API_KEY=your-key \
	-e UPSTASH_REDIS_REST_URL=your-url \
	-e UPSTASH_REDIS_REST_TOKEN=your-token \
	tri-system-astrology-api
```

## Deployment

This service is intended to run in Docker on Railway.

1. Create a Railway project and connect the GitHub repository.
2. Railway will detect the `Dockerfile` automatically.
3. Set the environment variables from `.env.example`.
4. Deploy the service.
5. If you attach a custom domain, set `PUBLIC_BASE_URL` to that HTTPS origin so `/openapi.json` advertises your branded domain instead of the raw Railway hostname.
6. Re-import or refresh the GPT Action from your public domain, for example `https://api.yourdomain.com/openapi.json`.

## Railway Notes

- The API listens on `PORT`, which Railway provides automatically.
- CORS already allows ChatGPT origins and Railway app domains.
- `GET /health` is available for simple health checks.
- If `PUBLIC_BASE_URL` is unset, the OpenAPI document falls back to the Railway domain for that request.

## MCP

The MCP server is separate from the HTTP API and runs locally with:

```bash
npm run mcp
```

See `mcp/README.md` for IDE and local assistant setup instructions.

## GPT Setup

See `gpt/README.md` for Custom GPT setup, authentication, and OpenAPI import instructions.
