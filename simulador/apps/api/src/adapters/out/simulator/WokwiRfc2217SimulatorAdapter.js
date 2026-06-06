import { EventEmitter } from 'node:events';
import net from 'node:net';

export class WokwiRfc2217SimulatorAdapter extends EventEmitter {
  constructor({ host = '127.0.0.1', port = 4000, reconnectMs = 2000 } = {}) {
    super();
    this.host = host;
    this.port = port;
    this.reconnectMs = reconnectMs;
    this.socket = null;
    this.connected = false;
    this.buffer = '';
    this.reconnectTimer = null;
  }

  start() {
    this.connect();
  }

  connect() {
    if (this.socket || this.reconnectTimer) return;
    const socket = net.createConnection({ host: this.host, port: this.port });
    this.socket = socket;

    socket.on('connect', () => {
      this.connected = true;
      this.emit('status', { connected: true });
      this.sendCommand('GET');
    });

    socket.on('data', data => this.handleData(data));
    socket.on('error', () => this.scheduleReconnect());
    socket.on('close', () => this.scheduleReconnect());
  }

  sendCommand(command) {
    if (!this.connected || !this.socket) return false;
    this.socket.write(`${command}\n`);
    return true;
  }

  handleData(data) {
    this.buffer += sanitizeSerialBytes(data);
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || '';
    for (const line of lines) {
      const jsonLine = extractJsonLine(line);
      if (!jsonLine) continue;
      try {
        const telemetry = JSON.parse(jsonLine);
        if (!telemetry.error && telemetry.temp !== undefined) {
          this.emit('telemetry', telemetry);
        }
      } catch {
        // RFC2217 can include Telnet negotiation bytes. Ignore non-JSON fragments.
      }
    }
  }

  scheduleReconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    if (this.connected) {
      this.connected = false;
      this.emit('status', { connected: false });
    }
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectMs);
  }
}

function sanitizeSerialBytes(buffer) {
  let text = '';
  for (const byte of buffer) {
    if (byte === 10 || byte === 13 || byte === 9 || (byte >= 32 && byte <= 126)) {
      text += String.fromCharCode(byte);
    }
  }
  return text;
}

function extractJsonLine(line) {
  const start = line.indexOf('{');
  const end = line.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return line.slice(start, end + 1);
}
