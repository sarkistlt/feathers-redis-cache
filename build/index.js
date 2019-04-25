"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var services_1 = __importDefault(require("./services"));
var client_1 = __importDefault(require("./client"));
var hooks_1 = __importDefault(require("./hooks"));
exports.default = {
    client: client_1.default,
    services: services_1.default,
    hooks: hooks_1.default,
};
//# sourceMappingURL=index.js.map