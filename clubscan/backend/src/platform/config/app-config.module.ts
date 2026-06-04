import { Global, Module, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from './app-config.service';

@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule implements OnModuleInit {
  constructor(private readonly config: AppConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.config.refresh();
  }
}
