import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, LEVEL_CONFIGS, TOTAL_LEVELS, EnemyType } from "../config";
import { playerNickname, currentSlot } from "../main";
import { Player } from "../entities/Player";
import { Bullet } from "../entities/Bullet";
import { Enemy, EnemyBullet } from "../entities/Enemy";
import { EvolutionSystem } from "../systems/EvolutionSystem";
import { ALL_EVOLUTIONS } from "../data/evolutions";
import { saveGame } from "../api/supabase";

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private bullets: Bullet[] = [];
  private bulletGroup!: Phaser.GameObjects.Group;

  private enemies: Enemy[] = [];

  private spawnZones: { x: number; y: number }[] = [
    { x: 120, y: 100 },  { x: 680, y: 100 },
    { x: 120, y: 500 },  { x: 680, y: 500 },
    { x: 400, y: 80 },   { x: 400, y: 520 },
    { x: 80, y: 300 },   { x: 720, y: 300 },
  ];

  private hpBarBg!: Phaser.GameObjects.Graphics;
  private expBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private expBarFill!: Phaser.GameObjects.Graphics;
  private hpLabelText!: Phaser.GameObjects.Text;
  private expLabelText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private enemyCountText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private levelBannerText!: Phaser.GameObjects.Text;
  private bossHPBarBg!: Phaser.GameObjects.Graphics;
  private bossHPBarFill!: Phaser.GameObjects.Graphics;

  private isGameFrozen = false;
  private isPaused = false;
  private bulletVanishChance = 0;
  private levelUpQueue = 0;
  private _boundResume: (() => void) | null = null;
  private _boundSaveQuit: (() => Promise<void>) | null = null;

  // 关卡进度
  private currentLevel = 0; // 0-based index
  private evolutionChosenThisLevel = false;
  private levelTransitioning = false;
  private proceedingToNext = false; // 防重入标志

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    const gfx = this.add.graphics();
    gfx.lineStyle(2, 0x666666);
    gfx.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add
      .text(12, 10, `🔬 实验员：${playerNickname}`, {
        fontSize: "13px", color: "#7dd3fc",
        fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
      });

    this.bulletGroup = this.add.group();
    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, this.bulletGroup);

    // ---- 检查是否有存档需要恢复 ----
    const saveData = (window as any).__saveData as import("../api/supabase").SaveSlot | undefined;
    let startingLevel = 0;

    if (saveData && saveData.player_data && Object.keys(saveData.player_data as Record<string, unknown>).length > 0) {
      const pd = saveData.player_data as Record<string, unknown>;
      this.player.restoreFromData(pd);
      if (typeof pd.bulletVanishChance === "number") {
        this.bulletVanishChance = pd.bulletVanishChance;
      }
      startingLevel = saveData.level;
    }

    // 消费标记，防止重复恢复
    delete (window as any).__saveData;
    // ---- 恢复结束 ----

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // 检查是否点在了 UI 面板上（暂停面板 / 进化面板）
      const pauseScreen = document.getElementById("pause-screen");
      const evoOverlay = document.getElementById("evolution-overlay");
      const targetElem = document.elementFromPoint(pointer.x, pointer.y) as HTMLElement | null;
      const clickedUI =
        (pauseScreen?.classList.contains("show") && targetElem && pauseScreen.contains(targetElem)) ||
        (evoOverlay?.classList.contains("show") && targetElem && evoOverlay.contains(targetElem));

      if (this.isGameFrozen || this.isPaused || clickedUI) return;

      const bullet = this.player.tryAttack(pointer.x, pointer.y, this.time.now);
      if (bullet) {
        bullet.tryVanish(this.bulletVanishChance);
        this.bullets.push(bullet);
      }
    });

    // ESC 暂停
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.isPaused) {
        this.resumeGame();
      } else {
        this.togglePause();
      }
    });

    // 暂停面板按钮（绑定到实例方法，避免匿名函数泄漏）
    this._boundResume = () => this.resumeGame();
    this._boundSaveQuit = () => this.handleSaveAndQuit();
    document.getElementById("btn-resume")?.addEventListener("click", this._boundResume);
    document.getElementById("btn-save-quit")?.addEventListener("click", this._boundSaveQuit);

    this.hpBarBg = this.add.graphics();
    this.expBarBg = this.add.graphics();
    this.hpBarFill = this.add.graphics();
    this.expBarFill = this.add.graphics();
    this.bossHPBarBg = this.add.graphics();
    this.bossHPBarFill = this.add.graphics();

    // HP 文字标签（血条左侧）
    this.hpLabelText = this.add
      .text(GAME_WIDTH - 180, 10, "", {
        fontSize: "12px", color: "#ffffff",
        fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
      });

    // EXP 文字标签（经验条左侧）
    this.expLabelText = this.add
      .text(GAME_WIDTH - 180, 30, "", {
        fontSize: "12px", color: "#7dd3fc",
        fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
      });

    // 关卡横幅文字
    this.levelBannerText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "", {
        fontSize: "28px", color: "#7dd3fc", align: "center",
        fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
        backgroundColor: "rgba(0,0,0,0.85)",
        padding: { x: 32, y: 16 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.enemyCountText = this.add
      .text(12, 34, "", {
        fontSize: "13px", color: "#e74c3c",
        fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
      });

    this.levelText = this.add
      .text(12, 50, "", {
        fontSize: "13px", color: "#f1c40f",
        fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
      });

    this.infoText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 24, "WASD 移动  |  鼠标点击 攻击  |  按ESC暂停", {
        fontSize: "12px", color: "#666666", align: "center",
        fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
      })
      .setOrigin(0.5);

    // 监听进化选择（先移除旧 Scene 残留的 handler，防止泄漏）
    const oldHandler = (window as any).__evoHandler as ((e: Event) => void) | undefined;
    if (oldHandler) {
      window.removeEventListener("choose-evolution", oldHandler);
    }
    (window as any).__evoHandler = this.onEvolutionChosen;
    window.addEventListener("choose-evolution", this.onEvolutionChosen);

    // Scene 销毁时清理
    this.events.on("shutdown", () => {
      window.removeEventListener("choose-evolution", this.onEvolutionChosen);
      (window as any).__evoHandler = undefined;
      if (this._boundResume) {
        document.getElementById("btn-resume")?.removeEventListener("click", this._boundResume);
      }
      if (this._boundSaveQuit) {
        document.getElementById("btn-save-quit")?.removeEventListener("click", this._boundSaveQuit);
      }
    });

    // 启动关卡（可能是恢复的关卡）
    this.startLevel(startingLevel);
  }

  // ========================================================
  // 关卡系统
  // ========================================================

  private startLevel(levelIndex: number): void {
    this.currentLevel = levelIndex;
    this.evolutionChosenThisLevel = false;
    this.levelTransitioning = true;

    // 进入关卡时存档当前关卡（死亡后读档从此关重来）
    this.autoSaveAtLevel(levelIndex);

    const cfg = LEVEL_CONFIGS[levelIndex];

    // 显示关卡横幅
    this.showLevelBanner(`第 ${cfg.id} 关：${cfg.name}`);

    // 延迟刷怪（等横幅动画结束）
    this.time.delayedCall(1800, () => {
      this.levelTransitioning = false;
      this.spawnWave(cfg);
    });
  }

  private showLevelBanner(text: string): void {
    this.levelBannerText.setText(text);
    this.levelBannerText.setAlpha(1);

    // 淡出动画
    this.tweens.add({
      targets: this.levelBannerText,
      alpha: 0,
      delay: 1200,
      duration: 600,
    });
  }

  private spawnWave(cfg: { id: number; name: string; enemies: { type: EnemyType; count: number }[] }): void {
    for (const group of cfg.enemies) {
      this.spawnEnemies(group.type, group.count);
    }
  }

  private spawnEnemies(type: EnemyType, count: number): void {
    for (let i = 0; i < count; i++) {
      const zone = this.spawnZones[Math.floor(Math.random() * this.spawnZones.length)];
      const offX = (Math.random() - 0.5) * 60;
      const offY = (Math.random() - 0.5) * 60;
      this.enemies.push(new Enemy(this, zone.x + offX, zone.y + offY, type));
    }
  }

  /** 检查当前关卡是否全部击杀 */
  private isLevelCleared(): boolean {
    return this.enemies.length === 0 || this.enemies.every((e) => !e.alive);
  }

  /** 进入下一关或通关 */
  private proceedToNextLevel(): void {
    if (this.proceedingToNext) return; // 防重入
    this.proceedingToNext = true;

    const nextIndex = this.currentLevel + 1;
    if (nextIndex >= TOTAL_LEVELS) {
      // 全部通关 → 触发结算
      this.onGameComplete();
      return;
    }

    // 清除旧敌人
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies = [];
    // 清除孤儿子弹
    for (const b of this.orphanRangedBullets) {
      b.alive = false;
      b.sprite.destroy();
    }
    this.orphanRangedBullets = [];

    this.startLevel(nextIndex);
  }

  // ========================================================
  // update
  // ========================================================

  update(_time: number, delta: number): void {
    if (this.isGameFrozen) return;

    // 关卡过渡中：不处理逻辑，只画 HUD
    if (this.levelTransitioning) {
      this.drawHUD();
      return;
    }

    // 玩家
    this.player.update(delta, this.time.now);

    // 自动走火
    const autoBullet = this.player.tryAutoFire(this.time.now);
    if (autoBullet) {
      autoBullet.tryVanish(this.bulletVanishChance);
      this.bullets.push(autoBullet);
    }

    // 子弹更新 + 越界 / 消失
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(delta);
      if (b.isOutOfBounds() || b.vanished) {
        b.destroy();
        this.bullets.splice(i, 1);
      }
    }

    // 敌人更新 + 碰撞
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.update(delta, this.player.x, this.player.y, this.time.now);

      if (
        enemy.collidesWith(this.player.x, this.player.y, this.player.radius * this.player.sizeMultiplier) &&
        enemy.canAttack(this.time.now)
      ) {
        enemy.markAttacked(this.time.now);
        const dodged = this.player.takeDamage(enemy.damage);
        if (!dodged && this.player.hp <= 0) {
          this.onPlayerDeath();
          return;
        }
      }
    }

    // 远程敌人子弹 vs 玩家碰撞
    this.checkEnemyBulletPlayerCollisions();

    this.checkBulletEnemyCollisions();
    this.cleanupDeadEnemies();
    this.drawHUD();

    // 升级触发
    if (this.levelUpQueue > 0) {
      this.levelUpQueue--;
      this.triggerEvolutionPanel();
    }

    // 本关敌人全部死亡 && 没有飞行中的远程子弹（包括孤儿） → 进入下一关
    const hasActiveRangedBullets =
      this.enemies.some((e) => e.alive && e.rangedBullets.length > 0) ||
      this.orphanRangedBullets.length > 0;
    if (this.isLevelCleared() && !hasActiveRangedBullets && !this.proceedingToNext) {
      this.proceedToNextLevel();
    }
  }

  private checkBulletEnemyCollisions(): void {
    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const bullet = this.bullets[bi];
      if (!bullet.sprite.active) continue;

      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;

        if (enemy.collidesWith(bullet.x, bullet.y, bullet.radius)) {
          const dmg = this.player.rollCrit();
          const dead = enemy.takeDamage(dmg);
          bullet.destroy();
          this.bullets.splice(bi, 1);

          if (dead) {
            // 治疗小怪被击杀 → 回复玩家 HP
            if (enemy.type === "healer") {
              const healAmount = 20;
              this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
              // 显示回血特效文字
              const healText = this.add
                .text(enemy.x, enemy.y - 20, `+${healAmount} HP`, {
                  fontSize: "14px", color: "#2ecc71",
                  fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
                  stroke: "#000000", strokeThickness: 3,
                })
                .setOrigin(0.5);
              this.tweens.add({
                targets: healText,
                alpha: 0,
                y: healText.y - 40,
                duration: 1200,
                onComplete: () => healText.destroy(),
              });
            }

            const leveledUp = this.player.gainExp(enemy.expReward);
            if (leveledUp) {
              this.levelUpQueue++;
            }
          }
          break;
        }
      }
    }
  }

  // -------------------------------------------------------
  // 远程敌人子弹 × 玩家（含孤儿子弹）
  // -------------------------------------------------------
  private checkEnemyBulletPlayerCollisions(): void {
    const playerR = this.player.radius * this.player.sizeMultiplier;

    // 活着的敌人的子弹
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.rangedBullets.length === 0) continue;
      for (let i = enemy.rangedBullets.length - 1; i >= 0; i--) {
        const eb = enemy.rangedBullets[i];
        if (!eb.alive) continue;
        const dist = Phaser.Math.Distance.Between(eb.x, eb.y, this.player.x, this.player.y);
        if (dist < eb.radius + playerR) {
          enemy.hitRangedBullet(i);
          const dodged = this.player.takeDamage(eb.damage);
          if (!dodged && this.player.hp <= 0) {
            this.onPlayerDeath();
            return;
          }
        }
      }
    }

    // 孤儿子弹（敌人死后仍在飞的子弹）
    for (let i = this.orphanRangedBullets.length - 1; i >= 0; i--) {
      const eb = this.orphanRangedBullets[i];
      if (!eb.alive) {
        eb.sprite.destroy();
        this.orphanRangedBullets.splice(i, 1);
        continue;
      }
      const dist = Phaser.Math.Distance.Between(eb.x, eb.y, this.player.x, this.player.y);
      if (dist < eb.radius + playerR) {
        eb.alive = false;
        eb.sprite.destroy();
        this.orphanRangedBullets.splice(i, 1);
        const dodged = this.player.takeDamage(eb.damage);
        if (!dodged && this.player.hp <= 0) {
          this.onPlayerDeath();
          return;
        }
      }
    }
  }

  // -------------------------------------------------------
  // 清理死亡敌人 + 孤儿远程子弹
  // -------------------------------------------------------
  /** 远程敌人死后，其飞行中的子弹会变成"孤儿"，需要单独追踪 */
  private orphanRangedBullets: { x: number; y: number; vx: number; vy: number; radius: number; damage: number; alive: boolean; sprite: Phaser.GameObjects.Graphics }[] = [];

  private cleanupDeadEnemies(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.alive) {
        // 将远程敌人飞行中的子弹转成"孤儿"，继续追踪碰撞
        for (const b of enemy.rangedBullets) {
          if (b.alive) {
            this.orphanRangedBullets.push(b);
          } else {
            b.sprite.destroy();
          }
        }
        enemy.rangedBullets = []; // 防止 destroy() 重复清理
        enemy.destroy();
        this.enemies.splice(i, 1);
      }
    }

    // 更新孤儿远程子弹（越界销毁）
    for (let i = this.orphanRangedBullets.length - 1; i >= 0; i--) {
      const b = this.orphanRangedBullets[i];
      if (!b.alive) {
        b.sprite.destroy();
        this.orphanRangedBullets.splice(i, 1);
        continue;
      }
      // 孤儿没有 enemy.update 驱动，手动推进位置（近似 60fps）
      b.x += b.vx * (1 / 60);
      b.y += b.vy * (1 / 60);
      if (b.x < -20 || b.x > 820 || b.y < -20 || b.y > 620) {
        b.alive = false;
        b.sprite.destroy();
        this.orphanRangedBullets.splice(i, 1);
        continue;
      }
      b.sprite.clear();
      b.sprite.fillStyle(0x3498db);
      b.sprite.fillCircle(b.x, b.y, b.radius);
      b.sprite.fillStyle(0x85c1e9);
      b.sprite.fillCircle(b.x, b.y, b.radius * 0.5);
    }
  }

  // -------------------------------------------------------
  // 进化面板
  // -------------------------------------------------------
  private triggerEvolutionPanel(): void {
    this.isGameFrozen = true;
    const options = EvolutionSystem.pickThree();

    window.dispatchEvent(
      new CustomEvent("show-evolution", { detail: { options } }),
    );
  }

  private onEvolutionChosen = ((e: Event) => {
    const detail = (e as CustomEvent).detail as { id: string };
    const option = ALL_EVOLUTIONS.find((o) => o.id === detail.id);
    if (!option) return;

    // 标记本关已进化
    this.evolutionChosenThisLevel = true;

    // 特殊处理记忆罐头 & 混沌培养液
    let resolvedOption = { ...option };
    if (option.id === "memory" && this.player.evolutionLog.length > 0) {
      const prev = this.player.evolutionLog[this.player.evolutionLog.length - 1];
      resolvedOption = {
        ...option,
        buff: { ...prev.buff },
        debuff: {
          ...prev.debuff,
        },
        visualParts: [...option.visualParts],
      };
    }
    if (option.id === "chaos") {
      const pool = ALL_EVOLUTIONS.filter(
        (o) => o.id !== "chaos" && o.id !== "memory",
      );
      const rnd = pool[Math.floor(Math.random() * pool.length)];
      resolvedOption = {
        ...option,
        buff: { ...rnd.buff },
        debuff: { ...rnd.debuff },
        visualParts: [...option.visualParts, ...rnd.visualParts],
      };
    }

    this.player.applyEvolution(resolvedOption);

    // 更新 bulletVanishChance
    if (resolvedOption.debuff.bulletVanish) {
      this.bulletVanishChance += resolvedOption.debuff.bulletVanish;
    }
    // memory 副作用翻倍
    if (option.id === "memory" && this.player.evolutionLog.length >= 2) {
      const prev = this.player.evolutionLog[this.player.evolutionLog.length - 2];
      this.player.applyEvolution({
        id: "memory_extra",
        name: "记忆罐头（翻倍）",
        type: "experiment",
        buff: {},
        debuff: { ...prev.debuff },
        visualParts: [],
      });
    }

    window.dispatchEvent(new CustomEvent("hide-evolution"));
    this.isGameFrozen = false;
  }).bind(this);

  // -------------------------------------------------------
  // 暂停 / 存档
  // -------------------------------------------------------
  private togglePause(): void {
    if (this.isGameFrozen) return; // 进化面板中不让暂停
    this.isPaused = true;
    this.scene.pause();
    document.getElementById("pause-screen")?.classList.add("show");
  }

  private resumeGame(): void {
    this.isPaused = false;
    document.getElementById("pause-screen")?.classList.remove("show");
    this.scene.resume();
  }

  /** 将 Player 的全部状态打成可序列化对象 */
  private snapshotPlayerData(): Record<string, unknown> {
    const p = this.player;
    return {
      level: p.level,
      hp: p.hp,
      maxHp: p.maxHp,
      exp: p.exp,
      expToNext: p.expToNext,
      damage: p.damage,
      speed: p.speed,
      attackCooldown: p.attackCooldown,
      sizeMultiplier: p.sizeMultiplier,
      dodgeChance: p.dodgeChance,
      critChance: p.critChance,
      critMultiplier: p.critMultiplier,
      bulletSpeedMultiplier: p.bulletSpeedMultiplier,
      hasAutoFire: p.hasAutoFire,
      stunInterval: p.stunInterval,
      visualParts: [...p.visualParts],
      evolutionLog: p.evolutionLog.map((ev) => ({
        id: ev.id,
        name: ev.name,
        type: ev.type,
        buff: ev.buff,
        debuff: ev.debuff,
      })),
      // 副作用
      bulletVanishChance: this.bulletVanishChance,
    };
  }

  /** 存档当前关卡（读档时从此关开始）— 静默失败，不打断游戏 */
  private autoSaveAtLevel(levelIndex: number): void {
    const slot = currentSlot;
    if (!slot) return;

    const data = this.snapshotPlayerData();
    saveGame(slot.id, levelIndex, data).catch(() => {
      // 静默失败
    });
  }

  /** 保存并退出：存档当前关卡（玩家下次从此关继续） */
  private async handleSaveAndQuit(): Promise<void> {
    const slot = currentSlot;
    if (!slot) {
      window.dispatchEvent(new CustomEvent("save-and-quit"));
      return;
    }

    try {
      const data = this.snapshotPlayerData();
      await saveGame(slot.id, this.currentLevel, data);
    } catch {
      // 静默失败，仍然退出
    }

    window.dispatchEvent(new CustomEvent("save-and-quit"));
  }

  /** 通关自动存档（存下一关索引，让读档时从下一关开始）— 静默失败，不打断游戏 */
  private async autoSaveNextLevel(nextLevel: number): Promise<void> {
    const slot = currentSlot;
    if (!slot) return;

    const data = this.snapshotPlayerData();
    try {
      await saveGame(slot.id, nextLevel, data);
    } catch {
      // 静默失败
    }
  }

  // -------------------------------------------------------
  // 玩家死亡
  // -------------------------------------------------------
  private onPlayerDeath(): void {
    this.isGameFrozen = true;
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "你被击败了！\n按 F5 重新挑战", {
        fontSize: "26px", color: "#e74c3c", align: "center",
        fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: { x: 24, y: 16 },
      })
      .setOrigin(0.5);
    this.input.off("pointerdown");
  }

  // -------------------------------------------------------
  // 全部通关
  // -------------------------------------------------------
  private onGameComplete(): void {
    this.isGameFrozen = true;
    const p = this.player;
    window.dispatchEvent(
      new CustomEvent("game-complete", {
        detail: {
          level: p.level,
          hp: p.hp,
          maxHp: p.maxHp,
          damage: p.damage,
          speed: p.speed,
          dodgeChance: p.dodgeChance,
          critChance: p.critChance,
          sizeMultiplier: p.sizeMultiplier,
          evolutionLog: p.evolutionLog.map((ev) => ({
            id: ev.id,
            name: ev.name,
            type: ev.type,
          })),
          visualParts: [...p.visualParts],
        },
      }),
    );
  }

  // -------------------------------------------------------
  // HUD
  // -------------------------------------------------------
  private drawHUD(): void {
    const barX = GAME_WIDTH - 170;   // 血条右对齐
    const barW = 140;
    const barH = 14;
    const labelX = GAME_WIDTH - 195; // 文字在血条左侧

    // HP 比例
    const hpRatio = Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1);

    // HP 文字标签
    this.hpLabelText.setText(`❤️ ${this.player.hp}/${this.player.maxHp}`);
    this.hpLabelText.setPosition(labelX, 10);

    // HP 颜色
    let hpColor: number;
    if (hpRatio >= 0.7) hpColor = 0x27ae60;
    else if (hpRatio >= 0.3) hpColor = 0xf39c12;
    else hpColor = 0xe74c3c;

    // HP 条
    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x333333);
    this.hpBarBg.fillRect(barX, 10, barW, barH);
    this.hpBarFill.clear();
    this.hpBarFill.fillStyle(hpColor);
    this.hpBarFill.fillRect(barX, 10, barW * hpRatio, barH);

    // EXP 文字标签
    this.expLabelText.setText(`⭐ Lv.${this.player.level}  EXP:${this.player.exp}/${this.player.expToNext}`);
    this.expLabelText.setPosition(labelX, 30);

    // EXP 条
    this.expBarBg.clear();
    this.expBarBg.fillStyle(0x333333);
    this.expBarBg.fillRect(barX, 30, barW, barH);
    this.expBarFill.clear();
    const expRatio = Phaser.Math.Clamp(this.player.exp / this.player.expToNext, 0, 1);
    this.expBarFill.fillStyle(0x2980b9);
    this.expBarFill.fillRect(barX, 30, barW * expRatio, barH);

    // 敌人数量 + 关卡信息
    const aliveCount = this.enemies.filter((e) => e.alive).length;
    const cfg = LEVEL_CONFIGS[this.currentLevel];
    this.enemyCountText.setText(`👾 第${cfg.id}关：${cfg.name} | 剩余敌人：${aliveCount}`);

    // 已获得部件
    const partNames = this.player.visualParts.length
      ? this.player.visualParts.slice(-3).join(" ")
      : "";
    this.levelText.setText(`Lv.${this.player.level}  ${partNames}`);

    // Boss 血条（屏幕中上方的独立血条）
    this.drawBossHUD();

    if (this.infoText) {
      this.infoText.setText(
        `WASD 移动  |  鼠标点击 攻击  |  按ESC暂停  |  HP:${this.player.hp}  EXP:${this.player.exp}/${this.player.expToNext}`,
      );
    }
  }

  /** Boss 专用大血条（画面顶部中央） */
  private drawBossHUD(): void {
    this.bossHPBarBg.clear();
    this.bossHPBarFill.clear();

    // 查找当前关卡中的 boss 或 elite_boss
    const boss = this.enemies.find((e) => (e.type === "boss" || e.type === "elite_boss") && e.alive);
    if (!boss) {
      if (this._bossNameText) this._bossNameText.setVisible(false);
      return;
    }

    const barW = 400;
    const barH = 10;
    const barX = (GAME_WIDTH - barW) / 2;
    const barY = 6;

    // 背景
    this.bossHPBarBg.fillStyle(0x333333);
    this.bossHPBarBg.fillRect(barX, barY, barW, barH);

    // 血量
    const ratio = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
    const barColor = boss.enraged ? 0xe74c3c : (boss.type === "elite_boss" ? 0xc39bdb : 0xbb66ff);
    this.bossHPBarFill.fillStyle(barColor);
    this.bossHPBarFill.fillRect(barX, barY, barW * ratio, barH);

    // Boss 名称标签
    const bossName = boss.type === "elite_boss" ? "精英实验体 E-5" : (boss.enraged ? "OMEGA · 狂暴模式" : "最终实验体 OMEGA");
    if (!this._bossNameText) {
      this._bossNameText = this.add
        .text(GAME_WIDTH / 2, barY - 12, bossName, {
          fontSize: "11px", color: boss.enraged ? "#e74c3c" : "#bb66ff", align: "center",
          fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
        })
        .setOrigin(0.5, 1);
    } else {
      this._bossNameText.setText(bossName);
      this._bossNameText.setColor(boss.enraged ? "#e74c3c" : (boss.type === "elite_boss" ? "#c39bdb" : "#bb66ff"));
    }
    this._bossNameText.setVisible(true);
  }

  private _bossNameText?: Phaser.GameObjects.Text;
}
