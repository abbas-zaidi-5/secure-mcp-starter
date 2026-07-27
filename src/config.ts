import { z } from 'zod';

const placeholder = /replace-with|changeme|example|password/i;

const secretSchema = z
  .string()
  .min(32, 'must contain at least 32 characters')
  .refine(value => !placeholder.test(value), 'must not use a placeholder value');

const envSchema = z.object({
  MCP_ALLOWED_HOSTS: z.string().default('localhost,127.0.0.1'),
  MCP_APPROVAL_TTL_MS: z.coerce.number().int().min(30_000).max(86_400_000).default(600_000),
  MCP_APPROVER_TOKEN: secretSchema,
  MCP_HOST: z.string().default('127.0.0.1'),
  MCP_MAX_NOTE_LENGTH: z.coerce.number().int().min(100).max(100_000).default(4_000),
  MCP_OPERATOR_TOKEN: secretSchema,
  MCP_PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
  MCP_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(60),
  MCP_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(60_000),
  MCP_READER_TOKEN: secretSchema
});

export type RuntimeConfig = {
  allowedHosts: string[];
  approvalTtlMs: number;
  approverToken: string;
  host: string;
  maxNoteLength: number;
  operatorToken: string;
  port: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  readerToken: string;
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const result = envSchema.safeParse(environment);

  if (!result.success) {
    const summary = result.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${summary}`);
  }

  const values = result.data;
  if (values.MCP_READER_TOKEN === values.MCP_OPERATOR_TOKEN) {
    throw new Error('Invalid configuration: reader and operator tokens must be different');
  }
  if (
    values.MCP_APPROVER_TOKEN === values.MCP_READER_TOKEN ||
    values.MCP_APPROVER_TOKEN === values.MCP_OPERATOR_TOKEN
  ) {
    throw new Error('Invalid configuration: the approval token must be independent');
  }

  const allowedHosts = values.MCP_ALLOWED_HOSTS.split(',')
    .map(host => host.trim())
    .filter(Boolean);
  if (allowedHosts.length === 0) {
    throw new Error('Invalid configuration: MCP_ALLOWED_HOSTS cannot be empty');
  }

  return {
    allowedHosts,
    approvalTtlMs: values.MCP_APPROVAL_TTL_MS,
    approverToken: values.MCP_APPROVER_TOKEN,
    host: values.MCP_HOST,
    maxNoteLength: values.MCP_MAX_NOTE_LENGTH,
    operatorToken: values.MCP_OPERATOR_TOKEN,
    port: values.MCP_PORT,
    rateLimitMax: values.MCP_RATE_LIMIT_MAX,
    rateLimitWindowMs: values.MCP_RATE_LIMIT_WINDOW_MS,
    readerToken: values.MCP_READER_TOKEN
  };
}
