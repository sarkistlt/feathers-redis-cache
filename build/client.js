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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var redis_1 = __importDefault(require("redis"));
var chalk_1 = __importDefault(require("chalk"));
exports.default = (function (options) {
    if (options === void 0) { options = {}; }
    var errorLogger = options.errorLogger || console.error;
    var retryInterval = options.retryInterval || 5000;
    return function client() {
        var app = this;
        var config = app.get('redis') || {};
        try {
            var redisOptions = __assign({}, config, { retry_strategy: function () {
                    app.set('redisClient', undefined);
                    console.log(chalk_1.default.yellow('[redis]') + " not connected");
                    return retryInterval;
                } });
            var client_1 = redis_1.default.createClient(redisOptions);
            app.set('redisClient', client_1);
            client_1.on('ready', function () {
                app.set('redisClient', client_1);
                console.log(chalk_1.default.green('[redis]') + " connected");
            });
        }
        catch (err) {
            errorLogger.error(err);
            app.set('redisClient', undefined);
        }
        return this;
    };
});
//# sourceMappingURL=client.js.map