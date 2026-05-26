import Phaser from "phaser";
import {
  EnemyType,
  ENEMY_NORMAL_HP,
  ENEMY_NORMAL_SPEED,
  ENEMY_NORMAL_DAMAGE,
  ENEMY_NORMAL_RADIUS,
  ENEMY_FAST_HP,
  ENEMY_FAST_SPEED,
  ENEMY_FAST_DAMAGE,
  ENEMY_FAST_RADIUS,
  ENEMY_BOSS_HP,
  ENEMY_BOSS_SPEED,
  ENEMY_BOSS_DAMAGE,
  ENEMY_BOSS_RADIUS,
  ENEMY_ATTACK_COOLDOWN,
  EXP_PER_KILL,
} from "../config";

export class Enemy {
  public x: number;
  public y: number;
  public radius: number;
  public hp: number;
  public maxHp: number;
  public speed: number;
  public damage: number;
  public type: EnemyType;
  public expReward: number;

  private gfx: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  private lastAttackTime = 0;
  public alive = true;

  private static ENEMY_CONFIG: Record<
    EnemyType,
    { hp: number; speed: number; damage: number; radius: number; exp: number }
  > = {
    normal: {
      hp: ENEMY_NORMAL_HP,
      speed: ENEMY_NORMAL_SPEED,
      damage: ENEMY_NORMAL_DAMAGE,
      radius: ENEMY_NORMAL_RADIUS,
      exp: EXP_PER_KILL,
    },
    fast: {
      hp: ENEMY_FAST_HP,
      speed: ENEMY_FAST_SPEED,
      damage: ENEMY_FAST_DAMAGE,
      radius: ENEMY_FAST_RADIUS,
      exp: EXP_PER_KILL + 5,
    },
    boss: {
      hp: ENEMY_BOSS_HP,
      speed: ENEMY_BOSS_SPEED,
      damage: ENEMY_BOSS_DAMAGE,
      radius: ENEMY_BOSS_RADIUS,
      exp: 100,
    },
  };

  constructor(scene: Phaser.Scene, x: number, y: number, type: EnemyType) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.type = type;

    const cfg = Enemy.ENEMY_CONFIG[type];
    this.hp = cfg.hp;
    this.maxHp = cfg.hp;
    this.speed = cfg.speed;
    this.damage = cfg.damage;
    this.radius = cfg.radius;
    this.expReward = cfg.exp;

    this.gfx = scene.add.graphics();
    this.draw();
  }

  // -------------------------------------------------------
  // 追踪 AI
  // -------------------------------------------------------
  update(delta: number, playerX: number, playerY: number): void {
    if (!this.alive) return;

    const angle = Math.atan2(playerY - this.y, playerX - this.x);
    const dt = delta / 1000;
    this.x += Math.cos(angle) * this.speed * dt;
    this.y += Math.sin(angle) * this.speed * dt;

    this.draw();
  }

  // -------------------------------------------------------
  // 是否可以攻击玩家（冷却检查）
  // -------------------------------------------------------
  canAttack(time: number): boolean {
    return time - this.lastAttackTime >= ENEMY_ATTACK_COOLDOWN * 1000;
  }

  markAttacked(time: number): void {
    this.lastAttackTime = time;
  }

  // -------------------------------------------------------
  // 受伤
  // -------------------------------------------------------
  takeDamage(amount: number): boolean {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true; // 死亡
    }
    return false;
  }

  // -------------------------------------------------------
  // 与目标碰撞检测
  // -------------------------------------------------------
  collidesWith(targetX: number, targetY: number, targetRadius: number): boolean {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    return dist < this.radius + targetRadius;
  }

  // -------------------------------------------------------
  // 绘制
  // -------------------------------------------------------
  private draw(): void {
    const gfx = this.gfx;
    gfx.clear();
    const x = this.x;
    const y = this.y;
    const r = this.radius;

    switch (this.type) {
      case "normal": {
        // 红色圆形 + 白色瞳孔
        gfx.fillStyle(0xe74c3c);
        gfx.fillCircle(x, y, r);
        gfx.fillStyle(0xffffff);
        gfx.fillCircle(x - r * 0.25, y - r * 0.2, r * 0.25);
        gfx.fillCircle(x + r * 0.25, y - r * 0.2, r * 0.25);
        gfx.fillStyle(0x111111);
        gfx.fillCircle(x - r * 0.25, y - r * 0.2, r * 0.13);
        gfx.fillCircle(x + r * 0.25, y - r * 0.2, r * 0.13);
        break;
      }
      case "fast": {
        // 橙色小三角形
        const h = r * 1.6;
        gfx.fillStyle(0xf39c12);
        gfx.fillTriangle(
          x, y - h * 0.55,
          x - r, y + h * 0.45,
          x + r, y + h * 0.45,
        );
        gfx.fillStyle(0xffffff);
        gfx.fillCircle(x - r * 0.28, y - h * 0.1, r * 0.22);
        gfx.fillCircle(x + r * 0.28, y - h * 0.1, r * 0.22);
        gfx.fillStyle(0x111111);
        gfx.fillCircle(x - r * 0.28, y - h * 0.1, r * 0.12);
        gfx.fillCircle(x + r * 0.28, y - h * 0.1, r * 0.12);
        break;
      }
      case "boss": {
        // 紫色大方块
        gfx.fillStyle(0x8e44ad);
        gfx.fillRect(x - r, y - r, r * 2, r * 2);
        // 边框
        gfx.lineStyle(2, 0xbb66ff);
        gfx.strokeRect(x - r, y - r, r * 2, r * 2);
        // 眼睛
        gfx.fillStyle(0xffffff);
        gfx.fillCircle(x - r * 0.5, y - r * 0.25, r * 0.32);
        gfx.fillCircle(x + r * 0.5, y - r * 0.25, r * 0.32);
        gfx.fillStyle(0x111111);
        gfx.fillCircle(x - r * 0.5, y - r * 0.25, r * 0.18);
        gfx.fillCircle(x + r * 0.5, y - r * 0.25, r * 0.18);
        // 嘴
        gfx.lineStyle(2, 0x111111);
        gfx.beginPath();
        gfx.moveTo(x - r * 0.5, y + r * 0.4);
        gfx.lineTo(x, y + r * 0.25);
        gfx.lineTo(x + r * 0.5, y + r * 0.4);
        gfx.strokePath();
        break;
      }
    }

    // HP 条（在头顶）
    if (this.type === "boss" || this.hp < this.maxHp) {
      const barW = this.type === "boss" ? 50 : 24;
      const barH = 4;
      const barY = y - this.radius - 10;
      gfx.fillStyle(0x333333);
      gfx.fillRect(x - barW / 2, barY, barW, barH);
      const ratio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
      const color = this.type === "boss" ? 0xbb66ff : 0xe74c3c;
      gfx.fillStyle(color);
      gfx.fillRect(x - barW / 2, barY, barW * ratio, barH);
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
