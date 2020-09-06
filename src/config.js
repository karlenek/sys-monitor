const convict = require('convict');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const config = convict({
  configPath: {
    format: 'String',
    default: './config.json',
    env: 'SYSM_CONFIG_PATH',
  },
  interval: {
    format: 'Number',
    default: 1000,
    env: 'SYSM_INTERVAL',
  },
  log: {
    level: {
      format: 'String',
      default: 'info',
      env: 'SYSM_LOG_LEVEL',
    },
  },
  mqtt: {
    enabled: {
      format: 'Boolean',
      default: true,
      env: 'SYSM_MQTT_ENABLED',
    },
    host: {
      format: 'String',
      default: 'localhost',
      env: 'SYSM_MQTT_HOST',
    },
    port: {
      format: 'Number',
      default: 1883,
      env: 'SYSM_MQTT_PORT',
    },
    auth: {
      format: 'Boolean',
      default: true,
      env: 'SYSM_MQTT_USE_AUTH',
    },
    username: {
      format: 'String',
      default: '',
      env: 'SYSM_MQTT_USERNAME',
    },
    password: {
      format: 'String',
      sensitive: true,
      default: '',
      env: 'SYSM_MQTT_PASSWORD',
    },
  },
  hass: {
    enabled: {
      format: 'Boolean',
      default: true,
      env: 'SYSM_HASS_ENABLED',
    },
    host: {
      format: 'String',
      default: 'http://supervisor/core',
      env: 'SYSM_HASS_HOST',
    },
    tls: {
      format: 'Boolean',
      default: true,
      env: 'SYSM_HASS_TLS',
    },
    interval: {
      format: 'Number',
      default: 2000,
      env: 'SYSM_HASS_INTERVAL',
    },
    token: {
      format: 'String',
      default: undefined,
      env: 'SYSM_MQTT_USERNAME',
    },
  },
});

const configPath = path.join(__dirname, '../', config.get('configPath'));
logger.info(`Loading configuration from ${configPath}`);

if (fs.existsSync(configPath)) {
  config.loadFile(configPath);
  logger.info('Loaded configuration file');
} else {
  logger.warn('Config not available, using default config');
}

config.validate();

module.exports = config.getProperties();
