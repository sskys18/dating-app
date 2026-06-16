import { IsBoolean } from 'class-validator';

export class IncognitoDto {
  @IsBoolean()
  enabled!: boolean;
}
