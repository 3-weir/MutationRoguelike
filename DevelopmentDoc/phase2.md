# Phase 2: 后端 + 用户系统 + 存档方案

## 1. 目标

在不破坏 Phase 1 闭环的前提下，加入最小后端逻辑：

- **双层身份**：第一层玩家账户（用户名注册/登录，无密码）；第二层存档槽位（最多 3 个，每个槽位一个变异体）
- **注册/登录**：输入玩家用户名 → 注册时查重，登录时校验存在
- **存档槽位**：登录后看到 3 个槽位 — 空的点 + 新建，有数据的可继续/删除
- **回访记忆**：`localStorage` 记住 `current_player`，跳过登录直接到槽位页
- **暂停存档**：ESC 暂停游戏，提供「保存并退出到档案页」
- **兜底自动存档**：每通关一关自动存一次（防止闪退）

## 2. 页面流转变化

```
Phase 2 (v2 双层):
  打开页面 → 检查 localStorage
     │
     ├─ 无记录 → 登录/注册页
     │     │
     │     ├─ 注册 tab → 输入用户名（唯一）→ 创建玩家 → localStorage → 存档槽位页
     │     └─ 登录 tab → 输入已有用户名 → 校验通过 → localStorage → 存档槽位页
     │
     └─ 有记录 → 自动登录 → 存档槽位页
                           │
                    ┌──────┴──────┐
                    ▼             ▼             ▼
                槽位1(空)     槽位2(有存档)   槽位3(有存档)
                  │ +             │ 继续          │ 继续
                  ▼               ▼               ▼
              取名变异体     从存档恢复       从存档恢复
                  │               │               │
                  └───────┬───────┴───────┬───────┘
                          ▼               ▼
                      游戏场景         游戏场景
                      · ESC → 暂停面板（保存并退出 / 继续游戏）
                      · 每关清完 → 自动存档
                          │
                          ▼
                      结算页 → 回到槽位页
```

## 3. 后端 / 数据库选型（全部免费）

### 推荐 A：Supabase（最省事）

| 维度 | 说明 |
|---|---|
| 数据库 | PostgreSQL，免费 500MB |
| 认证 | 内置 Auth 系统（邮箱/手机/匿名/自定义） |
| API | 自动生成 REST API，前端直接用 `@supabase/supabase-js` 调用 |
| 部署 | 官方托管，免费计划 2 个项目 |
| 额度 | 50,000 月活用户，1GB 带宽 |
| 前端代码量 | 最少——直接调 js client，不需要写后端代码 |

**适合你**：不需要搭建后端、不需要写 API、不需要管服务器。前端一个 SDK 搞定认证 + 增删改查。

---

### 推荐 B：PocketBase（最轻量）

| 维度 | 说明 |
|---|---|
| 数据库 | SQLite（内嵌） |
| 认证 | 内置用户名/密码 + OAuth |
| API | 根据 schema 自动生成 CRUD API |
| 部署 | 单文件 go 二进制，拖到服务器即可运行 |
| 额度 | 无限制（自己控制） |
| 前端代码量 | 少——`pocketbase/js-sdk` 直接调 |

**适合你**：想要绝对轻量、自控数据、一条命令启动。部署到 Railway / Render（免费计划）或用 ngrok/tunnel 跑本地。

---

### 推荐 C：Firebase（最成熟）

| 维度 | 说明 |
|---|---|
| 数据库 | Firestore（NoSQL），免费 1GB |
| 认证 | 内置 Auth，支持匿名/邮箱/自定义 |
| API | 前端直接 `firebase/auth` + `firebase/firestore` |
| 部署 | 官方托管，Spark 免费计划 |
| 前端代码量 | 少——Firebase SDK 全搞定 |

**适合你**：熟悉 Google 生态，想要成熟的文档和社区支持。

---

### 选 A 的理由（Supabase）

在三个方案都能做到"零后端代码、前端直接操作数据库"的前提下，Supabase 胜在：

1. **关系型数据库**——存档数据和用户表天然适合 JOIN/索引
2. **Row Level Security**——可以精细控制「用户只能读写自己的存档」
3. **免费额度大方**——对于这个项目完全够用
4. **注册流程**——5 分钟注册 Supabase 账号、建表、拿 key 就能开始写前端
5. 如果后续要做排行榜，一条 SQL 就能排序

---

## 4. 数据库表设计（Supabase v2 版）

```sql
-- 玩家账户表（username 唯一，无密码）
CREATE TABLE players (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username   TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 存档槽位表（每个玩家最多 3 个档）
CREATE TABLE save_slots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    UUID REFERENCES players(id) ON DELETE CASCADE,
  slot_index   INT NOT NULL CHECK (slot_index BETWEEN 1 AND 3),
  variant_name TEXT NOT NULL,                        -- 该档的变异体名字
  level        INT NOT NULL DEFAULT 1,               -- 当前关卡（0-based）
  player_data  JSONB NOT NULL DEFAULT '{}'::jsonb,   -- 完整 Player 状态
  saved_at     TIMESTAMPTZ DEFAULT now()
);

-- 一个玩家 + 槽位号 唯一
CREATE UNIQUE INDEX idx_save_slots ON save_slots(player_id, slot_index);
```

### 存档 `player_data` JSONB 字段内容

```json
{
  "variantName": "小钢蛋",
  "hp": 85,
  "maxHp": 120,
  "exp": 60,
  "expToNext": 150,
  "level": 2,
  "damage": 22,
  "speed": 180,
  "dodgeChance": 0.15,
  "critChance": 0.10,
  "sizeMultiplier": 1.2,
  "evolutionLog": [
    { "id": "spicy_pot",  "name": "辣味火锅", "type": "food" },
    { "id": "muscle",     "name": "肌肉针剂", "type": "drug" }
  ],
  "visualParts": ["flame_aura", "muscle_arm"],
  "currentLevel": 1,
  "bulletVanishChance": 0
}
```

保存时直接 `JSON.stringify(playerData)`，恢复时 `JSON.parse(playerData)` 赋值回 Player 实例。

---

## 5. 实现步骤（Supabase 方案）

> 进度标记：每完成一项勾选 `[x]`，即可追踪开发进度。

### 第 1 步：搭建 Supabase + 基础脚手架（10 分钟）

- [x] 1.1 用户自行注册 [supabase.com](https://supabase.com)，创建项目 ✅
- [x] 1.2 在 Supabase SQL Editor 中执行 `database_init.sql` 建表 ✅
- [x] 1.3 从 Supabase Dashboard → Settings → API 获取 `Project URL` 和 `anon public key` ✅
- [x] 1.4 安装依赖：`npm install @supabase/supabase-js` ✅ (`^2.106.1`)
- [x] 1.5 创建 `.env.example` 环境变量模板 ✅
- [x] 1.6 用户创建 `.env` 文件并填入自己的 Supabase 密钥 ✅
- [x] 1.7 创建 `src/api/` 目录及 `src/api/supabase.ts`（Supabase 客户端初始化）✅
- [x] 1.8 `npm run dev` 验证 Vite 正常启动 ✅

> ✅ 第 1 步全部完成

### 第 2 步：封装完整 API 层（v2 双层模型）

- [x] 2.1 实现 `registerPlayer(username)` —— 查重 + 创建玩家 ✅
- [x] 2.2 实现 `loginPlayer(username)` —— 查找已有玩家 ✅
- [x] 2.3 实现 `getSaveSlots(playerId)` —— 获取全部 3 个槽位 ✅
- [x] 2.4 实现 `createSaveSlot(playerId, idx, variantName)` —— 创建新存档 ✅
- [x] 2.5 实现 `saveGame(slotId, level, playerData)` —— 更新存档 ✅
- [x] 2.6 实现 `loadSave(slotId)` / `deleteSlot(slotId)` ✅
- [x] 2.7 导出 `PlayerInfo` / `SaveSlot` 接口 ✅

> ✅ 第 2 步全部完成

### 第 3 步：登录/注册页 + 存档槽位页（v2 双层）

- [x] 3.1 `#auth-screen` 登录/注册双 tab 切换 + 输入框 + 错误提示 ✅
- [x] 3.2 注册模式 → `registerPlayer` 查重，重名红线提示 ✅
- [x] 3.3 登录模式 → `loginPlayer` 查存在，不存在提示「请先注册」 ✅
- [x] 3.4 成功 → localStorage `current_player` → 进入存档槽位页 ✅
- [x] 3.5 `#slots-screen` 渲染 3 个槽位卡片（空=加号，满=名字+关卡） ✅
- [x] 3.6 空槽位 + → prompt 输入变异体名 → `createSaveSlot` → 进游戏 ✅
- [x] 3.7 满槽位 → 点击进游戏；删除按钮确认后删除 ✅
- [x] 3.8 `main.ts` 启动检查 localStorage 自动跳槽位页 ✅

> ✅ 第 3 步全部完成（合并原 Step 3+4）

### 第 4 步：游戏内暂停 + ESC 键（1.5 小时）

- [x] 4.1 `GameScene.ts` 注册 ESC 键监听 → `togglePause()` ✅
- [x] 4.2 暂停时 `this.scene.pause()` 冻结 Phaser 所有更新 ✅
- [x] 4.3 `index.html` 新增 `#pause-screen` DOM 覆盖层（「继续游戏」「保存退出」两按钮）✅
- [x] 4.4 实现 `snapshotPlayerData()` 将 Player 全部状态打成序列化对象 ✅
- [x] 4.5 「保存并退出」→ `saveGame(slotId, ...)` → 销毁 Phaser → 回槽位页 ✅
- [x] 4.6 「继续游戏」→ 隐藏覆盖层，`this.scene.resume()` ✅

> ✅ 第 4 步全部完成

### 第 5 步：通关自动存档（0.5 小时）

- [x] 5.1 在 `startLevel()` 中调用 `autoSave()` — 每进入新关卡自动存一次 ✅
- [x] 5.2 `autoSave()` 内部调用 `saveGame(currentSlotId, currentLevel, snapshotPlayerData())` ✅
- [x] 5.3 静默失败 — 自动存档出错不弹提示，不打断游戏 ✅

> ✅ 第 5 步全部完成

### 第 6 步：从存档恢复游戏（1 小时）

- [x] 6.1 槽位页「继续」→ `loadSave(slotId)` 拿到存档数据 ✅
- [x] 6.2 创建 Phaser Game 时将存档数据通过 `window.__saveData` 传入 GameScene ✅
- [x] 6.3 `GameScene.create()` 检测存档数据 → `restoreFromData(data)` 分支 ✅
- [x] 6.4 `restoreFromData` 中还原 Player 全部属性（hp/exp/level/...） ✅
- [x] 6.5 重建 visualParts 视觉部件（火焰光环、肌肉手臂等绘制逻辑） ✅
- [x] 6.6 `startLevel(data.level)` 从对应关卡恢复 ✅

> ✅ 第 6 步全部完成（之前修复存档 bug 时已实现）

### 第 7 步：联调 + 错误处理（0.5 小时）

- [ ] 7.1 网络异常统一处理 — register/login/save/load 错误不白屏
- [ ] 7.2 localStorage 不可用时降级（无痕模式 etc）
- [ ] 7.3 清理 Phase 1 旧昵称逻辑，统一用新版双层流程
- [ ] 7.4 端到端打通：注册 → 新建存档 → 过关自动存 → ESC存档退出 → 回到槽位 → 继续游戏恢复

---

## 6. 总进度追踪

```
Phase 2 全局进度: [▰▰▰▰▰▰▱] 6/7  (存档恢复已完成)

第1步 搭建 Supabase + 基础脚手架  [▰▰▰▰▰▰▰▰] 8/8 ✅ 完成
第2步 封装完整 API 层            [▰▰▰▰▰▰▰▰] 7/7 ✅ 完成
第3步 登录/注册 + 存档槽位页      [▰▰▰▰▰▰▰▰] 8/8 ✅ 完成
第4步 暂停 + ESC + 保存退出       [▰▰▰▰▰▰▰▰] 6/6 ✅ 完成
第5步 通关自动存档                [▰▰▰▰▰▰▰▰] 3/3 ✅ 完成
第6步 从存档恢复                  [▰▰▰▰▰▰▰▰] 6/6 ✅ 完成
第7步 联调 + 错误处理             [········] 0/4
```

---

## 7. 环境变量配置

项目根目录新增 `.env`（不提交 git）：

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

Vite 自动注入 `import.meta.env.VITE_*`。

`.gitignore` 需包含 `.env`。

---

## 8. 时间估算

| 步骤 | 内容 | 时间 |
|---|---|---|
| 1 | 搭建 Supabase + 建表 | 10 分钟 |
| 2 | 封装 API 层（supabase.ts） | 0.5 小时 |
| 3 | 登录/注册 + 存档槽位页 | 1.5 小时 |
| 4 | 暂停 + ESC + 保存退出 | 1.5 小时 |
| 5 | 通关自动存档 | 0.5 小时 |
| 6 | 从存档恢复 | 1 小时 |
| 7 | 联调 + 错误处理 | 0.5 小时 |

**总计约 5.5 小时**。

---

## 9. 备选：更粗暴的简化方案

如果觉得 Supabase 注册 + 建表都嫌麻烦，可以用 **纯 localStorage 方案**（零后端）：

- 用户名存 localStorage
- 存档也存 localStorage（用 `JSON.stringify`）
- 缺点：无法跨设备、无重名校验、无安全性
- 优点：0 成本、0 部署、10 分钟搞定

选择取决于你需要多正式的成品。Supabase 方案是"看起来像正经产品"的最短路径。

---

## 10. 不做的事情（Phase 2 范围边界）

- ❌ 不接入 AI 接口
- ❌ 不做排行榜
- ❌ 不做分享/导出
- ❌ 不做密码 / 邮箱验证（名字即身份，不设密码）
- ❌ 不做跨设备同步（一台设备一个身份）
- ❌ 不处理并发写入冲突
