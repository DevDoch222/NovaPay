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
import { CardsService } from './cards.service';
import { CardAuthorizeDto, IssueCardDto } from './dto';
import { CurrentUser, type AuthUser } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('cards')
@Controller('v1/cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Post()
  issue(@CurrentUser() user: AuthUser, @Body() dto: IssueCardDto) {
    return this.cards.issue(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List cards (paginated)' })
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.cards.list(user.userId, query.page, query.limit);
  }

  @Post('authorizations/:authId/settle')
  settle(
    @CurrentUser() user: AuthUser,
    @Param('authId', ParseUUIDPipe) authId: string,
  ) {
    return this.cards.settle(user.userId, authId);
  }

  @Post(':id/freeze')
  freeze(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cards.freeze(user.userId, id);
  }

  @Post(':id/unfreeze')
  unfreeze(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cards.unfreeze(user.userId, id);
  }

  @Post(':id/close')
  close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.cards.close(user.userId, id);
  }

  @Post(':id/authorize')
  authorize(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CardAuthorizeDto,
  ) {
    return this.cards.authorize({
      userId: user.userId,
      cardId: id,
      amountMajor: dto.amountMajor,
      merchant: dto.merchant,
      idempotencyKey: dto.idempotencyKey,
    });
  }
}
