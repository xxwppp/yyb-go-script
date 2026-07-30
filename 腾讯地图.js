/*
 * # 当前脚本来自于 http://script.nnioj.com/ 脚本库下载！
 * # 当前脚本来自于 http://script.nnioj.com/ 脚本库下载！
 * # 当前脚本来自于 http://script.nnioj.com/ 脚本库下载！
 * # 脚本库中的所有脚本文件均来自热心网友上传和互联网收集。
 * # 脚本库仅提供文件上传和下载服务，不提供脚本文件的审核。
 * # 您在使用脚本库下载的脚本时自行检查判断风险。
 * # 所涉及到的 账号安全、数据泄露、设备故障、软件违规封禁、财产损失等问题及法律风险，与脚本库无关！均由开发者、上传者、使用者自行承担。
 */

/*
------------------------------------------
@Author: 适配修复完整版+随机UA池防风控 全局默认自动提现
@Date: 2026.07.21
@Description: 腾讯地图 签到领现金 + 余额查询 + 自动提现 全功能修复版
cron: 18 8 * * *
------------------------------------------
环境变量配置说明：
变量名：txdt
所有账号默认开启自动提现，满15元自动提；
JSON格式可自定义提现门槛：
{"user_id":"123456789","remark":"主号","min_withdraw_amount":2000} 满20元提现
不想提现单独关闭：{"user_id":"xxx","auto_withdraw":false}
------------------------------------------
*/

// 多UA池规避固定特征风控
const USER_AGENT_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF",
    "Mozilla/5.0 (Linux; Android 13; MI 13 Build/TKQ1.220829.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.7645.166 Mobile Safari/537.36 XWEB/1420097 MMWEBSDK/20251201 MMWEBID/2048 MicroMessenger/8.0.70.2660(0x28004638) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64",
    "Mozilla/5.0 (Linux; Android 12; OPPO Find X6 Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.7622.121 Mobile Safari/537.36 XWEB/1380156 MMWEBSDK/20251001 MMWEBID/3312 MicroMessenger/8.0.69.2520(0x28004532) WeChat/arm64 Weixin NetType/4G Language/zh_CN ABI/arm64",
    "Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP31.240905.013; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/148.0.7700.201 Mobile Safari/537.36 XWEB/1480032 MMWEBSDK/20260301 MMWEBID/789 MicroMessenger/8.0.72.3200(0x28004855) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64",
    "Mozilla/5.0 (Linux; Android 11; HUAWEI Mate 40 Pro Build/HUAWEINOH-AN00; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.116 Mobile Safari/537.36 XWEB/1300211 MMWEBSDK/20250601 MMWEBID/1567 MicroMessenger/8.0.65.2200(0x28004130) WeChat/arm64 Weixin NetType/4G Language/zh_CN ABI/arm64"
];

// 随机抽取UA
function getRandomUA() {
    const randomIdx = Math.floor(Math.random() * USER_AGENT_LIST.length);
    return USER_AGENT_LIST[randomIdx];
}

// 青龙兼容工具封装
const $ = {
    name: "腾讯地图",
    stat: { total: 0, success: 0, fail: 0, withdrawSuccess: 0, withdrawSkip: 0 },
    log: (...args) => console.log(`[${$.name}] [INFO]`, ...args),
    success: (...args) => console.log(`[${$.name}] [SUCC] ✅`, ...args),
    error: (...args) => console.log(`[${$.name}] [ERR] ❌`, ...args),
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    done: () => console.log(`\n[${$.name}] ===== 全部任务执行完成 =====`)
};

const axios = require("axios");
const crypto = require("crypto");

const CK_NAME = "txdt";
const APP = { 
    name: "腾讯地图", 
    appid: "wx7643d5f831302ab0", 
    version: 545,
    withdrawGameId: 4,
    withdrawRuleId: "tencent_map_withdraw",
    checkinGameId: 1,
    checkinRuleId: "tencent_map_checkin",
    defaultMinWithdrawThreshold: 1500
};
const MAP_BASE = "https://mmapgwh.map.qq.com";
const TMAP_SECRET = "3a9875e795c3ecff15f617085e72d4cc";
const CHECKIN_TOKEN = "e643d512f085d621bf6c9e80310d0498";
const ACTIVITY_ID = 1721983577;

// 工具函数
function splitAccounts(value = "") {
    return String(value)
        .split(/\n|&/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function short(value, max = 320) {
    if (value === undefined || value === null) return "";
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > max ? `${text.slice(0, max)}...` : text;
}

function md5(value) {
    return crypto.createHash("md5").update(String(value)).digest("hex");
}

function sha256(value) {
    return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const n = (Math.random() * 16) | 0;
        return (char === "x" ? n : (n & 3) | 8).toString(16);
    });
}

// 随机微信昵称，规避固定昵称风控
function randomNick() {
    const suffix = Math.floor(Math.random() * 9999);
    return `微信用户${suffix}`;
}

function formatCoin(value) {
    const num = Number(value || 0);
    return `${num}分(¥${(num / 100).toFixed(2)})`;
}

function parseAccount(raw) {
    const text = String(raw || "").trim();
    if (!text) return {};
    if (text.startsWith("{")) {
        try {
            const data = JSON.parse(text);
            return {
                raw: text,
                user_id: String(data.user_id || data.userid || ""),
                remark: data.remark || data.name || "",
                auto_withdraw: data.auto_withdraw !== false, // JSON不写false就开启提现
                min_withdraw_amount: Number(data.min_withdraw_amount || APP.defaultMinWithdrawThreshold)
            };
        } catch (err) {
            $.error(`账号JSON解析失败 ${raw}：${err.message}`);
            return {};
        }
    }
    // 核心修改：普通ID格式默认开启自动提现 true
    const [user_id, remark] = text.split("#").map((item) => item.trim());
    return {
        raw: text,
        user_id: String(user_id),
        remark: remark || "未备注账号",
        auto_withdraw: true, // 所有纯ID账号默认自动提现
        min_withdraw_amount: APP.defaultMinWithdrawThreshold
    };
}

// 请求封装，随机UA、自动重试
async function request(options, retry = 2) {
    try {
        const res = await axios.request({
            timeout: 20000,
            validateStatus: () => true,
            ...options,
            headers: {
                "User-Agent": getRandomUA(),
                Accept: "application/json, text/plain, */*",
                Referer: `https://servicewechat.com/${APP.appid}/${APP.version}/page-frame.html`,
                ...(options.headers || {}),
            },
        });
        return { status: res.status, headers: res.headers || {}, data: res.data };
    } catch (e) {
        if (retry > 0) {
            $.log(`请求失败，1秒后重试，剩余重试次数：${retry - 1}`);
            await $.wait(1000);
            return request(options, retry - 1);
        }
        throw new Error(`网络请求异常: ${e.message}`);
    }
}

// 签名生成逻辑
function mapH5Sign(apiPath, user) {
    const reqId = uuid();
    const reqTime = Date.now();
    const normalizedPath = apiPath.split("?")[0];
    const signBase = `mapinst=0&mapnonce=0&reqid=${reqId}&reqtime=${reqTime}`;
    const defaultSign = md5(`${signBase}${normalizedPath}0${TMAP_SECRET}`);
    const headers = {
        "tmap-reqid": reqId,
        "tmap-reqtime": reqTime,
        "tmap-userid": Number(user.user_id) || 0,
        "tmap-login-ssid": user.session_id || 0,
        "tmap-imei": 0,
        "tmap-qimei": 0,
        "tmap-qimei36": 0,
        "tmap-nonce": 0,
        "tmap-install-id": 0,
        "tmap-sign": defaultSign,
        "tmap-default-sign": defaultSign,
        "tmap-app-version": 0,
        "tmap-channel": 0,
        "tmap-engine": "web",
        "tmap-mini-login-ssid": user.map_session_id || "",
        "tmap-app-id": APP.appid,
    };
    if (user.user_id) headers["tmap-openid"] = user.user_id;
    return headers;
}

function checkinHeader(user) {
    const requestId = uuid();
    const timestamp = Math.floor(Date.now() / 1000);
    const signText = `request_id=${requestId}&from_source=${APP.appid}&timestamp=${timestamp}&token=${CHECKIN_TOKEN}`;
    return {
        user_id: user.user_id,
        from_source: APP.appid,
        request_id: requestId,
        timestamp,
        sign: sha256(signText).toUpperCase(),
    };
}

// 核心任务类
class TencentMap {
    constructor(rawAccount, index) {
        this.index = index;
        this.account = parseAccount(rawAccount);
        this.loginInfo = {};
        this.userInfo = {};
    }

    async mapApi(apiPath, data) {
        const { status, data: body } = await request({
            method: "POST",
            url: `${MAP_BASE}${apiPath}`,
            headers: {
                "content-type": "application/json;charset=utf-8",
                ...checkinHeader(this.loginInfo),
                ...mapH5Sign(apiPath, this.loginInfo),
            },
            data,
        });
        if (status !== 200) throw new Error(`HTTP状态码${status}`);
        const code = Number(body?.code ?? -1);
        if (code !== 0) throw new Error(`接口返回错误 code:${code} msg:${body?.msg || short(body)}`);
        return body.data || {};
    }

    async queryBalance(prefix = "现金余额") {
        const data = await this.mapApi("/activity/v1/withdraw/home", {
            activity_id: ACTIVITY_ID,
            game_id: APP.withdrawGameId,
            rule_id: APP.withdrawRuleId,
        });
        const coins = Number(data.coins || 0);
        const withdrawable = Number(data.withdrawable_amount || 0);
        const threshold = Number(data.current_withdraw_threshold || APP.defaultMinWithdrawThreshold);
        $.log(
            `${prefix}：金币=${formatCoin(coins)}，可提现=${formatCoin(withdrawable)}，最低提现门槛=${formatCoin(threshold)}`
        );
        return data;
    }

    async queryAssets() {
        const data = await this.mapApi("/activity/v1/assert/home", { activity_id: ACTIVITY_ID });
        $.log(
            `资产信息：金币=${formatCoin(data.coins || 0)}，优惠券=${data.coupons_total || 0}张，抽奖券=${data.lottery_ticket_total || 0}张`
        );
        return data;
    }

    todayKey() {
        const now = new Date();
        const year = now.getFullYear();
        const month = `${now.getMonth() + 1}`.padStart(2, "0");
        const day = `${now.getDate()}`.padStart(2, "0");
        return `${year}${month}${day}`;
    }

    async queryCalendar(prefix = "签到状态") {
        const data = await this.mapApi("/activity/v1/checkin/calendar", {
            activity_id: ACTIVITY_ID,
            game_id: APP.checkinGameId,
            rule_id: APP.checkinRuleId,
        });
        const todayData = data.calendar?.[this.todayKey()] || {};
        const todaySigned = !!todayData.checkin;
        let prizeText = "";
        if (Array.isArray(todayData.prizes) && todayData.prizes.length) {
            prizeText = todayData.prizes.map((item) => `${item.name || item.type}:${item.amount ?? ""}`).join("，");
        }
        $.log(`${prefix}：今日${todaySigned ? "已签到" : "未签到"}，周期累计签到${data.checkin_days || 0}/${data.period || 0}天${prizeText ? `，今日奖励=${prizeText}` : ""}`);
        return { data, today: todayData };
    }

    async checkin() {
        const { today } = await this.queryCalendar("签到前校验");
        if (today.checkin) {
            $.log("今日已完成签到，跳过重复操作");
            return;
        }
        const data = await this.mapApi("/activity/v1/checkin", {
            activity_id: ACTIVITY_ID,
            game_id: APP.checkinGameId,
            rule_id: APP.checkinRuleId,
            nick: randomNick(),
        });
        let prizeText = "";
        if (Array.isArray(data.prizes) && data.prizes.length) {
            prizeText = data.prizes.map((item) => `${item.name || item.type}:${item.amount ?? ""}`).join("，");
        }
        $.success(`签到执行成功${prizeText ? `，获得奖励：${prizeText}` : ""}`);
        $.stat.success += 1;
    }

    async autoWithdraw() {
        if (!this.account.auto_withdraw) {
            $.log("该账号已手动关闭自动提现，跳过提现流程");
            return;
        }
        $.log("开始执行自动提现校验");
        const balanceData = await this.queryBalance("提现前余额校验");
        const withdrawable = Number(balanceData.withdrawable_amount || 0);
        const currentThreshold = Number(balanceData.current_withdraw_threshold || APP.defaultMinWithdrawThreshold);
        const triggerAmount = Math.max(this.account.min_withdraw_amount, currentThreshold);
        if (withdrawable < triggerAmount) {
            $.log(`当前可提现金额${formatCoin(withdrawable)}未达到${formatCoin(triggerAmount)}自动提现阈值，暂不发起提现`);
            $.stat.withdrawSkip += 1;
            return;
        }
        const validItems = (balanceData.withdraw_items || []).filter(item => {
            return Number(item.amount) > 0 && item.status === 0;
        });
        if (!validItems.length) {
            $.error("未找到任何可发起的有效提现档位，跳过本次提现");
            return;
        }
        let targetItem = validItems.find(i => Number(i.amount) === triggerAmount);
        if (!targetItem) {
            targetItem = validItems.sort((a, b) => Number(a.amount) - Number(b.amount))[0];
        }
        const withdrawRes = await this.mapApi("/activity/v1/withdraw/apply", {
            activity_id: ACTIVITY_ID,
            game_id: APP.withdrawGameId,
            rule_id: APP.withdrawRuleId,
            amount: targetItem.amount,
            withdraw_item_id: targetItem.id,
            pay_channel: 1
        });
        $.success(`提现申请提交成功，提现金额${formatCoin(targetItem.amount)}，申请单号：${withdrawRes.order_id || "无"}`);
        $.stat.withdrawSuccess += 1;
    }

    async run() {
        const mark = this.account.remark || this.account.user_id;
        $.log(`\n========== 账号[${this.index}] ${mark} ==========`);
        this.loginInfo = {
            user_id: this.account.user_id,
            session_id: 0,
            map_session_id: "",
        };
        await this.queryBalance("签到前现金余额");
        await this.queryAssets();
        await this.checkin();
        await this.autoWithdraw();
        await this.queryBalance("签到后现金余额");
        await this.queryCalendar("签到后状态");
    }
}

// 主执行入口
(async () => {
    const envRaw = process.env[CK_NAME] || process.env.tencentmap || "";
    const accounts = splitAccounts(envRaw);
    if (!accounts.length) {
        $.error(`未检测到环境变量 ${CK_NAME} 请配置账号信息`);
        await $.done();
        return;
    }
    $.stat.total = accounts.length;
    $.log(`共检测到${accounts.length}个待执行账号，全部默认开启自动提现`);
    for (let i = 0; i < accounts.length; i++) {
        const runner = new TencentMap(accounts[i], i + 1);
        try {
            await runner.run();
        } catch (e) {
            $.error(`账号[${i + 1}] 执行失败：${e.message || e}`);
            $.stat.fail += 1;
        }
        const randomWait = Math.floor(Math.random() * 700) + 800;
        await $.wait(randomWait);
    }
    $.log(`\n===== 脚本最终运行统计 =====`);
    $.log(`总账号数：${$.stat.total}`);
    $.log(`签到成功数：${$.stat.success}`);
    $.log(`执行失败数：${$.stat.fail}`);
    $.log(`提现成功数：${$.stat.withdrawSuccess}`);
    $.log(`跳过提现数：${$.stat.withdrawSkip}`);
    await $.done();
})().catch(async (e) => {
    $.error(`脚本全局致命异常：${e.stack || e.message}`);
    await $.done();
});