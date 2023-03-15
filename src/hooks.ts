/* eslint-disable no-console */
import moment from 'moment/moment';
import chalk from 'chalk';
import qs from 'qs';
import async from 'async';

const { DISABLE_REDIS_CACHE, ENABLE_REDIS_CACHE_LOGGER } = process.env;
const HTTP_OK = 200;
const HTTP_SERVER_ERROR = 500;
const defaults = {
  defaultExpiration: 3600 * 24, // seconds
};

export function hashCode(s: string): string {
  let h;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return String(h);
}

function cacheKey(hook) {
  const q = hook.params.query || {};
  const p = hook.params.paginate === false ? 'disabled' : 'enabled';
  let path = `pagination-hook:${p}::${hook.path}`;

  if (hook.id) {
    path += `/${hook.id}`;
  }

  if (Object.keys(q).length > 0) {
    path += `?${qs.stringify(JSON.parse(JSON.stringify(q)), { encode: false })}`;
  }

  // {prefix}{group}{key}
  return `${hashCode(hook.path)}${hashCode(path)}`;
}

export async function purgeGroup(client, group: string, prefix: string = 'frc_') {
  return new Promise((resolve, reject) => {
    let cursor = '0';

    function scan() {
        client.scan(cursor, 'MATCH', `${prefix}${group}*`, 'COUNT', '10000', function (err, reply) {
          if (err) return reject(err);
          if (!Array.isArray(reply[1]) || !reply[1][0]) return resolve();

          cursor = reply[0];
          const keys = reply[1];
          const batchKeys = keys.reduce((a, c) => {
            if (Array.isArray(a[a.length - 1]) && a[a.length - 1].length < 100) {
              a[a.length - 1].push(c.replace(prefix, ''));
            } else if (!Array.isArray(a[a.length - 1]) || a[a.length - 1].length >= 100) {
              a.push([c.replace(prefix, '')]);
            }
            return a;
          }, []);

          async.eachOfLimit(batchKeys, 10, (batch, idx, cb) => {
            if (client.unlink) {
              client.unlink(batch, cb);
            } else {
              client.del(batch, cb);
            }
          }, (err) => {
            if (err) return reject(err);
            return scan();
          });
        });
    }

    return scan();
  });
}

export default {
  before(passedOptions: any = {}) {
    if (DISABLE_REDIS_CACHE === 'true') {
      return hook => hook;
    }

    return function (hook) {
      try {
        if (hook && hook.params && hook.params.$skipCacheHook) {
          return Promise.resolve(hook);
        }

        return new Promise(resolve => {
          const client = hook.app.get('redisClient');
          const options = { ...defaults, ...passedOptions };

          if (!client) {
            return resolve(hook);
          }

          const group = typeof options.cacheGroupKey === 'function' ?
            hashCode(`group-${options.cacheGroupKey(hook)}`) :
            hashCode(`group-${hook.path || 'general'}`);
          const path = typeof options.cacheKey === 'function' ?
            `${group}${options.cacheKey(hook)}` :
            `${group}${cacheKey(hook)}`;

          hook.params.cacheKey = path;

          client.get(path, (err, reply) => {
            if (err) {
              return resolve(hook);
            }

            if (reply) {
              const data = JSON.parse(reply);

              if (!data || !data.expiresOn || !data.cache) {
                return resolve(hook);
              }

              const duration = moment(data.expiresOn).format('DD MMMM YYYY - HH:mm:ss');

              hook.result = data.cache;
              hook.params.$skipCacheHook = true;

              if (options.env !== 'test' && ENABLE_REDIS_CACHE_LOGGER === 'true') {
                console.log(`${chalk.cyan('[redis]')} returning cached value for ${chalk.green(path)}.`);
                console.log(`> Expires on ${duration}.`);
              }

              return resolve(hook);
            }

            return resolve(hook);
          });
        });
      } catch (err) {
        console.error(err);
        return Promise.resolve(hook);
      }
    };
  },
  after(passedOptions: any = {}) {
    if (DISABLE_REDIS_CACHE === 'true') {
      return hook => hook;
    }

    return function (hook) {
      try {
        if (
          hook
          && hook.params
          && hook.params.$skipCacheHook
        ) {
          return Promise.resolve(hook);
        }

        if (!hook.result) {
          return Promise.resolve(hook);
        }

        return new Promise((resolve) => {
          const client = hook.app.get('redisClient');
          const options = { ...defaults, ...passedOptions };
          const duration = options.expiration || options.defaultExpiration;
          const { cacheKey } = hook.params;

          if (!client) {
            return resolve(hook);
          }

          client.set(cacheKey, JSON.stringify({
            cache: hook.result,
            expiresOn: moment().add(moment.duration(duration, 'seconds')),
          }));
          client.expire(cacheKey, duration);

          if (options.env !== 'test' && ENABLE_REDIS_CACHE_LOGGER === 'true') {
            console.log(`${chalk.cyan('[redis]')} added ${chalk.green(cacheKey)} to the cache.`);
            console.log(`> Expires in ${moment.duration(duration, 'seconds').humanize()}.`);
          }

          resolve(hook);
        });
      } catch (err) {
        console.error(err);
        return Promise.resolve(hook);
      }
    };
  },
  purge(passedOptions = {}) {
    if (DISABLE_REDIS_CACHE === 'true') {
      return hook => hook;
    }

    return function (hook) {
      try {
        return new Promise((resolve) => {
          const client = hook.app.get('redisClient');
          const options: any = { ...defaults, ...passedOptions };
          const { prefix } = hook.app.get('redis');
          const group = typeof options.cacheGroupKey === 'function' ?
            hashCode(`group-${options.cacheGroupKey(hook)}`) :
            hashCode(`group-${hook.path || 'general'}`);

          if (!client) {
            return {
              message: 'Redis unavailable',
              status: HTTP_SERVER_ERROR,
            };
          }

          purgeGroup(client, group, prefix)
            .catch((err) => console.error({
              message: err.message,
              status: HTTP_SERVER_ERROR,
            }));

          // do not wait for purge to resolve
          resolve(hook);
        });
      } catch (err) {
        console.error(err);
        return Promise.resolve(hook);
      }
    };
  },
};
