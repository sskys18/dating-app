import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class PresignPhotoDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
  contentType!: string;
}
