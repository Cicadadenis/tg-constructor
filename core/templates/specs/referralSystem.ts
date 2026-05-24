import { resetTemplateSpecBuilder, tplEdge, tplNode, tplSpec } from "../templateSpecBuilder.js";

export function buildReferralSystemSpec() {
  resetTemplateSpecBuilder();
  const nodes = [
    tplNode("bot_1", "bot", { token: "YOUR_BOT_TOKEN" }, { x: 0, y: 0 }),
    tplNode(
      "global_refs",
      "global",
      { varname: "referral_stats", value: "{}" },
      { x: 280, y: 0 },
    ),
    tplNode("start_1", "start", {}, { x: 0, y: 140 }),
    tplNode(
      "msg_ref_intro",
      "message",
      {
        text: "🎁 Реферальная программа\nПриглашайте друзей — получайте бонусы!\nВаш код: {ref_code}",
      },
      { x: 280, y: 140 },
    ),
    tplNode(
      "set_ref_code",
      "set_variable",
      { name: "ref_code", value: "пользователь.id" },
      { x: 0, y: 280 },
    ),
    tplNode("cmd_invite", "command", { cmd: "invite" }, { x: 0, y: 420 }),
    tplNode(
      "msg_invite",
      "message",
      {
        text: "🔗 Поделитесь ссылкой:\nhttps://t.me/YOUR_BOT?start=ref_{ref_code}",
      },
      { x: 280, y: 420 },
    ),
    tplNode("cmd_my_refs", "command", { cmd: "my_refs" }, { x: 0, y: 560 }),
    tplNode(
      "get_ref_count",
      "get_variable",
      { name: "referral_count", varname: "referral_count" },
      { x: 280, y: 560 },
    ),
    tplNode(
      "msg_ref_stats",
      "message",
      { text: "📈 Приглашено друзей: {referral_count}" },
      { x: 0, y: 700 },
    ),
    tplNode(
      "remember_inviter",
      "remember",
      { varname: "invited_by", value: "start_payload" },
      { x: 0, y: 840 },
    ),
  ];

  const edges = [
    tplEdge("start_1", "msg_ref_intro"),
    tplEdge("msg_ref_intro", "set_ref_code"),
    tplEdge("set_ref_code", "remember_inviter"),
    tplEdge("cmd_invite", "msg_invite"),
    tplEdge("cmd_my_refs", "get_ref_count"),
    tplEdge("get_ref_count", "msg_ref_stats"),
  ];

  return tplSpec(
    "referral_system",
    {
      title: "Referral System",
      description: "Реферальные коды, приглашения и учёт приглашённых",
      tags: ["referral", "invite", "variables"],
    },
    nodes,
    edges,
  );
}
