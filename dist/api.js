"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Api = void 0;
const tencentcloud_sdk_nodejs_1 = require("tencentcloud-sdk-nodejs");
const compressing_1 = __importDefault(require("compressing"));
const fs_1 = require("fs");
const dayjs_1 = __importDefault(require("dayjs"));
const tls_1 = __importDefault(require("tls"));
const path_1 = require("path");
const child_process_1 = require("child_process");
const log4js_1 = __importDefault(require("log4js"));
const logger = log4js_1.default.getLogger();
const SslClient = tencentcloud_sdk_nodejs_1.ssl.v20191205.Client;
class Api {
    constructor(config) {
        /**
         * 获取证书列表
         * @returns
         */
        this.listCerts = () => {
            return this.client.DescribeCertificates({
                Limit: 10,
                Offset: 0,
            }).then(res => {
                return res.Certificates;
            });
        };
        /**
         * 获取最新证书
         */
        this.getNewCert = () => {
            const domain = this.config.DOMAIN;
            return this.listCerts().then(res => {
                const list = res?.sort((a, b) => {
                    return (0, dayjs_1.default)(b.CertEndTime).toDate().getTime() - (0, dayjs_1.default)(a.CertEndTime).toDate().getTime();
                });
                return list?.find(m => m.Domain == domain && (0, dayjs_1.default)(m.CertEndTime).isAfter((0, dayjs_1.default)()));
            });
        };
        /**
         * 下载并解压证书
         * @param certId
         * @returns
         */
        this.downloadCert = (certId) => {
            return this.client.DownloadCertificate({
                CertificateId: certId
            }).then(res => {
                if (res.Content) {
                    const buffer = Buffer.from(res.Content, 'base64');
                    (0, fs_1.writeFileSync)(`./cert.zip`, buffer);
                    return compressing_1.default.zip.uncompress(`./cert.zip`, `./cert`).then(() => {
                        return true;
                    });
                }
                else {
                    return false;
                }
            });
        };
        /**
         * 申请免费证书
         * @param domain
         * @returns
         */
        this.applyCert = () => {
            const domain = this.config.DOMAIN;
            return this.client.ApplyCertificate({
                DomainName: domain,
                DvAuthMethod: "DNS_AUTO"
            }).then(res => {
                return res.CertificateId;
            });
        };
        /**
         * 检查证书是否申请成功
         * @param certId 证书ID
         * @returns
         */
        this.checkCert = (certId) => {
            return this.listCerts().then(res => {
                return res?.find(m => m.CertificateId == certId)?.Status == 1;
            });
        };
        this.needApply = () => {
            const domain = this.config.DOMAIN;
            return this.listCerts().then(res => {
                //存在失效时间在7天后的证书，无需申请
                const cert = res?.find(m => m.Domain == domain && (0, dayjs_1.default)(m.CertEndTime).isAfter((0, dayjs_1.default)().add(7, 'day')));
                if (cert) {
                    return false;
                }
                else {
                    return true;
                }
            });
        };
        /**
         * 是否需要续签
         * @param domain
         * @returns
         */
        this.needRenew = () => {
            return this.getCertExpiry().then(expiryDate => {
                if (expiryDate.isAfter((0, dayjs_1.default)().add(7, 'day'))) {
                    return false;
                }
                else {
                    return true;
                }
            });
        };
        /**
         * 获取证书到期时间
         * @returns
         */
        this.getCertExpiry = () => {
            const domain = this.config.DOMAIN;
            return new Promise((resolve, reject) => {
                const socket = tls_1.default.connect({
                    host: domain,
                    port: 443,
                    rejectUnauthorized: false,
                    servername: domain,
                    session: undefined
                }, () => {
                    const cert = socket.getPeerCertificate();
                    socket.end();
                    if (!cert.valid_to) {
                        return reject(new Error('无法获取证书信息'));
                    }
                    const expiryDate = (0, dayjs_1.default)(cert.valid_to);
                    resolve(expiryDate);
                });
                socket.on('error', reject);
            });
        };
        /**
         * 更新证书
         * @param force 强制更新
         */
        this.renewCert = async (force = false) => {
            try {
                const needRenew = force ? true : await this.needRenew();
                if (needRenew) {
                    logger.info('证书需要更新，开始更新流程');
                    try {
                        const needApply = await this.needApply();
                        if (needApply) {
                            logger.info('证书需要申请，开始申请');
                            try {
                                await this.applyCert();
                                logger.info('证书申请成功');
                            }
                            catch (err) {
                                logger.error('证书申请时出错:', err);
                            }
                        }
                        else {
                            logger.info('证书无需申请');
                            const cert = await this.getNewCert();
                            if (cert) {
                                if (cert.Status == 1) {
                                    try {
                                        await this.downloadCert(cert.CertificateId);
                                        logger.info('下载证书成功');
                                        try {
                                            this.replaceCert();
                                            logger.info('替换证书成功');
                                        }
                                        catch (err) {
                                            logger.error('替换证书失败:', err);
                                        }
                                        try {
                                            this.reloadNginx();
                                            logger.info('重启nginx成功');
                                        }
                                        catch (err) {
                                            logger.error('重启nginx失败:', err);
                                        }
                                    }
                                    catch (err) {
                                        logger.error('下载证书失败:', err);
                                    }
                                }
                                else {
                                    logger.error('证书未颁发，无法更新');
                                }
                            }
                            else {
                                logger.error('找不到最新证书');
                            }
                        }
                    }
                    catch (err) {
                        logger.error('证书更新时出错:', err);
                    }
                }
                else {
                    logger.info('证书不需要更新');
                }
            }
            catch (err) {
                logger.error('检查证书更新时出错:', err);
            }
        };
        this.reloadNginx = () => {
            const nginxPath = (0, path_1.join)(this.config.NGINX_BIN_PATH, 'nginx');
            (0, child_process_1.exec)(`"${nginxPath}" -s reload`);
        };
        this.replaceCert = () => {
            const domain = this.config.DOMAIN;
            (0, fs_1.copyFileSync)(`./cert/${domain}.csr`, (0, path_1.join)(this.config.CERT_PATH, `${domain}.csr`));
            (0, fs_1.copyFileSync)(`./cert/${domain}.key`, (0, path_1.join)(this.config.CERT_PATH, `${domain}.key`));
            (0, fs_1.copyFileSync)(`./cert/${domain}.pem`, (0, path_1.join)(this.config.CERT_PATH, `${domain}_bundle.pem`));
            (0, fs_1.copyFileSync)(`./cert/Nginx/1_${domain}_bundle.crt`, (0, path_1.join)(this.config.CERT_PATH, `${domain}_bundle.crt`));
        };
        const credential = { secretId: config.TENCENTCLOUD_SECRET_ID, secretKey: config.TENCENTCLOUD_SECRET_KEY };
        this.client = new SslClient({ credential });
        this.config = config;
    }
}
exports.Api = Api;
