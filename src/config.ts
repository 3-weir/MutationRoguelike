// 敌人类型
export type EnemyType = "normal" | "fast" | "ranged" | "healer" | "boss" | "elite_boss";

// 游戏全局常量
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const PLAYER_SPEED = 200;
export const PLAYER_HP = 100;
export const PLAYER_DAMAGE = 10;
export const PLAYER_ATTACK_COOLDOWN = 0.4;
export const PLAYER_RADIUS = 16;

export const BULLET_SPEED = 400;
export const BULLET_RADIUS = 6;

export const EXP_TO_LEVEL = 100;
export const EXP_PER_KILL = 30;

// 敌人
export const ENEMY_NORMAL_HP = 30;
export const ENEMY_NORMAL_SPEED = 80;
export const ENEMY_NORMAL_DAMAGE = 15;
export const ENEMY_NORMAL_RADIUS = 14;

export const ENEMY_FAST_HP = 20;
export const ENEMY_FAST_SPEED = 150;
export const ENEMY_FAST_DAMAGE = 10;
export const ENEMY_FAST_RADIUS = 12;

export const ENEMY_RANGED_HP = 25;
export const ENEMY_RANGED_SPEED = 40;
export const ENEMY_RANGED_DAMAGE = 12;
export const ENEMY_RANGED_RADIUS = 13;
export const ENEMY_RANGED_ATTACK_RANGE = 250;
export const ENEMY_RANGED_ATTACK_COOLDOWN = 2.0;
export const ENEMY_RANGED_BULLET_SPEED = 220;

export const ENEMY_BOSS_HP = 300;
export const ENEMY_BOSS_SPEED = 50;
export const ENEMY_BOSS_DAMAGE = 30;
export const ENEMY_BOSS_RADIUS = 32;
export const ENEMY_BOSS_ENRAGE_SPEED = 80;  // HP≤50% 狂暴速度
export const ENEMY_BOSS_ENRAGE_THRESHOLD = 0.5;

export const ENEMY_ELITE_BOSS_HP = 150;
export const ENEMY_ELITE_BOSS_SPEED = 55;
export const ENEMY_ELITE_BOSS_DAMAGE = 20;
export const ENEMY_ELITE_BOSS_RADIUS = 28;

// 治疗小怪（击杀后回血）
export const ENEMY_HEALER_HP = 18;
export const ENEMY_HEALER_SPEED = 60;
export const ENEMY_HEALER_DAMAGE = 5;
export const ENEMY_HEALER_RADIUS = 12;
export const ENEMY_HEALER_HEAL_AMOUNT = 20; // 击杀后回复玩家 HP

export const ENEMY_ATTACK_COOLDOWN = 1.0;

// 关卡配置
export interface LevelSpawnGroup {
  type: EnemyType;
  count: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  enemies: LevelSpawnGroup[];
}

export const LEVEL_CONFIGS: LevelConfig[] = [
  // 第1关：新手引导 — 纯普通怪，熟悉操作
  {
    id: 1,
    name: "基因培育室",
    enemies: [
      { type: "normal", count: 5 },
    ],
  },
  // 第2关：引入快速怪 — 速度压力
  {
    id: 2,
    name: "变异长廊",
    enemies: [
      { type: "normal", count: 4 },
      { type: "fast", count: 4 },
    ],
  },
  // 第3关：引入远程怪 — 需要主动靠近
  {
    id: 3,
    name: "实验仓库",
    enemies: [
      { type: "normal", count: 3 },
      { type: "ranged", count: 3 },
    ],
  },
  // 第4关：三类型混合 — 考验优先级判断（加入治疗小怪）
  {
    id: 4,
    name: "混沌培养池",
    enemies: [
      { type: "normal", count: 3 },
      { type: "fast", count: 2 },
      { type: "ranged", count: 2 },
      { type: "healer", count: 1 },
    ],
  },
  // 第5关：半程Boss战 — 精英实验体 + 小怪骚扰
  {
    id: 5,
    name: "基因工厂",
    enemies: [
      { type: "fast", count: 3 },
      { type: "ranged", count: 2 },
      { type: "elite_boss", count: 1 },
    ],
  },
  // 第6关：高强度压力关 — 大量混合敌人，进化偏向实验物（加入治疗小怪）
  {
    id: 6,
    name: "失控培养舱",
    enemies: [
      { type: "normal", count: 4 },
      { type: "fast", count: 3 },
      { type: "ranged", count: 2 },
      { type: "healer", count: 2 },
    ],
  },
  // 第7关：终极Boss战 — 最终实验体 OMEGA + 护卫小怪（加入治疗小怪）
  {
    id: 7,
    name: "最终实验场",
    enemies: [
      { type: "normal", count: 2 },
      { type: "fast", count: 2 },
      { type: "healer", count: 1 },
      { type: "boss", count: 1 },
    ],
  },
];

export const TOTAL_LEVELS = LEVEL_CONFIGS.length;
