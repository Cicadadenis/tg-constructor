/**
 * Subscriber CRM API client (product layer).
 */

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'request_failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * @param {string} botId
 */
export function createSubscriberApi(botId) {
  const base = `/api/bots/${encodeURIComponent(botId)}`;

  return {
    listSubscribers: () =>
      fetch(`${base}/subscribers`).then(parseJson),

    getSubscriber: (subscriberId) =>
      fetch(`${base}/subscribers/${encodeURIComponent(subscriberId)}`).then(parseJson),

    addTag: (subscriberId, tag) =>
      fetch(`${base}/subscribers/${encodeURIComponent(subscriberId)}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag }),
      }).then(parseJson),

    removeTag: (subscriberId, tag) =>
      fetch(`${base}/subscribers/${encodeURIComponent(subscriberId)}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE',
      }).then(parseJson),

    setField: (subscriberId, key, value) =>
      fetch(`${base}/subscribers/${encodeURIComponent(subscriberId)}/fields/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      }).then(parseJson),

    setVariable: (subscriberId, key, value) =>
      fetch(`${base}/subscribers/${encodeURIComponent(subscriberId)}/variables/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      }).then(parseJson),

    listTags: () => fetch(`${base}/tags`).then(parseJson),

    listCustomFields: () => fetch(`${base}/custom-fields`).then(parseJson),

    defineCustomField: (body) =>
      fetch(`${base}/custom-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(parseJson),

    listSegments: () => fetch(`${base}/segments`).then(parseJson),

    createSegment: (body) =>
      fetch(`${base}/segments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(parseJson),

    evaluateSegment: (segmentId) =>
      fetch(`${base}/segments/${encodeURIComponent(segmentId)}/evaluate`, {
        method: 'POST',
      }).then(parseJson),

    listEvents: (subscriberId, limit = 50) =>
      fetch(`${base}/subscribers/${encodeURIComponent(subscriberId)}/events?limit=${limit}`).then(parseJson),

    listSessions: (subscriberId) =>
      fetch(`${base}/subscribers/${encodeURIComponent(subscriberId)}/sessions`).then(parseJson),

    listEventTypes: () => fetch(`${base}/event-types`).then(parseJson),

    evaluateAudience: (body) =>
      fetch(`${base}/audience/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(parseJson),
  };
}
