import { createImmerStore } from '../../stores/createStore.js';
import { createSubscriberApi } from './subscriberApi.js';

const initial = {
  botId: null,
  subscribers: [],
  segments: [],
  tagDefinitions: [],
  customFieldDefinitions: [],
  selectedSubscriberId: null,
  selectedSubscriber: null,
  selectedEvents: [],
  selectedSessions: [],
  listLoading: false,
  detailLoading: false,
  segmentsLoading: false,
  saveBusy: false,
  error: null,
  lastLoadedAt: null,
};

export const useSubscriberStore = createImmerStore((set, get) => ({
  ...initial,

  setBotId: (botId) => set((s) => {
    s.botId = botId ?? null;
  }),

  reset: () => set((s) => {
    Object.assign(s, { ...initial });
  }),

  loadSubscribers: async (botId) => {
    const id = botId ?? get().botId;
    if (!id) return;
    set((s) => {
      s.listLoading = true;
      s.error = null;
      s.botId = id;
    });
    try {
      const api = createSubscriberApi(id);
      const { subscribers } = await api.listSubscribers();
      set((s) => {
        s.subscribers = subscribers ?? [];
        s.listLoading = false;
        s.lastLoadedAt = Date.now();
      });
    } catch (err) {
      set((s) => {
        s.listLoading = false;
        s.error = err?.message || 'load_failed';
      });
    }
  },

  loadCatalog: async (botId) => {
    const id = botId ?? get().botId;
    if (!id) return;
    const api = createSubscriberApi(id);
    try {
      const [tagsRes, fieldsRes, segRes] = await Promise.all([
        api.listTags(),
        api.listCustomFields(),
        api.listSegments(),
      ]);
      set((s) => {
        s.tagDefinitions = tagsRes.tags ?? [];
        s.customFieldDefinitions = fieldsRes.fields ?? [];
        s.segments = segRes.segments ?? [];
      });
    } catch (err) {
      set((s) => {
        s.error = err?.message || 'catalog_load_failed';
      });
    }
  },

  selectSubscriber: async (subscriberId) => {
    const botId = get().botId;
    if (!botId || !subscriberId) return;
    set((s) => {
      s.selectedSubscriberId = subscriberId;
      s.detailLoading = true;
      s.error = null;
    });
    try {
      const api = createSubscriberApi(botId);
      const [detail, eventsRes, sessionsRes] = await Promise.all([
        api.getSubscriber(subscriberId),
        api.listEvents(subscriberId),
        api.listSessions(subscriberId),
      ]);
      set((s) => {
        s.selectedSubscriber = detail.subscriber ?? null;
        s.selectedEvents = detail.events ?? eventsRes.events ?? [];
        s.selectedSessions = sessionsRes.sessions ?? [];
        s.detailLoading = false;
      });
    } catch (err) {
      set((s) => {
        s.detailLoading = false;
        s.error = err?.message || 'detail_load_failed';
      });
    }
  },

  addTag: async (subscriberId, tag) => {
    const botId = get().botId;
    if (!botId) return;
    set((s) => { s.saveBusy = true; });
    try {
      const api = createSubscriberApi(botId);
      const { subscriber } = await api.addTag(subscriberId, tag);
      set((s) => {
        s.saveBusy = false;
        if (s.selectedSubscriberId === subscriberId) {
          s.selectedSubscriber = subscriber;
        }
        const idx = s.subscribers.findIndex((x) => x.id === subscriberId);
        if (idx >= 0) s.subscribers[idx] = subscriber;
      });
      return subscriber;
    } catch (err) {
      set((s) => {
        s.saveBusy = false;
        s.error = err?.message || 'tag_failed';
      });
      throw err;
    }
  },

  removeTag: async (subscriberId, tag) => {
    const botId = get().botId;
    if (!botId) return;
    set((s) => { s.saveBusy = true; });
    try {
      const api = createSubscriberApi(botId);
      const { subscriber } = await api.removeTag(subscriberId, tag);
      set((s) => {
        s.saveBusy = false;
        if (s.selectedSubscriberId === subscriberId) s.selectedSubscriber = subscriber;
        const idx = s.subscribers.findIndex((x) => x.id === subscriberId);
        if (idx >= 0) s.subscribers[idx] = subscriber;
      });
      return subscriber;
    } catch (err) {
      set((s) => {
        s.saveBusy = false;
        s.error = err?.message || 'untag_failed';
      });
      throw err;
    }
  },

  setField: async (subscriberId, key, value) => {
    const botId = get().botId;
    if (!botId) return;
    set((s) => { s.saveBusy = true; });
    try {
      const api = createSubscriberApi(botId);
      const { subscriber } = await api.setField(subscriberId, key, value);
      set((s) => {
        s.saveBusy = false;
        if (s.selectedSubscriberId === subscriberId) s.selectedSubscriber = subscriber;
      });
      return subscriber;
    } catch (err) {
      set((s) => {
        s.saveBusy = false;
        s.error = err?.message || 'field_failed';
      });
      throw err;
    }
  },

  createSegment: async ({ name, filter, description }) => {
    const botId = get().botId;
    if (!botId) return;
    set((s) => { s.segmentsLoading = true; });
    try {
      const api = createSubscriberApi(botId);
      const { segment } = await api.createSegment({ name, filter, description });
      set((s) => {
        s.segments = [...s.segments, segment];
        s.segmentsLoading = false;
      });
      return segment;
    } catch (err) {
      set((s) => {
        s.segmentsLoading = false;
        s.error = err?.message || 'segment_failed';
      });
      throw err;
    }
  },
}), 'subscriber');
