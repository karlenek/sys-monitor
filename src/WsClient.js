const WebSocket = require('ws');
const log = require('./logger');
const { EventEmitter } = require('events');

const config = require('./config');

const {
  enabled,
  host,
  appId,
  tls,
  token,
} = config.sysmServer;

const interval = 1000;

class WsClient extends EventEmitter {
  constructor() {
    super();

    this._connected = false;
    this._connecting = false;

    this.connect();
  }

  _login() {
    log.debug('[WS_CLIENT]: Authenticating...')
    this._client.send(JSON.stringify({
      type: 'auth',
      accessToken: token,
      appId,
    }));

    setTimeout(() => {
      if (!this._connected && this._connecting) {
        this._client.close();
      }
    }, 3000)
  }

  _authFailed(message) {
    log.warn(`[WS_CLIENT]: Failed connecting to ${host}, ${message}`);
    this._client.close();
  }
  
  _authSucceded() {
    log.debug(`[WS_CLIENT]: Authenticated to ${host}`);
    this.emit('connected');
    this._connected = true;
  }

  _onMessage(msg) {
    const { type, payload, message } = JSON.parse(msg);

    switch (type) {
      case 'auth_required':
        return this._login();
      case 'auth_failed':
        return this._authFailed(message);
      case 'auth_success':
        return this._authSucceded(message);
      default:
        break;
    }
  }

  connect() {
    if (this._connecting || this._connected) return;

    this._connecting = true;

    if (this._client) {
      this._client.terminate();
      this._client.removeAllListeners();
      this._client = null;
    }

    let connectionUrl = `${tls ? 'wss' : 'ws'}://${host.replace(/\/^/, '')}`;

    this._client = new WebSocket(connectionUrl);
    
    this._client.on('close', () => {
      this._connected = false;
      this._connecting = false;
        
      log.debug(`[WS_CLIENT]: Not connected, retrying in ${interval / 1000} seconds`);
      
      if (this._retryConnection) {
        setTimeout(() => { this.connect() }, interval);
      }
    });
  
    this._client.on('error', (err) => {
      log.error(err);
    });

    this._retryConnection = true;
    this._client.on('message', (...args) => this._onMessage(...args));
  }

  disconnect() {
    if (!this._client || !this._connecting) {
      return;
    }
    this._retryConnection = false;
    this._client.close();
  }

  send(type, { message, ...rest } = {}) {
    this._client.send(JSON.stringify({
      type,
      message,
      payload: {
        message,
        ...rest,
      },
    }));
  }
};

WsClient.CHANGE = 'change';

module.exports = {
  wsClient: new WsClient(),
  CHANGE: WsClient.CHANGE,
};
