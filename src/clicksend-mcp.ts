#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from './helper/yaml.js'
import * as mcp from './helper/mcp.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENAPI_YAML = path.resolve(__dirname, 'openapi-specs.yaml');

export const server = new McpServer({
  name: "clicksend",
  version: "1.0.0",
});

const endpoints = [
    "POST /v3/sms/send",
    "GET /v3/search/contacts-lists",
    "POST /v3/sms/price",
    "GET /v3/sms/templates",
    "GET /v3/statistics/sms",
    "GET /v3/sms/history"
];

export async function main() {
  try {
    const openApiSpec = yaml.loadOpenApiSpec(OPENAPI_YAML);
    
    mcp.generateToolsFromOpenApiSpecs(server, openApiSpec, endpoints);
    
    const transport = new StdioServerTransport();
    await server.connect(transport);

  } catch (error) {
    console.error("Error:", error);
  }
}

main();