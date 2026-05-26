-- ============================================================
-- Phase 2 v2: 双层模型（玩家账户 → 存档槽位）
-- 在 Supabase Dashboard → SQL Editor 中粘贴执行
-- 
-- 如果之前有旧表，先执行下面两行清除：
--   DROP TABLE IF EXISTS saves CASCADE;
--   DROP TABLE IF EXISTS users CASCADE;
-- ============================================================

-- 1. 玩家账户表（username = 玩家用户名，唯一）
CREATE TABLE players (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username   TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 存档槽位表（每个玩家最多 3 个档）
CREATE TABLE save_slots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    UUID REFERENCES players(id) ON DELETE CASCADE,
  slot_index   INT NOT NULL CHECK (slot_index BETWEEN 1 AND 3),
  variant_name TEXT NOT NULL,                        -- 该档的变异体名字
  level        INT NOT NULL DEFAULT 1,               -- 当前关卡（0-based）
  player_data  JSONB NOT NULL DEFAULT '{}'::jsonb,   -- 完整 Player 状态
  saved_at     TIMESTAMPTZ DEFAULT now()
);

-- 一个玩家 + 槽位号 唯一
CREATE UNIQUE INDEX idx_save_slots ON save_slots(player_id, slot_index);

-- 3. 公开访问策略（无 Supabase Auth）
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE save_slots ENABLE ROW LEVEL SECURITY;

-- players 表
CREATE POLICY "public_select_players" ON players FOR SELECT USING (true);
CREATE POLICY "public_insert_players" ON players FOR INSERT WITH CHECK (true);

-- save_slots 表
CREATE POLICY "public_select_slots" ON save_slots FOR SELECT USING (true);
CREATE POLICY "public_insert_slots" ON save_slots FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_slots" ON save_slots FOR UPDATE USING (true);
CREATE POLICY "public_delete_slots" ON save_slots FOR DELETE USING (true);
