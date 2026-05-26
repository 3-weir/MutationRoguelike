export interface EvolutionBuff {
  damage?: number;
  speed?: number;
  attackCooldown?: number; // 乘数，如 0.8 表示攻速 +20%
  dodgeChance?: number;
  critChance?: number;
  heal?: number;
  sizeMultiplier?: number;
  bulletSpeed?: number;
}

export interface EvolutionDebuff {
  speed?: number;          // 乘数
  damage?: number;         // 减法
  attackCooldown?: number; // 乘数
  sizeMultiplier?: number;
  autoFire?: boolean;      // 每隔一段时间自动向随机方向开火
  stunInterval?: number;   // 周期性眩晕（秒）
  bulletVanish?: number;   // 子弹有概率提前消失（0~1）
}

export interface EvolutionOption {
  id: string;
  name: string;
  type: "food" | "drug" | "experiment";
  buff: EvolutionBuff;
  debuff: EvolutionDebuff;
  visualParts: string[];
}

export const ALL_EVOLUTIONS: EvolutionOption[] = [
  // ===== 食物 =====
  {
    id: "spicy_pot",
    name: "辣味火锅",
    type: "food",
    buff: { damage: 5 },
    debuff: { autoFire: true },
    visualParts: ["flame_aura"],
  },
  {
    id: "deep_fish",
    name: "深海鱼子",
    type: "food",
    buff: { dodgeChance: 0.15 },
    debuff: { speed: 0.9 },
    visualParts: ["fish_fin"],
  },
  {
    id: "carrot",
    name: "巨型胡萝卜",
    type: "food",
    buff: { critChance: 0.1 },
    debuff: { sizeMultiplier: 0.15 },
    visualParts: ["big_eyes"],
  },

  // ===== 药物 =====
  {
    id: "muscle",
    name: "肌肉针剂",
    type: "drug",
    buff: { damage: 12 },
    debuff: { sizeMultiplier: 0.2 },
    visualParts: ["muscle_arm"],
  },
  {
    id: "nerve",
    name: "神经兴奋剂",
    type: "drug",
    buff: { speed: 1.25, attackCooldown: 0.8 },
    debuff: { stunInterval: 12 },
    visualParts: ["zigzag_legs"],
  },
  {
    id: "regen",
    name: "再生药膏",
    type: "drug",
    buff: { heal: 20 },
    debuff: { damage: -5 },
    visualParts: ["green_skin"],
  },

  // ===== 实验物 =====
  {
    id: "blackhole",
    name: "迷你黑洞糖",
    type: "experiment",
    buff: { bulletSpeed: 1.2 },
    debuff: { bulletVanish: 0.15 },
    visualParts: ["black_hole_aura"],
  },
  {
    id: "memory",
    name: "记忆罐头",
    type: "experiment",
    buff: {},
    debuff: {},
    visualParts: ["clone_echo"],
  },
  {
    id: "chaos",
    name: "混沌培养液",
    type: "experiment",
    buff: {},
    debuff: {},
    visualParts: ["random_glow"],
  },
];

/** 获取类型对应的图标文本 */
export function typeIcon(type: EvolutionOption["type"]): string {
  switch (type) {
    case "food": return "🍖";
    case "drug": return "💊";
    case "experiment": return "🧪";
  }
}

/** 获取类型中文 */
export function typeLabel(type: EvolutionOption["type"]): string {
  switch (type) {
    case "food": return "食物";
    case "drug": return "药物";
    case "experiment": return "实验物";
  }
}
