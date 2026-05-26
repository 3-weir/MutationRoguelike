import {
  ALL_EVOLUTIONS,
  EvolutionOption,
  EvolutionBuff,
  EvolutionDebuff,
} from "../data/evolutions";

export class EvolutionSystem {
  /** 从全部选项中随机抽 3 个不重复的 */
  static pickThree(): EvolutionOption[] {
    const pool = [...ALL_EVOLUTIONS];
    const result: EvolutionOption[] = [];

    for (let i = 0; i < 3; i++) {
      if (pool.length === 0) break;
      const idx = Math.floor(Math.random() * pool.length);
      result.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return result;
  }

  /** 将 evolution 选项转换成人类可读的 buff 描述 */
  static describeBuff(buff: EvolutionBuff): string {
    const parts: string[] = [];
    if (buff.damage !== undefined && buff.damage > 0) parts.push(`+${buff.damage} 攻击力`);
    if (buff.speed !== undefined && buff.speed > 1) parts.push(`+${Math.round((buff.speed - 1) * 100)}% 移速`);
    if (buff.attackCooldown !== undefined && buff.attackCooldown < 1) parts.push(`+${Math.round((1 - buff.attackCooldown) * 100)}% 攻速`);
    if (buff.dodgeChance !== undefined) parts.push(`+${Math.round(buff.dodgeChance * 100)}% 闪避`);
    if (buff.critChance !== undefined) parts.push(`+${Math.round(buff.critChance * 100)}% 暴击`);
    if (buff.heal !== undefined) parts.push(`+${buff.heal} 回血`);
    if (buff.bulletSpeed !== undefined && buff.bulletSpeed > 1) parts.push(`+${Math.round((buff.bulletSpeed - 1) * 100)}% 弹速`);
    return parts.length ? parts.join(" | ") : "随机增益";
  }

  /** 将 evolution 选项转换成人类可读的 debuff 描述 */
  static describeDebuff(debuff: EvolutionDebuff): string {
    const parts: string[] = [];
    if (debuff.speed !== undefined && debuff.speed < 1) parts.push(`-${Math.round((1 - debuff.speed) * 100)}% 移速`);
    if (debuff.damage !== undefined && debuff.damage < 0) parts.push(`${debuff.damage} 攻击力`);
    if (debuff.attackCooldown !== undefined && debuff.attackCooldown > 1) parts.push(`-${Math.round((debuff.attackCooldown - 1) * 100)}% 攻速`);
    if (debuff.sizeMultiplier !== undefined) parts.push(`+${Math.round(debuff.sizeMultiplier * 100)}% 体型`);
    if (debuff.autoFire) parts.push("周期性走火");
    if (debuff.stunInterval !== undefined) parts.push(`每${debuff.stunInterval}s 短暂眩晕`);
    if (debuff.bulletVanish !== undefined) parts.push(`子弹${Math.round(debuff.bulletVanish * 100)}%概率消失`);
    return parts.length ? parts.join(" | ") : "随机副作用";
  }
}
