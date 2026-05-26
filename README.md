# 🧬 变异吧！人类！

TypeScript + Phaser 3 变异体生存 Roguelike 小游戏，搭载 Supabase 后端实现存档系统。

---

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Supabase（后端）

在项目根目录复制 `.env.example` 为 `.env` 并填入：

```bash
cp .env.example .env
```

`.env` 内容：

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### 3. 启动开发服务器

```bash
npm run dev
```

浏览器打开 Vite 输出的地址即可开始游戏。

---

## 可用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动开发服务器（热更新） |
| `npm run build` | 编译 TypeScript + Vite 打包 |
| `npm run preview` | 预览打包产物 |

---

## 技术栈

- **前端**: Phaser 3 + TypeScript + Vite
- **后端**: Supabase (PostgreSQL + 自动 REST API)
- **无密码认证**: 用户名即身份，注册查重 / 登录查存在
