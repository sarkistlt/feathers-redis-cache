##### This repository is a fork of [feathers-hooks-rediscache](https://github.com/idealley/feathers-hooks-rediscache), with the following changes:
- refactor and simplified API and source code (details bellow).
- support of feathers pagination hook, when it's enabled or disabled per the same endpoint.
- remove `hookCache` now to set custom expiration date you need to pass it as an option in before hook.
- remove `redisCache` from config.
- key always generated in before hook

###Installation

```
  yarn add feathers-redis-cache
```    
```
  npm install feathers-redis-cache
```    

## Purpose
The purpose of these hooks is to provide redis caching for APIs endpoints. Using redis is a very good option for clustering your API. As soon as a request is cached it is available to all the other nodes in the cluster, which is not true for usual in memory cache as each node has its own memory allocated. This means that each node has to cache all requests individually.

Each request to an endpoint can be cached. Route variables and params are cached on a per request base. If a param to call is set to true and then to false two responses will be cached.

The cache can be purged for an individual route, but also for a group of routes. This is very useful if you have an API endpoint that creates a list of articles, and an endpoint that returns an individual article. If the article is modified, the list of articles should, most likely, be purged as well. This can be done by calling one endpoint.

### Routes exemples
In the same fashion if you have many variants of the same endpoint that return similar content based on parameters you can bust the whole group as well:

```js
'/articles' // list
'/articles/article' //individual item
'/articles/article?markdown=true' // variant
```
#### Clearing cache
These are all listed in a redis list under `group-articles` and can be busted by calling `/cache/clear/group/articles`. All urls keys will be purged.

You can also purge single cached paths as by doing GET requests on 
```js
'/cache/clear/single/articles'
'/cache/clear/single/articles/article'
'/cache/clear/single/articles/article?markdown=true' // works with query strings too
```

or purge all by calling `/cache/clear/all`

It was meant to be used over **_HTTP_**, not yet tested with sockets.

### Configuration
#### Redis
To configure the redis connection the feathers configuration system can be used.
```js
//config/default.json
{
  "host": "localhost",
  "port": 3030,
  "redis": {
    "host": "my-redis-service.example.com",
    "port": 1234
  }
}
```
* if no config is provided, default config from the [redis module](https://github.com/NodeRedis/node_redis) is used

## Available hooks
More details and example use bellow

* `hooks.before(options)` - retrieves the data from redis
* `hooks.after(options)` - cache the data to redis
* `hooks.purge()` - purge cache from redis

####options properties (all props are optional)

##### cacheKey(context: `feathers-context`): `string`
In case if you want to use custom function to modify key name, you need to pass the same function in before and after hooks.

##### expiration: `number`
Time in seconds when to expire the key, this option need to be passed in after hook, if you won't pass it, default value of 1 day will be used.

##### env: `string`
The default environment is production, but it is annoying when running test as the hooks output information to the console. Therefore if you use this option, you can set `test` as an environment and the hooks will not output anything to the console. This is useful for CI or CLI.


Available routes:
```js
'/cache/clear/all' // clears the whole cache
'/cache/clear/single/:target' // clears a single route if you want to purge a route with params just adds them target?param=1
'/cache/clear/group/:target' // clears a group
```

## Complete Example

Here's an example of a Feathers server that uses `feathers-hooks-rediscache`.

```js
const feathers = require('feathers');
const rest = require('feathers-rest');
const hooks = require('feathers-hooks');
const bodyParser = require('body-parser');
const errorHandler = require('feathers-errors/handler');
const redisHook = require('feathers-hooks-rediscache');

// Initialize the application
const app = feathers()
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }))
  .configure(rest())
  .configure(hooks())
  // errorLogger is function for logging errors
  // if not passed console.error will bbe used
  .configure(redisHook.client({ errorLogger: logger.error }))
  // you can change cache path prefix by passing `pathPrefix` option
  // if not passed default prefix '/cache' will be used
  .configure(redisHook.services({ pathPrefix: '/cache' }))
  .use(errorHandler());

app.listen(3030);

console.log('Feathers app started on 127.0.0.1:3030');
```

Add hooks on the routes that need caching
```js
//services/<service>.hooks.js

const hooks = require('feathers-hooks-rediscache');


module.exports = {
  before: {
    all: [],
    find: [hooks.before()],
    get: [hooks.before()],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],
    find: [hooks.after({ expiration: 3600 * 24 * 7 })],
    get: [hooks.after({ expiration: 3600 * 24 * 7 })],
    create: [hooks.purge()],
    update: [hooks.purge()],
    patch: [hooks.purge()],
    remove: [hooks.purge()]
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};
```

###TODO:
- TS definitions
- test cases
- option in after hook to set limit of keys per group
## License

Copyright (c) 2018

Licensed under the [MIT license](LICENSE).