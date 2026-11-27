const ROOT = new URL('assets/hunger-media/', self.registration.scope);
const VIDEO = new URL('opening-v8.mp4', ROOT).href;
const HEADER_LENGTH = 35827;
const ORIGINAL_DATA_START = 28;
const VIDEO_LENGTH = 253576181;
const PART_LENGTH = 10485760;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.url === VIDEO) event.respondWith(serveVideo(event.request));
});

function parseRange(value) {
  if (!value) return [0, VIDEO_LENGTH - 1];
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, VIDEO_LENGTH - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), VIDEO_LENGTH - 1) : VIDEO_LENGTH - 1;
  return start <= end ? [start, end] : null;
}

// Serve the existing media bytes with the indexed MP4 header at the front.
// Each response reads only the numbered parts needed for the client's range.
function serveVideo(request) {
  const rangeHeader = request.headers.get('Range');
  const range = parseRange(rangeHeader);
  if (!range) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + VIDEO_LENGTH } });
  const [start, end] = range;
  const headers = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(end - start + 1),
  };
  if (rangeHeader) headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + VIDEO_LENGTH;
  return new Response(request.method === 'HEAD' ? null : streamRange(start, end), {
    status: rangeHeader ? 206 : 200,
    headers,
  });
}

function streamRange(start, end) {
  const abort = new AbortController();
  let position = start;
  let reader;
  let skip = 0;
  let remaining = 0;

  async function openPart() {
    let name, offset, length;
    if (position < HEADER_LENGTH) {
      name = 'hunger-intro-header.bin';
      offset = position;
      length = HEADER_LENGTH - offset;
    } else {
      const physical = position - HEADER_LENGTH + ORIGINAL_DATA_START;
      const index = Math.floor(physical / PART_LENGTH);
      name = 'hunger-intro-' + String(index).padStart(2, '0') + '.bin';
      offset = physical % PART_LENGTH;
      length = PART_LENGTH - offset;
    }
    remaining = Math.min(length, end - position + 1);
    const response = await fetch(new URL(name, ROOT), {
      headers: { Range: 'bytes=' + offset + '-' + (offset + remaining - 1) },
      signal: abort.signal,
    });
    if (!response.ok || !response.body) throw new Error('Could not read opening video: ' + response.status);
    skip = response.status === 206 ? 0 : offset;
    reader = response.body.getReader();
  }

  return new ReadableStream({
    async pull(controller) {
      if (position > end) {
        controller.close();
        return;
      }
      if (!reader) await openPart();
      while (true) {
        const { value, done } = await reader.read();
        if (done) throw new Error('Opening video part ended early');
        if (skip >= value.length) {
          skip -= value.length;
          continue;
        }
        const chunk = value.subarray(skip, skip + remaining);
        skip = 0;
        position += chunk.length;
        remaining -= chunk.length;
        controller.enqueue(chunk);
        if (!remaining) {
          reader.cancel().catch(() => {});
          reader = null;
        }
        if (position > end) controller.close();
        return;
      }
    },
    cancel() {
      abort.abort();
      if (reader) reader.cancel().catch(() => {});
    },
  });
}
