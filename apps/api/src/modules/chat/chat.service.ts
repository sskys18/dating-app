import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LlmService } from '../llm/llm.service';
import {
  ChatOutputsSchema,
  SendMessageRequestSchema,
  type ChatMessage,
} from '@dating-app/types';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const MIN_TURNS_FOR_COMPLETION = 6;
const RATE_LIMIT_SECONDS = 3;
// NFR-05 / §13: cap runaway LLM cost per persona-chat session.
const DEFAULT_SESSION_TOKEN_BUDGET = 20000;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly sessionTokenBudget: number;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private llm: LlmService,
    private config: ConfigService,
  ) {
    this.sessionTokenBudget = this.config.get<number>(
      'LLM_SESSION_TOKEN_BUDGET',
      DEFAULT_SESSION_TOKEN_BUDGET,
    );
  }

  async startChat(sessionId: string) {
    // Verify session exists and quiz is completed
    const session = await this.prisma.anonSession.findUnique({
      where: { id: sessionId },
      include: { quizResponse: true, chatSession: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new NotFoundException('Session not found or expired');
    }

    if (!session.quizResponse?.completedAt) {
      throw new BadRequestException(
        'Please complete the quiz before starting a chat.',
      );
    }

    // Resume existing session
    if (session.chatSession) {
      return this.formatSession(session.chatSession);
    }

    // Fetch type info for the system prompt
    const quizResponse = session.quizResponse;
    const type = await this.prisma.typeCatalog.findUnique({
      where: { id: quizResponse.typeId },
    });

    const axisScores = quizResponse.axisScores as Record<string, number>;
    const axisPoles = quizResponse.axisPoles as Record<string, string>;

    const systemPrompt = this.buildSystemPrompt(
      type?.code ?? 'UNKNOWN',
      type?.label ?? 'Unknown Type',
      axisScores,
      axisPoles,
    );

    // Create initial greeting
    const greeting = await this.llm.chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content:
            'Start the conversation with a warm greeting. Introduce yourself briefly and ask your first question about their dating style.',
        },
      ],
    });

    const now = new Date().toISOString();
    const initialMessages: ChatMessage[] = [
      { role: 'assistant', content: greeting.content, timestamp: now },
    ];

    const chatSession = await this.prisma.chatSession.create({
      data: {
        sessionId,
        systemPrompt,
        messages: initialMessages,
        totalTokens: greeting.usage.totalTokens,
      },
    });

    return this.formatSession(chatSession);
  }

  async sendMessage(sessionId: string, content: string) {
    // Validate content
    const parsed = SendMessageRequestSchema.safeParse({ content });
    if (!parsed.success) {
      throw new BadRequestException('Message must be between 1 and 500 characters.');
    }

    // Rate limit: 1 message per 3 seconds per session
    const rateLimitKey = `rate:chat:msg:${sessionId}`;
    const exists = await this.redis.exists(rateLimitKey);
    if (exists) {
      throw new BadRequestException('Please wait a few seconds before sending another message.');
    }
    await this.redis.setex(rateLimitKey, RATE_LIMIT_SECONDS, '1');

    // Load session
    const chatSession = await this.prisma.chatSession.findUnique({
      where: { sessionId },
    });

    if (!chatSession) {
      throw new NotFoundException('No chat session found. Please start a chat first.');
    }

    if (chatSession.status !== 'active') {
      throw new BadRequestException('This chat session has already been completed.');
    }

    const messages = chatSession.messages as ChatMessage[];
    const newTurnCount = chatSession.turnCount + 1;
    const now = new Date().toISOString();

    // Append user message
    messages.push({ role: 'user', content, timestamp: now });

    // NFR-05 cost cap — evaluated BEFORE the completion/LLM paths so it can
    // never be bypassed on the expensive final turns. If cumulative spend
    // already exceeds the per-session token budget, stop spending: finalize
    // from what exists instead of issuing another normal turn. If we have
    // enough turns to extract meaningful structured outputs, do the one-time
    // extraction (force-finalize skips the extra wrap-up call); otherwise
    // complete with no further LLM calls at all.
    if (chatSession.totalTokens >= this.sessionTokenBudget) {
      this.logger.warn(
        `Session ${chatSession.id} hit token budget ` +
          `(${chatSession.totalTokens}/${this.sessionTokenBudget}) at turn ` +
          `${newTurnCount}; force-finalizing.`,
      );
      if (newTurnCount >= MIN_TURNS_FOR_COMPLETION) {
        return this.completeChat(chatSession, messages, newTurnCount, true);
      }
      return this.finalizeWithoutLlm(chatSession, messages, newTurnCount);
    }

    // Check if we should extract structured outputs and complete
    const shouldComplete =
      (newTurnCount >= MIN_TURNS_FOR_COMPLETION && newTurnCount >= chatSession.maxTurns - 1) ||
      newTurnCount >= chatSession.maxTurns;

    if (shouldComplete) {
      return this.completeChat(chatSession, messages, newTurnCount);
    }

    // Normal conversation turn
    const llmMessages = this.buildLlmMessages(
      chatSession.systemPrompt!,
      messages,
    );

    const response = await this.llm.chatCompletion({ messages: llmMessages });
    const assistantTimestamp = new Date().toISOString();
    messages.push({
      role: 'assistant',
      content: response.content,
      timestamp: assistantTimestamp,
    });

    const updated = await this.prisma.chatSession.update({
      where: { id: chatSession.id },
      data: {
        messages,
        turnCount: newTurnCount,
        totalTokens: chatSession.totalTokens + response.usage.totalTokens,
      },
    });

    return this.formatSession(updated);
  }

  async getSession(sessionId: string) {
    const chatSession = await this.prisma.chatSession.findUnique({
      where: { sessionId },
    });

    if (!chatSession) {
      return null;
    }

    return this.formatSession(chatSession);
  }

  private async completeChat(
    chatSession: { id: string; systemPrompt: string | null; totalTokens: number; maxTurns: number },
    messages: ChatMessage[],
    turnCount: number,
    forceFinalize = false,
  ) {
    // When force-finalizing on the cost cap, skip the extra conversational
    // wrap-up model call (pure spend) and append a static closing message.
    // The single extraction call below is the actual deliverable (OUT-01..03)
    // and keeps NFR-04 schema validation intact.
    let finalResponseTokens = 0;
    if (forceFinalize) {
      messages.push({
        role: 'assistant',
        content:
          "Thanks so much for sharing — I've got everything I need to put together your profile draft. It's ready for you now!",
        timestamp: new Date().toISOString(),
      });
    } else {
      // Get a final conversational response first
      const conversationMessages = this.buildLlmMessages(
        chatSession.systemPrompt!,
        messages,
      );

      // Add instruction for the final turn
      conversationMessages.push({
        role: 'system',
        content:
          'This is the final turn. Warmly wrap up the conversation — thank them for sharing, give a brief positive reflection on what you learned about them, and let them know their profile draft is ready.',
      });

      const finalResponse = await this.llm.chatCompletion({
        messages: conversationMessages,
      });
      finalResponseTokens = finalResponse.usage.totalTokens;

      const finalTimestamp = new Date().toISOString();
      messages.push({
        role: 'assistant',
        content: finalResponse.content,
        timestamp: finalTimestamp,
      });
    }

    // Extract structured outputs from the full conversation
    const extractionMessages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a data extraction assistant. Based on the following persona chat conversation, generate a JSON object with this exact structure:

{
  "profileDraft": {
    "bioVariants": ["<bio version 1, 2-3 sentences>", "<bio version 2, 2-3 sentences>"],
    "promptAnswers": ["<answer to 'My ideal first date...'>", "<answer to 'I'm looking for someone who...'>", "<answer to 'A fun fact about me...'>"]
  },
  "matchingCriteria": {
    "dealbreakers": ["<dealbreaker 1>", "<dealbreaker 2>", ...],
    "greenFlags": ["<green flag 1>", "<green flag 2>", ...],
    "weights": { "closeness": <0-1>, "reassurance": <0-1>, "commitment": <0-1>, "conflict": <0-1> }
  },
  "messageStarters": {
    "starters": ["<opener 1>", "<opener 2>", "<opener 3>"]
  }
}

Guidelines:
- Bio variants should sound natural for a dating app, reflecting the user's personality from the conversation
- Prompt answers should be specific and personal, based on what the user shared
- Dealbreakers and green flags should come directly from what the user mentioned
- Weights should reflect how important each axis dimension seems based on the conversation (0 = not important, 1 = very important)
- Message starters should be friendly conversation openers that reflect the user's personality
- Return ONLY the JSON object, no additional text`,
      },
      ...this.buildLlmMessages(chatSession.systemPrompt!, messages).slice(1), // exclude system prompt, already have our own
    ];

    const extraction = await this.llm.structuredOutput({
      messages: extractionMessages,
      schema: ChatOutputsSchema,
      schemaName: 'ChatOutputs',
    });

    const updated = await this.prisma.chatSession.update({
      where: { id: chatSession.id },
      data: {
        messages,
        turnCount,
        status: 'completed',
        completedAt: new Date(),
        profileDraft: extraction.data.profileDraft,
        matchingCriteria: extraction.data.matchingCriteria,
        messageStarters: extraction.data.messageStarters,
        totalTokens:
          chatSession.totalTokens +
          finalResponseTokens +
          extraction.usage.totalTokens,
      },
    });

    return this.formatSession(updated);
  }

  /**
   * Force-finalize a session that hit the token budget too early to extract
   * meaningful structured outputs. Marks the chat complete with NO further
   * LLM calls — a hard stop on runaway cost (NFR-05). Outputs stay null.
   */
  private async finalizeWithoutLlm(
    chatSession: { id: string },
    messages: ChatMessage[],
    turnCount: number,
  ) {
    messages.push({
      role: 'assistant',
      content:
        "Thanks for chatting! We've reached the limit for this session, so I'm wrapping things up here.",
      timestamp: new Date().toISOString(),
    });

    const updated = await this.prisma.chatSession.update({
      where: { id: chatSession.id },
      data: {
        messages,
        turnCount,
        status: 'completed',
        completedAt: new Date(),
      },
    });

    return this.formatSession(updated);
  }

  private buildSystemPrompt(
    typeCode: string,
    typeLabel: string,
    axisScores: Record<string, number>,
    axisPoles: Record<string, string>,
  ): string {
    const axisDescriptions = [
      {
        name: 'Closeness',
        key: 'a',
        poles: { first: 'CLOSE (prefers intimacy)', second: 'DIST (values space)' },
      },
      {
        name: 'Reassurance',
        key: 'b',
        poles: { first: 'CALM (self-assured)', second: 'NEED (seeks validation)' },
      },
      {
        name: 'Commitment',
        key: 'c',
        poles: { first: 'COMMIT (ready to settle)', second: 'EXPLORE (keeping options)' },
      },
      {
        name: 'Conflict',
        key: 'd',
        poles: { first: 'ENGAGE (confronts issues)', second: 'PAUSE (avoids conflict)' },
      },
    ];

    const axisLines = axisDescriptions.map((axis) => {
      const score = axisScores[axis.key] ?? 0;
      const pole = axisPoles[axis.key] ?? '';
      const poleDesc =
        pole === axis.poles.first.split(' ')[0]
          ? axis.poles.first
          : axis.poles.second;
      return `- ${axis.name} (${axis.key.toUpperCase()}): ${score}/3 → ${poleDesc}`;
    });

    const ambiguousAxes = axisDescriptions
      .filter((axis) => {
        const score = axisScores[axis.key] ?? 0;
        return score === 1 || score === 2;
      })
      .map((axis) => axis.name);

    const ambiguousNote =
      ambiguousAxes.length > 0
        ? `\nNote: The following axes had borderline scores and may not strongly define the user: ${ambiguousAxes.join(', ')}. Explore these areas with curiosity rather than assuming a strong preference.`
        : '';

    return `You are a warm, insightful dating persona guide. The user just completed a dating personality quiz and was assigned type: ${typeCode} — "${typeLabel}".

Their axis scores:
${axisLines.join('\n')}
${ambiguousNote}

Your job over 6-10 conversational turns:
1. Help them reflect on their dating style through thoughtful questions
2. Explore what they value in relationships
3. Understand their dealbreakers and green flags
4. Help articulate their personality in dating-app-friendly language

Be conversational, empathetic, occasionally playful. Ask one question at a time.
Do NOT output structured data during the conversation — that happens at the end.`;
  }

  private buildLlmMessages(
    systemPrompt: string,
    messages: ChatMessage[],
  ): ChatCompletionMessageParam[] {
    const llmMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        llmMessages.push({ role: msg.role, content: msg.content });
      }
    }

    return llmMessages;
  }

  private formatSession(chatSession: {
    id: string;
    turnCount: number;
    maxTurns: number;
    messages: unknown;
    status: string;
    profileDraft: unknown;
    matchingCriteria: unknown;
    messageStarters: unknown;
  }) {
    const messages = (chatSession.messages as ChatMessage[]).filter(
      (m) => m.role !== 'system',
    );

    return {
      id: chatSession.id,
      turnCount: chatSession.turnCount,
      maxTurns: chatSession.maxTurns,
      messages,
      status: chatSession.status,
      ...(chatSession.status === 'completed'
        ? {
            profileDraft: chatSession.profileDraft,
            matchingCriteria: chatSession.matchingCriteria,
            messageStarters: chatSession.messageStarters,
          }
        : {}),
    };
  }
}
