import { Module } from '@nestjs/common';
import { SearchService } from './application/search.service';
import { SearchController } from './presentation/search.controller';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
