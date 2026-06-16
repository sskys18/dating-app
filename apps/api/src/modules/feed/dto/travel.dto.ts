import { IsBoolean, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class TravelDto {
  // active=false clears the override; active=true requires lat/lng.
  @IsBoolean()
  active!: boolean;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
