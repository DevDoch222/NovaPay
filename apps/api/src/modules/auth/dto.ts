import {
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phone must be E.164 format, e.g. +2348012345678',
  })
  phone!: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone!: string;

  @IsString()
  @MinLength(4)
  code!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class StepUpVerifyDto {
  @IsString()
  @MinLength(4)
  code!: string;
}

export class SubmitKycDto {
  @IsString()
  documentType!: string;

  @IsString()
  @MinLength(5)
  documentNumber!: string;

  @IsOptional()
  @IsString()
  fullName?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]{2,23}$/, {
    message:
      'username must be 3–24 chars, start with a letter, letters/numbers/_ only',
  })
  tag?: string;

  /** data:image/...;base64,... or https URL — null clears */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  avatarUrl?: string | null;
}
