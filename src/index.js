const log = require('./logger');
const config = require('./config');
const logger = require('./logger');
const { mqttClient, MQTT_STATUS_CHANGED } = require('./MqttClient');
const { hassRestClient, HASS_REST_STATUS_CHANGED } = require('./HassRestClient');
const { hassWsClient, HASS_WS_STATUS_CHANGED } = require('./HassWsClient');

logger.init(config.log);

const status = {
  mqtt: {},
  hassRest: {},
  hassWs: {},
};

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
});
