/** @category media */
import { handlerColumn, mergeColumns } from './helpers.js';

export const media = mergeColumns(0, [
  handlerColumn(1, [
    {
      id: 'n_cmds',
      type: 'commands',
      props: { commands: '/media - 🖼 Медиа' },
    },
  ], 20),
  handlerColumn(2, [
    { id: 'n_media', type: 'command', props: { cmd: 'media' } },
    { id: 'n_cap', type: 'message', props: { text: '🖼 Медиа-демо:' } },
    { id: 'n_photo', type: 'photo', props: { url: 'https://picsum.photos/640/360' } },
    { id: 'n_video', type: 'video', props: { url: 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4' } },
    {
      id: 'n_doc',
      type: 'document',
      props: { url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    },
    { id: 'n_done', type: 'message', props: { text: '✅ Готово.' } },
  ]),
  handlerColumn(3, [
    { id: 'n_on_photo', type: 'on_photo' },
    { id: 'n_photo_ack', type: 'message', props: { text: '📷 Фото получено' } },
  ]),
]);
