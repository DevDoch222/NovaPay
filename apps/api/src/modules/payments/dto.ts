import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FundWalletDto {
  /** Amount in major units (e.g. 1000.50 NGN) — converted to kobo server-side */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMajor!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}

export class CreateBeneficiaryDto {
  @IsString()
  @Matches(/^(bank|mobile_money)$/)
  type!: 'bank' | 'mobile_money';

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  country?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsString()
  @MinLength(2)
  accountName!: string;

  @IsString()
  @MinLength(6)
  accountNumber!: string;

  @IsOptional()
  @IsString()
  bankCode?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  /** Required for mobile_money: mtn | airtel | mpesa | vodafone */
  @IsOptional()
  @IsString()
  @Matches(/^(mtn|airtel|mpesa|vodafone)$/)
  provider?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class CreatePayoutDto {
  @IsUUID()
  beneficiaryId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMajor!: number;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}

export class SimulateFundDto {
  @IsOptional()
  @IsString()
  providerRef?: string;
}
