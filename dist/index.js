#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yaml_1 = require("yaml");
const api_1 = require("./api");
const fs_1 = require("fs");
const path_1 = require("path");
const package_json_1 = require("../package.json");
const log4js_1 = __importDefault(require("log4js"));
log4js_1.default.configure({
    appenders: {
        out: {
            type: 'stdout', layout: {
                type: 'pattern',
                pattern: '%[%m%]'
            }
        },
        file: { type: 'file', filename: './renew-tc-cert.log' }
    },
    categories: {
        default: { appenders: ['out', 'file'], level: 'info' }
    }
});
const logger = log4js_1.default.getLogger();
logger.info('当前版本：' + package_json_1.version);
const args = process.argv.splice(2);
const configFilename = "renew-tc-cert.yml";
const configFile = (0, path_1.join)(process.cwd(), configFilename);
if (!(0, fs_1.existsSync)(configFile)) {
    if (args.length > 0 && args[0] == "init") {
        (0, fs_1.writeFileSync)(configFile, `
# 主域名
DOMAIN:
# 腾讯云SecretId
TENCENTCLOUD_SECRET_ID:
# 腾讯云SecretKey
TENCENTCLOUD_SECRET_KEY:
# 证书存放路径
CERT_PATH:
# nginx所在路径
NGINX_BIN_PATH:
`);
        logger.info("配置文件`" + configFilename + "`已生成，请修改后再次运行");
    }
    else {
        logger.error("配置文件`" + configFilename + "`不存在，请先执行`renew-tc-cert init`生成配置文件");
    }
}
else {
    const config = (0, yaml_1.parse)((0, fs_1.readFileSync)(configFile, "utf8"));
    const api = new api_1.Api(config);
    const force = !!args.find(m => m == "--force");
    if (force) {
        api.renewCert(true);
    }
    else {
        api.renewCert();
    }
}
