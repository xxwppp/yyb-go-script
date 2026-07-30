/*
 * # 当前脚本来自于 http://script.nnioj.com/ 脚本库下载！
 * # 当前脚本来自于 http://script.nnioj.com/ 脚本库下载！
 * # 当前脚本来自于 http://script.nnioj.com/ 脚本库下载！
 * # 脚本库中的所有脚本文件均来自热心网友上传和互联网收集。
 * # 脚本库仅提供文件上传和下载服务，不提供脚本文件的审核。
 * # 您在使用脚本库下载的脚本时自行检查判断风险。
 * # 所涉及到的 账号安全、数据泄露、设备故障、软件违规封禁、财产损失等问题及法律风险，与脚本库无关！均由开发者、上传者、使用者自行承担。
 */

const crypto = require('crypto');
const axios = require('axios');

// ========== 环境与基础配置 ==========
const ENV_VAR = process.env.TREECOIN_AUTH || '';
const PROXY_API_URL = process.env.TREECOIN_PROXY_API || '';
const MAX_PROXY_RETRIES = 5;
const MAX_AD_CONCURRENT = 4; // 广告最大并发，根据账号数量调整，建议3~5

const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000,
    timeout: 15000
};

const RISK_CONFIG = {
    accountDelayMin: 5000,
    accountDelayMax: 10000,
    adDelayMin: 3000,
    adDelayMax: 6000,
    uaPool: [
        'Mozilla/5.0 (Linux; Android 14; 24069RA21C Build/UKQ1.240116.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.178 Mobile Safari/537.36 XWEB/1460217 MMWEBSDK/20260202 MMWEBID/1137 MicroMessenger/8.0.71.3080(0x28004750) WeChat/arm64 Weixin NetType/4G Language/zh_CN ABI/arm64',
        'Mozilla/5.0 (Linux; Android 13; MI 13 Build/TKQ1.220829.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.7645.166 Mobile Safari/537.36 XWEB/1420097 MMWEBSDK/20251201 MMWEBID/2048 MicroMessenger/8.0.70.2660(0x28004638) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64',
        'Mozilla/5.0 (Linux; Android 12; OPPO Find X6 Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.7622.121 Mobile Safari/537.36 XWEB/1380156 MMWEBSDK/20251001 MMWEBID/3312 MicroMessenger/8.0.69.2520(0x28004532) WeChat/arm64 Weixin NetType/4G Language/zh_CN ABI/arm64',
        'Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP31.240905.013; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/148.0.7700.201 Mobile Safari/537.36 XWEB/1480032 MMWEBSDK/20260301 MMWEBID/789 MicroMessenger/8.0.72.3200(0x28004855) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64',
        'Mozilla/5.0 (Linux; Android 11; HUAWEI Mate 40 Pro Build/HUAWEINOH-AN00; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.116 Mobile Safari/537.36 XWEB/1300211 MMWEBSDK/20250601 MMWEBID/1567 MicroMessenger/8.0.65.2200(0x28004130) WeChat/arm64 Weixin NetType/4G Language/zh_CN ABI/arm64'
    ]
};

const BASE_URL = 'https://treecoin.cn/api';

// ========== 通用工具函数 ==========
function parseAccounts() {
    if (!ENV_VAR) return [];
    const lines = ENV_VAR.split(/[\n&,]/).map(s => s.trim()).filter(Boolean);
    return lines.map(line => {
        const [authCode, deviceFP] = line.split('#');
        return {
            authCode: authCode.trim(),
            deviceFP: deviceFP ? deviceFP.trim() : genDeviceFP()
        };
    });
}

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function genDeviceFP() {
    return `BROWSER_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return sleep(ms);
}

/**
 * 获取代理IP
 */
async function getProxyIp() {
    try {
        const res = await axios.get(PROXY_API_URL, {
            params: { num: 1 },
            timeout: 10000
        });
        const ip = res.data.toString().trim();
        if (!ip || /错误|失败|剩余|余额/.test(ip)) {
            return null;
        }
        if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(ip)) {
            return null;
        }
        return ip;
    } catch (err) {
        return null;
    }
}

// ========== 核心账号类 ==========
class TreeCoin {
    constructor(authCode, deviceFP, proxy = null) {
        this.authCode = authCode;
        this.deviceFP = deviceFP;
        this.proxy = proxy;
        this.sessionId = null;
        this.cbcKey = null;
        this.userInfo = null;
        this.userAgent = RISK_CONFIG.uaPool[Math.floor(Math.random() * RISK_CONFIG.uaPool.length)];
    }

    _getHeaders() {
        return {
            'User-Agent': this.userAgent,
            'Referer': 'https://treecoin.cn/home',
            'Origin': 'https://treecoin.cn',
            'X-Requested-With': 'com.tencent.mm',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'X-Device-Fingerprint': this.deviceFP
        };
    }

    _getRequestConfig() {
        const config = {
            headers: this._getHeaders(),
            timeout: RETRY_CONFIG.timeout
        };
        if (this.proxy) {
            const [host, port] = this.proxy.split(':');
            config.proxy = { host, port: parseInt(port, 10) };
        }
        return config;
    }

    updateProxy(proxy) {
        this.proxy = proxy;
    }

    async login() {
        const res = await axios.post(`${BASE_URL}/auth/login-by-auth-code`, {
            authCode: this.authCode,
            device_fingerprint: this.deviceFP
        }, this._getRequestConfig());

        if (res.data.c !== 1) {
            const err = new Error(res.data.msg || '登录失败');
            err.businessError = true;
            throw err;
        }

        this.sessionId = res.data.data.session.sessionId;
        this.cbcKey = Buffer.from(res.data.data.session.sessionKey, 'base64');
        this.userInfo = res.data.data.user.dataValues;
        return this.userInfo;
    }

    cbcEncrypt(obj) {
        const plain = Buffer.from(JSON.stringify(obj), 'utf8');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', this.cbcKey, iv);
        const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
        return Buffer.concat([iv, encrypted]).toString('base64');
    }

    cbcDecrypt(b64) {
        const raw = Buffer.from(b64, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.cbcKey, raw.slice(0, 16));
        const decrypted = Buffer.concat([decipher.update(raw.slice(16)), decipher.final()]);
        return JSON.parse(decrypted.toString('utf8'));
    }

    async request(path, data = {}) {
        const payload = {
            sessionId: this.sessionId,
            encryptedData: this.cbcEncrypt(data),
            nonce: uuid(),
            timestamp: Date.now()
        };
        const res = await axios.post(`${BASE_URL}${path}`, payload, this._getRequestConfig());
        return res.data.encrypted ? this.cbcDecrypt(res.data.data) : res.data;
    }

    async prepareAd() {
        return await this.request('/app/ad-reward/prepare', {});
    }

    async claimAd(token) {
        return await this.request('/app/ad-reward/claim', { token });
    }

    isAdExhaustedError(msg) {
        if (!msg) return false;
        return /次数已用完|已用完|明天|刷新|没有更多|暂无|额外奖励/.test(msg);
    }

    isRateLimitError(msg) {
        if (!msg) return false;
        return /休息|等待|稍后再|频繁|过快|限流/.test(msg);
    }

    parseWaitTime(msg) {
        if (!msg) return 0;
        const minSecMatch = msg.match(/(\d+)分(\d+)秒/);
        if (minSecMatch) return parseInt(minSecMatch[1]) * 60 + parseInt(minSecMatch[2]);
        const secMatch = msg.match(/(\d+)秒/);
        if (secMatch) return parseInt(secMatch[1]);
        const minMatch = msg.match(/(\d+)分/);
        if (minMatch) return parseInt(minMatch[1]) * 60;
        return 0;
    }

    isProxyError(err) {
        if (!err) return false;
        const codes = ['ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'EPIPE', 'ECONNABORTED', 'ETIMEDOUT'];
        if (err.code && codes.includes(err.code)) return true;
        if (/timeout|ECONNRESET|ECONNREFUSED/i.test(err.message || '')) return true;
        return false;
    }
}

// ========== 广告任务函数 ==========
async function watchAds(client, accountIdx, useProxy) {
    let totalReward = 0;
    let watchedCount = 0;
    let consecutiveErrors = 0;
    let proxyRetryCount = 0;

    const log = (msg) => console.log(`[账号${accountIdx}] ${msg}`);

    for (let i = 1; i <= 5; i++) {
        let adCompleted = false;
        let retryCount = 0;

        while (!adCompleted && retryCount < 3) {
            try {
                log(`📺 正在获取第 ${i}/5 个广告${retryCount > 0 ? ` (重试${retryCount})` : ''}...`);
                const prepareResult = await client.prepareAd();

                if (prepareResult.c !== 1) {
                    const errorMsg = prepareResult.msg || '未知错误';
                    
                    if (client.isAdExhaustedError(errorMsg)) {
                        log(`⚠️ 今日广告奖励次数已用完`);
                        return { watchedCount, totalReward: totalReward.toFixed(2) };
                    }
                    
                    if (client.isRateLimitError(errorMsg)) {
                        const waitTime = client.parseWaitTime(errorMsg);
                        if (waitTime > 0) {
                            log(`⏳ 触发限流，等待 ${waitTime} 秒...`);
                            await sleep(waitTime * 1000);
                            continue;
                        }
                    }
                    
                    log(`⚠️ 获取广告失败: ${errorMsg}`);
                    retryCount++;
                    consecutiveErrors++;
                    await randomDelay(2000, 4000);
                    continue;
                }

                const { token, remaining, used, total } = prepareResult.data;

                if (remaining === 0) {
                    log(`⚠️ 今日广告已看完 (${used}/${total})`);
                    return { watchedCount, totalReward: totalReward.toFixed(2) };
                }

                log(`✅ 获取广告成功 (已看 ${used}/${total}, 剩余 ${remaining})`);

                const watchTime = Math.floor(Math.random() * 3000) + 3000;
                log(`⏳ 模拟观看 ${(watchTime / 1000).toFixed(1)} 秒...`);
                await sleep(watchTime);

                const claimResult = await client.claimAd(token);

                if (claimResult.c === 1) {
                    const reward = claimResult.data.reward;
                    totalReward += reward;
                    watchedCount++;
                    consecutiveErrors = 0;
                    adCompleted = true;
                    log(`🎉 获得奖励: +${reward} 树苗 (累计: +${totalReward.toFixed(2)})`);
                } else {
                    const claimMsg = claimResult.msg || '未知错误';
                    
                    if (client.isAdExhaustedError(claimMsg)) {
                        log(`⚠️ 今日广告奖励次数已用完`);
                        return { watchedCount, totalReward: totalReward.toFixed(2) };
                    }
                    
                    if (client.isRateLimitError(claimMsg)) {
                        const waitTime = client.parseWaitTime(claimMsg);
                        if (waitTime > 0) {
                            log(`⏳ 触发限流，等待 ${waitTime} 秒...`);
                            await sleep(waitTime * 1000);
                            continue;
                        }
                    }
                    
                    log(`⚠️ 领取奖励失败: ${claimMsg}`);
                    retryCount++;
                    consecutiveErrors++;
                    await randomDelay(2000, 4000);
                }

            } catch (err) {
                if (useProxy && client.isProxyError(err) && proxyRetryCount < MAX_PROXY_RETRIES) {
                    proxyRetryCount++;
                    log(`🔄 代理异常，第 ${proxyRetryCount} 次更换IP...`);
                    const newProxy = await getProxyIp();
                    if (newProxy) {
                        client.updateProxy(newProxy);
                        log(`✅ 新代理IP: ${newProxy}`);
                        await randomDelay(1000, 2000);
                        continue;
                    }
                }

                log(`❌ 出错: ${err.message}`);
                consecutiveErrors++;
                retryCount++;
                
                if (consecutiveErrors >= 3) {
                    log(`⚠️ 连续错误过多，等待10秒...`);
                    await sleep(10000);
                } else {
                    await randomDelay(2000, 4000);
                }
            }
        }

        if (!adCompleted) {
            log(`⚠️ 第 ${i} 个广告跳过`);
        }

        if (i < 5 && adCompleted) {
            await randomDelay(RISK_CONFIG.adDelayMin, RISK_CONFIG.adDelayMax);
        }
    }

    return { watchedCount, totalReward: totalReward.toFixed(2) };
}

async function login(account, idx, useProxy) {
    const log = (msg) => console.log(`[账号${idx}] ${msg}`);
    let proxy = null;
    let proxyRetryCount = 0;

    while (proxyRetryCount <= MAX_PROXY_RETRIES) {
        let client = null;
        try {
            if (useProxy && !proxy) {
                const newProxy = await getProxyIp();
                if (newProxy) {
                    proxy = newProxy;
                    log(`🌐 代理IP: ${proxy}`);
                } else {
                    proxy = 'DIRECT';
                    log('⚠️ 未获取到代理IP，使用直连');
                }
            }

            const currentProxy = proxy === 'DIRECT' ? null : proxy;
            client = new TreeCoin(account.authCode, account.deviceFP, currentProxy);

            log('🔑 登录中...');
            await client.login();

            log(`✅ 登录成功 | 昵称: ${client.userInfo.nickName} | 树苗: ${client.userInfo.vitality}`);
            return { success: true, client };

        } catch (e) {
            if (useProxy && proxy !== 'DIRECT' && client && client.isProxyError(e) && proxyRetryCount < MAX_PROXY_RETRIES) {
                proxyRetryCount++;
                log(`🔄 代理异常(${e.message})，第 ${proxyRetryCount} 次更换IP...`);
                proxy = null;
                await sleep(1500);
                continue;
            } else {
                log(`❌ 登录失败: ${e.message}`);
                return { success: false };
            }
        }
    }
    return { success: false };
}

// 简易并发控制函数，限制同时运行广告数量
async function limitedParallel(tasks, limit) {
    const results = [];
    const running = [];
    for (const task of tasks) {
        const p = Promise.resolve().then(task);
        results.push(p);
        if (running.push(p) > limit) {
            await Promise.race(running);
            running.splice(running.findIndex(r => r !== p), 1);
        }
    }
    return Promise.allSettled(results);
}

(async () => {
    process.on('unhandledRejection', (reason) => {
        console.error(`❌ 全局未捕获异常: ${reason.message}`);
    });

    const accounts = parseAccounts();
    if (accounts.length === 0) {
        console.log('❌ 未配置环境变量 TREECOIN_AUTH');
        console.log('格式: 授权码，多账号换行/&/逗号分隔');
        process.exit(1);
    }

    const useProxy = !!PROXY_API_URL;
    console.log(`🌲 绿树田园广告任务启动`);
    console.log(`📋 账号总数：${accounts.length}`);
    console.log(`🌐 代理模式：${useProxy ? '启用' : '直连'}`);
    console.log(`⚡ 广告最大并发：${MAX_AD_CONCURRENT}`);
    console.log();

    // 第一阶段：串行登录
    console.log('══════════════════════');
    console.log('📌 第一阶段：依次登录账号');
    console.log('══════════════════════');
    console.log();

    const clients = [];
    let loginSuccess = 0, loginFail = 0;
    for (let i = 0; i < accounts.length; i++) {
        const idx = i + 1;
        console.log(`───── 账号 ${idx}/${accounts.length} ─────`);
        const result = await login(accounts[i], idx, useProxy);
        if (result.success) {
            loginSuccess++;
            clients.push({ client: result.client, idx });
        } else {
            loginFail++;
        }
        console.log();
        if (i < accounts.length - 1) {
            await randomDelay(RISK_CONFIG.accountDelayMin, RISK_CONFIG.accountDelayMax);
        }
    }
    console.log(`📊 登录汇总：成功 ${loginSuccess} | 失败 ${loginFail}`);
    console.log();

    // 第二阶段：受控并发跑广告
    if (clients.length > 0) {
        console.log('══════════════════════');
        console.log('📌 第二阶段：开始观看广告（受控并发）');
        console.log('══════════════════════');
        console.log();

        const adTaskList = clients.map(({ client, idx }) => async () => {
            return await watchAds(client, idx, useProxy);
        });

        const adResults = await limitedParallel(adTaskList, MAX_AD_CONCURRENT);

        let totalAdWatched = 0;
        let totalAdReward = 0;
        console.log('──────────────────────');
        adResults.forEach((result, i) => {
            const idx = clients[i].idx;
            if (result.status === 'fulfilled') {
                const { watchedCount, totalReward } = result.value;
                totalAdWatched += watchedCount;
                totalAdReward += parseFloat(totalReward);
                console.log(`[账号${idx}] 观看 ${watchedCount}/5 个, 获得 +${totalReward} 树苗`);
            } else {
                console.log(`[账号${idx}] 任务异常: ${result.reason?.message || '未知错误'}`);
            }
        });
        console.log('──────────────────────');
        console.log(`📊 广告汇总：共观看 ${totalAdWatched} 个, 总计 +${totalAdReward.toFixed(2)} 树苗`);
    }

    console.log();
    console.log('══════════════════════');
    console.log('✅ 全部账号任务执行完毕');
    console.log('══════════════════════');
})();