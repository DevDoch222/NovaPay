import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  LogoutDto,
  RefreshTokenDto,
  RequestOtpDto,
  StepUpVerifyDto,
  SubmitKycDto,
  UpdateProfileDto,
  VerifyOtpDto,
} from './dto';
import { CurrentUser, Public, type AuthUser } from '../../common/decorators';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/request')
  @ApiOperation({ summary: 'Request OTP (rate limited, hashed at rest)' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify OTP (rate limited + lockout)' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('token/refresh')
  @ApiOperation({ summary: 'Rotate refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke refresh token (and optional all sessions)' })
  logout(@Body() dto: LogoutDto = {}) {
    return this.auth.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout/all')
  @ApiOperation({ summary: 'Revoke all refresh tokens for this user' })
  logoutAll(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken, user.userId);
  }

  @ApiBearerAuth()
  @Post('step-up/request')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send step-up OTP for sensitive actions' })
  requestStepUp(@CurrentUser() user: AuthUser) {
    return this.auth.requestStepUp(user.userId);
  }

  @ApiBearerAuth()
  @Post('step-up/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify step-up OTP' })
  verifyStepUp(@CurrentUser() user: AuthUser, @Body() dto: StepUpVerifyDto) {
    return this.auth.verifyStepUp(user.userId, dto.code);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.userId, dto);
  }

  @Post('kyc')
  submitKyc(@CurrentUser() user: AuthUser, @Body() dto: SubmitKycDto) {
    return this.auth.submitKyc(user.userId, dto);
  }
}
