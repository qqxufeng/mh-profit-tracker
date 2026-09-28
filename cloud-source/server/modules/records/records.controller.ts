// ============================================================
// 梦幻搬砖收益账本 · 云版 — 记账记录模块 records.controller.ts
// ============================================================
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { RecordsService } from './records.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type {
  MhRecord,
  MhUser,
  StatsSummary,
  SourceDistributionItem,
  TrendPoint,
} from '@shared/api.interface';

@Controller('api/records')
@UseGuards(AuthGuard)
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Get()
  async list(
    @CurrentUser() user: MhUser,
    @Query('serverId') serverId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ): Promise<MhRecord[]> {
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.recordsService.list(user.id, serverId, {
      from,
      to,
      limit: limitNum,
    });
  }

  @Post()
  async create(
    @CurrentUser() user: MhUser,
    @Body() dto: CreateRecordDto,
  ): Promise<MhRecord> {
    return this.recordsService.create(user.id, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: MhUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecordDto,
  ): Promise<MhRecord> {
    return this.recordsService.update(user.id, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: MhUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.recordsService.remove(user.id, id);
  }

  @Get('stats')
  async stats(
    @CurrentUser() user: MhUser,
    @Query('serverId') serverId: string,
  ): Promise<StatsSummary> {
    return this.recordsService.getStats(user.id, serverId);
  }

  @Get('source-distribution')
  async sourceDistribution(
    @CurrentUser() user: MhUser,
    @Query('serverId') serverId: string,
  ): Promise<SourceDistributionItem[]> {
    return this.recordsService.getSourceDistribution(user.id, serverId);
  }

  @Get('trend')
  async trend(
    @CurrentUser() user: MhUser,
    @Query('serverId') serverId: string,
    @Query('days') days?: string,
  ): Promise<TrendPoint[]> {
    const daysNum = days ? parseInt(days, 10) : 7;
    return this.recordsService.getTrend(user.id, serverId, daysNum);
  }
}
