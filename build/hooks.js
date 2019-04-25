"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var moment_1 = __importDefault(require("moment/moment"));
var chalk_1 = __importDefault(require("chalk"));
var qs_1 = __importDefault(require("qs"));
var async_1 = __importDefault(require("async"));
var HTTP_OK = 200;
var HTTP_NO_CONTENT = 204;
var HTTP_SERVER_ERROR = 500;
var defaults = {
    defaultExpiration: 3600 * 24
};
function cacheKey(hook) {
    var q = hook.params.query || {};
    var p = hook.params.paginate === false ? 'disabled' : 'enabled';
    var path = "pagination-hook:" + p + "::" + hook.path;
    if (hook.id) {
        path += "/" + hook.id;
    }
    if (Object.keys(q).length > 0) {
        path += "?" + qs_1.default.stringify(q, { encode: false });
    }
    return path;
}
exports.default = {
    before: function (passedOptions) {
        return function (hook) {
            try {
                if (hook && hook.params && hook.params.$skipCacheHook) {
                    return Promise.resolve(hook);
                }
                return new Promise(function (resolve) {
                    var client = hook.app.get('redisClient');
                    var options = __assign({}, defaults, passedOptions);
                    if (!client) {
                        return resolve(hook);
                    }
                    var path = typeof options.cacheKey === 'function' ?
                        options.cacheKey(hook) :
                        cacheKey(hook);
                    hook.params.cacheKey = path;
                    client.get(path, function (err, reply) {
                        if (err) {
                            return resolve(hook);
                        }
                        if (reply) {
                            var data = JSON.parse(reply);
                            if (!data || !data.expiresOn || !data.cache) {
                                return resolve(hook);
                            }
                            var duration = moment_1.default(data.expiresOn).format('DD MMMM YYYY - HH:mm:ss');
                            hook.result = data.cache;
                            hook.params.$skipCacheHook = true;
                            if (options.env !== 'test') {
                                console.log(chalk_1.default.cyan('[redis]') + " returning cached value for " + chalk_1.default.green(path) + ".");
                                console.log("> Expires on " + duration + ".");
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
    after: function (passedOptions) {
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
                return new Promise(function (resolve) {
                    var client = hook.app.get('redisClient');
                    var options = __assign({}, defaults, passedOptions);
                    var duration = options.expiration || options.defaultExpiration;
                    var path = hook.params.cacheKey;
                    var group = hook.path ? "group-" + hook.path : '';
                    if (!client) {
                        return resolve(hook);
                    }
                    client.set(path, JSON.stringify({
                        cache: hook.result,
                        expiresOn: moment_1.default().add(moment_1.default.duration(duration, 'seconds')),
                        group: group,
                    }));
                    client.expire(path, duration);
                    client.rpush(group, path);
                    if (options.env !== 'test') {
                        console.log(chalk_1.default.cyan('[redis]') + " added " + chalk_1.default.green(path) + " to the cache.");
                        console.log("> Expires in " + moment_1.default.duration(duration, 'seconds').humanize() + ".");
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
    purge: function () {
        return function (hook) {
            var _this = this;
            try {
                if (hook
                    && hook.params
                    && hook.params.$skipCacheHook) {
                    return Promise.resolve(hook);
                }
                return new Promise(function (resolve) {
                    var client = hook.app.get('redisClient');
                    var target = hook.path;
                    if (!client) {
                        return {
                            message: 'Redis unavailable',
                            status: HTTP_SERVER_ERROR
                        };
                    }
                    client.lrange("group-" + target, 0, -1, function (err, reply) {
                        if (err) {
                            return resolve(hook);
                        }
                        if (!reply || !Array.isArray(reply) || reply.length <= 0) {
                            return resolve(hook);
                        }
                        async_1.default.eachOfLimit(reply, 10, async_1.default.asyncify(function (key) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2, new Promise(function (res) {
                                        client.del(key, function (err, reply) {
                                            if (err) {
                                                return res({ message: 'something went wrong' + err.message });
                                            }
                                            if (!reply) {
                                                return res({
                                                    message: "cache already cleared for key " + target,
                                                    status: HTTP_NO_CONTENT
                                                });
                                            }
                                            res({
                                                message: "cache cleared for key " + target,
                                                status: HTTP_OK
                                            });
                                        });
                                    })];
                            });
                        }); }), function () { return resolve(hook); });
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