import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ZodSchema } from 'zod';

const DEFAULT_MODEL = 'gpt-4o-mini';

@Injectable()
export class LlmService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(LlmService.name);

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: config.get<string>('OPENAI_API_KEY'),
    });
  }

  async chatCompletion(params: {
    messages: ChatCompletionMessageParam[];
    model?: string;
    maxTokens?: number;
  }): Promise<{ content: string; usage: { totalTokens: number } }> {
    const response = await this.openai.chat.completions.create({
      model: params.model ?? DEFAULT_MODEL,
      messages: params.messages,
      max_tokens: params.maxTokens ?? 512,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const totalTokens = response.usage?.total_tokens ?? 0;

    return { content, usage: { totalTokens } };
  }

  async structuredOutput<T>(params: {
    messages: ChatCompletionMessageParam[];
    schema: ZodSchema<T>;
    schemaName: string;
    model?: string;
    maxRetries?: number;
  }): Promise<{ data: T; usage: { totalTokens: number } }> {
    const maxRetries = params.maxRetries ?? 2;
    let lastError: Error | null = null;
    let accumulatedTokens = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await this.openai.chat.completions.create({
        model: params.model ?? DEFAULT_MODEL,
        messages: params.messages,
        response_format: { type: 'json_object' },
        max_tokens: 2048,
      });

      accumulatedTokens += response.usage?.total_tokens ?? 0;
      const raw = response.choices[0]?.message?.content ?? '';

      try {
        const parsed = JSON.parse(raw);
        const validated = params.schema.parse(parsed);
        return { data: validated, usage: { totalTokens: accumulatedTokens } };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `Structured output validation failed (attempt ${attempt + 1}/${maxRetries + 1}) for ${params.schemaName}: ${lastError.message}`,
        );
      }
    }

    throw new Error(
      `Failed to get valid structured output for ${params.schemaName} after ${maxRetries + 1} attempts: ${lastError?.message}`,
    );
  }
}
