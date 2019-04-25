"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = __importDefault(require("redis"));
const chalk_1 = __importDefault(require("chalk"));
function client({ retryInterval = 5000 } = {}) {
    const app = this;
    const redisOptions = Object.assign({}, this.get('redis'), { retry_strategy: () => {
            app.set('redisClient', undefined);
            console.log(`${chalk_1.default.yellow('[redis]')} not connected`);
            return retryInterval;
        } });
    const client = redis_1.default.createClient(redisOptions);
    app.set('redisClient', client);
    client.on('ready', () => {
        app.set('redisClient', client);
        console.log(`${chalk_1.default.green('[redis]')} connected`);
    });
    return this;
}
exports.default = client;
//# sourceMappingURL=client.js.map