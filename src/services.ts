import { purgeGroup } from './hooks';

const { DISABLE_REDIS_CACHE } = process.env;
const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;
const HTTP_SERVER_ERROR = 500;
const HTTP_NOT_FOUND = 404;

const serviceClearSingle = {
  setup(app, path) {
    this.app = app;
    this.path = path;
  },
  async find(params) {
    const client = this.app.get('redisClient');
    const { target } = params.query;

    if (!target) {
      return {
        message: 'You must provide key',
        status: HTTP_NOT_FOUND
      };
    }

    if (!client) {
      return {
        message: 'Redis unavailable',
        status: HTTP_SERVER_ERROR
      };
    }

    return new Promise((resolve) => {
      const del = client.unlink || client.del;
      client.get(target, (err, reply) => {
        if (err) {
          return resolve({ message: 'something went wrong' + err.message });
        }

        if (!reply) {
          return resolve({
            message: `cache already cleared for key ${target}`,
            status: HTTP_NO_CONTENT
          });
        }

        del(target, (err, reply) => {
          if (err) {
            return resolve({ message: 'something went wrong' + err.message });
          }

          if (!reply) {
            return resolve({
              message: `cache already cleared for key ${target}`,
              status: HTTP_NO_CONTENT
            });
          }

          resolve({
            message: `cache cleared for key ${target}`,
            status: HTTP_OK
          });
        });
      });
    });
  },
};
const serviceClearGroup = {
  setup(app, path) {
    this.app = app;
    this.path = path;
  },
  async find(params) {
    const client = this.app.get('redisClient');
    const { prefix } = this.app.get('redis');
    const { target } = params.query;

    if (!client) {
      return {
        message: 'Redis unavailable',
        status: HTTP_SERVER_ERROR
      };
    }

    return purgeGroup(client, target, prefix)
      .then(() => ({
        message: `cache cleared for group ${target}`,
        status: HTTP_OK,
      }))
      .catch((err) => ({
        message: err.message,
        status: HTTP_SERVER_ERROR,
      }));
  },
};
const serviceClearAll = {
  setup(app, path) {
    this.app = app;
    this.path = path;
  },
  async find() {
    const client = this.app.get('redisClient');
    const { prefix } = this.app.get('redis');

    if (!client) {
      return {
        message: 'Redis unavailable',
        status: HTTP_SERVER_ERROR
      };
    }

    return purgeGroup(client, '', prefix)
      .then(() => ({
        message: 'cache cleared',
        status: HTTP_OK,
      }))
      .catch((err) => ({
        message: err.message,
        status: HTTP_SERVER_ERROR,
      }));
  },
};
const serviceFlashDb = {
  setup(app, path) {
    this.app = app;
    this.path = path;
  },
  async find() {
    const client = this.app.get('redisClient');

    if (!client) {
      return {
        message: 'Redis unavailable',
        status: HTTP_SERVER_ERROR
      };
    }

    return new Promise((resolve) => {
      client.flushdb(() => {
        resolve({
          message: 'Cache cleared',
          status: HTTP_OK
        });
      });
    });
  },
};

export default (options: any = {}) => {
  const pathPrefix = options.pathPrefix || '/cache';

  return function () {
    const app = this;

    if (!DISABLE_REDIS_CACHE) {
      app.use(`${pathPrefix}/clear/single`, serviceClearSingle);
      app.use(`${pathPrefix}/clear/group`, serviceClearGroup);
      app.use(`${pathPrefix}/clear/all`, serviceClearAll);
      app.use(`${pathPrefix}/flashdb`, serviceFlashDb);
    }
  };
}

