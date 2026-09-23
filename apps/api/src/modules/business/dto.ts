import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(3)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers, and hyphens',
  })
  slug!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approvalLimitMajor?: number;
}

export class InviteMemberDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  /** E.164 phone of an existing NovaPay user */
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone?: string;

  /** @username / tag of an existing NovaPay user */
  @IsOptional()
  @IsString()
  @MinLength(3)
  tag?: string;

  @IsIn(['admin', 'approver', 'member'])
  role!: 'admin' | 'approver' | 'member';
}

export class FundOrgWalletDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMajor!: number;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}

export class BulkPayoutItemDto {
  @IsString()
  @MinLength(2)
  accountName!: string;

  @IsString()
  @MinLength(6)
  accountNumber!: string;

  @IsOptional()
  @IsString()
  bankCode?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMajor!: number;
}

export class CreateBulkPayoutDto {
  @IsString()
  @MinLength(8)
  idempotencyKey!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPayoutItemDto)
  items!: BulkPayoutItemDto[];
}
