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
const async_1 = __importDefault(require("async"));
const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;
const HTTP_SERVER_ERROR = 500;
const HTTP_NOT_FOUND = 404;
const serviceClearSingle = {
    setup(app, path) {
        this.app = app;
        this.path = path;
    },
    find(params) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    client.del(target, (err, reply) => {
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
        });
    },
};
const serviceClearGroup = {
    setup(app, path) {
        this.app = app;
        this.path = path;
    },
    find(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.app.get('redisClient');
            const { target } = params.query;
            if (!client) {
                return {
                    message: 'Redis unavailable',
                    status: HTTP_SERVER_ERROR
                };
            }
            return new Promise((resolve) => {
                client.lrange(`group-${target}`, 0, -1, (err, reply) => {
                    if (err) {
                        return resolve({ message: 'something went wrong' + err.message });
                    }
                    if (!reply || !Array.isArray(reply) || reply.length <= 0) {
                        return resolve({
                            message: `cache already cleared for the group key: ${target}`,
                            status: HTTP_NO_CONTENT
                        });
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
                    })), (err) => {
                        if (err) {
                            return resolve({ message: 'something went wrong' + err.message });
                        }
                        resolve({
                            message: `cache cleared for the group key: ${target}`,
                            status: HTTP_OK
                        });
                    });
                });
            });
        });
    },
};
const serviceClearAll = {
    setup(app, path) {
        this.app = app;
        this.path = path;
    },
    find() {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    },
};
exports.default = (options = {}) => {
    const pathPrefix = options.pathPrefix || '/cache';
    return function () {
        const app = this;
        app.use(`${pathPrefix}/clear/single`, serviceClearSingle);
        app.use(`${pathPrefix}/clear/group`, serviceClearGroup);
        app.use(`${pathPrefix}/clear/all`, serviceClearAll);
    };
};
//# sourceMappingURL=services.js.map