/** @category fsm */
import { handlerColumn, mergeColumns } from './helpers.js';

export const fsm = mergeColumns(0, [
  handlerColumn(1, [
    { id: 'n_start', type: 'command', props: { cmd: 'profile' } },
    { id: 'n_ask1', type: 'ask', props: { question: 'Как вас зовут?', varname: 'name' } },
    { id: 'n_ask2', type: 'ask', props: { question: 'Город?', varname: 'city' } },
    { id: 'n_save', type: 'save', props: { key: 'profile_name', varname: 'name' } },
    { id: 'n_done', type: 'message', props: { text: '✅ {name}, {city}' } },
    { id: 'n_done_kb', type: 'buttons', props: { rows: '/profile' } },
  ]),
]);
