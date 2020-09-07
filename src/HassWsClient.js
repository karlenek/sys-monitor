const WebSocket = require('ws');
const log = require('./logger');
const { EventEmitter } = require('events');

const config = require('./config');

const {
  enabled,
  host,
  tls,
  interval = 1000,
  token,
} = config.hass;

class HassWsClient extends EventEmitter {
  constructor() {
    super();

    this._connected = false;
    this._connecting = false;
    this._disconnectReason = null;

    this._status = {
      online: false,
      status: 'Not connected',
      error: null,
    };

    if (!enabled) return;

    this.connect();
  }

  getStatus() {
    return JSON.parse(JSON.stringify(this._status));
  }

  _setStatus(online, status, error) {
    const oldStatus = this.getStatus();

    this._status = {
      ...this._status,
      status,
      online,
      error,
    };
    if (JSON.stringify(this._status) !== JSON.stringify(oldStatus)) {
      this.emit(HassWsClient.HASS_WS_STATUS_CHANGED, this.getStatus());
    }
  }

  _watchConnection() {
    if (this._watchingConnection) return;
    this._watchingConnection = true;

    setInterval(() => {
      if (!this._connected) return;
      this._client.ping();

      let pongReceived = false;

      const onPong = () => { pongReceived = true; };
      this._client.once('pong', onPong);

      setTimeout(() => {
        if (pongReceived) return;

        this._client.removeListener('pong', onPong);
        this._disconnectReason = 'Server not responding to ping';
        this._client.terminate();
      }, 1500);
    }, 5000);
  }

  _login() {
    log.debug('[HASS:WS]: Authenticating...')
    this._client.send(JSON.stringify({
      type: 'auth',
      access_token: `${token || process.env.SUPERVISOR_TOKEN}`,
    }));

    setTimeout(() => {
      if (!this._connected && this._connecting) {
        this._disconnectReason = 'Server never responded to auth request';
        this._client.close();
      }
    }, 3000)
  }

  _authFailed() {
    log.warn(`[HASS:WS]: Failed connecting to ${host}, invalid apiKey`);
    this._retryConnection = false;
    this._disconnectReason = 'Failed to authenticate with server';
    this._client.close();
  }
  
  _authSucceded() {
    log.debug(`[HASS:WS]: Authenticated to ${host}`);
    this._connected = true;

    this._disconnectReason = null;
    this._error = null;

    this._setStatus(true, 'Connected', null);
  }

  _onMessage(message) {
    const { type, ...data } = JSON.parse(message);

    switch (type) {
      case 'auth_required':
        return this._login();
      case 'auth_invalid':
        return this._authFailed();
      case 'auth_ok':
        return this._authSucceded();
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

    if (token) {
      connectionUrl = `${connectionUrl}/api/websocket`;
    } else {
      connectionUrl = `${connectionUrl}/core/websocket`;
    }

    this._client = new WebSocket(connectionUrl);
    
    this._client.on('close', () => {
      this._connected = false;
      this._connecting = false;

      this._setStatus(false, this._disconnectReason || 'Not connected', this._error);

      this._disconnectReason = null;
      this._error = null;
        
      log.debug(`[HASS:WS]: Not connected, retrying in ${interval / 1000} seconds`);
      
      if (this._retryConnection) {
        setTimeout(() => { this.connect() }, interval);
      }
    });
  
    this._client.on('error', (err) => {
      log.debug(err);

      this._error = {
        message: err.message,
        stack: err.stack,
      };
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
};

HassWsClient.HASS_WS_STATUS_CHANGED = 'hass-ws-status-changed';

module.exports = {
  hassWsClient: new HassWsClient(),
  HASS_WS_STATUS_CHANGED: HassWsClient.HASS_WS_STATUS_CHANGED,
};
