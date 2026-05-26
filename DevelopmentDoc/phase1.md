# Phase 1: 最小验证 Demo 方案

## 1. 目标

在最短时间内跑通一个可玩的网页端游戏闭环，验证核心玩法——**打怪 → 得经验 → 升级 → 三选一进化 → 能力/外观变化**——是否成立。不依赖后端，不依赖 AI 实时接口，所有内容本地写死。

## 2. 最小闭环流程

```
登录页 → 关卡1 → 升级选择 → 关卡2 → 升级选择 → 关卡3(Boss) → 结算页
```

- **登录页**：输入昵称，点击"开始实验"，进入关卡1。
- **关卡内**：WASD 移动，鼠标左键点击发射子弹/攻击方向。击杀所有敌人则通关本关。
- **升级选择**：通关一关后弹出三个选项，每个选项包含一个 buff 和一个 debuff，点击即生效，并叠加对应外观部件。
- **结算页**：通过三关后展示最终变异体形象、选择路线和一份本地模板生成的"实验报告"。

## 3. 技术选型

| 层 | 技术 | 说明 |
|---|---|---|
| 框架 | Phaser 3 | 成熟 H5 2D 框架，碰撞/动画/场景管理开箱即用 |
| 构建 | Vite | 极速 HMR，零配置开箱 |
| 语言 | TypeScript | 类型安全，适合多人协作 |
| UI | 原生 HTML/CSS 覆盖层 | 登录页、选择面板、结算页用 DOM 实现更高效 |
| 资产 | 纯代码绘制 + 基础几何图形 | MVP 阶段不引入任何外部图片，全部用 Phaser Graphics |

**原则**：整个 Demo 是纯前端单页应用，`npm install && npm run dev` 即可跑起来，不需要后端。

## 4. 场景设计

### 4.1 登录场景（HTML 层）

纯 DOM 页面，不进入 Phaser。包含：

- 游戏标题："变异进化肉鸽 · 最小原型"
- 昵称输入框，限制 8 个字符
- "开始实验"按钮
- 极简实验室背景（CSS 渐变即可）

点击按钮后，存储昵称到 `localStorage`，切换到 Phaser 游戏场景。

### 4.2 关卡场景（Phaser Scene）

#### 地图

- 单屏固定矩形竞技场，800×600（或自适应）
- 灰色地板 + 深色边框墙壁
- 角落放 2-3 个方块障碍物（简单矩形）

#### 玩家

- 初始形态：一个蓝色圆形身体 + 两条黑色线段手臂 + 两条黑色线段腿（火柴人简化版）
- WASD 移动，速度 200px/s
- 鼠标左键点击：向鼠标点击方向发射一颗黄色小球（子弹），速度 400px/s，伤害 10
- 攻击间隔 0.4s（有冷却，防止无限连点）
- 初始 HP：100
- 经验条：0 / 100，击败一个敌人 +30 经验

#### 敌人

| 类型 | 外观 | HP | 伤害 | 移动速度 | 经验 | 出现关卡 |
|---|---|---|---|---|---|---|
| 普通小怪 | 红色圆形 | 30 | 15 | 80px/s | 30 | 1, 2, 3 |
| 快速小怪 | 橙色小三角形 | 20 | 10 | 150px/s | 35 | 2, 3 |
| Boss | 紫色大方块（60×60） | 200 | 25 | 50px/s | 100 | 3 |

敌人 AI：持续向玩家位置移动，碰到玩家时造成碰撞伤害（有 1s 冷却防止秒杀）。

#### 通关条件

- 关卡1：击杀 5 只普通小怪，全部清完后弹出升级选择。
- 关卡2：击杀 3 只普通 + 3 只快速，全部清完后弹出升级选择。
- 关卡3：击杀 2 只普通 + 2 只快速 + 1 只 Boss，全部清完后进入结算。

### 4.3 升级选择面板（HTML 覆盖层）

通关一关后，Phaser 暂停，DOM 层弹出一个三选一面板：

```
┌──────────────────────────────────┐
│         🔬 进化选择              │
├──────────┬──────────┬────────────┤
│ 选项 A   │ 选项 B   │  选项 C    │
│ 🍖 食物  │ 💊 药物  │ 🧪 实验物  │
│          │          │            │
│ 辣味火锅  │ 肌肉针剂 │ 迷你黑洞糖  │
│          │          │            │
│ + 火焰伤害│ + 攻击力 │ + 吸附攻击  │
│ - 暴露位置│ - 体型变大│ - 吸走掉落 │
│          │          │            │
│ [选择]   │ [选择]   │  [选择]    │
└──────────┴──────────┴────────────┘
```

MVP 阶段准备 9 个选项（每关随机出 3 个即可）：

| ID | 名称 | 类型 | Buff | Debuff | 外观部件 |
|---|---|---|---|---|---|
| spicy_pot | 辣味火锅 | food | 子弹附带火焰，+5 伤害 | 每隔 8s 自动向随机方向发射一颗子弹（可能暴露位置） | flame_aura |
| deep_fish | 深海鱼子 | food | 闪避率 +15% | 移动速度 -10% | fish_fin |
| carrot | 巨型胡萝卜 | food | 视野范围 +20%，暴击率 +10% | 体型增大 15%（受击判定变大） | big_eyes |
| muscle | 肌肉针剂 | drug | 攻击力 +12 | 体型增大 20%（受击判定变大） | muscle_arm |
| nerve | 神经兴奋剂 | drug | 移动速度 +25%，攻速 +20% | 每 12s 短暂眩晕 0.8s | zigzag_legs |
| regen | 再生药膏 | drug | 每关开始回血 20 | 攻击力 -5 | green_skin |
| blackhole | 迷你黑洞糖 | experiment | 子弹吸附 3px 范围内敌人 | 掉落物有 20% 概率消失 | black_hole_aura |
| memory | 记忆罐头 | experiment | 复制上一个进化选项的 buff | 复制上一个进化选项的 debuff（效果翻倍） | clone_echo |
| chaos | 混沌培养液 | experiment | 随机获得一个未选过的 buff | 随机获得一个未选过的 debuff | random_glow |

选择后，面板消失，Phaser 恢复，角色能力立即生效，外观部件追加渲染。

### 4.4 结算场景

过完三关后进入结算页（DOM 层）：

- 展示角色最终形象（Phaser 截帧或 Canvas 绘制）
- 列出本局选择路线：`辣味火锅 → 肌肉针剂 → 迷你黑洞糖`
- 列出最终属性面板：HP、攻击力、速度、特殊能力
- 生成一段本地模板"实验报告"：

```
══════════════════════
  实 验 报 告
══════════════════════

实验体编号：EX-001
实验员：[玩家昵称]
培养代数：3

最终形态特征：
· 火焰光环围绕身体
· 右臂异常粗壮
· 周围存在微弱引力场

综合评估：
这是一个同时具备火焰能力、肌肉强化和引力控制的中型变异体。
危险等级：★★★☆☆
培养建议：肌肉组织过度增生风险较高，建议下一轮减少药物类摄入。

══════════════════════
```

- 两个按钮："再开一局"（回到登录页）、"分享截图"（可选 MVP 阶段不做）

## 5. 项目结构

```
f:\github\GameEngine\
├── index.html              # 入口 HTML，包含登录页、选择面板、结算页 DOM
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts             # 入口：创建 Phaser Game，管理场景切换
    ├── config.ts           # 游戏常量（地图大小、速度、数值等）
    ├── scenes/
    │   ├── GameScene.ts    # 关卡主场景（玩家、敌人、碰撞、经验、通关逻辑）
    │   └── SummaryScene.ts # 可选的 Phaser 结算场景（或用纯 DOM）
    ├── entities/
    │   ├── Player.ts       # 玩家类：移动（WASD）、攻击（鼠标点击）、HP、经验、视觉叠加
    │   ├── Enemy.ts        # 敌人类：追踪 AI、碰撞、不同类型
    │   ├── Bullet.ts       # 子弹类：移动、碰撞、销毁
    │   └── Obstacle.ts     # 障碍物
    ├── systems/
    │   ├── EvolutionSystem.ts  # 进化选项管理：随机抽取、buff/debuff 应用
    │   └── UIManager.ts        # UI 管理：登录、选择面板、结算、经验条通信
    ├── data/
    │   └── evolutions.ts   # 9 个进化选项的 JSON 配置
    └── utils/
        └── report.ts       # 结算报告模板拼接逻辑
```

## 6. 数据流

```
                    ┌──────────────┐
                    │  登录页(DOM)  │
                    │  输入昵称     │
                    └──────┬───────┘
                           │ 点击开始
                           ▼
              ┌────────────────────────┐
              │   GameScene (Phaser)   │
              │                        │
              │  ┌──────────────────┐  │
              │  │ Player           │  │
              │  │ · position       │  │
              │  │ · hp, exp, lv    │  │
              │  │ · stats{damage,  │  │
              │  │   speed, ...}    │  │
              │  │ · visualParts[]  │  │
              │  │ · evolutionLog[] │  │
              │  └────────┬─────────┘  │
              │           │ 击败所有敌人
              │           ▼            │
              │  ┌──────────────────┐  │
              │  │ 弹出进化选择      │  │
              │  │ (DOM覆盖层)       │  │
              │  │ 3个随机选项       │  │
              │  └────────┬─────────┘  │
              │           │ 玩家点击选择 │
              │           ▼            │
              │  ┌──────────────────┐  │
              │  │ 应用 buff/debuff │  │
              │  │ 叠加外观部件       │  │
              │  │ 记录到 evolutionLog│ │
              │  └────────┬─────────┘  │
              │           │ 下一关      │
              └───────────┼────────────┘
                          │ 三关完成
                          ▼
                 ┌────────────────┐
                 │  结算页(DOM)    │
                 │  展示最终形象    │
                 │  展示选择路线    │
                 │  生成实验报告    │
                 └────────────────┘
```

## 7. 核心实现要点

### 7.1 玩家（Player.ts）

```typescript
class Player {
  x: number; y: number;
  hp: number = 100;
  maxHp: number = 100;
  exp: number = 0;
  expToNext: number = 100;
  level: number = 1;
  
  // 可修改属性
  damage: number = 10;
  speed: number = 200;
  attackCooldown: number = 0.4;
  dodgeChance: number = 0;
  critChance: number = 0;
  sizeMultiplier: number = 1;  // 影响碰撞体积
  
  // 进化记录
  evolutionLog: EvolutionOption[] = [];
  visualParts: string[] = [];  // 当前激活的外观部件标签
  
  // 临时效果（眩晕、反向控制等）
  activeEffects: ActiveEffect[] = [];
  
  move(dx: number, dy: number) { ... }
  attack(targetX: number, targetY: number) { ... }
  takeDamage(amount: number) { ... }
  gainExp(amount: number) { ... }
  applyEvolution(option: EvolutionOption) { ... }
}
```

### 7.2 经验与升级

```typescript
// 在 gainExp 中：
gainExp(amount: number) {
  this.exp += amount;
  if (this.exp >= this.expToNext) {
    this.level++;
    this.exp -= this.expToNext;
    this.expToNext = Math.floor(this.expToNext * 1.5); // 每级所需经验递增
    this.onLevelUp();  // 触发事件，通知 UIManager 弹出选择面板
  }
}
```

注意：MVP 阶段每个关卡只升 1 级（击杀足够敌人后恰好满经验），这样每关结束后必然弹出一次三选一。简化设计：每关的敌人总数经验刚好够升一级。

### 7.3 外观部件叠加

```typescript
// 在 Player 的 render/graphics update 中：
drawVisualParts(graphics: Phaser.GameObjects.Graphics) {
  // 基础身体 (受 sizeMultiplier 影响)
  const r = 16 * this.sizeMultiplier;
  graphics.fillStyle(0x4488ff);
  graphics.fillCircle(this.x, this.y, r);
  
  // 叠加部件
  for (const partId of this.visualParts) {
    switch (partId) {
      case 'flame_aura':
        // 画一层半透明橙色光环
        graphics.lineStyle(2, 0xff6600, 0.5);
        graphics.strokeCircle(this.x, this.y, r + 8);
        break;
      case 'muscle_arm':
        // 画更粗的手臂
        graphics.lineStyle(6, 0x333333);
        graphics.lineBetween(this.x, this.y, this.x + 20, this.y - 10);
        break;
      case 'big_eyes':
        // 画两个大白色圆点 + 黑色瞳孔
        ...
        break;
      // ... 其他部件
    }
  }
}
```

MVP 阶段用简单几何图形即可，不需要真实图片素材。

### 7.4 敌人 AI

```typescript
class Enemy {
  update(playerX: number, playerY: number, delta: number) {
    // 向玩家移动
    const angle = Math.atan2(playerY - this.y, playerX - this.x);
    this.x += Math.cos(angle) * this.speed * (delta / 1000);
    this.y += Math.sin(angle) * this.speed * (delta / 1000);
    
    // 碰撞检测：距离 < 玩家半径 + 自己半径 → 造成伤害
    const dist = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
    if (dist < this.radius + playerRadius && this.canAttack()) {
      this.attackPlayer();
    }
  }
}
```

### 7.5 鼠标点击攻击

```typescript
// 在 GameScene 中
this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
  // pointer.x, pointer.y 是世界坐标
  this.player.attack(pointer.x, pointer.y);
});
```

## 8. 关卡敌人配置

```typescript
const LEVEL_CONFIG = [
  { // 关卡 1
    id: 1,
    enemies: [
      { type: 'normal', count: 5 }
    ],
    obstacleCount: 2
  },
  { // 关卡 2
    id: 2,
    enemies: [
      { type: 'normal', count: 3 },
      { type: 'fast', count: 3 }
    ],
    obstacleCount: 3
  },
  { // 关卡 3
    id: 3,
    enemies: [
      { type: 'normal', count: 2 },
      { type: 'fast', count: 2 },
      { type: 'boss', count: 1 }
    ],
    obstacleCount: 3,
    isBossLevel: true
  }
];
```

## 9. HTML 页面结构（index.html 概要）

```html
<!DOCTYPE html>
<html>
<head>
  <title>变异进化肉鸽 · MVP</title>
  <style>
    /* 登录页样式 */
    #login-screen { ... }
    /* 进化选择面板 */
    #evolution-panel { display: none; ... }
    /* 结算页 */
    #summary-screen { display: none; ... }
    /* Phaser canvas */
    #game-container { ... }
  </style>
</head>
<body>
  <div id="login-screen">
    <h1>变异进化肉鸽</h1>
    <input id="nickname" maxlength="8" placeholder="输入实验员代号">
    <button id="btn-start">开始实验</button>
  </div>
  
  <div id="game-container"></div>
  
  <div id="evolution-panel">
    <h2>进化选择</h2>
    <div id="choices">
      <!-- 动态插入 3 个选项卡片 -->
    </div>
  </div>
  
  <div id="summary-screen">
    <h2>实验结束</h2>
    <canvas id="final-image"></canvas>
    <div id="evolution-path"></div>
    <div id="experiment-report"></div>
    <button id="btn-restart">再开一局</button>
  </div>
  
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

## 10. 开发顺序（建议 1.5 天完成）

### ✅ 第 1 步：项目骨架（1 小时）
- [x] `npm create vite@latest . -- --template vanilla-ts`（手动创建，npm 不可用）
- [x] 安装 `phaser`（已写入 package.json，需运行 `npm install`）
- [x] 创建基础目录结构
- [x] 写一个空的 Phaser GameScene，能看到灰色背景

### ✅ 第 2 步：登录页 → 进入游戏（0.5 小时）
- [x] 写 login-screen DOM
- [x] 点击按钮隐藏 login，显示 game-container，启动 Phaser

### ✅ 第 3 步：玩家移动 + 攻击（1.5 小时）
- [x] Player 类：WASD 移动、鼠标点击攻击、HP、经验
- [x] Bullet 类：生成、移动、碰撞销毁
- [x] 在 GameScene 中跑通

### ✅ 第 4 步：敌人（1.5 小时）
- [x] Enemy 类：追踪 AI、三种类型
- [x] 碰撞检测（子弹 vs 敌人、敌人 vs 玩家）
- [x] 击败敌人给经验、删除敌人

### ✅ 第 5 步：经验升级 + 三选一（2 小时）
- [x] 经验满 → 触发升级事件 → 弹出 DOM 面板
- [x] EvolutionSystem：随机抽 3 个选项
- [x] 点击选项 → 应用 buff/debuff → 叠加视觉部件
- [x] 关闭面板，进入下一关

### ✅ 第 6 步：多关卡 + Boss（1.5 小时）
- [x] 关卡配置加载
- [x] 清完当前关卡敌人 → 自动加载下一关
- [x] Boss 特殊处理（血条、体积、伤害）

### ✅ 第 7 步：结算页（1 小时）
- [x] 三关完成后展示 summary-screen
- [x] 用 Canvas 画最终形态
- [x] 拼接实验报告文案
- [x] 再开一局按钮

### 第 8 步：调手感 + 修 bug（2 小时）
- [ ] 数值调整
- [ ] 边缘情况处理
- [ ] 体验优化

**总计约 11 小时，一天半可以完成。**

## 11. 验收标准

打开发布页面后可以完成以下闭环即视为 MVP 通过：

- [ ] 输入昵称 → 点击开始，进入游戏画面
- [ ] WASD 移动角色，鼠标点击发射子弹
- [ ] 击败红色圆形敌人，获得经验
- [ ] 经验满后弹出三选一面板，三个选项的 buff/debuff 描述清晰
- [ ] 选择后角色属性变化，外观有肉眼可见的叠加效果
- [ ] 通关三关（最后一关有紫色 Boss）
- [ ] 进入结算页，看到最终形态、选择路线和实验报告
- [ ] 点击"再开一局"可以重新开始

## 12. 不做的事情（明确范围边界）

- ❌ 不接入后端 / AI 接口
- ❌ 不使用任何外部图片素材
- ❌ 不做随机地图生成
- ❌ 不做音效和音乐
- ❌ 不做排行榜、分享、存档
- ❌ 不做复杂的粒子特效
- ❌ 不做 Buff/Debuff 之间的联动组合（如火焰+毒雾=爆炸）
- ❌ 不做掉落物系统
- ❌ 不做复杂 UI 动画（只用简单的显示/隐藏）

Phase 1 的唯一目的：**证明核心循环可行，好玩，值得继续投入**。
