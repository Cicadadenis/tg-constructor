import fs from 'node:fs';

/**
 * Inline <script> blocks need a nonce matching helmet CSP (see server.mjs).
 * sendFile() alone leaves scripts blocked — dev pages stay blank.
 */
export function sendHtmlWithCspNonce(res, filePath) {
  const nonce = res.locals?.cspNonce;
  if (!nonce) {
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) res.status(404).send('Not found');
    });
    return;
  }
  let html;
  try {
    html = fs.readFileSync(filePath, 'utf8');
  } catch {
    if (!res.headersSent) res.status(404).send('Not found');
    return;
  }
  const patched = html.replace(
    /<script(?![^>]*\bsrc=)(?![^>]*\bnonce=)/gi,
    `<script nonce="${nonce}"`,
  );
  res.type('html').send(patched);
}
