import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public } from '@/platform/security/decorators';
import { AuthenticatedUser } from '@/platform/security/auth.types';
import { ReviewsService } from '../application/reviews.service';
import { CreateReviewDto, UpdateReviewDto } from '../application/dto/review.dto';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('venues/:venueId/reviews')
  listForVenue(
    @Param('venueId') venueId: string,
    @Query('sort') sort: 'recent' | 'helpful' = 'recent',
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.reviews.listForVenue(venueId, sort === 'helpful' ? 'helpful' : 'recent', cursor, limit);
  }

  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post('venues/:venueId/reviews')
  create(
    @CurrentUser('id') userId: string,
    @Param('venueId') venueId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(userId, venueId, dto);
  }

  @Public()
  @Get('reviews/:id')
  getOne(@Param('id') id: string) {
    return this.reviews.getById(id);
  }

  @Patch('reviews/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviews.update(user, id, dto);
  }

  @Delete('reviews/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reviews.remove(user, id);
  }

  @Post('reviews/:id/helpful')
  markHelpful(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.reviews.markHelpful(userId, id, true);
  }

  @Delete('reviews/:id/helpful')
  unmarkHelpful(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.reviews.markHelpful(userId, id, false);
  }
}
