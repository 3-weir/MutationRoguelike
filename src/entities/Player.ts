import Phaser from "phaser";
import {
  PLAYER_SPEED,
  PLAYER_HP,
  PLAYER_DAMAGE,
  PLAYER_ATTACK_COOLDOWN,
  PLAYER_RADIUS,
  EXP_TO_LEVEL,
} from "../config";
import { Bullet } from "./Bullet";
import { EvolutionOption } from "../data/evolutions";

export class Player {
  public x: number;
  public y: number;
  public radius: number = PLAYER_RADIUS;

  public hp: number = PLAYER_HP;
  public maxHp: number = PLAYER_HP;
  public exp: number = 0;
  public expToNext: number = EXP_TO_LEVEL;
  public level: number = 1;

  public damage: number = PLAYER_DAMAGE;
  public speed: number = PLAYER_SPEED;
  public attackCooldown: number = PLAYER_ATTACK_COOLDOWN;
  public sizeMultiplier: number = 1;

  // 进化相关
  public evolutionLog: EvolutionOption[] = [];
  public visualParts: string[] = [];
  public dodgeChance = 0;
  public critChance = 0;
  public critMultiplier = 2;
  public bulletSpeedMultiplier = 1;

  // 副作用
  public hasAutoFire = false;
  public stunInterval = 0; // 秒

  // 内部状态
  private autoFireTimer = 0;
  private stunTimer = 0;
  public isStunned = false;

  private bodyGfx: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  private lastAttackTime = 0;

  private cursors!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private bulletGroup: Phaser.GameObjects.Group;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletGroup: Phaser.GameObjects.Group,
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.bulletGroup = bulletGroup;

    this.bodyGfx = scene.add.graphics();
    this.drawBody();

    if (scene.input.keyboard) {
      this.cursors = {
        W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }
  }

  // -------------------------------------------------------
  // 主 update
  // -------------------------------------------------------
  update(delta: number, time: number): void {
    // 眩晕检查
    if (this.stunInterval > 0) {
      this.stunTimer += delta;
      if (this.stunTimer >= this.stunInterval * 1000) {
        this.stunTimer -= this.stunInterval * 1000;
        this.isStunned = true;
        this.scene.time.delayedCall(800, () => {
          this.isStunned = false;
        });
      }
    }

    // 移动（眩晕时不可移动）
    if (!this.isStunned) {
      this.doMovement(delta);
    }

    this.drawBody();
  }

  // -------------------------------------------------------
  // 移动
  // -------------------------------------------------------
  private doMovement(delta: number): void {
    let dx = 0;
    let dy = 0;
    if (this.cursors.W.isDown) dy -= 1;
    if (this.cursors.S.isDown) dy += 1;
    if (this.cursors.A.isDown) dx -= 1;
    if (this.cursors.D.isDown) dx += 1;

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    const dt = delta / 1000;
    this.x += dx * this.speed * dt;
    this.y += dy * this.speed * dt;

    const r = this.radius * this.sizeMultiplier;
    this.x = Phaser.Math.Clamp(this.x, r, 800 - r);
    this.y = Phaser.Math.Clamp(this.y, r, 600 - r);
  }

  // -------------------------------------------------------
  // 攻击
  // -------------------------------------------------------
  tryAttack(targetX: number, targetY: number, time: number): Bullet | null {
    if (this.isStunned) return null;
    if (time - this.lastAttackTime < this.attackCooldown * 1000) {
      return null;
    }
    this.lastAttackTime = time;
    return this.fireBullet(Math.atan2(targetY - this.y, targetX - this.x));
  }

  /** 自动走火 */
  tryAutoFire(time: number): Bullet | null {
    if (!this.hasAutoFire) return null;
    if (this.isStunned) return null;

    this.autoFireTimer += 1000 / 60;
    if (this.autoFireTimer < 8000) return null;
    this.autoFireTimer = 0;

    const angle = Math.random() * Math.PI * 2;
    return this.fireBullet(angle);
  }

  private fireBullet(angle: number): Bullet {
    const bullet = new Bullet(this.scene, this.x, this.y, angle, this.bulletSpeedMultiplier);
    this.bulletGroup.add(bullet.sprite);
    return bullet;
  }

  // -------------------------------------------------------
  // 受伤（返回 true 表示闪避了）
  // -------------------------------------------------------
  takeDamage(amount: number): boolean {
    if (Math.random() < this.dodgeChance) {
      return true; // 闪避
    }
    this.hp -= amount;
    if (this.hp < 0) this.hp = 0;
    return false;
  }

  // -------------------------------------------------------
  // 暴击判定
  // -------------------------------------------------------
  rollCrit(): number {
    if (Math.random() < this.critChance) {
      return Math.floor(this.damage * this.critMultiplier);
    }
    return this.damage;
  }

  // -------------------------------------------------------
  // 经验
  // -------------------------------------------------------
  gainExp(amount: number): boolean {
    this.exp += amount;
    if (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.expToNext = Math.floor(this.expToNext * 1.5);
      this.level++;
      return true;
    }
    return false;
  }

  // -------------------------------------------------------
  // 应用进化
  // -------------------------------------------------------
  applyEvolution(option: EvolutionOption): void {
    this.evolutionLog.push(option);

    // buff
    const b = option.buff;
    if (b.damage) this.damage += b.damage;
    if (b.speed) this.speed = Math.round(this.speed * b.speed);
    if (b.attackCooldown) this.attackCooldown *= b.attackCooldown;
    if (b.dodgeChance) this.dodgeChance += b.dodgeChance;
    if (b.critChance) this.critChance += b.critChance;
    if (b.heal) this.hp = Math.min(this.maxHp, this.hp + b.heal);
    if (b.sizeMultiplier) this.sizeMultiplier += b.sizeMultiplier;
    if (b.bulletSpeed) this.bulletSpeedMultiplier *= b.bulletSpeed;

    // debuff
    const d = option.debuff;
    if (d.speed) this.speed = Math.round(this.speed * d.speed);
    if (d.damage) {
      this.damage += d.damage;
      if (this.damage < 1) this.damage = 1;
    }
    if (d.attackCooldown) this.attackCooldown *= d.attackCooldown;
    if (d.sizeMultiplier) this.sizeMultiplier += d.sizeMultiplier;
    if (d.autoFire) this.hasAutoFire = true;
    if (d.stunInterval) this.stunInterval = d.stunInterval;
    if (d.bulletVanish) {
      // bulletVanish is handled in Bullet or GameScene
    }

    // 视觉部件
    this.visualParts.push(...option.visualParts);
  }

  // -------------------------------------------------------
  // 绘制身体（火柴人 + 可变部件）
  // -------------------------------------------------------
  private drawBody(): void {
    const gfx = this.bodyGfx;
    gfx.clear();

    const r = this.radius * this.sizeMultiplier;
    const x = this.x;
    const y = this.y;

    // -- 眩晕闪烁 --
    if (this.isStunned) {
      const alpha = 0.3 + Math.sin(Date.now() * 0.01) * 0.3;
      // 外面会重新设置不透明度，所以这里直接跳过绘制部分
    }

    // -- 身体颜色（有 green_skin 变绿色） --
    const bodyColor = this.visualParts.includes("green_skin") ? 0x44cc44 : 0x4488ff;
    gfx.fillStyle(bodyColor, 1);
    gfx.fillCircle(x, y, r);

    // 白色高光
    gfx.fillStyle(0xffffff, 0.3);
    gfx.fillCircle(x - r * 0.3, y - r * 0.35, r * 0.3);

    // -- 眼睛（big_eyes 时变大） --
    const bigEyes = this.visualParts.includes("big_eyes");
    const eyeOffX = r * 0.35;
    const eyeOffY = r * 0.1;
    const eyeR = r * (bigEyes ? 0.38 : 0.22);
    const pupilR = eyeR * 0.55;

    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(x - eyeOffX, y - eyeOffY, eyeR);
    gfx.fillCircle(x + eyeOffX, y - eyeOffY, eyeR);
    gfx.fillStyle(0x111111, 1);
    gfx.fillCircle(x - eyeOffX, y - eyeOffY, pupilR);
    gfx.fillCircle(x + eyeOffX, y - eyeOffY, pupilR);

    // -- 手臂（muscle_arm 时加粗） --
    const muscleArm = this.visualParts.includes("muscle_arm");
    const armThickness = muscleArm ? 6 : 3;
    gfx.lineStyle(armThickness, 0x333333);
    const armLen = r * 0.9;
    gfx.lineBetween(x - r * 0.7, y, x - r * 0.7 - armLen * 0.6, y + armLen * 0.7);
    gfx.lineBetween(x + r * 0.7, y, x + r * 0.7 + armLen * 0.6, y + armLen * 0.7);

    // -- 腿（zigzag_legs 时画锯齿状） --
    const zigzag = this.visualParts.includes("zigzag_legs");
    const legThickness = zigzag ? 4 : 3.5;
    gfx.lineStyle(legThickness, zigzag ? 0xff8800 : 0x333333);
    const legLen = r * 1.05;
    if (zigzag) {
      // 左腿锯齿
      this.drawZigzagLine(gfx, x - r * 0.35, y + r, x - r * 0.35, y + r + legLen, 2);
      // 右腿锯齿
      this.drawZigzagLine(gfx, x + r * 0.35, y + r, x + r * 0.35, y + r + legLen, 2);
    } else {
      gfx.lineBetween(x - r * 0.35, y + r, x - r * 0.35, y + r + legLen);
      gfx.lineBetween(x + r * 0.35, y + r, x + r * 0.35, y + r + legLen);
    }

    // -- 火焰光环 --
    if (this.visualParts.includes("flame_aura")) {
      const flicker = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
      gfx.lineStyle(3, 0xff6600, flicker * 0.6);
      gfx.strokeCircle(x, y, r + 8);
      gfx.lineStyle(2, 0xffaa00, flicker * 0.4);
      gfx.strokeCircle(x, y, r + 5);
    }

    // -- 鱼鳍 --
    if (this.visualParts.includes("fish_fin")) {
      gfx.fillStyle(0x44ccff, 0.7);
      const fx = x - r * 0.5;
      const fy = y - r * 1.1;
      gfx.fillTriangle(
        fx, fy,
        fx - r * 0.7, fy + r * 0.5,
        fx + r * 0.3, fy + r * 0.5,
      );
    }

    // -- 黑洞光环 --
    if (this.visualParts.includes("black_hole_aura")) {
      const pulse = Math.sin(Date.now() * 0.003) * 0.2 + 0.5;
      gfx.lineStyle(2, 0x8844cc, pulse);
      gfx.strokeCircle(x, y, r + 12);
    }

    // -- 随机光芒 --
    if (this.visualParts.includes("random_glow")) {
      const hue = (Date.now() * 0.05) % 360;
      gfx.fillStyle(Phaser.Display.Color.HSLToColor(hue / 360, 0.8, 0.6).color, 0.15);
      gfx.fillCircle(x, y, r * 2);
    }

    // -- 克隆回声 --
    if (this.visualParts.includes("clone_echo")) {
      const echoOffset = 16;
      gfx.lineStyle(2, 0x888888, 0.3);
      gfx.strokeCircle(x + echoOffset, y + echoOffset * 0.5, r * 0.9);
      gfx.strokeCircle(x - echoOffset, y - echoOffset * 0.5, r * 0.85);
    }

    // -- 眩晕覆盖层 --
    if (this.isStunned) {
      gfx.fillStyle(0xffffff, 0.25);
      gfx.fillCircle(x, y, r * 1.5);
      // 星星
      gfx.lineStyle(1, 0xffff00, 0.8);
      const starAngles = [0, 72, 144, 216, 288].map((a) => (Math.PI / 180) * (a - 90));
      for (let i = 0; i < 5; i++) {
        const sx = x + Math.cos(starAngles[i]) * r * 1.3;
        const sy = y + Math.sin(starAngles[i]) * r * 1.3;
        const ex = x + Math.cos(starAngles[(i + 2) % 5]) * r * 1.3;
        gfx.lineBetween(sx, sy, ex, sy);
      }
    }
  }

  private drawZigzagLine(
    gfx: Phaser.GameObjects.Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
    zigCount: number,
  ): void {
    const segLenY = (y2 - y1) / (zigCount * 2);
    let cy = y1;
    for (let i = 0; i < zigCount * 2; i++) {
      const nextY = y1 + segLenY * (i + 1);
      const xOff = (i % 2 === 0 ? 6 : -6);
      gfx.lineBetween(x1 + xOff, cy, x1 + xOff, nextY);
      cy = nextY;
    }
  }

  /** 从存档数据恢复 Player 状态 */
  restoreFromData(data: Record<string, unknown>): void {
    if (typeof data.level === "number") this.level = data.level;
    if (typeof data.hp === "number") { this.hp = data.hp; this.maxHp = data.hp; }
    if (typeof data.maxHp === "number") this.maxHp = data.maxHp;
    if (typeof data.exp === "number") this.exp = data.exp;
    if (typeof data.expToNext === "number") this.expToNext = data.expToNext;
    if (typeof data.damage === "number") this.damage = data.damage;
    if (typeof data.speed === "number") this.speed = data.speed;
    if (typeof data.attackCooldown === "number") this.attackCooldown = data.attackCooldown;
    if (typeof data.sizeMultiplier === "number") this.sizeMultiplier = data.sizeMultiplier;
    if (typeof data.dodgeChance === "number") this.dodgeChance = data.dodgeChance;
    if (typeof data.critChance === "number") this.critChance = data.critChance;
    if (typeof data.critMultiplier === "number") this.critMultiplier = data.critMultiplier;
    if (typeof data.bulletSpeedMultiplier === "number") this.bulletSpeedMultiplier = data.bulletSpeedMultiplier;
    if (typeof data.hasAutoFire === "boolean") this.hasAutoFire = data.hasAutoFire;
    if (typeof data.stunInterval === "number") this.stunInterval = data.stunInterval;

    if (Array.isArray(data.visualParts)) {
      this.visualParts = data.visualParts as string[];
    }
    if (Array.isArray(data.evolutionLog)) {
      this.evolutionLog = data.evolutionLog as Player["evolutionLog"];
    }
  }

  destroy(): void {
    this.bodyGfx.destroy();
  }
}
