import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '@/platform/security/decorators';
import { ProfilesService } from '../application/profiles.service';
import { UpdateProfileDto } from '../application/dto/profile.dto';

@ApiTags('profiles')
@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.profiles.getMe(userId);
  }

  @Patch('me/profile')
  updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.profiles.updateProfile(userId, dto);
  }

  @Public()
  @Get('users/:username')
  publicProfile(
    @Param('username') username: string,
    @CurrentUser('id') viewerId?: string,
  ) {
    return this.profiles.getPublicProfile(username, viewerId);
  }

  @Post('users/:id/follow')
  follow(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.profiles.follow(userId, targetId);
  }

  @Delete('users/:id/follow')
  unfollow(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.profiles.unfollow(userId, targetId);
  }

  @Public()
  @Get('users/:id/followers')
  followers(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.profiles.listFollowers(id, cursor, limit);
  }

  @Public()
  @Get('users/:id/following')
  following(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.profiles.listFollowing(id, cursor, limit);
  }
}
