import { IsString, IsIn } from 'class-validator';

export class LikeDto {
  @IsString()
  targetUserId!: string;

  @IsIn(['like', 'pass'])
  action!: 'like' | 'pass';
}
