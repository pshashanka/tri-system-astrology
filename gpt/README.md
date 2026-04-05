# Setting Up the Tri-System Astrology Custom GPT

## Prerequisites

1. A **ChatGPT Plus/Team/Enterprise** account (GPT creation requires a paid plan)
2. Your API **deployed to Railway** (or another public HTTPS URL)
3. An **API key** generated for authentication

## Step 1: Deploy the API

From the project root:

```bash
# Install dependencies
npm install

# Verify the app locally first
npm run build
npm start

# Optional: verify the Docker artifact locally
docker build -t tri-system-astrology-api .
docker run --rm -p 3000:3000 -e ASTRO_API_KEY=test-key tri-system-astrology-api

# Then deploy the Dockerized app to Railway and set:
# - ASTRO_API_KEY: your generated API key (see below)
# - UPSTASH_REDIS_REST_URL: from Upstash dashboard
# - UPSTASH_REDIS_REST_TOKEN: from Upstash dashboard
# - CORS_ALLOWED_ORIGINS: optional extra origins if you need browser access
```

Note your deployment URL (e.g., `https://tri-system-astrology-production.up.railway.app`).

Before moving on, confirm these URLs work:

- `https://api-production-860d.up.railway.app/health`
- `https://api-production-860d.up.railway.app/openapi.json`

## Step 2: Generate an API Key

```bash
# Generate a secure random key
openssl rand -hex 32
```

Add this as `ASTRO_API_KEY` in your Railway environment variables.

## Step 3: Update OpenAPI Schema

`public/openapi.json` is now configured for the live Railway deployment:

```json
{
   "servers": [
      {
         "url": "https://api-production-860d.up.railway.app",
         "description": "Production"
      }
   ]
}
```

If the Railway domain changes later, update the `servers[0].url` field and redeploy.

## Step 4: Create the GPT

1. Go to [https://chatgpt.com/gpts/mine](https://chatgpt.com/gpts/mine)
2. Click **"Create a GPT"**
3. Switch to the **Configure** tab

### Name & Description
- **Name**: Astro Oracle (or your preferred name)
- **Description**: Master astrologer providing personalized readings across Western, Vedic, and Chinese traditions using real astronomical calculations.

### Instructions
Copy the entire contents of `gpt/instructions.md` into the **Instructions** field.

The GPT is designed to call the API for chart data and then synthesize the reading itself. The HTTP API does not currently expose a server-side `/reading` endpoint.

### Conversation Starters
- "I'd like a birth chart reading"
- "Can you analyze my astrology charts?"
- "What do the stars say about someone born on March 21, 1995?"
- "I want to understand my BaZi chart"

## Step 5: Configure Actions

1. Click **"Create new action"**
2. In the **Schema** field, paste the contents of your OpenAPI spec from: `https://api-production-860d.up.railway.app/openapi.json`
   - Or click **"Import from URL"** and enter: `https://api-production-860d.up.railway.app/openapi.json`
3. The GPT Builder should auto-detect 2 actions:
   - `calculateCharts` (POST /api/v1/charts)
   - `geocodeLocation` (GET /api/v1/geocode)

### Authentication
1. Click the **gear icon** next to the schema
2. Select **"API Key"**
3. Auth Type: **Bearer**
4. Paste your `ASTRO_API_KEY` value

If `ASTRO_API_KEY` is missing from the server environment, auth is effectively open. That is acceptable for local development, but not for production.

## Step 6: Test

1. Click **"Preview"** in the GPT Builder
2. Try: "I was born on May 15, 1990 at 2:30 PM in New York City"
3. Verify the GPT:
   - Calls `calculateCharts` with the correct parameters
   - Receives chart data
   - Synthesizes a reading across all three systems

## Step 7: Publish

- **Only me**: Private, only you can use it
- **Anyone with a link**: Share via URL
- **Everyone**: Listed in the GPT Store (requires builder profile)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Authentication failed" | Check ASTRO_API_KEY matches in Railway env vars and GPT Action auth |
| "Too many requests" | Rate limit is 10/min per IP. Wait and retry. |
| "Location not found" | Try a more specific location name, or use geocodeLocation first |
| Actions not detected | Verify openapi.json is accessible at your deployment URL |
| Timeout errors | Check Railway logs and confirm upstream APIs are responding within the request window |
| Preflight or browser CORS issues | Add the browser origin to `CORS_ALLOWED_ORIGINS` |

## API Shape Used By GPT

- `POST /api/v1/charts`: returns raw or summarized chart data
- `GET /api/v1/geocode`: returns up to 5 location suggestions

For GPT usage, `summary: true` is usually the better default because it produces a smaller payload while preserving interpretive detail.

## Setting Up Upstash Redis (Free Tier)

1. Go to [https://console.upstash.com](https://console.upstash.com)
2. Create a new Redis database (free tier)
3. Copy the **REST URL** and **REST Token**
4. Add to Railway environment variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

Without Upstash configured, rate limiting falls back to allow-all mode (fine for development).
