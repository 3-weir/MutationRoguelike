import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, LEVEL_CONFIGS, TOTAL_LEVELS, EnemyType } from "../config";
import { playerNickname, currentSlot } from "../main";
import { Player } from "../entities/Player";
import { Bullet } from "../entities/Bullet";
import { Enemy } from "../entities/Enemy";
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

  // UI
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private expBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private expBarFill!: Phaser.GameObjects.Graphics;
  private hpLabelText!: Phaser.GameObjects.Text;
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
      if (this.isGameFrozen || this.isPaused) return;
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
      .text(GAME_WIDTH - 300, 14, "", {
        fontSize: "12px", color: "#ffffff",
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

    // 通关自动存档
    this.autoSave();

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
      enemy.update(delta, this.player.x, this.player.y);

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

    this.checkBulletEnemyCollisions();
    this.cleanupDeadEnemies();
    this.drawHUD();

    // 升级触发
    if (this.levelUpQueue > 0) {
      this.levelUpQueue--;
      this.triggerEvolutionPanel();
    }

    // 已进化完成 && 本关敌人全部死亡 → 进入下一关
    if (this.evolutionChosenThisLevel && this.isLevelCleared()) {
      this.proceedToNextLevel();
    }
  }

  // -------------------------------------------------------
  // 子弹 × 敌人
  // -------------------------------------------------------
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
  // 清理死亡敌人
  // -------------------------------------------------------
  private cleanupDeadEnemies(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!this.enemies[i].alive) {
        this.enemies[i].destroy();
        this.enemies.splice(i, 1);
      }
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

    // 进化面板关闭后，检查是否可以直接进入下一关
    // 有短暂延迟让面板动画结束
    this.time.delayedCall(100, () => {
      if (this.isLevelCleared()) {
        this.proceedToNextLevel();
      }
    });
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

  private async handleSaveAndQuit(): Promise<void> {
    const slot = currentSlot;
    if (!slot) {
      // 无存档槽位，回主菜单
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

  /** 通关自动存档 — 静默失败，不打断游戏 */
  private autoSave(): void {
    const slot = currentSlot;
    if (!slot) return;

    const data = this.snapshotPlayerData();
    saveGame(slot.id, this.currentLevel, data).catch(() => {
      // 静默失败
    });
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
    const barX = GAME_WIDTH - 220;
    const barW = 160;
    const barH = 14;

    // HP 比例（先计算，供颜色判断和绘制共用）
    const hpRatio = Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1);

    // HP 文字标签
    this.hpLabelText.setText(`生命值：${this.player.hp}`);

    // HP 颜色：>=70% 绿色, 30-70% 黄色, <30% 红色
    let hpColor: number;
    if (hpRatio >= 0.7) {
      hpColor = 0x27ae60; // 绿色
    } else if (hpRatio >= 0.3) {
      hpColor = 0xf39c12; // 黄色
    } else {
      hpColor = 0xe74c3c; // 红色
    }

    // HP 条
    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x333333);
    this.hpBarBg.fillRect(barX, 14, barW, barH);

    this.hpBarFill.clear();
    this.hpBarFill.fillStyle(hpColor);
    this.hpBarFill.fillRect(barX, 14, barW * hpRatio, barH);

    // EXP 条（蓝色）
    this.expBarBg.clear();
    this.expBarBg.fillStyle(0x333333);
    this.expBarBg.fillRect(barX, 34, barW, barH);

    this.expBarFill.clear();
    const expRatio = Phaser.Math.Clamp(this.player.exp / this.player.expToNext, 0, 1);
    this.expBarFill.fillStyle(0x2980b9);
    this.expBarFill.fillRect(barX, 34, barW * expRatio, barH);

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

    // 查找当前关卡中的 boss
    const boss = this.enemies.find((e) => e.type === "boss" && e.alive);
    if (!boss) return;

    const barW = 400;
    const barH = 10;
    const barX = (GAME_WIDTH - barW) / 2;
    const barY = 6;

    // 背景
    this.bossHPBarBg.fillStyle(0x333333);
    this.bossHPBarBg.fillRect(barX, barY, barW, barH);

    // 血量
    const ratio = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
    this.bossHPBarFill.fillStyle(0xbb66ff);
    this.bossHPBarFill.fillRect(barX, barY, barW * ratio, barH);

    // Boss 名称标签
    if (!this._bossNameText) {
      this._bossNameText = this.add
        .text(GAME_WIDTH / 2, barY - 12, "BOSS · 最终实验体", {
          fontSize: "11px", color: "#bb66ff", align: "center",
          fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
        })
        .setOrigin(0.5, 1);
    }
    this._bossNameText.setVisible(true);
  }

  private _bossNameText?: Phaser.GameObjects.Text;
}
