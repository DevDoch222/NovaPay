import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StablecoinsService } from './stablecoins.service';
import { StableConvertDto, StableDepositDto } from './dto';
import { CurrentUser, type AuthUser } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('stablecoins')
@Controller('v1/stablecoins')
export class StablecoinsController {
  constructor(private readonly stables: StablecoinsService) {}

  @Get()
  @ApiOperation({ summary: 'Supported stablecoin assets' })
  supported() {
    return this.stables.supported();
  }

  @Get('balances')
  @ApiOperation({ summary: 'Stablecoin balances (paginated)' })
  balances(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.stables.balances(user.userId, query.page, query.limit);
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Sandbox stablecoin deposit' })
  deposit(@CurrentUser() user: AuthUser, @Body() dto: StableDepositDto) {
    return this.stables.deposit({
      userId: user.userId,
      currency: dto.currency,
      amountMajor: dto.amountMajor,
      idempotencyKey: dto.idempotencyKey,
      txHash: dto.txHash,
    });
  }

  @Post('convert')
  @ApiOperation({ summary: 'Convert USDC/USDT <-> USD (1:1 sandbox)' })
  convert(@CurrentUser() user: AuthUser, @Body() dto: StableConvertDto) {
    return this.stables.convert({
      userId: user.userId,
      sourceCurrency: dto.sourceCurrency,
      destCurrency: dto.destCurrency,
      sourceAmountMajor: dto.sourceAmountMajor,
      idempotencyKey: dto.idempotencyKey,
    });
  }
}
