export interface OpenApiSpec {
  openapi: string;
  info: any;
  paths: Record<string, any>;
  components?: any;
}

export interface OpenApiParameter {
  name: string;
  in: string;
  schema: any;
  description?: string;
  required?: boolean;
}
