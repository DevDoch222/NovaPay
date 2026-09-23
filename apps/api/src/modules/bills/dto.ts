import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PayBillDto {
  @IsString()
  billerId!: string;

  @IsString()
  @MinLength(3)
  customerRef!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMajor!: number;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}

export class AirtimeTopupDto {
  @IsString()
  operatorId!: string;

  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMajor!: number;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}

export class CatalogQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  country?: string;
}
