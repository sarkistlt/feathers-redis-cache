/* eslint-disable no-console */
import redis from 'redis';
import chalk from 'chalk';

export default function client({ retryInterval = 5000 } = {}) {
  const app = this;
  const redisOptions = {
    ...this.get('redis'),
    retry_strategy: () => {
      app.set('redisClient', undefined);

      console.log(`${chalk.yellow('[redis]')} not connected`);

      return retryInterval;
    }
  };
  const client = redis.createClient(redisOptions);

  app.set('redisClient', client);

  client.on('ready', () => {
    app.set('redisClient', client);

    console.log(`${chalk.green('[redis]')} connected`);
  });

  return this;
}
