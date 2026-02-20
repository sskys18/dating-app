import { IsString } from 'class-validator';

export class BlockUserDto {
  @IsString()
  blockedId!: string;
}
