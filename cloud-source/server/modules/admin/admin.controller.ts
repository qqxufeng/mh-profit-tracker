// ============================================================
// 梦幻搬砖收益账本 · 云版 — 后台管理控制器 admin.controller.ts
// 概览 / 用户管理（VIP、管理员、重置密码、删除）/ 行情管理（增删改查）
// ============================================================
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';

import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import type {
  AdminOverviewStats,
  AdminUserListResponse,
  AdminUserItem,
  AdminMarketServerItem,
  AdminMarketCreateRequest,
  AdminMarketUpdateRequest,
  MarketReference,
} from '@shared/api.interface';

interface SetVipBody {
  isVip: boolean;
}

interface SetAdminBody {
  isAdmin: boolean;
}

interface ResetPasswordBody {
  newPassword: string;
}

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  async getOverview(): Promise<AdminOverviewStats> {
    return this.adminService.getOverview();
  }

  @Get('users')
  async listUsers(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('search') search?: string,
  ): Promise<AdminUserListResponse> {
    const pageNum: number = parseInt(page, 10);
    const pageSizeNum: number = parseInt(pageSize, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException('page 必须是正整数');
    }
    if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
      throw new BadRequestException('pageSize 必须在 1-100 之间');
    }
    return this.adminService.listUsers(pageNum, pageSizeNum, search);
  }

  @Patch('users/:id/vip')
  async setUserVip(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetVipBody,
  ): Promise<AdminUserItem> {
    if (typeof body.isVip !== 'boolean') {
      throw new BadRequestException('isVip 必须是布尔值');
    }
    return this.adminService.setUserVip(id, body.isVip);
  }

  @Patch('users/:id/admin')
  async setUserAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetAdminBody,
  ): Promise<AdminUserItem> {
    if (typeof body.isAdmin !== 'boolean') {
      throw new BadRequestException('isAdmin 必须是布尔值');
    }
    return this.adminService.setUserAdmin(id, body.isAdmin);
  }

  @Patch('users/:id/password')
  async resetUserPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResetPasswordBody,
  ): Promise<{ ok: true }> {
    if (typeof body.newPassword !== 'string' || !body.newPassword) {
      throw new BadRequestException('newPassword 不能为空');
    }
    return this.adminService.resetUserPassword(id, body.newPassword);
  }

  @Delete('users/:id')
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    return this.adminService.deleteUser(id);
  }

  @Get('market/servers')
  async listMarketServers(): Promise<AdminMarketServerItem[]> {
    return this.adminService.listMarketServers();
  }

  @Get('market/servers/:id')
  async getMarketServer(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MarketReference> {
    return this.adminService.getMarketServer(id);
  }

  @Post('market/servers')
  async createMarketServer(
    @Body() body: AdminMarketCreateRequest,
  ): Promise<MarketReference> {
    if (!body.serverName || typeof body.serverName !== 'string') {
      throw new BadRequestException('serverName 不能为空');
    }
    if (typeof body.goldBase !== 'number') {
      throw new BadRequestException('goldBase 必须是数字');
    }
    if (typeof body.goldRate !== 'number') {
      throw new BadRequestException('goldRate 必须是数字');
    }
    if (!Array.isArray(body.items)) {
      throw new BadRequestException('items 必须是数组');
    }
    return this.adminService.createMarketServer(body);
  }

  @Patch('market/servers/:id')
  async updateMarketServer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminMarketUpdateRequest,
  ): Promise<MarketReference> {
    return this.adminService.updateMarketServer(id, body);
  }

  @Delete('market/servers/:id')
  async deleteMarketServer(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    return this.adminService.deleteMarketServer(id);
  }
}
