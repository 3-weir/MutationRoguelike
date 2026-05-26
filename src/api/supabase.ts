// ================================================================
// Supabase 客户端 — 连接远程数据库，接口签名与 mock 版完全一致
// ================================================================

import { createClient } from "@supabase/supabase-js";

// ----------------------------------------------------------------
// 初始化 Supabase 客户端
// ----------------------------------------------------------------
const SUPABASE_URL = "https://zbjglfdfhbcgmfaxgrde.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiamdsZmRmaGJjZ21mYXhncmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MTIwNDEsImV4cCI6MjA5NTE4ODA0MX0.07vJYY7284d1GmHaM9VzelNndatLcCEO6KOZYBCrDNg";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------------------------------------------------------
// 类型定义（与 mock 版一致）
// ----------------------------------------------------------------

export interface PlayerInfo {
  id: string;
  username: string;
}

export interface SaveSlot {
  id: string;
  player_id: string;
  slot_index: number;
  variant_name: string;
  level: number;
  player_data: Record<string, unknown>;
  saved_at: string;
}

// ----------------------------------------------------------------
// 玩家账户 API
// ----------------------------------------------------------------

/** 注册：检查用户名是否已被占用 → 未占用就创建玩家 */
export async function registerPlayer(username: string): Promise<{
  ok: boolean;
  player?: PlayerInfo;
  reason?: "taken" | "error";
}> {
  try {
    const { data, error } = await supabase
      .from("players")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (error) return { ok: false, reason: "error" };
    if (data) return { ok: false, reason: "taken" };

    const { data: newPlayer, error: insertErr } = await supabase
      .from("players")
      .insert({ username })
      .select()
      .single();

    if (insertErr) { console.error("[registerPlayer insert]", insertErr); return { ok: false, reason: "error" }; }
    if (!newPlayer) return { ok: false, reason: "error" };
    return { ok: true, player: { id: newPlayer.id, username: newPlayer.username } };
  } catch (e) {
    console.error("[registerPlayer]", e);
    return { ok: false, reason: "error" };
  }
}

/** 登录：查找已有玩家 */
export async function loginPlayer(username: string): Promise<{
  ok: boolean;
  player?: PlayerInfo;
  reason?: "not_found" | "error";
}> {
  try {
    const { data, error } = await supabase
      .from("players")
      .select()
      .eq("username", username)
      .maybeSingle();

    if (error) return { ok: false, reason: "error" };
    if (!data) return { ok: false, reason: "not_found" };
    return { ok: true, player: { id: data.id, username: data.username } };
  } catch {
    return { ok: false, reason: "error" };
  }
}

// ----------------------------------------------------------------
// 存档槽位 API
// ----------------------------------------------------------------

/** 获取某玩家的全部存档槽位（返回 3 项数组，未占用的为 null） */
export async function getSaveSlots(playerId: string): Promise<(SaveSlot | null)[]> {
  const { data, error } = await supabase
    .from("save_slots")
    .select()
    .eq("player_id", playerId);

  if (error || !data) return [null, null, null];

  const result: (SaveSlot | null)[] = [null, null, null];
  for (const slot of data) {
    result[(slot.slot_index as number) - 1] = slot as SaveSlot;
  }
  return result;
}

/** 在空槽位创建新存档 */
export async function createSaveSlot(
  playerId: string,
  slotIndex: number,
  variantName: string,
): Promise<{
  ok: boolean;
  slot?: SaveSlot;
  reason?: "occupied" | "error";
}> {
  try {
    const { data: existing } = await supabase
      .from("save_slots")
      .select("id")
      .eq("player_id", playerId)
      .eq("slot_index", slotIndex)
      .maybeSingle();

    if (existing) return { ok: false, reason: "occupied" };

    const { data, error } = await supabase
      .from("save_slots")
      .insert({
        player_id: playerId,
        slot_index: slotIndex,
        variant_name: variantName,
        level: 0,
        player_data: {},
      })
      .select()
      .single();

    if (error || !data) return { ok: false, reason: "error" };
    return { ok: true, slot: data as SaveSlot };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** 保存/更新游戏存档 */
export async function saveGame(
  slotId: string,
  level: number,
  playerData: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("save_slots")
    .update({
      level,
      player_data: playerData,
      saved_at: new Date().toISOString(),
    })
    .eq("id", slotId);

  if (error) throw new Error(`[saveGame] ${error.message}`);
}

/** 读取存档 */
export async function loadSave(slotId: string): Promise<SaveSlot | null> {
  const { data, error } = await supabase
    .from("save_slots")
    .select()
    .eq("id", slotId)
    .maybeSingle();

  if (error || !data) return null;
  return data as SaveSlot;
}

/** 删除存档槽位 */
export async function deleteSlot(slotId: string): Promise<void> {
  const { error } = await supabase
    .from("save_slots")
    .delete()
    .eq("id", slotId);

  if (error) throw new Error(`[deleteSlot] ${error.message}`);
}
