// ============================================================
// 梦幻搬砖收益账本 · 云版 — 数据同步模块 sync.controller.ts
// fullSync：本地数据合并到云端（事务内按去重规则）
// pull：拉取云端全量数据
// ============================================================
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { FullSyncDataDto } from './dto/sync.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { SyncResponse, MhUser } from '@shared/api.interface';

@Controller('api/sync')
@UseGuards(AuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('full')
  async fullSync(
    @CurrentUser() user: MhUser,
    @Body() data: FullSyncDataDto,
  ): Promise<SyncResponse> {
    return this.syncService.fullSync(user.id, data);
  }

  @Get('pull')
  async pull(@CurrentUser() user: MhUser): Promise<SyncResponse> {
    return this.syncService.pull(user.id);
  }
}
