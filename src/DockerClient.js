const http = require('http');
const { EventEmitter } = require('events');

const config = require('./config');
const { Container } = require('winston');

const {
  socket,
  enabled,
  containers: watchedContainers,
  interval,
} = config.docker;

function getContainers() {
  return new Promise((resolve, reject) => {
    const callback = (response) => {
      let body = '';

      response.on('data', (chunk) => {
        body += chunk;
      });

      response.on('end', () => {
        const data = JSON.parse(body + '');

        if (response.statusCode !== 200) {
          return reject({
            statusCode: response.statusCode,
            data,
          });
        }

        return resolve({
          statusCode: response.statusCode,
          data,
        });
      });

      response.on('error', err => {
        reject(err);
      });
    };

    const options = {
      socketPath: socket,
      path: '/v1.39/containers/json'
    };

      http.get(options, callback)
        .on('error', reject)
        .end(0);
  });
}

class DockerClient extends EventEmitter {
  constructor() {
    super();

    this._status = {
      online: false,
      status: 'Not running',
      containers: watchedContainers.map(name => ({
        name,
        running: false,
        state: 'Not running',
      })),
      error: null,
    };

    this.started = false;

    if (enabled) {
      this.startWatch();
    }
  }

  getStatus() {
    return JSON.parse(JSON.stringify(this._status));
  }

  _setStatus(online, status, containers, error) {
    const oldStatus = this.getStatus();

    this._status = {
      ...this._status,
      online,
      status,
      containers,
      error,
    };

    if (JSON.stringify(this._status) !== JSON.stringify(oldStatus)) {
      this.emit(DockerClient.DOCKER_STATUS_CHANGED, this.getStatus());
    }
  }

  startWatch() {
    this.started = true;
    this.watchContainers();
  }

  stopWatch() {
    this.started = false;
  }

  async watchContainers() {
    if (!this.started) {
      return;
    }

    let status = '';
    let online = false;
    let error = null;
    const containers = [];

    try {
      const { data: runningContainers } = await getContainers();

      watchedContainers.forEach((containerName) => {
        const runningContainer = runningContainers.find((c) => c.Names.some((name) => name.includes(containerName)));
        const container = {
          name: containerName,
          running: false,
          state: 'Not running',
        };

        if (runningContainer) {
          container.state = runningContainer.State;
        }
        if (runningContainer && runningContainer.State === 'running') {
          container.running = true;
        }

        containers.push(container);
      });

      const healthyCount = containers.filter((c) => c.running).length;
      const containerCount = containers.length;
  
      if (healthyCount === containerCount) {
        status = 'All containers running and healthy';
        online = true;
      } else {
        status = `${healthyCount}/${containerCount} healthy`;
        online = false;
      }
    } catch (err) {
      status = 'Server error';
      online = false;
      error = {
        message: err.message,
        stack: err.stack,
      }
    }


    this._setStatus(online, status, containers, error);

    setTimeout(() => this.watchContainers(), interval);
  }
}

DockerClient.DOCKER_STATUS_CHANGED = 'docker-status-changed';

module.exports = {
  dockerClient: new DockerClient(),
  DOCKER_STATUS_CHANGED: DockerClient.DOCKER_STATUS_CHANGED,
};
