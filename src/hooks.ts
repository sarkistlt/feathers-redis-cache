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

function hashCode(s: string): string {
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
  let cursor = '0';

  function scan() {
    return new Promise((resolve, reject) => {
      client.scan(cursor, 'MATCH', `${prefix}${group}*`, 'COUNT', '1000', function (err, reply) {
        if (err) reject(err);
        if (!Array.isArray(!reply[1]) || !reply[1][0]) return resolve();

        cursor = reply[0];
        const keys = reply[1];
        const batchKeys = keys.reduce((a, c) => {
          if (Array.isArray(a[a.length - 1]) && a[a.length - 1].length < 2) {
            a[a.length - 1].push(c);
          } else if (!Array.isArray(a[a.length - 1]) || a[a.length - 1].length >= 2) {
            a.push([c]);
          }
          return a;
        }, []);

        async.eachOfLimit(batchKeys, 10, (batch, idx, cb) => {
          if (client.unlink) {
            client.unlink(batch, cb);
          } else {
            client.del(batch, cb);
          }
        }, (err) => err ? reject(err) : resolve());
      });

      return scan();
    });
  }

  return scan();
}

export default {
  before(passedOptions) {
    if (DISABLE_REDIS_CACHE) {
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

          const path = typeof options.cacheKey === 'function' ?
            options.cacheKey(hook) :
            cacheKey(hook);

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
  after(passedOptions) {
    if (DISABLE_REDIS_CACHE) {
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
          const group = hook.path ? hashCode(`group-${hook.path}`) : '';

          if (!client) {
            return resolve(hook);
          }

          client.set(cacheKey, JSON.stringify({
            cache: hook.result,
            expiresOn: moment().add(moment.duration(duration, 'seconds')),
            group,
          }));
          client.expire(cacheKey, duration);
          client.rpush(group, cacheKey);

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
  purge() {
    if (DISABLE_REDIS_CACHE) {
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

        return new Promise((resolve) => {
          const client = hook.app.get('redisClient');
          const { prefix } = hook.app.get('redis');
          const targetGroup = hook.path;

          if (!client) {
            return {
              message: 'Redis unavailable',
              status: HTTP_SERVER_ERROR,
            };
          }

          purgeGroup(client, targetGroup, prefix)
            .then(() => resolve({
              message: `cache cleared for group ${targetGroup}`,
              status: HTTP_OK,
            }))
            .catch((err) => resolve({
              message: err.message,
              status: HTTP_SERVER_ERROR,
            }));
        });
      } catch (err) {
        console.error(err);
        return Promise.resolve(hook);
      }
    };
  },
};
