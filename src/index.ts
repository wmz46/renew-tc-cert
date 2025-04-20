#!/usr/bin/env node
import { parse } from "yaml"
import { Api } from './api'
import { readFileSync, writeFileSync, existsSync } from "fs"
import { dirname, join } from "path"
import { IConfig } from "./types"
import { version } from '../package.json'
import { exit } from "process"
import log4js from "log4js"
log4js.configure({
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
})
const logger = log4js.getLogger()
logger.info('当前版本：' + version)
const args = process.argv.splice(2);
const configFilename = "renew-tc-cert.yml"
const configFile = join(process.cwd(), configFilename)
if (!existsSync(configFile)) {
  if (args.length > 0 && args[0] == "init") {
    writeFileSync(configFile, `
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
`)
    logger.info("配置文件`" + configFilename + "`已生成，请修改后再次运行")
  } else {
    logger.error("配置文件`" + configFilename + "`不存在，请先执行`renew-tc-cert init`生成配置文件")
  }
} else {
  const config: IConfig = parse(readFileSync(configFile, "utf8"))
  const api = new Api(config)

  const force = !!args.find(m => m == "--force")
  if (force) {
    api.renewCert(true)
  } else {
    api.renewCert()
  }
}