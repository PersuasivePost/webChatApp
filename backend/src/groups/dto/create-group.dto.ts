import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;
}
