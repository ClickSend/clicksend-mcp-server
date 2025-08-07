import yaml from "js-yaml";
import fs from "node:fs";
import { z } from "zod";
import type { OpenApiSpec, OpenApiParameter } from '../types/openapi.ts';

export function loadOpenApiSpec(filePath: string) {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const spec = yaml.load(fileContents) as OpenApiSpec;
    injectUserDateRequestParameter(spec);
    return spec;
  } catch (error: any) {
    console.error(`Error loading OpenAPI spec: ${error.message}`);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Injects the user_date_request parameter into SMS history endpoint
 * This allows AI agents to pass original user date requests for better parsing
 */
function injectUserDateRequestParameter(spec: OpenApiSpec) {
  const smsHistoryPath = spec?.paths?.['/v3/sms/history'];
  if (!smsHistoryPath?.get?.parameters) {
    return;
  }
  
  const parameters = smsHistoryPath.get.parameters;
  const hasUserDateRequest = parameters.some((param: OpenApiParameter) => param.name === 'user_date_request');
  if (hasUserDateRequest) {
    return;
  }
  
  const userDateRequestParam = {
    name: 'user_date_request',
    in: 'query',
    schema: {
      type: 'string'
    },
    description: "[FOR AI AGENTS] When user requests dates in natural language (e.g., 'Aug 5 2025', 'yesterday', 'last Tuesday'), pass the EXACT original user message here. The backend will parse this to generate correct Unix timestamps for date_from/date_to, avoiding common AI errors like wrong years. This parameter overrides any date_from/date_to values if provided."
  };
  
  parameters.push(userDateRequestParam);
}

export function openapiToZod(schema: any, fullSpec: any): any {
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
      
      const shape: any = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        shape[key] = schema.required?.includes(key) 
          ? openapiToZod(prop, fullSpec)
          : openapiToZod(prop, fullSpec).optional();
      }
      return z.object(shape).describe(schema.description || '');
    
    default:
      // For schemas without a type but with properties
      if (schema.properties) {
        const shape: any = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
          shape[key] = schema.required?.includes(key) 
            ? openapiToZod(prop, fullSpec)
            : openapiToZod(prop, fullSpec).optional();
        }
        return z.object(shape).describe(schema.description || '');
      }
      
      // For YAML that defines "oneOf", "anyOf", etc.
      if (schema.oneOf) {
        const unionTypes = schema.oneOf.map((s: any) => openapiToZod(s, fullSpec));
        return z.union(unionTypes).describe(schema.description || '');
      }
      
      if (schema.anyOf) {
        const unionTypes = schema.anyOf.map((s: any) => openapiToZod(s, fullSpec));
        return z.union(unionTypes).describe(schema.description || '');
      }
      
      return z.any().describe(schema.description || '');
  }
}

export function getOperationDetails(openApiSpec: any, method: string, path: string) {
  const lowerMethod = method.toLowerCase();
  
  if (!openApiSpec.paths?.[path]?.[lowerMethod]) {
    return null;
  }
  
  return {
    operation: openApiSpec.paths[path][lowerMethod],
    operationId: `${method}-${path.replace(/[^\w-]/g, '-').replace(/-+/g, '-')}`
  };
}

export function buildParamsSchema(operation: any, openApiSpec: any): any {
  const paramsSchema = {};
  
  // Process path parameters
  const pathParams = operation.parameters?.filter((p: any) => p.in === 'path') || [];
  processParameters(pathParams, paramsSchema, openApiSpec);
  
  // Process query parameters
  const queryParams = operation.parameters?.filter((p: any) => p.in === 'query') || [];
  processParameters(queryParams, paramsSchema, openApiSpec);
  
  // Process request body if it exists
  if (operation.requestBody) {
    processRequestBody(operation.requestBody, paramsSchema, openApiSpec);
  }
  
  return paramsSchema;
}

export function processParameters(parameters: any, paramsSchema: any, openApiSpec: any) {
  for (const param of parameters) {
    const zodParam = openapiToZod(param.schema, openApiSpec);
    
    // Override with parameter-level description if it exists (takes precedence over schema description)
    const finalParam = param.description ? zodParam.describe(param.description) : zodParam;
    
    paramsSchema[param.name] = param.required ? finalParam : finalParam.optional();
  }
}

export function processRequestBody(requestBody: any, paramsSchema: any, openApiSpec: any) {
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
        let propSchema: any = schema;
        
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

export function resolveReference(ref: string, openApiSpec: any) {
  const refPath = ref.replace('#/', '').split('/');
  return refPath.reduce((obj, path) => obj[path], openApiSpec);
}

export function processPathParameters(path: string, operation: any, params: any) {
  let actualPath = path;
  const pathParams = operation.parameters?.filter((p: any) => p.in === 'path') || [];
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

export function separateParameters(params: any, operation: any, method: string) {
  const queryParams: any = {};
  const bodyParams: any = {};
  
  // Get query parameters from operation definition
  const definedQueryParams = operation.parameters?.filter((p: any) => p.in === 'query').map((p: any) => p.name) || [];
  
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

export function appendQueryString(path: string, queryParams: any) {
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