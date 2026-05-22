export function redactSecrets(value) {
  return String(value || '')
    .replace(/\/bot\d{6,12}:[A-Za-z0-9_-]{25,}/gi, '/bot***redacted***')
    .replace(/\b\d{6,12}:[A-Za-z0-9_-]{25,}\b/g, '***redacted***')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi, '$1 ***redacted***')
    .replace(/\b(token|secret|api[_-]?key|password|passwd|authorization|client_secret)\b(\s*[:=]\s*)(["']?)[^\s"',;]+/gi, '$1$2$3***redacted***')
    .replace(/(бот\s+["'])[^"'\r\n]{8,}(["'])/giu, '$1***redacted***$2')
    .replace(/\/(?:var|home|root|tmp|usr)[^\s'"]+/g, '[redacted:path]');
}

export function redactError(err) {
  if (err instanceof Error) {
    return new Error(redactSecrets(err.message));
  }
  return new Error(redactSecrets(String(err)));
}
