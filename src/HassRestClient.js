const axios = require('axios');
const { EventEmitter } = require('events');

const config = require('./config');

const {
  enabled,
  host,
  tls,
  interval = 1000,
  token,
} = config.hass;


class HassRestClient extends EventEmitter {
  constructor() {
    super();

    this._pollInterval = 0;

    this._restClient = axios.create({
      baseURL: `${tls ? 'https' : 'http'}://${host.replace(/\/^/, '')}${!token ? '/core' : ''}/api`,
      headers: {
        Authorization: `Bearer ${token || process.env.SUPERVISOR_TOKEN}`,
      },
    });

    this._restStatus = {
      online: false,
      status: 'Not connected',
      error: null,
    };

    if (enabled) {
      this.startPoll();
    }
  }

  getRestStatus() {
    return JSON.parse(JSON.stringify(this._restStatus));
  }

  _setRestStatus(online, status, error) {
    const oldStatus = this.getRestStatus();

    this._restStatus = {
      ...this._restStatus,
      status,
      online,
      error,
    };
    if (JSON.stringify(this._restStatus) !== JSON.stringify(oldStatus)) {
      this.emit(HassRestClient.HASS_REST_STATUS_CHANGED, this.getRestStatus());
    }
  }

  startPoll() {
    if (this._pollInterval) {
      this.stopPoll();
    }

    this._pollInterval = setInterval(async () => {
      try {
        const response = await this._restClient.get('/');

        if (this._pollInterval === null) {
          return;
        }

        const { message } = response.data;

        this._setRestStatus(true, message, null);
      } catch (err) {
        const error = {
          message: err.message,
          stack: err.stack || null,
        };
    
        let status = '';
        let online = false;

        if (err.code === 'ECONNREFUSED') {
          status = `Not connected to server, ${err.code}`;
        } else if (err.response && err.response.status === 401) {
          status = 'Not connected to server, authentication failed';
        } else {
          status = `Not connected to server, ${err.code
            || (err.response || {}).status
            || 'unknown reason'}`;
        }

        if (this._pollInterval === null) {
          return;
        }

        this._setRestStatus(online, status, error);
      }
    }, interval);
  }

  stopPoll() {
    if (this._pollInterval !== null) {
      clearInterval(this._pollInterval);
    }

    this._pollInterval = null;
  }
}

HassRestClient.HASS_REST_STATUS_CHANGED = 'hass-rest-status-changed';

module.exports = {
  hassRestClient: new HassRestClient(),
  HASS_REST_STATUS_CHANGED: HassRestClient.HASS_REST_STATUS_CHANGED,
};
