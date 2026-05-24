import { resetTemplateSpecBuilder, tplEdge, tplNode, tplSpec } from "../templateSpecBuilder.js";

export function buildShopBotSpec() {
  resetTemplateSpecBuilder();
  const y0 = 0;
  const y1 = 140;
  const y2 = 280;
  const y3 = 420;
  const x0 = 0;
  const x1 = 280;

  const nodes = [
    tplNode("bot_1", "bot", { token: "YOUR_BOT_TOKEN" }, { x: x0, y: y0 }),
    tplNode(
      "global_products",
      "global",
      { varname: "products", value: "[]" },
      { x: x1, y: y0 },
    ),
    tplNode("start_1", "start", { cmd: "start" }, { x: x0, y: y1 }),
    tplNode(
      "msg_welcome",
      "message",
      { text: "🛍 Добро пожаловать в магазин! Нажмите «Каталог» или /catalog" },
      { x: x1, y: y1 },
    ),
    tplNode("cmd_catalog", "command", { cmd: "catalog" }, { x: x0, y: y2 }),
    tplNode(
      "fe_catalog",
      "foreach",
      {
        list: "products",
        var: "product",
        output: "inline_keyboard",
        labelField: "name",
        idField: "id",
        callbackPrefix: "prod:",
        columns: 2,
      },
      { x: x0, y: y2 + 70 },
    ),
    tplNode(
      "msg_catalog",
      "message",
      { text: "Выберите товар:" },
      { x: x1, y: y2 },
    ),
    tplNode("cb_product", "callback", { dataPrefix: "prod:" }, { x: x0, y: y3 }),
    tplNode(
      "msg_ordered",
      "message",
      { text: "✅ Товар выбран. Оформление заказа: {product}" },
      { x: x1, y: y3 },
    ),
  ];

  const edges = [
    tplEdge("start_1", "msg_welcome"),
    tplEdge("cmd_catalog", "msg_catalog"),
    tplEdge("msg_catalog", "fe_catalog"),
    tplEdge("cb_product", "msg_ordered"),
  ];

  return tplSpec(
    "shop_bot",
    {
      title: "Shop Bot",
      description: "Каталог товаров с inline-кнопками и оформлением заказа",
      tags: ["commerce", "catalog", "foreach", "inline"],
    },
    nodes,
    edges,
  );
}
