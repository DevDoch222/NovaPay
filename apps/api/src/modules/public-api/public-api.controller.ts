import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicApiService } from './public-api.service';
import { CreateApiKeyDto, CreateWebhookDto } from './dto';
import { CurrentUser, type AuthUser } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('developer')
@Controller('v1')
export class PublicApiController {
  constructor(private readonly api: PublicApiService) {}

  /** Manage keys (JWT session) */
  @Post('developer/api-keys')
  createKey(@CurrentUser() user: AuthUser, @Body() dto: CreateApiKeyDto) {
    return this.api.createApiKey(user.userId, dto);
  }

  @Get('developer/api-keys')
  @ApiOperation({ summary: 'List API keys (paginated)' })
  listKeys(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.api.listApiKeys(user.userId, query.page, query.limit);
  }

  @Post('developer/api-keys/:id/revoke')
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.api.revokeApiKey(user.userId, id);
  }

  @Post('developer/webhooks')
  createWebhook(@CurrentUser() user: AuthUser, @Body() dto: CreateWebhookDto) {
    return this.api.createWebhook(user.userId, dto);
  }

  @Get('developer/webhooks')
  @ApiOperation({ summary: 'List webhooks (paginated)' })
  listWebhooks(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.api.listWebhooks(user.userId, query.page, query.limit);
  }

  /** Public merchant API (API key or JWT) */
  @Get('public/wallets')
  publicWallets(@CurrentUser() user: AuthUser) {
    return this.api.publicWallets(user.userId);
  }

  @Get('public/transactions')
  @ApiOperation({
    summary: 'Public transaction list (paginated, API key or JWT)',
  })
  publicTxns(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.api.publicTransactions(user.userId, query.page, query.limit);
  }
}
