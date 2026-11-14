const Network = (() => {
  const ROOM_PREFIX = 'pong-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let peer = null;
  let conn = null;
  let hostRole = false;
  let cb = {};

  function makeRoomCode() {
    let s = '';
    for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return s;
  }

  function host(callbacks) {
    hostRole = true;
    cb = callbacks || {};
    const code = makeRoomCode();

    peer = new Peer(ROOM_PREFIX + code);
    peer.on('open', () => cb.onRoomCreated && cb.onRoomCreated(code));
    peer.on('connection', (c) => {
      if (conn) { c.close(); return; }
      conn = c;
      wireConnection();
    });
    peer.on('error', (err) => cb.onError && cb.onError(err));
    peer.on('disconnected', () => cb.onError && cb.onError(new Error('Verbindung zum Signalisierungsserver verloren')));
  }

  function join(code, callbacks) {
    hostRole = false;
    cb = callbacks || {};

    peer = new Peer();
    peer.on('open', () => {
      conn = peer.connect(ROOM_PREFIX + code.trim().toUpperCase(), { reliable: false });
      wireConnection();
    });
    peer.on('error', (err) => cb.onError && cb.onError(err));
  }

  function wireConnection() {
    conn.on('open', () => cb.onConnected && cb.onConnected());
    conn.on('data', (data) => cb.onData && cb.onData(data));
    conn.on('close', () => cb.onDisconnected && cb.onDisconnected());
    conn.on('error', (err) => cb.onError && cb.onError(err));
  }

  function send(obj) {
    if (conn && conn.open) {
      try { conn.send(obj); } catch (e) {}
    }
  }

  function isHost() { return hostRole; }

  function destroy() {
    if (conn) { try { conn.close(); } catch (e) {} }
    if (peer) { try { peer.destroy(); } catch (e) {} }
    conn = null;
    peer = null;
  }

  return { host, join, send, isHost, destroy };
})();
