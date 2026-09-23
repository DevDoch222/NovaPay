import { IsInt, IsString, Matches, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFxQuoteDto {
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  sourceCurrency!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  destCurrency!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceAmountMajor!: number;
}

export class BookFxQuoteDto {
  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}
