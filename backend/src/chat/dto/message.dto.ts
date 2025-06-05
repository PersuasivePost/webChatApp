import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MessageDto {
  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  groudId?: string;
}
