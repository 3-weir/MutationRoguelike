/**
 * 结算报告生成 & 形态绘制
 */

/**
 * 在 HTML Canvas 上绘制初始变异体（无任何进化部件的基础形态）
 */
export function drawInitialForm(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d")!;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const baseR = 30;
  const r = baseR;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // -- 身体 --
  ctx.fillStyle = "#4488ff";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 高光
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // -- 眼睛 --
  const eyeOffX = r * 0.35;
  const eyeOffY = r * 0.1;
  const eyeR = r * 0.22;
  const pupilR = eyeR * 0.55;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx - eyeOffX, cy - eyeOffY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + eyeOffX, cy - eyeOffY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.arc(cx - eyeOffX, cy - eyeOffY, pupilR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + eyeOffX, cy - eyeOffY, pupilR, 0, Math.PI * 2);
  ctx.fill();

  // -- 手臂 --
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 3;
  const armLen = r * 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.7, cy);
  ctx.lineTo(cx - r * 0.7 - armLen * 0.6, cy + armLen * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.7, cy);
  ctx.lineTo(cx + r * 0.7 + armLen * 0.6, cy + armLen * 0.7);
  ctx.stroke();

  // -- 腿 --
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 3.5;
  const legLen = r * 1.05;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.35, cy + r);
  ctx.lineTo(cx - r * 0.35, cy + r + legLen);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.35, cy + r);
  ctx.lineTo(cx + r * 0.35, cy + r + legLen);
  ctx.stroke();
}

export interface PlayerSummary {
  level: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  dodgeChance: number;
  critChance: number;
  sizeMultiplier: number;
  evolutionLog: { id: string; name: string; type: string }[];
  visualParts: string[];
}

/**
 * 在 HTML Canvas 上绘制最终变异体
 * 复刻 Player.drawBody() 的核心逻辑，用 Canvas 2D API
 */
export function drawFinalForm(
  canvas: HTMLCanvasElement,
  visualParts: string[],
  sizeMultiplier: number,
): void {
  const ctx = canvas.getContext("2d")!;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const baseR = 30; // 基础半径
  const r = baseR * (1 + sizeMultiplier);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // -- 随机光芒（在最底层） --
  if (visualParts.includes("random_glow")) {
    const grd = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.2);
    grd.addColorStop(0, "rgba(255,255,255,0.25)");
    grd.addColorStop(0.5, "rgba(200,100,255,0.12)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // -- 克隆回声 --
  if (visualParts.includes("clone_echo")) {
    ctx.strokeStyle = "rgba(136,136,136,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + 18, cy + 10, r * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 18, cy - 10, r * 0.85, 0, Math.PI * 2);
    ctx.stroke();
  }

  // -- 身体 --
  const bodyColor = visualParts.includes("green_skin") ? "#44cc44" : "#4488ff";
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 高光
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // -- 眼睛 --
  const bigEyes = visualParts.includes("big_eyes");
  const eyeOffX = r * 0.35;
  const eyeOffY = r * 0.1;
  const eyeR = r * (bigEyes ? 0.38 : 0.22);
  const pupilR = eyeR * 0.55;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx - eyeOffX, cy - eyeOffY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + eyeOffX, cy - eyeOffY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.arc(cx - eyeOffX, cy - eyeOffY, pupilR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + eyeOffX, cy - eyeOffY, pupilR, 0, Math.PI * 2);
  ctx.fill();

  // -- 手臂 --
  const muscleArm = visualParts.includes("muscle_arm");
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = muscleArm ? 6 : 3;
  const armLen = r * 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.7, cy);
  ctx.lineTo(cx - r * 0.7 - armLen * 0.6, cy + armLen * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.7, cy);
  ctx.lineTo(cx + r * 0.7 + armLen * 0.6, cy + armLen * 0.7);
  ctx.stroke();

  // -- 腿 --
  const zigzag = visualParts.includes("zigzag_legs");
  ctx.strokeStyle = zigzag ? "#ff8800" : "#333333";
  ctx.lineWidth = zigzag ? 4 : 3.5;
  const legLen = r * 1.05;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.35, cy + r);
  ctx.lineTo(cx - r * 0.35, cy + r + legLen);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.35, cy + r);
  ctx.lineTo(cx + r * 0.35, cy + r + legLen);
  ctx.stroke();

  // -- 火焰光环 --
  if (visualParts.includes("flame_aura")) {
    ctx.strokeStyle = "rgba(255,102,0,0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,170,0,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // -- 鱼鳍 --
  if (visualParts.includes("fish_fin")) {
    ctx.fillStyle = "rgba(68,204,255,0.7)";
    const fx = cx - r * 0.5;
    const fy = cy - r * 1.1;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx - r * 0.7, fy + r * 0.5);
    ctx.lineTo(fx + r * 0.3, fy + r * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  // -- 黑洞光环 --
  if (visualParts.includes("black_hole_aura")) {
    ctx.strokeStyle = "rgba(136,68,204,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * 生成实验报告文本
 */
export function generateReport(
  nickname: string,
  evolutionLog: { name: string }[],
  visualParts: string[],
): string {
  const pathStr = evolutionLog.length
    ? evolutionLog.map((e) => e.name).join(" → ")
    : "（无进化记录）";

  // Map visual parts to readable descriptions
  const partDescMap: Record<string, string> = {
    flame_aura: "火焰光环围绕身体",
    fish_fin: "头部生长出异常鱼鳍状结构",
    big_eyes: "眼部异常增大，视觉敏感度大幅提升",
    muscle_arm: "手臂肌肉异常粗壮，远超正常比例",
    zigzag_legs: "腿部呈现锯齿状增生结构",
    green_skin: "表皮呈藻绿色，具有轻微光合作用",
    black_hole_aura: "周围存在微弱引力场扭曲",
    clone_echo: "运动时产生残影回响",
    random_glow: "体内散发不稳定的生物荧光",
  };

  const features = visualParts
    .filter((p, i, arr) => arr.indexOf(p) === i) // unique
    .map((p) => partDescMap[p] || p)
    .map((desc) => `· ${desc}`)
    .join("\n");

  // 危险等级
  const dangerLevel = Math.min(5, evolutionLog.length);
  const dangerStars = "★".repeat(dangerLevel) + "☆".repeat(5 - dangerLevel);

  return `
══════════════════════════════
       实  验  报  告
══════════════════════════════

实验体编号：EX-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}
实验员：${nickname}
培养代数：${evolutionLog.length}

进化路线：
  ${pathStr}

最终形态特征：
${features || "· 未发生明显变异"}

综合评估：
这是一个${
    dangerLevel >= 4 ? "高度危险" : dangerLevel >= 2 ? "中等" : "轻度"
  }的变异体${
    dangerLevel >= 3 ? "，已具备明显的非人特征" : ""
  }。
危险等级：${dangerStars}
培养建议：${
    dangerLevel >= 4
      ? "建议立即终止实验并启动安全协议。"
      : dangerLevel >= 2
        ? "肌肉组织存在进一步增生风险，建议下一轮减少药物类摄入。"
        : "变异可控，可继续进行下一阶段培养。"
  }

══════════════════════════════
  `.trim();
}
