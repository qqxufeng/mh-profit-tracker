// ============================================================
// 梦幻搬砖收益账本 · 云版 — 认证控制器 auth.controller.ts
// 注册 / 登录 / 登出 / 当前用户（JWT httpOnly Cookie 30 天）
// ============================================================
import { Controller, Post, Get, Body, Res, Req, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthService, COOKIE_NAME } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { AuthResponse, MhUser } from '@shared/api.interface';

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30天

@Controller('api/auth')
@UseGuards(AuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { user, token } = await this.authService.register(dto.username, dto.password);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
      path: '/',
    });
    return { user };
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { user, token } = await this.authService.login(dto.username, dto.password);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
      path: '/',
    });
    return { user };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response): Promise<{ ok: boolean }> {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: MhUser | null): { user: MhUser | null } {
    return { user };
  }
}
