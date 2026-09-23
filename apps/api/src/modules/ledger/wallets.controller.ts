import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators';
import { WalletsService } from './wallets.service';

@ApiTags('wallets')
@Controller('v1/wallets')
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'List user wallets and balances' })
  list(@CurrentUser() user: AuthUser) {
    return this.wallets.listUserWallets(user.userId);
  }
}
