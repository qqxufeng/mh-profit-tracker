// ============================================================
// 梦幻搬砖收益账本 · 云版 — 行情参考模块 market.controller.ts（只读）
// ============================================================
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { MarketService } from './market.service';
import type { MarketReference } from '@shared/api.interface';

@Controller('api/market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('servers')
  async listServers(): Promise<MarketServerListItem[]> {
    return this.marketService.listServers();
  }

  @Get('servers/:id')
  async getServer(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MarketReference> {
    return this.marketService.getServer(id);
  }
}
