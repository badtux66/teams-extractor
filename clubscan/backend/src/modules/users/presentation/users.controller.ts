import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/platform/security/decorators';
import { AuthenticatedUser } from '@/platform/security/auth.types';
import { UsersService } from '../application/users.service';
import { RegisterDeviceDto } from '../application/dto/device.dto';

@ApiTags('users')
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('sessions')
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.users.listSessions(user.id, user.sessionId);
  }

  @Delete('sessions/:id')
  revokeSession(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.users.revokeSession(userId, id);
  }

  @Get('devices')
  devices(@CurrentUser('id') userId: string) {
    return this.users.listDevices(userId);
  }

  @Post('devices')
  registerDevice(@CurrentUser('id') userId: string, @Body() dto: RegisterDeviceDto) {
    return this.users.registerDevice(userId, dto);
  }

  @Delete('devices/:id')
  removeDevice(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.users.removeDevice(userId, id);
  }
}
