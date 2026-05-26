import Phaser from "phaser";
import { BULLET_SPEED, BULLET_RADIUS } from "../config";

export class Bullet {
  public x: number;
  public y: number;
  public radius: number = BULLET_RADIUS;
  public sprite: Phaser.GameObjects.Arc;
  public vanished = false;

  private angle: number;
  private speed: number;

  constructor(scene: Phaser.Scene, x: number, y: number, angle: number, speedMultiplier = 1) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = BULLET_SPEED * speedMultiplier;

    this.sprite = scene.add.circle(x, y, BULLET_RADIUS, 0xffdd44);
  }

  update(delta: number): void {
    const dt = delta / 1000;
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.sprite.setPosition(this.x, this.y);
  }

  isOutOfBounds(): boolean {
    const margin = 50;
    return (
      this.x < -margin ||
      this.x > 800 + margin ||
      this.y < -margin ||
      this.y > 600 + margin
    );
  }

  /** 随机消失（bulletsVanish debuff） */
  tryVanish(chance: number): boolean {
    if (Math.random() < chance) {
      this.vanished = true;
      return true;
    }
    return false;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
