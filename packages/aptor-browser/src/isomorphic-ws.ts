const browserWebSocket = globalThis.WebSocket;

// The Midnight indexer provider expects the named export in browser bundles,
// while isomorphic-ws 5 exposes only a default browser export.
export const WebSocket = browserWebSocket;
export default browserWebSocket;
