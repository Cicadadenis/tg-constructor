import { resetTemplateSpecBuilder, tplEdge, tplNode, tplSpec } from "../templateSpecBuilder.js";

export function buildAdminPanelSpec() {
  resetTemplateSpecBuilder();
  const nodes = [
    tplNode("bot_1", "bot", { token: "YOUR_BOT_TOKEN" }, { x: 0, y: 0 }),
    tplNode(
      "global_admins",
      "global",
      { varname: "admin_ids", value: "[]" },
      { x: 280, y: 0 },
    ),
    tplNode("start_1", "start", {}, { x: 0, y: 140 }),
    tplNode(
      "req_admin",
      "require_role",
      { role: "admin", message: "⛔ Доступ только для администраторов" },
      { x: 280, y: 140 },
    ),
    tplNode(
      "msg_panel",
      "message",
      {
        text: "🛠 Панель администратора\n/stats — статистика\n/users — пользователи\n/broadcast — рассылка",
      },
      { x: 0, y: 280 },
    ),
    tplNode("cmd_stats", "command", { cmd: "stats" }, { x: 0, y: 420 }),
    tplNode(
      "msg_stats",
      "message",
      { text: "📊 Статистика: пользователей — {users_count}" },
      { x: 280, y: 420 },
    ),
    tplNode("cmd_users", "command", { cmd: "users" }, { x: 0, y: 560 }),
    tplNode(
      "msg_users",
      "message",
      { text: "👥 Список пользователей загружается…" },
      { x: 280, y: 560 },
    ),
    tplNode("cmd_broadcast", "command", { cmd: "broadcast" }, { x: 0, y: 700 }),
    tplNode(
      "ask_broadcast",
      "ask",
      { question: "Текст рассылки:", varname: "broadcast_text" },
      { x: 280, y: 700 },
    ),
    tplNode(
      "msg_broadcast_ok",
      "message",
      { text: "📣 Рассылка поставлена в очередь." },
      { x: 0, y: 840 },
    ),
  ];

  const edges = [
    tplEdge("start_1", "req_admin"),
    tplEdge("req_admin", "msg_panel"),
    tplEdge("cmd_stats", "msg_stats"),
    tplEdge("cmd_users", "msg_users"),
    tplEdge("cmd_broadcast", "ask_broadcast"),
    tplEdge("ask_broadcast", "msg_broadcast_ok"),
  ];

  return tplSpec(
    "admin_panel",
    {
      title: "Admin Panel",
      description: "Команды администратора с проверкой роли admin",
      tags: ["admin", "require_role", "commands"],
    },
    nodes,
    edges,
  );
}
