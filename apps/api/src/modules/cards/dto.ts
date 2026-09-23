import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IssueCardDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  spendLimitMajor?: number;

  @IsOptional()
  @IsIn(['virtual', 'physical'])
  form?: 'virtual' | 'physical';

  @ValidateIf((o: IssueCardDto) => o.form === 'physical')
  @IsString()
  @MinLength(2)
  shippingName?: string;

  @ValidateIf((o: IssueCardDto) => o.form === 'physical')
  @IsString()
  @MinLength(3)
  shippingLine1?: string;

  @ValidateIf((o: IssueCardDto) => o.form === 'physical')
  @IsString()
  @MinLength(2)
  shippingCity?: string;

  @ValidateIf((o: IssueCardDto) => o.form === 'physical')
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  shippingCountry?: string;

  @ValidateIf((o: IssueCardDto) => o.form === 'physical')
  @IsString()
  @MinLength(2)
  shippingPostal?: string;
}

export class CardAuthorizeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMajor!: number;

  @IsString()
  @MinLength(2)
  merchant!: string;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}
