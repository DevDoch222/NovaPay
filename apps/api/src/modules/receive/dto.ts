import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVirtualAccountDto {
  @IsString()
  @IsIn(['USD', 'EUR'])
  currency!: 'USD' | 'EUR';
}

export class SimulateInboundDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMajor!: number;

  @IsString()
  @IsIn(['USD', 'EUR'])
  currency!: 'USD' | 'EUR';

  @IsString()
  @MinLength(8)
  externalReference!: string;

  @IsOptional()
  @IsString()
  senderName?: string;
}
