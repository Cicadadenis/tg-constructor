export const NODE_CAPABILITIES = {
  command: {
    outputs: ["next"],
    inputs: [],
  },

  message: {
    outputs: ["next"],
    inputs: ["input"],
  },

  callback: {
    outputs: ["next"],
    inputs: ["input"],
  },

  fsm: {
    outputs: ["success", "fail"],
    inputs: ["input"],
  },
};
