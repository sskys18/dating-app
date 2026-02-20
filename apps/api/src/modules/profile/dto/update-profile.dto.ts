import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  MaxLength,
  IsDateString,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nickname?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  introLine?: string;

  @IsOptional()
  @IsNumber()
  locationLat?: number;

  @IsOptional()
  @IsNumber()
  locationLng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  locationLabel?: string;

  @IsOptional()
  @IsBoolean()
  typeVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  axisCVisible?: boolean;
}
