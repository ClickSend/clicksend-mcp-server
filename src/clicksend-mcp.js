import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import https from "node:https";
import { URL } from "node:url";
import yaml from "js-yaml";
import fs from "node:fs";
import * as path from 'path';
import { fileURLToPath } from 'url';


// Resolve directory path when using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Model Context Protocol server
export const server = new McpServer({
  name: "clicksend",
  version: "1.0.0",
});

// API configuration
const CLICKSEND_USERNAME = process.env.CLICKSEND_USERNAME;
const CLICKSEND_API_KEY = process.env.CLICKSEND_API_KEY
const CLICKSEND_API_HOSTNAME = "rest.clicksend.com";
const OPENAPI_YAML = path.resolve(__dirname, 'openapi-specs.yaml');


// Define API endpoints supported by this integration
const endpoints = [
    "POST /v3/sms/send",
    "GET /v3/search/contacts-lists"
];

/**
 * Makes an authenticated request to the ClickSend API
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - API endpoint path
 * @param {Object} data - Request payload data (for POST/PUT requests)
 * @returns {Promise<Object>} - Response data as JSON
 */
export async function makeClickSendRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    // Normalize path format (handle paths with or without leading slash)
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    
    // Create basic auth credentials from API key
    const auth = Buffer.from(`${CLICKSEND_USERNAME}:${CLICKSEND_API_KEY}`).toString('base64');
    const options = {
      hostname: CLICKSEND_API_HOSTNAME,
      path: `/${cleanPath}`,
      method: method,
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    };

    // Create and send the HTTP request
    console.error("Making request: " + JSON.stringify(options));
    const req = https.request(options, (res) => {
      let responseData = "";
      
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      
      res.on("end", () => {
        try {
          const parsedData = JSON.parse(responseData);
          console.error('Response:');
          console.error(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            reject(new Error(`API error: ${parsedData.message || responseData}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });
    
    req.on("error", (error) => {
      reject(error);
    });
    
    // For non-GET requests, serialize and send the form data
    if (data && method !== "GET") {
      // Convert object to URL encoded form data
      console.error(data);
      // const formData = new URLSearchParams();
      // for (const [key, value] of Object.entries(data)) {
      //   if (Array.isArray(value)) {
      //     for (const item of value) {
      //       formData.append(key, item);
      //     }
      //   } else if (value !== undefined && value !== null) {
      //     formData.append(key, value.toString());
      //   }
      // }
      console.error('Form Data:');
      console.error(JSON.stringify(data));
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Loads and parses the OpenAPI specification from a YAML file
 * @param {string} filePath - Path to the OpenAPI YAML file
 * @returns {Object} - Parsed OpenAPI specification
 */
export function loadOpenApiSpec(filePath) {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return yaml.load(fileContents);
  } catch (error) {
    console.error(`Error loading OpenAPI spec: ${error.message}`);
    // Don't exit in test mode
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error; // Throw so tests can catch it
  }
}

/**
 * Converts OpenAPI schema definitions to Zod validation schemas
 * @param {Object} schema - OpenAPI schema object
 * @param {Object} fullSpec - Complete OpenAPI specification
 * @returns {z.ZodType} - Corresponding Zod schema
 */
export function openapiToZod(schema, fullSpec) {
  if (!schema) return z.any();
  
  // Handle schema references (e.g. #/components/schemas/...)
  if (schema.$ref) {
    // For #/components/schemas/EventSeverityType type references
    if (schema.$ref.startsWith('#/')) {
      const refPath = schema.$ref.substring(2).split('/');
      
      // Navigate through the object using the path segments
      let referenced = fullSpec;
      for (const segment of refPath) {
        if (!referenced || !referenced[segment]) {
          // If we can't resolve it but know it's EventSeverityType, use our knowledge
          if (segment === 'EventSeverityType' || schema.$ref.endsWith('EventSeverityType')) {
            return z.enum(['temporary', 'permanent'])
              .describe('Filter by event severity');
          }
          
          console.error(`Failed to resolve reference: ${schema.$ref}, segment: ${segment}`);
          return z.any().describe(`Failed reference: ${schema.$ref}`);
        }
        referenced = referenced[segment];
      }
      
      return openapiToZod(referenced, fullSpec);
    }
    
    // Handle other reference formats if needed
    console.error(`Unsupported reference format: ${schema.$ref}`);
    return z.any().describe(`Unsupported reference: ${schema.$ref}`);
  }
  
  // Convert different schema types to Zod equivalents
  switch (schema.type) {
    case 'string':
      let zodString = z.string();
      if (schema.enum) {
        return z.enum(schema.enum);
      }
      if (schema.format === 'email') {
        zodString = zodString.email();
      }
      if (schema.format === 'uri') {
        zodString = zodString.describe(`URI: ${schema.description || ''}`);
      }
      return zodString.describe(schema.description || '');
    
    case 'number':
    case 'integer':
      let zodNumber = z.number();
      if (schema.minimum !== undefined) {
        zodNumber = zodNumber.min(schema.minimum);
      }
      if (schema.maximum !== undefined) {
        zodNumber = zodNumber.max(schema.maximum);
      }
      return zodNumber.describe(schema.description || '');
    
    case 'boolean':
      return z.boolean().describe(schema.description || '');
    
    case 'array':
      return z.array(openapiToZod(schema.items, fullSpec)).describe(schema.description || '');
    
    case 'object':
      if (!schema.properties) return z.record(z.any());
      
      const shape = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        shape[key] = schema.required?.includes(key) 
          ? openapiToZod(prop, fullSpec)
          : openapiToZod(prop, fullSpec).optional();
      }
      return z.object(shape).describe(schema.description || '');
    
    default:
      // For schemas without a type but with properties
      if (schema.properties) {
        const shape = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
          shape[key] = schema.required?.includes(key) 
            ? openapiToZod(prop, fullSpec)
            : openapiToZod(prop, fullSpec).optional();
        }
        return z.object(shape).describe(schema.description || '');
      }
      
      // For YAML that defines "oneOf", "anyOf", etc.
      if (schema.oneOf) {
        const unionTypes = schema.oneOf.map(s => openapiToZod(s, fullSpec));
        return z.union(unionTypes).describe(schema.description || '');
      }
      
      if (schema.anyOf) {
        const unionTypes = schema.anyOf.map(s => openapiToZod(s, fullSpec));
        return z.union(unionTypes).describe(schema.description || '');
      }
      
      return z.any().describe(schema.description || '');
  }
}

/**
 * Generates MCP tools from the OpenAPI specification
 * @param {Object} openApiSpec - Parsed OpenAPI specification
 */
export function generateToolsFromOpenApi(openApiSpec) {  
  for (const endpoint of endpoints) {
    try {
      const [method, path] = endpoint.split(' ');
      const operationDetails = getOperationDetails(openApiSpec, method, path);
      
      if (!operationDetails) {
        console.warn(`Could not match endpoint: ${method} ${path} in OpenAPI spec`);
        continue;
      }
      
      const { operation, operationId } = operationDetails;
      const paramsSchema = buildParamsSchema(operation, openApiSpec);
      const toolId = sanitizeToolId(operationId);
      const toolDescription = operation.summary || `${method.toUpperCase()} ${path}`;
      
      registerTool(toolId, toolDescription, paramsSchema, method, path, operation);
      // makeTestRequest(paramsSchema, method, path, operation, {"messages":[{"body":"Hi from mcp","to":"+61478390955"}]})
      
    } catch (error) {
      console.error(`Failed to process endpoint ${endpoint}: ${error.message}`);
    }
  }
  
  return;
}

/**
 * Retrieves operation details from the OpenAPI spec for a given method and path
 * @param {Object} openApiSpec - Parsed OpenAPI specification
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - API endpoint path
 * @returns {Object|null} - Operation details or null if not found
 */
export function getOperationDetails(openApiSpec, method, path) {
  const lowerMethod = method.toLowerCase();
  
  if (!openApiSpec.paths?.[path]?.[lowerMethod]) {
    return null;
  }
  
  return {
    operation: openApiSpec.paths[path][lowerMethod],
    operationId: `${method}-${path.replace(/[^\w-]/g, '-').replace(/-+/g, '-')}`
  };
}

/**
 * Sanitizes an operation ID to be used as a tool ID
 * @param {string} operationId - The operation ID to sanitize
 * @returns {string} - Sanitized tool ID
 */
export function sanitizeToolId(operationId) {
  return operationId.replace(/[^\w-]/g, '-').toLowerCase();
}

/**
 * Builds a Zod parameter schema from an OpenAPI operation
 * @param {Object} operation - OpenAPI operation object
 * @param {Object} openApiSpec - Complete OpenAPI specification
 * @returns {Object} - Zod parameter schema
 */
export function buildParamsSchema(operation, openApiSpec) {
  const paramsSchema = {};
  
  // Process path parameters
  const pathParams = operation.parameters?.filter(p => p.in === 'path') || [];
  processParameters(pathParams, paramsSchema, openApiSpec);
  
  // Process query parameters
  const queryParams = operation.parameters?.filter(p => p.in === 'query') || [];
  processParameters(queryParams, paramsSchema, openApiSpec);
  
  // Process request body if it exists
  if (operation.requestBody) {
    processRequestBody(operation.requestBody, paramsSchema, openApiSpec);
  }
  
  return paramsSchema;
}

/**
 * Processes OpenAPI parameters into Zod schemas
 * @param {Array} parameters - OpenAPI parameter objects
 * @param {Object} paramsSchema - Target schema object to populate
 * @param {Object} openApiSpec - Complete OpenAPI specification
 */
export function processParameters(parameters, paramsSchema, openApiSpec) {
  for (const param of parameters) {
    const zodParam = openapiToZod(param.schema, openApiSpec);
    paramsSchema[param.name] = param.required ? zodParam : zodParam.optional();
  }
}

/**
 * Processes request body schema into Zod schemas
 * @param {Object} requestBody - OpenAPI request body object
 * @param {Object} paramsSchema - Target schema object to populate
 * @param {Object} openApiSpec - Complete OpenAPI specification
 */
export function processRequestBody(requestBody, paramsSchema, openApiSpec) {
  if (!requestBody.content) return;
  
  // Try different content types in priority order
  const contentTypes = [
    'application/json', 
    'multipart/form-data', 
    'application/x-www-form-urlencoded'
  ];
  
  for (const contentType of contentTypes) {
    if (!requestBody.content[contentType]) continue;
    
    let bodySchema = requestBody.content[contentType].schema;
    
    // Handle schema references
    if (bodySchema.$ref) {
      bodySchema = resolveReference(bodySchema.$ref, openApiSpec);
    }
    
    // Process schema properties
    if (bodySchema?.properties) {
      for (const [prop, schema] of Object.entries(bodySchema.properties)) {
        let propSchema = schema;
        
        // Handle nested references
        if (propSchema.$ref) {
          propSchema = resolveReference(propSchema.$ref, openApiSpec);
        }
        
        const zodProp = openapiToZod(propSchema, openApiSpec);
        paramsSchema[prop] = bodySchema.required?.includes(prop) 
          ? zodProp 
          : zodProp.optional();
      }
    }
    
    break; // We found and processed a content type
  }
}

/**
 * Resolves a schema reference within an OpenAPI spec
 * @param {string} ref - Reference string (e.g. #/components/schemas/ModelName)
 * @param {Object} openApiSpec - Complete OpenAPI specification
 * @returns {Object} - Resolved schema
 */
export function resolveReference(ref, openApiSpec) {
  const refPath = ref.replace('#/', '').split('/');
  return refPath.reduce((obj, path) => obj[path], openApiSpec);
}

/**
 * Registers a tool with the MCP server
 * @param {string} toolId - Unique tool identifier
 * @param {string} toolDescription - Human-readable description
 * @param {Object} paramsSchema - Zod schema for parameters
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - API endpoint path
 * @param {Object} operation - OpenAPI operation object
 */
export function registerTool(toolId, toolDescription, paramsSchema, method, path, operation) {
  server.tool(
    toolId,
    toolDescription,
    paramsSchema,
    async (params) => {
      try {
        const { actualPath, remainingParams } = processPathParameters(path, operation, params);
        const { queryParams, bodyParams } = separateParameters(remainingParams, operation, method);
        const finalPath = appendQueryString(actualPath, queryParams);
        console.error(params);
        console.error(JSON.stringify(params));
        
        // Make the API request
        const result = await makeClickSendRequest(
          method.toUpperCase(), 
          finalPath, 
          method.toUpperCase() === 'GET' ? null : bodyParams
        );
        
        return {
          content: [
            {
              type: "text",
              text: `✅ ${method.toUpperCase()} ${finalPath} completed successfully:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
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

/**
 * Registers a tool with the MCP server
 * @param {string} toolId - Unique tool identifier
 * @param {string} toolDescription - Human-readable description
 * @param {Object} paramsSchema - Zod schema for parameters
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - API endpoint path
 * @param {Object} operation - OpenAPI operation object
 */
export async function makeTestRequest(paramsSchema, method, path, operation, params) {

  try {
    const { actualPath, remainingParams } = processPathParameters(path, operation, params);
    const { queryParams, bodyParams } = separateParameters(remainingParams, operation, method);
    const finalPath = appendQueryString(actualPath, queryParams);
    
    // Make the API request
    const result = await makeClickSendRequest(
      method.toUpperCase(), 
      finalPath, 
      method.toUpperCase() === 'GET' ? null : bodyParams
    );
    
    return {
      content: [
        {
          type: "text",
          text: `✅ ${method.toUpperCase()} ${finalPath} completed successfully:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  } catch (error) {
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


/**
 * Processes path parameters from the request parameters
 * @param {string} path - API endpoint path with placeholders
 * @param {Object} operation - OpenAPI operation object
 * @param {Object} params - Request parameters
 * @returns {Object} - Processed path and remaining parameters
 */
export function processPathParameters(path, operation, params) {
  let actualPath = path;
  const pathParams = operation.parameters?.filter(p => p.in === 'path') || [];
  const remainingParams = { ...params };
  
  for (const param of pathParams) {
    if (params[param.name]) {
      actualPath = actualPath.replace(
        `{${param.name}}`, 
        encodeURIComponent(params[param.name])
      );
      delete remainingParams[param.name];
    } else {
      throw new Error(`Required path parameter '${param.name}' is missing`);
    }
  }
  
  return { actualPath, remainingParams };
}

/**
 * Separates parameters into query parameters and body parameters
 * @param {Object} params - Request parameters
 * @param {Object} operation - OpenAPI operation object
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @returns {Object} - Separated query and body parameters
 */
export function separateParameters(params, operation, method) {
  const queryParams = {};
  const bodyParams = {};
  
  // Get query parameters from operation definition
  const definedQueryParams = operation.parameters?.filter(p => p.in === 'query').map(p => p.name) || [];
  
  // Sort parameters into body or query
  for (const [key, value] of Object.entries(params)) {
    if (definedQueryParams.includes(key)) {
      queryParams[key] = value;
    } else {
      bodyParams[key] = value;
    }
  }
  
  // For GET requests, move all params to query
  if (method.toUpperCase() === 'GET') {
    Object.assign(queryParams, bodyParams);
    Object.keys(bodyParams).forEach(key => delete bodyParams[key]);
  }
  
  return { queryParams, bodyParams };
}

/**
 * Appends query string parameters to a path
 * @param {string} path - API endpoint path
 * @param {Object} queryParams - Query parameters
 * @returns {string} - Path with query string
 */
export function appendQueryString(path, queryParams) {
  if (Object.keys(queryParams).length === 0) {
    return path;
  }
  
  const queryString = new URLSearchParams();
  
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null) {
      queryString.append(key, value.toString());
    }
  }
  
  return `${path}?${queryString.toString()}`;
}

/**
 * Main function to initialize and start the MCP server
 */
export async function main() {
  try {
    // Load and parse OpenAPI spec
    const openApiSpec = loadOpenApiSpec(OPENAPI_YAML);
    
    // Generate tools from the spec
    generateToolsFromOpenApi(openApiSpec);
    
    // Connect to the transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("ClickSend MCP Server running on stdio");
  } catch (error) {
    console.error("Fatal error in main():", error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
}

// Only auto-execute when not in test environment
if (process.env.NODE_ENV !== 'test') {
  main();
}