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
  ENEMY_RANGED_HP,
  ENEMY_RANGED_SPEED,
  ENEMY_RANGED_DAMAGE,
  ENEMY_RANGED_RADIUS,
  ENEMY_RANGED_ATTACK_RANGE,
  ENEMY_RANGED_ATTACK_COOLDOWN,
  ENEMY_RANGED_BULLET_SPEED,
  ENEMY_BOSS_HP,
  ENEMY_BOSS_SPEED,
  ENEMY_BOSS_DAMAGE,
  ENEMY_BOSS_RADIUS,
  ENEMY_BOSS_ENRAGE_SPEED,
  ENEMY_BOSS_ENRAGE_THRESHOLD,
  ENEMY_ELITE_BOSS_HP,
  ENEMY_ELITE_BOSS_SPEED,
  ENEMY_ELITE_BOSS_DAMAGE,
  ENEMY_ELITE_BOSS_RADIUS,
  ENEMY_HEALER_HP,
  ENEMY_HEALER_SPEED,
  ENEMY_HEALER_DAMAGE,
  ENEMY_HEALER_RADIUS,
  ENEMY_HEALER_HEAL_AMOUNT,
  ENEMY_ATTACK_COOLDOWN,
  EXP_PER_KILL,
} from "../config";

export interface EnemyBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  alive: boolean;
  sprite: Phaser.GameObjects.Graphics;
}

export class Enemy {
  public x: number;
  public y: number;
  public radius: number;
  public hp: number;
  public maxHp: number;
  public speed: number;
  public baseSpeed: number;
  public damage: number;
  public type: EnemyType;
  public expReward: number;

  private gfx: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  private lastAttackTime = 0;
  private lastRangedAttackTime = 0;
  public alive = true;
  public enraged = false;

  // 远程敌人专属：发射的子弹列表
  public rangedBullets: EnemyBullet[] = [];

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
    ranged: {
      hp: ENEMY_RANGED_HP,
      speed: ENEMY_RANGED_SPEED,
      damage: ENEMY_RANGED_DAMAGE,
      radius: ENEMY_RANGED_RADIUS,
      exp: EXP_PER_KILL + 10,
    },
    boss: {
      hp: ENEMY_BOSS_HP,
      speed: ENEMY_BOSS_SPEED,
      damage: ENEMY_BOSS_DAMAGE,
      radius: ENEMY_BOSS_RADIUS,
      exp: 150,
    },
    elite_boss: {
      hp: ENEMY_ELITE_BOSS_HP,
      speed: ENEMY_ELITE_BOSS_SPEED,
      damage: ENEMY_ELITE_BOSS_DAMAGE,
      radius: ENEMY_ELITE_BOSS_RADIUS,
      exp: 80,
    },
    healer: {
      hp: ENEMY_HEALER_HP,
      speed: ENEMY_HEALER_SPEED,
      damage: ENEMY_HEALER_DAMAGE,
      radius: ENEMY_HEALER_RADIUS,
      exp: EXP_PER_KILL + 15,
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
    this.baseSpeed = cfg.speed;
    this.damage = cfg.damage;
    this.radius = cfg.radius;
    this.expReward = cfg.exp;

    this.gfx = scene.add.graphics();
    this.draw();
  }

  // -------------------------------------------------------
  // 追踪 / 保距 AI
  // -------------------------------------------------------
  update(delta: number, playerX: number, playerY: number, time: number): void {
    if (!this.alive) return;

    const dt = delta / 1000;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
    const angle = Math.atan2(playerY - this.y, playerX - this.x);

    if (this.type === "ranged") {
      // 远程敌人：保持 180~250px 距离
      const idealDist = (ENEMY_RANGED_ATTACK_RANGE * 0.75 + ENEMY_RANGED_ATTACK_RANGE) / 2;
      if (dist < ENEMY_RANGED_ATTACK_RANGE * 0.7) {
        // 太近 → 远离玩家
        this.x -= Math.cos(angle) * this.speed * dt;
        this.y -= Math.sin(angle) * this.speed * dt;
      } else if (dist > ENEMY_RANGED_ATTACK_RANGE * 0.95) {
        // 太远 → 靠近玩家
        this.x += Math.cos(angle) * this.speed * dt;
        this.y += Math.sin(angle) * this.speed * dt;
      }
      // 保持在边界内
      this.clampToBounds();

      // 进入攻击范围 → 发射子弹
      if (dist <= ENEMY_RANGED_ATTACK_RANGE) {
        this.tryRangedAttack(time, playerX, playerY);
      }
    } else if (this.type === "boss" || this.type === "elite_boss") {
      // Boss 狂暴检测
      const hpRatio = this.hp / this.maxHp;
      if (this.type === "boss" && hpRatio <= ENEMY_BOSS_ENRAGE_THRESHOLD && !this.enraged) {
        this.enraged = true;
        this.speed = ENEMY_BOSS_ENRAGE_SPEED;
      }
      // Boss 追踪玩家
      this.x += Math.cos(angle) * this.speed * dt;
      this.y += Math.sin(angle) * this.speed * dt;
    } else {
      // normal / fast 直接追踪
      this.x += Math.cos(angle) * this.speed * dt;
      this.y += Math.sin(angle) * this.speed * dt;
    }

    // 更新远程子弹
    this.updateRangedBullets(delta);

    this.draw();
  }

  // -------------------------------------------------------
  // 远程攻击
  // -------------------------------------------------------
  private tryRangedAttack(time: number, playerX: number, playerY: number): void {
    if (time - this.lastRangedAttackTime < ENEMY_RANGED_ATTACK_COOLDOWN * 1000) return;
    this.lastRangedAttackTime = time;

    const angle = Math.atan2(playerY - this.y, playerX - this.x);
    const bullet: EnemyBullet = {
      x: this.x,
      y: this.y,
      vx: Math.cos(angle) * ENEMY_RANGED_BULLET_SPEED,
      vy: Math.sin(angle) * ENEMY_RANGED_BULLET_SPEED,
      radius: 5,
      damage: this.damage,
      alive: true,
      sprite: this.scene.add.graphics(),
    };
    this.rangedBullets.push(bullet);
  }

  private updateRangedBullets(delta: number): void {
    const dt = delta / 1000;
    for (let i = this.rangedBullets.length - 1; i >= 0; i--) {
      const b = this.rangedBullets[i];
      if (!b.alive) {
        b.sprite.destroy();
        this.rangedBullets.splice(i, 1);
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // 越界销毁
      if (b.x < -20 || b.x > 820 || b.y < -20 || b.y > 620) {
        b.alive = false;
        b.sprite.destroy();
        this.rangedBullets.splice(i, 1);
        continue;
      }

      // 绘制子弹
      b.sprite.clear();
      b.sprite.fillStyle(0x3498db);
      b.sprite.fillCircle(b.x, b.y, b.radius);
      b.sprite.fillStyle(0x85c1e9);
      b.sprite.fillCircle(b.x, b.y, b.radius * 0.5);
    }
  }

  /** 标记远程子弹命中 → 销毁 */
  hitRangedBullet(index: number): void {
    if (index < 0 || index >= this.rangedBullets.length) return;
    this.rangedBullets[index].alive = false;
  }

  // -------------------------------------------------------
  // 边界限制
  // -------------------------------------------------------
  private clampToBounds(): void {
    this.x = Phaser.Math.Clamp(this.x, 20, 780);
    this.y = Phaser.Math.Clamp(this.y, 20, 580);
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
      case "ranged": {
        // 蓝色菱形 + 触角
        const halfW = r * 0.9;
        const halfH = r * 1.2;
        gfx.fillStyle(0x3498db);
        gfx.fillPoints([
          { x: x, y: y - halfH },         // 上
          { x: x + halfW, y: y },          // 右
          { x: x, y: y + halfH },          // 下
          { x: x - halfW, y: y },          // 左
        ], true);
        // 触角
        gfx.lineStyle(1.5, 0x2980b9);
        gfx.beginPath();
        gfx.moveTo(x - halfW * 0.5, y - halfH * 0.3);
        gfx.lineTo(x - halfW * 0.9, y - halfH * 0.9);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(x + halfW * 0.5, y - halfH * 0.3);
        gfx.lineTo(x + halfW * 0.9, y - halfH * 0.9);
        gfx.strokePath();
        // 触角圆点
        gfx.fillStyle(0x85c1e9);
        gfx.fillCircle(x - halfW * 0.9, y - halfH * 0.9, r * 0.2);
        gfx.fillCircle(x + halfW * 0.9, y - halfH * 0.9, r * 0.2);
        // 眼睛
        gfx.fillStyle(0xffffff);
        gfx.fillCircle(x - halfW * 0.35, y - halfH * 0.1, r * 0.22);
        gfx.fillCircle(x + halfW * 0.35, y - halfH * 0.1, r * 0.22);
        gfx.fillStyle(0x111111);
        gfx.fillCircle(x - halfW * 0.35, y - halfH * 0.1, r * 0.12);
        gfx.fillCircle(x + halfW * 0.35, y - halfH * 0.1, r * 0.12);
        break;
      }
      case "healer": {
        // 绿色十字形治疗小怪
        gfx.fillStyle(0x2ecc71);
        gfx.fillRect(x - r * 0.4, y - r, r * 0.8, r * 2); // 竖
        gfx.fillRect(x - r, y - r * 0.4, r * 2, r * 0.8); // 横
        // 白色十字中心圆
        gfx.fillStyle(0xffffff);
        gfx.fillCircle(x, y, r * 0.35);
        // 绿色加号标识
        gfx.fillStyle(0x27ae60);
        gfx.fillRect(x - r * 0.15, y - r * 0.5, r * 0.3, r);
        gfx.fillRect(x - r * 0.5, y - r * 0.15, r, r * 0.3);
        // 眼睛
        gfx.fillStyle(0xffffff);
        gfx.fillCircle(x - r * 0.3, y - r * 0.1, r * 0.18);
        gfx.fillCircle(x + r * 0.3, y - r * 0.1, r * 0.18);
        gfx.fillStyle(0x111111);
        gfx.fillCircle(x - r * 0.3, y - r * 0.1, r * 0.1);
        gfx.fillCircle(x + r * 0.3, y - r * 0.1, r * 0.1);
        break;
      }
      case "elite_boss": {
        // 精英Boss：紫色方块（比最终Boss小）
        gfx.fillStyle(0x9b59b6);
        gfx.fillRect(x - r, y - r, r * 2, r * 2);
        gfx.lineStyle(2, 0xc39bdb);
        gfx.strokeRect(x - r, y - r, r * 2, r * 2);
        gfx.fillStyle(0xffffff);
        gfx.fillCircle(x - r * 0.45, y - r * 0.2, r * 0.28);
        gfx.fillCircle(x + r * 0.45, y - r * 0.2, r * 0.28);
        gfx.fillStyle(0x111111);
        gfx.fillCircle(x - r * 0.45, y - r * 0.2, r * 0.15);
        gfx.fillCircle(x + r * 0.45, y - r * 0.2, r * 0.15);
        gfx.lineStyle(2, 0x111111);
        gfx.beginPath();
        gfx.moveTo(x - r * 0.4, y + r * 0.35);
        gfx.lineTo(x, y + r * 0.2);
        gfx.lineTo(x + r * 0.4, y + r * 0.35);
        gfx.strokePath();
        // 精英标识：头顶小皇冠
        gfx.fillStyle(0xf1c40f);
        gfx.fillTriangle(
          x - r * 0.25, y - r * 1.2,
          x + r * 0.25, y - r * 1.2,
          x, y - r * 1.5,
        );
        break;
      }
      case "boss": {
        // 紫色大方块 — 最终Boss
        gfx.fillStyle(0x8e44ad);
        gfx.fillRect(x - r, y - r, r * 2, r * 2);
        // 狂暴时边框变红
        if (this.enraged) {
          gfx.lineStyle(3, 0xe74c3c);
        } else {
          gfx.lineStyle(2, 0xbb66ff);
        }
        gfx.strokeRect(x - r, y - r, r * 2, r * 2);
        // 眼睛（狂暴时变红）
        gfx.fillStyle(this.enraged ? 0xe74c3c : 0xffffff);
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
        // 狂暴标识：头顶火焰
        if (this.enraged) {
          gfx.fillStyle(0xe74c3c);
          gfx.fillTriangle(
            x - r * 0.3, y - r * 1.2,
            x + r * 0.3, y - r * 1.2,
            x, y - r * 1.7,
          );
          gfx.fillStyle(0xf39c12);
          gfx.fillTriangle(
            x - r * 0.15, y - r * 1.2,
            x + r * 0.15, y - r * 1.2,
            x, y - r * 1.5,
          );
        }
        break;
      }
    }

    // HP 条（在头顶）
    const isBossType = this.type === "boss" || this.type === "elite_boss";
    if (isBossType || this.hp < this.maxHp) {
      const barW = isBossType ? 50 : 24;
      const barH = 4;
      const barY = y - this.radius - (isBossType ? 14 : 10);
      gfx.fillStyle(0x333333);
      gfx.fillRect(x - barW / 2, barY, barW, barH);
      const ratio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
      const color = this.enraged ? 0xe74c3c : (this.type === "elite_boss" ? 0xc39bdb : 0xbb66ff);
      gfx.fillStyle(color);
      gfx.fillRect(x - barW / 2, barY, barW * ratio, barH);
    }
  }

  destroy(): void {
    // 销毁所有远程子弹
    for (const b of this.rangedBullets) {
      b.sprite.destroy();
    }
    this.rangedBullets = [];
    this.gfx.destroy();
  }
}
