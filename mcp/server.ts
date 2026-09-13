/**
 * Run: npx tsx mcp/server.ts
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './index.js';

async function main() {
  const transport = new StdioServerTransport();
  const server = createMcpServer();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
