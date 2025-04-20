# 一、安装
```shell
# 安装
npm install wmz46/renew-tc-cert
```
# 二、使用
```shell
# 生成配置，会在当前目录生成一个配置文件`renew-tc-cert.yml`
renew-tc-cert init
```
修改配置文件`renew-tc-cert.yml`，配置好域名，配置内容如下
```yaml
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
```
# 三、运行
**由于新申请证书需要审核，请使用定时任务定时运行，具体请查看四、程序处理逻辑**
```shell
renew-tc-cert
```
# 四、程序处理逻辑
```mermaid
flowchart TB
A(开始)-->B
B{站点证书是否7天内过期（即将过期）}-->|否|C(结束)
B-->|是|D{腾讯云是否存在7天后未过期的证书（无论是否审核通过）}
D-->|是|F
D-->|否|E[申请免费证书<br><b style="color:red">由于证书申请需要审核，这里申请后直接结束，在下次调用时检查证书状态</b>]
E-->C
F-->|审核未通过|C
F{检查最新证书是否审核通过}-->|审核通过|G
G[下载证书]-->H
H[解压并替换本地证书]-->I
I[重启nginx]-->C
```
**由于证书申请需要审核，请使用定时任务调用`renew-tc-cert`，保证证书正常更新**
