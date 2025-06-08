import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @Length(3, 50)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;
}
