const log = require('./logger');
const config = require('./config');
const { wsClient, CHANGE } = require('./WsClient');
const { mqttClient, MQTT_STATUS_CHANGED } = require('./MqttClient');
const { hassRestClient, HASS_REST_STATUS_CHANGED } = require('./HassRestClient');
const { hassWsClient, HASS_WS_STATUS_CHANGED } = require('./HassWsClient');
const { dockerClient, DOCKER_STATUS_CHANGED } = require('./DockerClient');

log.init(config.log);

const status = {
  mqtt: null,
  hassRest: null,
  hassWs: null,
  docker: null,
};

function sendStatus() {
  const services = [];

  if (status.mqtt) {
    const { mqtt } = status;

    services.push({
      id: 'mqtt',
      online: mqtt.online,
      status: mqtt.status,
      error: mqtt.error,
    });
  }

  if (status.hassRest && status.hassWs) {
    const { hassRest, hassWs } = status;

    services.push({
      id: 'hass',
      online: hassRest.online && hassWs.online,
      status: !hassRest.online ? hassRest.status : hassWs.status,
      error: hassRest.error || hassWs.error,
    });
  }

  if (status.docker) {
    const { docker } = status;

    services.push({
      id: 'docker',
      online: docker.online,
      status: docker.status,
      error: docker.error,
      containers: docker.containers,
    });
  }

  if (services.length) {
    try {
      wsClient.send('status', { services });
      log.debug('Sent status to server');
    } catch (err) {
      log.error('Failed to send update to sysm server');
      log.error(err);
    }
  }
}

setInterval(sendStatus, config.sysmServer.updateInterval || 2000);

wsClient.on('connected', () => {
  sendStatus();
});

mqttClient.on(MQTT_STATUS_CHANGED, (newStatus) => {
  status.mqtt = newStatus;

  if (newStatus.error) {
    log.error(newStatus.error);
  }

  if (newStatus.online) {
    log.info('[MQTT]: Online');
  } else {
    log.warn(`[MQTT]: Offline, ${newStatus.status}`);
  }

  sendStatus();
});

hassRestClient.on(HASS_REST_STATUS_CHANGED, (newStatus) => {
  status.hassRest = newStatus;

  if (newStatus.error) {
    log.error(newStatus.error);
  }

  if (newStatus.online) {
    log.info('[HASS:REST]: Online');
  } else {
    log.warn(`[HASS:REST]: Offline, ${newStatus.status}`);
  }

  sendStatus();
});

hassWsClient.on(HASS_WS_STATUS_CHANGED, (newStatus) => {
  status.hassWs = newStatus;

  if (newStatus.error) {
    log.error(newStatus.error);
  }

  if (newStatus.online) {
    log.info('[HASS:WS]: Online');
  } else {
    log.warn(`[HASS:WS]: Offline, ${newStatus.status}`);
  }

  sendStatus();
});

dockerClient.on(DOCKER_STATUS_CHANGED, (newStatus) => {
  status.docker = newStatus;

  if (newStatus.error) {
    log.error(newStatus.error);
  }

  if (newStatus.online) {
    log.info('[DOCKER]: Online');
  } else {
    log.warn(`[DOCKER]: Offline, ${newStatus.status}`);
  }

  sendStatus();
});
