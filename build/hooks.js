"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const moment_1 = __importDefault(require("moment/moment"));
const chalk_1 = __importDefault(require("chalk"));
const qs_1 = __importDefault(require("qs"));
const async_1 = __importDefault(require("async"));
const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;
const HTTP_SERVER_ERROR = 500;
const defaults = {
    defaultExpiration: 3600 * 24
};
function cacheKey(hook) {
    const q = hook.params.query || {};
    const p = hook.params.paginate === false ? 'disabled' : 'enabled';
    let path = `pagination-hook:${p}::${hook.path}`;
    if (hook.id) {
        path += `/${hook.id}`;
    }
    if (Object.keys(q).length > 0) {
        path += `?${qs_1.default.stringify(q, { encode: false })}`;
    }
    return path;
}
exports.default = {
    before(passedOptions) {
        return function (hook) {
            try {
                if (hook && hook.params && hook.params.$skipCacheHook) {
                    return Promise.resolve(hook);
                }
                return new Promise(resolve => {
                    const client = hook.app.get('redisClient');
                    const options = Object.assign({}, defaults, passedOptions);
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
                            const duration = moment_1.default(data.expiresOn).format('DD MMMM YYYY - HH:mm:ss');
                            hook.result = data.cache;
                            hook.params.$skipCacheHook = true;
                            if (options.env !== 'test') {
                                console.log(`${chalk_1.default.cyan('[redis]')} returning cached value for ${chalk_1.default.green(path)}.`);
                                console.log(`> Expires on ${duration}.`);
                            }
                            return resolve(hook);
                        }
                        return resolve(hook);
                    });
                });
            }
            catch (err) {
                console.error(err);
                return Promise.resolve(hook);
            }
        };
    },
    after(passedOptions) {
        return function (hook) {
            try {
                if (hook
                    && hook.params
                    && hook.params.$skipCacheHook) {
                    return Promise.resolve(hook);
                }
                if (!hook.result) {
                    return Promise.resolve(hook);
                }
                return new Promise((resolve) => {
                    const client = hook.app.get('redisClient');
                    const options = Object.assign({}, defaults, passedOptions);
                    const duration = options.expiration || options.defaultExpiration;
                    const { cacheKey: path } = hook.params;
                    const group = hook.path ? `group-${hook.path}` : '';
                    if (!client) {
                        return resolve(hook);
                    }
                    client.set(path, JSON.stringify({
                        cache: hook.result,
                        expiresOn: moment_1.default().add(moment_1.default.duration(duration, 'seconds')),
                        group,
                    }));
                    client.expire(path, duration);
                    client.rpush(group, path);
                    if (options.env !== 'test') {
                        console.log(`${chalk_1.default.cyan('[redis]')} added ${chalk_1.default.green(path)} to the cache.`);
                        console.log(`> Expires in ${moment_1.default.duration(duration, 'seconds').humanize()}.`);
                    }
                    resolve(hook);
                });
            }
            catch (err) {
                console.error(err);
                return Promise.resolve(hook);
            }
        };
    },
    purge() {
        return function (hook) {
            try {
                if (hook
                    && hook.params
                    && hook.params.$skipCacheHook) {
                    return Promise.resolve(hook);
                }
                return new Promise((resolve) => {
                    const client = hook.app.get('redisClient');
                    const target = hook.path;
                    if (!client) {
                        return {
                            message: 'Redis unavailable',
                            status: HTTP_SERVER_ERROR
                        };
                    }
                    client.lrange(`group-${target}`, 0, -1, (err, reply) => {
                        if (err) {
                            return resolve(hook);
                        }
                        if (!reply || !Array.isArray(reply) || reply.length <= 0) {
                            return resolve(hook);
                        }
                        async_1.default.eachOfLimit(reply, 10, async_1.default.asyncify((key) => __awaiter(this, void 0, void 0, function* () {
                            return new Promise((res) => {
                                client.del(key, (err, reply) => {
                                    if (err) {
                                        return res({ message: 'something went wrong' + err.message });
                                    }
                                    if (!reply) {
                                        return res({
                                            message: `cache already cleared for key ${target}`,
                                            status: HTTP_NO_CONTENT
                                        });
                                    }
                                    res({
                                        message: `cache cleared for key ${target}`,
                                        status: HTTP_OK
                                    });
                                });
                            });
                        })), () => resolve(hook));
                    });
                });
            }
            catch (err) {
                console.error(err);
                return Promise.resolve(hook);
            }
        };
    },
};
//# sourceMappingURL=hooks.js.map