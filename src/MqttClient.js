const mqtt = require('mqtt');
const { EventEmitter } = require('events');

const config = require('./config');

const {
  username,
  password,
  port,
  host,
  enabled,
  auth,
} = config.mqtt;

let mqttConfig = {
  port,
};

if (auth === true) {
  mqttConfig.username = username;
  mqttConfig.password = password;
}


class MqttClient extends EventEmitter {
  constructor() {
    super();

    if (!enabled) return;

    this._client = mqtt.connect(`mqtt://${host}`, mqttConfig);
    
    this._status = {
      online: false,
      status: 'Not connected',
      error: null,
    };

    this._client.on('error', (...args) => this._handleError(...args));
    this._client.on('connect', (...args) => this._handleConnected(...args));
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
      this.emit(MqttClient.MQTT_STATUS_CHANGED, this.getStatus());
    }
  }

  _handleError(err) {
    const error = {
      message: err.message,
      stack: err.stack || null,
    };

    let status = 'Not connected';
    let online = false;

    if (
      err.code && ['ENOTFOUND', 'ECONNREFUSED'].includes(err.code)
    ) {
      status = `Unable to connect to host, ${err.code}`;
    }

    if (err.code && err.code === 5) {
      status = 'Unable to connect to host, not authorized';
    }

    this._setStatus(online, status, error);
  }

  _handleConnected(event) {
    this._setStatus(true, 'Connected', null);
  }
};

MqttClient.MQTT_STATUS_CHANGED = 'mqtt-status-changed';

module.exports = {
  mqttClient: new MqttClient(),
  MQTT_STATUS_CHANGED: MqttClient.MQTT_STATUS_CHANGED,
};
