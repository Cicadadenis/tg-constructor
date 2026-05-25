/** @category basic_handlers — AI Assistant starter template */
import { handlerColumn, mergeColumns } from './helpers.js';

export const aiAssistant = mergeColumns(0, [
  handlerColumn(1, [
    { id: 'n_start', type: 'start' },
    { id: 'n_intro', type: 'message', props: { text: '🤖 Hi! I am your AI assistant.' } },
    { id: 'n_hint', type: 'message', props: { text: 'Ask a question — I will classify your intent and reply.' } },
    { id: 'n_kb', type: 'buttons', props: { rows: 'Ask a question, Tips' } },
  ]),
  handlerColumn(2, [
    { id: 'n_cb_ask', type: 'callback', props: { label: 'Ask a question' } },
    { id: 'n_ask_prompt', type: 'message', props: { text: '✍️ Type your question in the chat.' } },
    { id: 'n_ask_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(3, [
    { id: 'n_cb_tips', type: 'callback', props: { label: 'Tips' } },
    { id: 'n_tips_msg', type: 'message', props: { text: '💡 Connect an LLM block here for real AI replies.' } },
    { id: 'n_tips_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(4, [
    { id: 'n_else', type: 'on_text' },
    { id: 'n_classify', type: 'classify', props: { intents: 'question\norder\nother', varname: 'intent' } },
    { id: 'n_reply', type: 'message', props: { text: '🤖 Intent: {intent}. Add your AI provider step next.' } },
  ]),
]);
