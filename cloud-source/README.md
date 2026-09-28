# 梦幻搬砖收益账本 · 云版 — 源码备份

这是「梦幻搬砖收益账本 · 云版」全栈应用（登录 + 会员 + 云同步）的**核心源码备份**，
从在线应用工程导出，供二次开发与自托管部署参考。

## 架构总览

- **前端**：React（`client/`），路由 /login、/market，深色金色国风
- **后端**：NestJS（`server/`），REST API，JWT 认证（httpOnly Cookie `mh_session`，30 天）
- **数据库**：PostgreSQL + Drizzle ORM（`server/database/schema.ts`）
- **共享契约**：`shared/api.interface.ts`（前后端共用类型）

## 功能清单

1. **账号体系**：自建账号密码注册/登录，bcrypt 哈希 + JWT；数据按 userId 隔离
2. **免登录本地模式**：未登录数据存 localStorage（`mh_ledger_local_v1`），登录后一键 fullSync 合并到云端
3. **核心记账**：物品记录（内置估价表自动匹配单价）、金币收入/支出、今日/本周/本月收益（梦幻币+人民币双显示）
4. **图表**：近 7 天收益趋势、今日来源占比、近 30 天金价走势
5. **多服务器**：每服务器估价表/金价/记录独立
6. **每日金价**：金价自动记入当日历史，可补录
7. **会员（本期免费）**：登录即会员标识，可看全区服物价金价参考（`mh_market_reference` 只读表，运营维护）
8. **数据备份**：JSON 导出/导入

## 数据同步去重策略（server/modules/sync）

- servers：按 `name` 去重，同名更新金价/排序
- records：按 `localId` 去重，避免重复写入
- prices：按 `serverId + name` 去重
- goldHistory：按 `serverId + recordDate` 去重

## 数据库表

| 表 | 说明 |
| --- | --- |
| mh_user | 用户（isVip 会员标识） |
| mh_server | 服务器（金价基数/汇率） |
| mh_record | 记账记录（kind: item/in/out） |
| mh_price | 估价表 |
| mh_gold_history | 金价历史 |
| mh_market_reference | 全区服行情参考（只读） |

## 目录结构（关键文件）

```
cloud-source/
├── shared/api.interface.ts                 # 前后端共享类型契约（完整）
├── server/
│   ├── database/schema.ts                  # Drizzle 表结构（完整）
│   └── modules/
│       ├── auth/                           # 认证：service / guard / controller（完整）
│       ├── records/                        # 记账：controller / service（完整）
│       ├── sync/                           # 云同步：controller / service（完整）
│       └── market/                         # 行情参考：controller / service（完整）
└── client/src/
    ├── api/index.ts                        # 全部后端 API 封装（完整）
    ├── hooks/                              # useAuth / useLocalStore / useLedgerData（完整）
    └── pages/                              # LoginPage / HomePage / RecordForm / MarketPage（完整）
```

## 部署说明（自托管时）

> 本目录是**核心业务源码备份**，不含完整工程脚手架（package.json、构建配置、
> shadcn/ui 组件库、样式文件、图表组件等）。如需完整自托管部署，请在
> @lark-apaas/fullstack-nestjs-core 模板工程基础上，按本目录源码补齐各模块。

1. 准备 PostgreSQL 数据库
2. 按 `server/database/schema.ts` 建表（drizzle-kit push/migrate）
3. 设置环境变量：`MH_JWT_SECRET`（JWT 密钥，生产必改）
4. 初始化 `mh_market_reference` 行情数据（运营脚本维护，应用端只读）
5. 启动 NestJS 后端 + React 前端构建产物

## 安全提示

- `server/modules/auth/auth.service.ts` 中的 `MH_JWT_SECRET` 默认值仅用于开发，
  **生产环境必须通过环境变量覆盖**
- 记账/同步接口均按 `userId` 过滤，防止越权读取他人数据
