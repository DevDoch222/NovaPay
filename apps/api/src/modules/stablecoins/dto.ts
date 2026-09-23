import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StableDepositDto {
  @IsString()
  @IsIn(['USDC', 'USDT'])
  currency!: 'USDC' | 'USDT';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMajor!: number;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  txHash?: string;
}

export class StableConvertDto {
  @IsString()
  @IsIn(['USDC', 'USDT', 'USD'])
  sourceCurrency!: string;

  @IsString()
  @IsIn(['USDC', 'USDT', 'USD'])
  destCurrency!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceAmountMajor!: number;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}
