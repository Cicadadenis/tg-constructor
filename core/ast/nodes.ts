export interface CommandNode {
  id: string;
  type: "command";
  command: string;
  router?: string;
  next?: string[];
}

export interface MessageNode {
  id: string;
  type: "message";
  text: string;
  parseMode?: string;
  keyboard?: string;
}

export interface CallbackNode {
  id: string;
  type: "callback";
  callbackData: string;
  next?: string[];
}

export interface FSMNode {
  id: string;
  type: "fsm";
  state: string;
  next?: string[];
}
