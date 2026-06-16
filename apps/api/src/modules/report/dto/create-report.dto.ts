import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'inappropriate_content',
  'fake_profile',
  'underage',
  'other',
] as const;

export class CreateReportDto {
  @IsString()
  reportedId!: string;

  @IsIn(REPORT_REASONS)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  // When the report originates from a chat, the conversation is snapshotted.
  @IsOptional()
  @IsString()
  chatRoomId?: string;
}
