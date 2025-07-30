import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as yaml from './yaml.js'
import * as clicksend from './clicksend.js'

export function generateToolsFromOpenApiSpecs(server: McpServer, openApiSpec: any, endpoints: string[]) {  
  for (const endpoint of endpoints) {
    try {
      const [method, path] = endpoint.split(' ');
      const operationDetails = yaml.getOperationDetails(openApiSpec, method, path);
      
      if (!operationDetails) {
        console.warn(`Could not match endpoint: ${method} ${path} in OpenAPI spec`);
        continue;
      }
      
      const { operation, operationId } = operationDetails;
      const paramsSchema = yaml.buildParamsSchema(operation, openApiSpec);
      const toolId = sanitizeToolId(operationId);
      const toolDescription = operation.summary || `${method.toUpperCase()} ${path}`;
      
      registerTool(server, toolId, toolDescription, paramsSchema, method, path, operation);
      // makeTestRequest(paramsSchema, method, path, operation, {"messages":[{"body":"Hi from mcp","to":"+61478390955"}]})
      
    } catch (error: any) {
      console.error(`Failed to process endpoint ${endpoint}: ${error.message}`);
    }
  }

  return;
}

export function sanitizeToolId(operationId: string) {
  return operationId.replace(/[^\w-]/g, '-').toLowerCase();
}

export function registerTool(server: McpServer, toolId: string, toolDescription: string, paramsSchema: any, method: string, path: string, operation: string) {
  server.tool(
    toolId,
    toolDescription,
    paramsSchema,
    async (params: any): Promise<CallToolResult> => {
      try {
        const { actualPath, remainingParams } = yaml.processPathParameters(path, operation, params);
        const { queryParams, bodyParams } = yaml.separateParameters(remainingParams, operation, method);
        const finalPath = yaml.appendQueryString(actualPath, queryParams);
        console.error(params);
        console.error(JSON.stringify(params));
        
        let requestBody = null;
        if (method.toUpperCase() !== 'GET') {
          requestBody = { ...bodyParams, source: 'MCP' };
        }
        
        // Make the API request
        const result = await clicksend.makeClickSendRequest(
          method.toUpperCase(), 
          finalPath, 
          requestBody
        );
        
        return {
          content: [
            {
              type: "text",
              text: `${method.toUpperCase()} ${finalPath} completed successfully:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message || String(error)}`,
            },
          ],
        };
      }
    }
  );
}
