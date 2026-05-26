// 敌人类型
export type EnemyType = "normal" | "fast" | "boss";

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

export const ENEMY_BOSS_HP = 200;
export const ENEMY_BOSS_SPEED = 50;
export const ENEMY_BOSS_DAMAGE = 25;
export const ENEMY_BOSS_RADIUS = 30;

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
  {
    id: 1,
    name: "基因培育室",
    enemies: [
      { type: "normal", count: 5 },
    ],
  },
  {
    id: 2,
    name: "变异长廊",
    enemies: [
      { type: "normal", count: 3 },
      { type: "fast", count: 3 },
    ],
  },
  {
    id: 3,
    name: "最终实验场",
    enemies: [
      { type: "normal", count: 2 },
      { type: "fast", count: 2 },
      { type: "boss", count: 1 },
    ],
  },
];

export const TOTAL_LEVELS = LEVEL_CONFIGS.length;
