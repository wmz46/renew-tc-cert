import { ca, ssl } from 'tencentcloud-sdk-nodejs'
import compressing from 'compressing'
import { copyFileSync, writeFileSync } from 'fs'
import dayjs from 'dayjs'
import tls from 'tls'
import { join } from 'path'
import { exec } from 'child_process'
import type { IConfig } from './types'
import log4js from "log4js"
const logger  = log4js.getLogger()
const SslClient = ssl.v20191205.Client
export class Api {
  private readonly client
  private readonly config: IConfig
  constructor(config: IConfig ) {
    const credential = { secretId: config.TENCENTCLOUD_SECRET_ID, secretKey: config.TENCENTCLOUD_SECRET_KEY }
    this.client = new SslClient({ credential });
    this.config = config
  }

  /**
   * 获取证书列表
   * @returns
   */
  public listCerts = () => {
    return this.client.DescribeCertificates({
      Limit: 10,
      Offset: 0,
    }).then(res => {
      return res.Certificates
    })
  }
  /**
   * 获取最新证书
   */
  public getNewCert = () => {
    const domain = this.config.DOMAIN
    return this.listCerts().then(res => {
      const list = res?.sort((a, b) => {
        return dayjs(b.CertEndTime).toDate().getTime() - dayjs(a.CertEndTime).toDate().getTime()
      })
      return list?.find(m => m.Domain == domain && dayjs(m.CertEndTime).isAfter(dayjs()))
    })
  }
  /**
   * 下载并解压证书
   * @param certId
   * @returns
   */
  public downloadCert = (certId: string) => {
    return this.client.DownloadCertificate({
      CertificateId: certId
    }).then(res => {
      if (res.Content) {
        const buffer = Buffer.from(res.Content, 'base64')
        writeFileSync(`./cert.zip`, buffer)
        return compressing.zip.uncompress(`./cert.zip`, `./cert`).then(() => {
          return true
        })
      } else {
        return false
      }
    })
  }
  /**
   * 申请免费证书
   * @param domain
   * @returns
   */
  public applyCert = () => {
    const domain = this.config.DOMAIN
    return this.client.ApplyCertificate({
      DomainName: domain,
      DvAuthMethod: "DNS_AUTO"
    }).then(res => {
      return res.CertificateId
    })
  }
  /**
   * 检查证书是否申请成功
   * @param certId 证书ID
   * @returns
   */
  public checkCert = (certId: string) => {
    return this.listCerts().then(res => {
      return res?.find(m => m.CertificateId == certId)?.Status == 1
    })
  }
  public needApply = () => {
    const domain = this.config.DOMAIN
    return this.listCerts().then(res => {
      //存在失效时间在7天后的证书，无需申请
      const cert = res?.find(m => m.Domain == domain && dayjs(m.CertEndTime).isAfter(dayjs().add(7, 'day')))
      if (cert) {
        return false
      } else {
        return true
      }
    })
  }
  /**
   * 是否需要续签
   * @param domain
   * @returns
   */
  public needRenew = () => {
    return this.getCertExpiry().then(expiryDate => {
      if (expiryDate.isAfter(dayjs().add(7, 'day'))) {
        return false
      } else {
        return true
      }
    })
  }
  /**
   * 获取证书到期时间
   * @returns
   */
  private getCertExpiry = (): Promise<dayjs.Dayjs> => {
    const domain = this.config.DOMAIN
    return new Promise((resolve, reject) => {
      const socket = tls.connect({
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
        const expiryDate = dayjs(cert.valid_to);
        resolve(expiryDate);
      });

      socket.on('error', reject);

    })
  }
  /**
   * 更新证书
   * @param force 强制更新
   */
  public renewCert = async ( force: boolean = false) => {
    try {
      const needRenew = force ? true : await this.needRenew()
      if (needRenew) {
        logger.info('证书需要更新，开始更新流程')
        try {
          const needApply = await this.needApply()
          if (needApply) {
            logger.info('证书需要申请，开始申请')
            try {
              await this.applyCert()
              logger.info('证书申请成功')
            } catch (err) {
              logger.error('证书申请时出错:', err)
            }
          } else {
            logger.info('证书无需申请')
            const cert = await this.getNewCert()
            if (cert) {
              if (cert.Status == 1) {
                try {
                  await this.downloadCert(cert.CertificateId!)
                  logger.info('下载证书成功')
                  try {
                    this.replaceCert()
                    logger.info('替换证书成功')
                  } catch (err) {
                    logger.error('替换证书失败:', err)
                  }
                  try {
                    this.reloadNginx()
                    logger.info('重启nginx成功')
                  } catch (err) {
                    logger.error('重启nginx失败:', err)
                  }
                } catch (err) {
                  logger.error('下载证书失败:', err)
                }
              } else {
                logger.error('证书未颁发，无法更新')
              }
            } else {
              logger.error('找不到最新证书')
            }
          }
        } catch (err) {
          logger.error('证书更新时出错:', err)
        }
      } else {
        logger.info('证书不需要更新')
      }
    } catch (err) {
      logger.error('检查证书更新时出错:', err)
    }
  }
  private reloadNginx = () => {
    const nginxPath = join(this.config.NGINX_BIN_PATH, 'nginx')
    exec(`"${nginxPath}" -s reload`)
  }
  private replaceCert = () => {
    const domain = this.config.DOMAIN
    copyFileSync(`./cert/${domain}.csr`, join(this.config.CERT_PATH, `${domain}.csr`))
    copyFileSync(`./cert/${domain}.key`, join(this.config.CERT_PATH, `${domain}.key`))
    copyFileSync(`./cert/${domain}.pem`, join(this.config.CERT_PATH, `${domain}_bundle.pem`))
    copyFileSync(`./cert/Nginx/1_${domain}_bundle.crt`, join(this.config.CERT_PATH, `${domain}_bundle.crt`))
  }
}