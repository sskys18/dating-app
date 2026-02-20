import { z } from 'zod';

export const AxisPoleASchema = z.enum(['CLOSE', 'DIST']);
export const AxisPoleBSchema = z.enum(['CALM', 'NEED']);
export const AxisPoleCSchema = z.enum(['COMMIT', 'EXPLORE']);
export const AxisPoleDSchema = z.enum(['ENGAGE', 'PAUSE']);

export const AxisScoresSchema = z.object({
  a: z.number().int().min(0).max(3),
  b: z.number().int().min(0).max(3),
  c: z.number().int().min(0).max(3),
  d: z.number().int().min(0).max(3),
});

export type AxisScores = z.infer<typeof AxisScoresSchema>;

export const AxisPolesSchema = z.object({
  a: AxisPoleASchema,
  b: AxisPoleBSchema,
  c: AxisPoleCSchema,
  d: AxisPoleDSchema,
});

export type AxisPoles = z.infer<typeof AxisPolesSchema>;

// A single quiz answer: 0 = option A, 1 = option B
export const QuizAnswerSchema = z.number().int().min(0).max(1);

// All 12 answers
export const QuizAnswersSchema = z.array(QuizAnswerSchema).length(12);

export const QuizItemSchema = z.object({
  id: z.number().int().min(0).max(11),
  axis: z.enum(['a', 'b', 'c', 'd']),
  optionA: z.object({ text: z.string(), textKo: z.string() }),
  optionB: z.object({ text: z.string(), textKo: z.string() }),
});

export type QuizItem = z.infer<typeof QuizItemSchema>;

export const QuizProgressSchema = z.object({
  answers: z.array(QuizAnswerSchema.nullable()).length(12),
  currentIndex: z.number().int().min(0).max(11),
});

export type QuizProgress = z.infer<typeof QuizProgressSchema>;

export const QuizSubmitRequestSchema = z.object({
  answers: QuizAnswersSchema,
});

export type QuizSubmitRequest = z.infer<typeof QuizSubmitRequestSchema>;

export const QuizSubmitResponseSchema = z.object({
  quizResponseId: z.string(),
  typeId: z.number().int().min(0).max(15),
  axisScores: AxisScoresSchema,
  axisPoles: AxisPolesSchema,
  type: z.object({
    code: z.string(),
    label: z.string(),
    description: z.string(),
  }),
});

export type QuizSubmitResponse = z.infer<typeof QuizSubmitResponseSchema>;

export const SaveProgressRequestSchema = z.object({
  progress: QuizProgressSchema,
});

export type SaveProgressRequest = z.infer<typeof SaveProgressRequestSchema>;

export const TypeCatalogSchema = z.object({
  id: z.number().int().min(0).max(15),
  code: z.string(),
  label: z.string(),
  labelKo: z.string(),
  description: z.string(),
  descriptionKo: z.string(),
  axisAPole: z.string(),
  axisBPole: z.string(),
  axisCPole: z.string(),
  axisDPole: z.string(),
});

export type TypeCatalogType = z.infer<typeof TypeCatalogSchema>;
