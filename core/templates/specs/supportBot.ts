import { resetTemplateSpecBuilder, tplEdge, tplNode, tplSpec } from "../templateSpecBuilder.js";

export function buildSupportBotSpec() {
  resetTemplateSpecBuilder();
  const nodes = [
    tplNode("bot_1", "bot", { token: "YOUR_BOT_TOKEN" }, { x: 0, y: 0 }),
    tplNode("start_1", "start", {}, { x: 0, y: 140 }),
    tplNode(
      "msg_help",
      "message",
      { text: "🎧 Поддержка. Опишите проблему — мы создадим тикет." },
      { x: 280, y: 140 },
    ),
    tplNode(
      "ask_issue",
      "ask",
      { question: "Опишите вашу проблему:", varname: "issue" },
      { x: 0, y: 280 },
    ),
    tplNode(
      "set_ticket",
      "set_variable",
      { name: "ticket", value: "issue" },
      { x: 280, y: 280 },
    ),
    tplNode(
      "msg_ticket_ok",
      "message",
      { text: "✅ Тикет создан. Номер обращения сохранён." },
      { x: 0, y: 420 },
    ),
    tplNode("cmd_status", "command", { cmd: "status" }, { x: 0, y: 560 }),
    tplNode(
      "get_ticket",
      "get_variable",
      { name: "ticket", varname: "ticket" },
      { x: 280, y: 560 },
    ),
    tplNode(
      "msg_status",
      "message",
      { text: "📋 Статус тикета: {ticket}" },
      { x: 0, y: 700 },
    ),
  ];

  const edges = [
    tplEdge("start_1", "ask_issue"),
    tplEdge("ask_issue", "set_ticket"),
    tplEdge("set_ticket", "msg_ticket_ok"),
    tplEdge("cmd_status", "get_ticket"),
    tplEdge("get_ticket", "msg_status"),
  ];

  return tplSpec(
    "support_bot",
    {
      title: "Support Bot",
      description: "Приём обращений, FSM-вопрос и проверка статуса тикета",
      tags: ["support", "ask", "ticket"],
    },
    nodes,
    edges,
  );
}
