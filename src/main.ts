import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { EvolutionOption, typeIcon, typeLabel } from "./data/evolutions";
import { EvolutionSystem } from "./systems/EvolutionSystem";
import { drawInitialForm, drawFinalForm, generateReport, PlayerSummary } from "./utils/report";
import {
  PlayerInfo,
  SaveSlot,
  registerPlayer,
  loginPlayer,
  getSaveSlots,
  createSaveSlot,
  loadSave,
  deleteSlot,
} from "./api/supabase";

// ----------------------------------------------------------------
// 全局身份状态
// ----------------------------------------------------------------
export let playerNickname = "";       // Phase 1 兼容，存 variantName
export let currentPlayer: PlayerInfo | null = null;
export let currentSlot: SaveSlot | null = null;

const LS_KEY = "current_player";

// ----------------------------------------------------------------
// DOM 引用
// ----------------------------------------------------------------
const authScreen = document.getElementById("auth-screen")!;
const slotsScreen = document.getElementById("slots-screen")!;
const variantCreateScreen = document.getElementById("variant-create-screen")!;
const gameScreen = document.getElementById("game-screen")!;
const summaryScreen = document.getElementById("summary-screen")!;

// 登录/注册页
const authSubtitle = document.getElementById("auth-subtitle")!;
const authTabs = document.querySelectorAll(".auth-tab");
const authUsername = document.getElementById("auth-username") as HTMLInputElement;
const btnAuth = document.getElementById("btn-auth")!;
const authError = document.getElementById("auth-error")!;

// 存档页
const slotsUsername = document.getElementById("slots-username")!;
const slotsRow = document.getElementById("slots-row")!;
const btnSlotsLogout = document.getElementById("btn-slots-logout")!;

// 变异体创建页
const createPreviewCanvas = document.getElementById("create-preview-canvas") as HTMLCanvasElement;
const createVariantName = document.getElementById("create-variant-name") as HTMLInputElement;
const btnCreateConfirm = document.getElementById("btn-create-confirm")!;
const btnCreateCancel = document.getElementById("btn-create-cancel")!;
const createError = document.getElementById("create-error")!;

// 结算页
const btnRestart = document.getElementById("btn-restart")!;

// 药物汇总弹窗
const evosSummaryOverlay = document.getElementById("evos-summary-overlay")!;
const evosSummaryContent = document.getElementById("evos-summary-content")!;
const btnEvosSummaryClose = document.getElementById("btn-evos-summary-close")!;

/** 显示药物汇总弹窗（从 GameScene 获取玩家进化数据） */
function showEvosSummary(): void {
  // 从 GameScene 的 player 实例获取进化记录
  const gameScene = game?.scene?.scenes?.[0] as any;
  if (!gameScene || !gameScene.player) {
    evosSummaryContent.innerHTML = `<p style="color:#64748b;">暂无药物数据，请先开始游戏。</p>`;
  } else {
    const evolutionLog = gameScene.player.evolutionLog as import("./data/evolutions").EvolutionOption[];
    const visualParts = gameScene.player.visualParts as string[];
    const typeIcon: Record<string, string> = { food: "🍖", drug: "💊", experiment: "🧪" };
    const typeLabel: Record<string, string> = { food: "食物", drug: "药物", experiment: "实验物" };

    let html = "";
    if (evolutionLog.length === 0) {
      html = `<p style="color:#64748b;">尚未获得任何药物或进化。</p>`;
    } else {
      html += `<p style="color:#94a3b8; margin-bottom:10px;">已获得 <span style="color:#e2e8f0; font-weight:600;">${evolutionLog.length}</span> 种进化：</p>`;
      for (let i = 0; i < evolutionLog.length; i++) {
        const ev = evolutionLog[i];
        const icon = typeIcon[ev.type] ?? "❓";
        const label = typeLabel[ev.type] ?? ev.type;
        const buffDesc = EvolutionSystem.describeBuff(ev.buff);
        const debuffDesc = EvolutionSystem.describeDebuff(ev.debuff);
        html += `
          <div style="margin-bottom:10px; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
            <div style="color:#e2e8f0; font-weight:600;">${icon} ${ev.name} <span style="font-size:11px; color:#64748b;">（${label}）</span></div>
            <div style="font-size:12px; color:#4ade80; margin-top:2px;">增益：${buffDesc || "无"}</div>
            <div style="font-size:12px; color:#f87171;">副作用：${debuffDesc || "无"}</div>
          </div>`;
      }
      if (visualParts.length > 0) {
        html += `<p style="color:#94a3b8; margin-top:12px; margin-bottom:6px;">已获得外观部件：</p>`;
        html += `<div style="color:#7dd3fc; font-size:13px;">${visualParts.join("  ")}</div>`;
      }
    }
    evosSummaryContent.innerHTML = html;
  }

  evosSummaryOverlay.style.display = "flex";
}

function hideEvosSummary(): void {
  evosSummaryOverlay.style.display = "none";
}

btnEvosSummaryClose.addEventListener("click", hideEvosSummary);
evosSummaryOverlay.addEventListener("click", (e) => {
  if (e.target === evosSummaryOverlay) hideEvosSummary();
});

// 暂停页「查看药物汇总」按钮
const btnViewEvos = document.getElementById("btn-view-evos")!;
btnViewEvos.addEventListener("click", () => {
  // 先关闭暂停面板
  document.getElementById("pause-screen")?.classList.remove("show");
  showEvosSummary();
  // 标记：关闭汇总后重新显示暂停面板
  (evosSummaryOverlay as any)._returnToPause = true;
});

// 关闭汇总后，如果来自暂停面板，则重新显示暂停面板
evosSummaryOverlay.addEventListener("click", (e) => {
  if (e.target === evosSummaryOverlay && (evosSummaryOverlay as any)._returnToPause) {
    (evosSummaryOverlay as any)._returnToPause = false;
    document.getElementById("pause-screen")?.classList.add("show");
  }
});
(btnEvosSummaryClose as HTMLButtonElement).addEventListener("click", () => {
  evosSummaryOverlay.style.display = "none";
  if ((evosSummaryOverlay as any)._returnToPause) {
    (evosSummaryOverlay as any)._returnToPause = false;
    document.getElementById("pause-screen")?.classList.add("show");
  }
});

// ----------------------------------------------------------------
// 状态: "login" | "register"
// ----------------------------------------------------------------
let currentAuthMode: "login" | "register" = "login";

/** 记录当前正在创建的槽位索引 (1/2/3) */
let creatingSlotIndex = 0;

// ----------------------------------------------------------------
// Phaser 实例管理
// ----------------------------------------------------------------
let game: Phaser.Game | null = null;

function createGame(): void {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: "game-container",
    backgroundColor: "#2d2d2d",
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    scene: [GameScene],
  };
  game = new Phaser.Game(config);
}

function destroyGame(): void {
  if (game) {
    game.destroy(true);
    game = null;
  }
}

// ----------------------------------------------------------------
// 页面切换
// ----------------------------------------------------------------
function hideAll(): void {
  authScreen.style.display = "none";
  slotsScreen.classList.remove("show");
  variantCreateScreen.classList.remove("show");
  gameScreen.style.display = "none";
  summaryScreen.classList.remove("show");
}

function showAuthScreen(): void {
  hideAll();
  authScreen.style.display = "flex";
  authUsername.value = "";
  authError.classList.remove("show");
  authUsername.focus();
}

function showSlotsScreen(): void {
  hideAll();
  slotsScreen.classList.add("show");
  if (currentPlayer) {
    slotsUsername.textContent = currentPlayer.username;
  }
  renderSaveSlots();
}

function showGame(): void {
  hideAll();
  // 确保暂停覆盖层不残留
  document.getElementById("pause-screen")?.classList.remove("show");
  gameScreen.style.display = "flex";
}

function showSummary(detail: PlayerSummary): void {
  hideAll();
  summaryScreen.classList.add("show");

  const initialCanvas = document.getElementById("initial-canvas") as HTMLCanvasElement;
  drawInitialForm(initialCanvas);

  const canvas = document.getElementById("final-canvas") as HTMLCanvasElement;
  drawFinalForm(canvas, detail.visualParts, detail.sizeMultiplier);

  const evoPathEl = document.getElementById("evo-path")!;
  const pathStr = detail.evolutionLog.length
    ? detail.evolutionLog
        .map((ev) => {
          const icon = ev.type === "food" ? "🍖" : ev.type === "drug" ? "💊" : "🧪";
          return `${icon} ${ev.name}`;
        })
        .join("  →  ")
    : "（未发生进化）";
  evoPathEl.textContent = pathStr;

  const statsGrid = document.getElementById("stats-grid")!;
  const dodgePct = Math.round(detail.dodgeChance * 100);
  const critPct = Math.round(detail.critChance * 100);
  statsGrid.innerHTML = `
    <span>❤️ HP</span><span class="stat-val">${detail.hp} / ${detail.maxHp}</span>
    <span>⚔️ 攻击力</span><span class="stat-val">${detail.damage}</span>
    <span>🏃 速度</span><span class="stat-val">${detail.speed}</span>
    <span>🛡️ 闪避率</span><span class="stat-val">${dodgePct}%</span>
    <span>💥 暴击率</span><span class="stat-val">${critPct}%</span>
    <span>📏 体型</span><span class="stat-val">${Math.round((1 + detail.sizeMultiplier) * 100)}%</span>
    <span>⬆️ 等级</span><span class="stat-val">Lv.${detail.level}</span>
    <span>🧬 变异数</span><span class="stat-val">${detail.evolutionLog.length} 次</span>
  `;

  const reportEl = document.getElementById("report-text")!;
  reportEl.textContent = generateReport(
    playerNickname,
    detail.evolutionLog,
    detail.visualParts,
  );

  document.getElementById("summary-subtitle")!.textContent =
    `实验体 ${playerNickname} · 本次实验完成`;
}

// ----------------------------------------------------------------
// 登录/注册逻辑
// ----------------------------------------------------------------
async function handleAuth(): Promise<void> {
  const name = authUsername.value.trim();

  if (!name) {
    authUsername.focus();
    authUsername.style.borderColor = "#f87171";
    setTimeout(() => {
      authUsername.style.borderColor = "";
    }, 600);
    return;
  }

  (btnAuth as HTMLButtonElement).disabled = true;
  authError.classList.remove("show");

  if (currentAuthMode === "register") {
    const result = await registerPlayer(name);
    if (result.ok && result.player) {
      setPlayer(result.player);
      showSlotsScreen();
    } else if (result.reason === "taken") {
      authError.textContent = "⚠️ 该用户名已被注册，请换一个";
      authError.classList.add("show");
      authUsername.value = "";
      authUsername.focus();
    } else {
      authError.textContent = "⚠️ 网络开小差了，稍后重试";
      authError.classList.add("show");
    }
  } else {
    const result = await loginPlayer(name);
    if (result.ok && result.player) {
      setPlayer(result.player);
      showSlotsScreen();
    } else if (result.reason === "not_found") {
      authError.textContent = "⚠️ 用户不存在，请先注册";
      authError.classList.add("show");
      authUsername.value = "";
      authUsername.focus();
    } else {
      authError.textContent = "⚠️ 网络开小差了，稍后重试";
      authError.classList.add("show");
    }
  }

  (btnAuth as HTMLButtonElement).disabled = false;
}

function setPlayer(player: PlayerInfo): void {
  currentPlayer = player;
  localStorage.setItem(LS_KEY, JSON.stringify(player));
}

function logout(): void {
  localStorage.removeItem(LS_KEY);
  currentPlayer = null;
  currentSlot = null;
  playerNickname = "";
  destroyGame();
  showAuthScreen();
}

// ----------------------------------------------------------------
// 存档槽位 UI
// ----------------------------------------------------------------
async function renderSaveSlots(): Promise<void> {
  if (!currentPlayer) return;

  const slots = await getSaveSlots(currentPlayer.id);
  slotsRow.innerHTML = "";

  for (let i = 0; i < 3; i++) {
    const idx = i + 1;
    const slot = slots[i];
    const card = document.createElement("div");
    card.className = "slot-card";

    if (!slot) {
      // 空槽位 → 新建
      card.innerHTML = `
        <div class="slot-empty-icon">➕</div>
        <div class="slot-add-text">新建实验</div>
      `;
      card.addEventListener("click", () => openCreateSlotDialog(idx));
    } else {
      // 已有存档 → 继续 / 删除
      card.innerHTML = `
        <div class="slot-variant-name">🧬 ${slot.variant_name}</div>
        <div class="slot-level">第 ${slot.level + 1} 关</div>
        <button class="slot-delete" data-slot-id="${slot.id}">删除</button>
      `;
      // 点击卡片 → 继续游戏
      card.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains("slot-delete")) return; // 不触发卡片点击
        startFromSlot(slot);
      });
      // 删除按钮 → 弹出游戏内确认弹窗
      const delBtn = card.querySelector(".slot-delete") as HTMLButtonElement;
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showDeleteConfirm(slot.id, slot.variant_name);
      });
    }

    slotsRow.appendChild(card);
  }
}

/** 打开变异体创建页 */
function openCreateSlotDialog(slotIndex: number): void {
  creatingSlotIndex = slotIndex;
  createError.classList.remove("show");
  createVariantName.value = "";
  drawInitialPreview();
  hideAll();
  variantCreateScreen.classList.add("show");
  createVariantName.focus();
}

/** 在 HTML Canvas 上绘制初始人类形态预览 */
function drawInitialPreview(): void {
  const canvas = createPreviewCanvas;
  const ctx = canvas.getContext("2d")!;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 画一个基础人类外形
  // 头
  ctx.beginPath();
  ctx.arc(cx, cy - 50, 18, 0, Math.PI * 2);
  ctx.fillStyle = "#f5c6a0";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 眼睛
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath(); ctx.arc(cx - 6, cy - 54, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 6, cy - 54, 3, 0, Math.PI * 2); ctx.fill();

  // 嘴
  ctx.beginPath();
  ctx.arc(cx, cy - 42, 5, 0.1, Math.PI - 0.1);
  ctx.strokeStyle = "#c0392b";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 身体
  ctx.beginPath();
  ctx.moveTo(cx, cy - 32);
  ctx.lineTo(cx, cy + 20);
  ctx.strokeStyle = "#7dd3fc";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 左臂
  ctx.beginPath();
  ctx.moveTo(cx, cy - 22);
  ctx.lineTo(cx - 22, cy + 10);
  ctx.stroke();

  // 右臂
  ctx.beginPath();
  ctx.moveTo(cx, cy - 22);
  ctx.lineTo(cx + 22, cy + 10);
  ctx.stroke();

  // 左腿
  ctx.beginPath();
  ctx.moveTo(cx, cy + 20);
  ctx.lineTo(cx - 14, cy + 60);
  ctx.stroke();

  // 右腿
  ctx.beginPath();
  ctx.moveTo(cx, cy + 20);
  ctx.lineTo(cx + 14, cy + 60);
  ctx.stroke();

  // 标签
  ctx.font = "11px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "center";
  ctx.fillText("初始人类形态", cx, cy + 78);
}

async function handleCreateConfirm(): Promise<void> {
  const name = createVariantName.value.trim();
  if (!name) {
    createVariantName.focus();
    createError.textContent = "请输入变异体名字";
    createError.classList.add("show");
    return;
  }

  (btnCreateConfirm as HTMLButtonElement).disabled = true;
  createError.classList.remove("show");

  await createSlotAndStart(creatingSlotIndex, name);

  (btnCreateConfirm as HTMLButtonElement).disabled = false;
}

function handleCreateCancel(): void {
  showSlotsScreen();
}

async function createSlotAndStart(slotIndex: number, variantName: string): Promise<void> {
  if (!currentPlayer) return;

  const result = await createSaveSlot(currentPlayer.id, slotIndex, variantName);

  if (!result.ok) {
    if (result.reason === "occupied") {
      createError.textContent = "该槽位已被占用";
    } else {
      createError.textContent = "创建失败，请稍后重试";
    }
    createError.classList.add("show");
    return;
  }

  currentSlot = result.slot!;
  playerNickname = variantName;
  destroyGame();
  showGame();
  createGame();
}

async function startFromSlot(slot: SaveSlot): Promise<void> {
  currentSlot = slot;
  playerNickname = slot.variant_name;

  destroyGame();

  if (slot.player_data && Object.keys(slot.player_data).length > 0) {
    // 有存档数据 → 恢复
    const data = await loadSave(slot.id);
    if (data) {
      // 将存档数据挂到 window 上，GameScene 读取
      (window as any).__saveData = data;
    }
  }

  showGame();
  createGame();
}

// ----------------------------------------------------------------
// 初始检测
// ----------------------------------------------------------------
function init(): void {
  const saved = localStorage.getItem(LS_KEY);
  if (saved) {
    try {
      const player: PlayerInfo = JSON.parse(saved);
      currentPlayer = player;
      showSlotsScreen();
      return;
    } catch {
      localStorage.removeItem(LS_KEY);
    }
  }
  showAuthScreen();
}

// ----------------------------------------------------------------
// 事件绑定
// ----------------------------------------------------------------

// Tab 切换
authTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    authTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const mode = tab.getAttribute("data-tab") as "login" | "register";
    currentAuthMode = mode;
    if (mode === "register") {
      btnAuth.textContent = "注 册";
      authSubtitle.textContent = "创建新账户";
    } else {
      btnAuth.textContent = "登 录";
      authSubtitle.textContent = "登录已有账户";
    }
    authError.classList.remove("show");
    authUsername.focus();
  });
});

// 登录/注册按钮
btnAuth.addEventListener("click", handleAuth);
authUsername.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleAuth();
});

// 退出登录
btnSlotsLogout.addEventListener("click", logout);

// 变异体创建页
btnCreateConfirm.addEventListener("click", handleCreateConfirm);
btnCreateCancel.addEventListener("click", handleCreateCancel);
createVariantName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleCreateConfirm();
});

// 结算页「回到档案」
btnRestart.addEventListener("click", () => {
  destroyGame();
  showSlotsScreen();
});

// ----------------------------------------------------------------
// 删除确认弹窗
// ----------------------------------------------------------------
let pendingDeleteSlotId: string | null = null;
const deleteConfirmOverlay = document.getElementById("delete-confirm-overlay")!;
const deleteConfirmMsg = document.getElementById("delete-confirm-msg")!;
const btnConfirmNo = document.getElementById("btn-confirm-no")!;
const btnConfirmYes = document.getElementById("btn-confirm-yes")!;

function showDeleteConfirm(slotId: string, variantName: string): void {
  pendingDeleteSlotId = slotId;
  deleteConfirmMsg.textContent = `确定要删除实验体「${variantName}」的存档吗？此操作不可撤销。`;
  deleteConfirmOverlay.classList.add("show");
}

function hideDeleteConfirm(): void {
  pendingDeleteSlotId = null;
  deleteConfirmOverlay.classList.remove("show");
}

btnConfirmNo.addEventListener("click", hideDeleteConfirm);

btnConfirmYes.addEventListener("click", async () => {
  if (pendingDeleteSlotId === null) return;
  const slotId = pendingDeleteSlotId;
  hideDeleteConfirm();
  await deleteSlot(slotId);
  renderSaveSlots();
});

// 点击遮罩关闭
deleteConfirmOverlay.addEventListener("click", (e) => {
  if (e.target === deleteConfirmOverlay) {
    hideDeleteConfirm();
  }
});

// 暂停页面「保存并退出」事件
window.addEventListener("save-and-quit", () => {
  document.getElementById("pause-screen")?.classList.remove("show");
  destroyGame();
  showSlotsScreen();
});

// ----------------------------------------------------------------
// 进化选择面板（不变）
// ----------------------------------------------------------------
const evoOverlay = document.getElementById("evolution-overlay")!;
const evoCardsContainer = document.getElementById("evo-cards")!;
const evoConfirmOverlay = document.getElementById("evo-confirm-overlay")!;
const evoConfirmTitle = document.getElementById("evo-confirm-title")!;
const evoConfirmMsg = document.getElementById("evo-confirm-msg")!;
const btnEvoConfirmNo = document.getElementById("btn-evo-confirm-no")!;
const btnEvoConfirmYes = document.getElementById("btn-evo-confirm-yes")!;

/** 暂存玩家点选的进化选项 ID，确认后才派发 */
let pendingEvoId: string | null = null;

function showEvoConfirm(opt: EvolutionOption): void {
  pendingEvoId = opt.id;
  const icon = opt.type === "food" ? "🍖" : opt.type === "drug" ? "💊" : "🧪";
  evoConfirmTitle.textContent = `${icon} 确认选择「${opt.name}」？`;
  const buffDesc = EvolutionSystem.describeBuff(opt.buff);
  const debuffDesc = EvolutionSystem.describeDebuff(opt.debuff);
  evoConfirmMsg.textContent = `增益：${buffDesc}\n副作用：${debuffDesc}`;
  evoConfirmOverlay.classList.add("show");
}

function hideEvoConfirm(): void {
  pendingEvoId = null;
  evoConfirmOverlay.classList.remove("show");
}

btnEvoConfirmNo.addEventListener("click", hideEvoConfirm);
btnEvoConfirmYes.addEventListener("click", () => {
  if (pendingEvoId === null) return;
  const id = pendingEvoId;
  hideEvoConfirm();
  window.dispatchEvent(
    new CustomEvent("choose-evolution", { detail: { id } }),
  );
});
evoConfirmOverlay.addEventListener("click", (e) => {
  if (e.target === evoConfirmOverlay) hideEvoConfirm();
});

window.addEventListener(
  "show-evolution",
  (() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { options: EvolutionOption[] };
      if (!game) return;

      game.scene.scenes[0].scene.pause();
      evoCardsContainer.innerHTML = "";

      for (const opt of detail.options) {
        const card = document.createElement("div");
        card.className = "evo-card";

        const buffDesc = EvolutionSystem.describeBuff(opt.buff);
        const debuffDesc = EvolutionSystem.describeDebuff(opt.debuff);

        card.innerHTML = `
          <div class="type-badge ${opt.type}">${typeIcon(opt.type)} ${typeLabel(opt.type)}</div>
          <div class="evo-name">${opt.name}</div>
          <div class="evo-buff">+ ${buffDesc}</div>
          <div class="evo-debuff">- ${debuffDesc}</div>
          <div class="evo-hint">点击选择</div>
        `;

        card.addEventListener("click", () => {
          showEvoConfirm(opt);
        });

        evoCardsContainer.appendChild(card);
      }

      evoOverlay.classList.add("show");
    };
    return handler;
  })(),
);

window.addEventListener("hide-evolution", () => {
  evoOverlay.classList.remove("show");
  evoCardsContainer.innerHTML = "";
  if (game) {
    game.scene.scenes[0].scene.resume();
  }
});

// ----------------------------------------------------------------
// 游戏完成 → 结算页
// ----------------------------------------------------------------
window.addEventListener("game-complete", ((e: Event) => {
  const detail = (e as CustomEvent).detail as PlayerSummary;
  if (!detail) return;

  destroyGame();
  showSummary(detail);
}) as EventListener);

// ----------------------------------------------------------------
// 入口
// ----------------------------------------------------------------
init();
