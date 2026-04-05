# Tri-System Astrology API

This repository now runs as an API-first Hono service for tri-system astrology calculations, designed for Custom GPT Actions, MCP clients, and other HTTP consumers.

## Scripts

```bash
npm run dev
npm run build
npm start
npm test
npm run mcp
```

## HTTP Endpoints

- `GET /health`
- `GET /openapi.json`
- `GET /api/v1/geocode`
- `POST /api/v1/charts`

## Deployment

The service is intended to run in Docker on Railway. Configure the environment variables from `.env.example`, then update `public/openapi.json` with your deployed domain before importing the action into ChatGPT.
