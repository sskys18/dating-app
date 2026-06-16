import { IsIn, IsOptional, IsBoolean } from 'class-validator';

export class ResolveReportDto {
  @IsIn(['reviewed', 'resolved', 'dismissed'])
  status!: string;

  // When true, the reported user is banned (locked out at auth + filtered from feed).
  @IsOptional()
  @IsBoolean()
  banReported?: boolean;
}
