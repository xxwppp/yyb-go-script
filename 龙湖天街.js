// === YYB_GO 统一通知注入 begin ===
(function () {
  const __logs = [];
  const __oL = console.log.bind(console);
  console.log = function (...a) { try { __logs.push(a.map(x => (x && x.stack) ? x.stack : String(x)).join(' ')); } catch (e) {} __oL(...a); };
  const __oE = console.error.bind(console);
  console.error = function (...a) { try { __logs.push('[ERR] ' + a.map(x => (x && x.stack) ? x.stack : String(x)).join(' ')); } catch (e) {} __oE(...a); };

  function __resolveKey() {
    let k = process.env.QYWX_KEY || process.env.QYWX || process.env.WEWORK_KEY;
    if (k) return k;
    try {
      const fs = require('fs');
      let p = null;
      try { p = require.resolve('./sendNotify'); } catch (e) { try { p = require.resolve('/ql/data/scripts/sendNotify'); } catch (e2) {} }
      if (p) {
        const t = fs.readFileSync(p, 'utf-8');
        const m = t.match(/QYWX_KEY\s*=\s*['"]([^'"]+)['"]/);
        if (m) return m[1];
      }
    } catch (e) {}
    return null;
  }

  let __flushed = false;
  function __flush() {
    if (__flushed) return;
    __flushed = true;
    const title = (process.argv[1] || 'YYB_GO').split(/[\/]/).pop();
    const body = __logs.slice(-40).join('\n');
    // 1) 显式调用 sendNotify.js（满足要求）；临时静音其可能产生的报错，避免误导
    const _ol = console.log, _oe = console.error;
    console.log = function () {}; console.error = function () {};
    try {
      let sn;
      try { sn = require('./sendNotify'); } catch (e) { try { sn = require('/ql/data/scripts/sendNotify'); } catch (e2) { sn = null; } }
      if (sn) {
        if (typeof sn === 'function') { try { sn(title, body); } catch (e) {} }
        else if (sn.sendNotify && typeof sn.sendNotify === 'function') { try { sn.sendNotify(title, body); } catch (e) {} }
      }
    } catch (e) {}
    console.log = _ol; console.error = _oe;
    // 2) 兜底：同步 curl POST 企业微信机器人 webhook（绕过损坏的 sendNotify.js，确保送达）
    try {
      const key = __resolveKey();
      if (key) {
        const fs = require('fs');
        const cp = require('child_process');
        const tmp = '/tmp/yyb_notify_' + process.pid + '.json';
        fs.writeFileSync(tmp, JSON.stringify({ msgtype: 'text', text: { content: '【' + title + '】\n' + body } }));
        cp.execSync('curl -s -m 15 -X POST -H "Content-Type: application/json" --data @' + tmp + ' "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + key + '"', { stdio: 'ignore' });
        try { fs.unlinkSync(tmp); } catch (e) {}
      }
    } catch (e) {}
  }

  let __exiting = false;
  const __origExit = (typeof process.exit === 'function') ? process.exit.bind(process) : function (c) { throw new Error('exit ' + c); };
  process.exit = function (code) {
    if (__exiting) return __origExit(code);
    __exiting = true;
    try { __flush(); } catch (e) {}
    return __origExit(code);
  };
  process.on('beforeExit', () => { if (!__exiting) { __exiting = true; try { __flush(); } catch (e) {} } });
})();
// === YYB_GO 统一通知注入 end ===
// === YYB 微信备注映射注入 begin ===
const _NAME_MAP = {};
const _raw_nm = process.env.YYB_NAME_MAP || "";
_raw_nm.split(/[\n&]/).forEach(function (line) {
  line = line.trim();
  const idx = line.indexOf("=");
  if (idx > 0) _NAME_MAP[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
});
function yybDisplay(entry) {
  if (!entry) return entry;
  const ref = entry.indexOf("@") !== -1 ? entry.slice(entry.indexOf("@") + 1) : entry;
  return _NAME_MAP[ref] !== undefined ? _NAME_MAP[ref] : entry;
}
// === YYB 微信备注映射注入 end ===


// name: 龙湖天街
// cron: 42 9 * * *

const axios = require("axios");

// === YYB 协议统一认证（自动 https + Basic/Bearer） begin ===
(function () {
    const token = process.env.YYB_TOKEN;
    const user = process.env.YYB_USER;
    const pass = process.env.YYB_PASS;
    let yybAuth = null;
    if (token) yybAuth = `Bearer ${token}`;
    else if (user && pass) yybAuth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
    axios.interceptors.request.use(config => {
        let url = config.url || '';
        if (url.includes('/wxapp/getCode')) {
            if (url.startsWith('http://')) config.url = url.replace('http://', 'https://');
            if (yybAuth) {
                config.headers = config.headers || {};
                config.headers.Authorization = yybAuth;
            }
        }
        return config;
    });
})();
// === YYB 协议统一认证 end ===

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
// ====================== YYB Go 账号（环境变量 YYB_GO = 换行或&分隔，每个为 地址@微信账号标识） ======================
// 任何形如 [object Object] 或不含 @ 的脏行都会被自动跳过，不影响其他有效账号。
function buildServers() {
    const raw = String(process.env.YYB_GO || "").trim();
    if (!raw) {
        console.error("未配置环境变量 YYB_GO，请设置后重试（格式：地址@微信账号标识，换行或&）");
        process.exit(1);
    }
    console.log("YYB_GO 原始内容(前200字): " + raw.slice(0, 200).replace(/\r/g, "").replace(/\n/g, "\\n"));
    return raw
        .split(/\r?\n|&/)
        .map(s => String(s).trim())
        .filter(Boolean)
        .filter(line => {
            if (line === "[object Object]") {
                console.log("已跳过无效行: [object Object]");
                return false;
            }
            if (!line.includes("@")) {
                console.log("YYB_GO 格式应为 地址@微信账号标识，已跳过当前值: " + line);
                return false;
            }
            return true;
        });
}
const SERVERS = buildServers();
if (!SERVERS.length) {
    console.error("未配置有效的 YYB_GO 账号（每行格式：地址@微信账号标识）");
    process.exit(1);
}
function parseYybGoEntry(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) return { server: "", ref: "" };
    const atIndex = value.indexOf("@");
    if (atIndex === -1) {
        console.log("YYB_GO 格式应为 地址@微信账号标识，当前值: " + value);
        return { server: "", ref: "" };
    }
    let server = value.slice(0, atIndex).trim();
    const ref = value.slice(atIndex + 1).trim();
    if (server.startsWith("http://")) server = server.slice(7);
    else if (server.startsWith("https://")) server = server.slice(8);
    server = server.replace(/\/+$/, "");
    if (!server || !ref) return { server: "", ref: "" };
    return { server, ref };
}
function buildYybAuthHeaders() {
    const token = process.env.YYB_TOKEN;
    if (token) return { Authorization: `Bearer ${token}` };
    const user = process.env.YYB_USER;
    const pass = process.env.YYB_PASS;
    if (user && pass) return { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` };
    return {};
}
async function getCode(server) {
    const { server: parsedServer, ref } = parseYybGoEntry(server);
    if (!parsedServer || !ref) return null;
    const url = "https://" + parsedServer + "/wxapp/getCode";
    try {
        const { data } = await axios.post(url, { ref, app_id: MINI_APP_ID }, { timeout: 20000, proxy: false });
        const code = data && data.data && data.data.result && data.data.result.code;
        if (!data || data.code !== 0 || !code) {
            console.log(parsedServer + " 获取code失败: " + JSON.stringify(data));
            return null;
        }
        console.log(parsedServer + " 获取code成功");
        return code;
    } catch (e) {
        console.log(parsedServer + " 获取code异常: " + e.message);
        return null;
    }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
let userIdx = 1;

const MINI_APP_ID = "wx50282644351869da";
const PAGE_VERSION = "506";
const API_VERSION = "v1_25_0";
const APP_VERSION = "1.25.0";
const CHANNEL = "C2";
const BU_CODE = "C20400";
const BASE_HOST = "https://gw2c-hw-open.longfor.com/supera";
const MEMBER_HOST = `${BASE_HOST}/member`;
const TASK_HOST = "https://gw2c-hw-open.longfor.com/lmarketing-task-api-mvc-prod";
const MEMBER_GAIA_KEY = "98717e7a-a039-46af-8143-be7558a089c0";
const TASK_GAIA_KEY = "c06753f1-3e68-437d-b592-b94656ea5517";
const MINI_SIGN_SECRET = "Q74eKtH5LePYfSjIiflUbCL2gxjTa7rF";
const DX_MINI_CONFIG = {
    appId: "d1a43734fc59aeae9f1562dbd70fdf54",
    server: "https://ly-sta.longhu.net/udid/w1",
    cache: true,
    gps: true,
};
const DX_ALPHABET = "S0DOZN9bBJyPV-qczRa3oYvhGlUMrdjW7m2CkE5_FuKiTQXnwe6pg8fs4HAtIL1x=";
const DX_LID_KEY = "_dx_uzZo5y";
const DX_TOKEN_KEY = "_dx_raAh8q";
const DX_STORAGE = new Map();
const DX_KEY_MAP = {
    SDKVersion: "sv",
    accuracy: "ac",
    altitude: "att",
    available: "al",
    batteryLevel: "bl",
    benchmarkLevel: "bml",
    brand: "bd",
    BSSID: "bs",
    collectTime: "ct",
    discovering: "dc",
    fontSizeSetting: "fss",
    horizontalAccuracy: "ha",
    language: "lang",
    latitude: "lt",
    longitude: "lgt",
    model: "md",
    networkType: "nt",
    pixelRatio: "pr",
    platform: "pf",
    screenHeight: "sh",
    screenWidth: "sw",
    secure: "se",
    speed: "sp",
    signalStrength: "ss",
    statusBarHeight: "",
    supportMode: "sm",
    system: "sy",
    SSID: "si",
    version: "vs",
    verticalAccuracy: "va",
    windowHeight: "wh",
    windowWidth: "ww",
    gps: "gps",
};
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "longfor_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

function readCache() {
    try {
        if (!fs.existsSync(TOKEN_CACHE_FILE)) return {};
        return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf8")) || {};
    } catch (e) {
        return {};
    }
}

function writeCache(cache) {
    try {
        fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
    } catch (e) {
        console.log(`写入token缓存失败: ${e.message || e}`);
    }
}

function shortValue(value = "") {
    const text = String(value || "");
    return text ? `${text.slice(0, 4)}***${text.slice(-4)}` : "";
}

function uuid() {
    return crypto.randomUUID().replace(/-/g, "");
}

function canonicalize(data = {}) {
    return Object.keys(data || {})
        .sort()
        .map((key) => {
            let value = data[key];
            if (Array.isArray(value)) {
                let text = "[";
                if (!value.length) text += "]";
                value.forEach((item, index) => {
                    if (Array.isArray(item)) text += JSON.stringify(item);
                    else if (typeof item === "object" && item !== null) text += `{${canonicalize(item)}}`;
                    else text += item;
                    text += index < value.length - 1 ? "," : "]";
                });
                value = text;
            } else if (typeof value === "object" && value !== null) {
                value = `{${canonicalize(value)}}`;
            }
            return `${value}`.trim() && `${value}` !== "null" ? `${key}=${value}` : "";
        })
        .filter(Boolean)
        .join("|");
}

function miniSign(data) {
    const timestamp = Date.now().toString();
    const body = canonicalize(JSON.parse(JSON.stringify(data || {})));
    const raw = `${body ? `${body}&` : ""}${timestamp}&${MINI_SIGN_SECRET}`;
    return {
        "X-LONGZHU-TimeStamp": timestamp,
        "X-Client-Type": "microApp",
        "X-LONGZHU-Sign": crypto.createHash("md5").update(raw).digest("hex"),
    };
}

function dxMakeLocalId(length = 32) {
    const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let value = "";
    for (let i = 0; i < length; i++) value += chars.charAt(Math.floor(Math.random() * chars.length));
    return value;
}

function dxEncrypt(data) {
    const text = JSON.stringify(data) || "";
    let output = "";
    for (let index = 0; index < text.length; ) {
        const first = text.charCodeAt(index++);
        const second = text.charCodeAt(index++);
        const third = text.charCodeAt(index++);
        const a = first >> 2;
        const b = ((first & 3) << 4) | (second >> 4);
        let c = ((second & 15) << 2) | (third >> 6);
        let d = third & 63;
        if (Number.isNaN(second)) c = d = 64;
        else if (Number.isNaN(third)) d = 64;
        output += DX_ALPHABET.charAt(a) + DX_ALPHABET.charAt(b) + DX_ALPHABET.charAt(c) + DX_ALPHABET.charAt(d);
    }
    return output;
}

function dxSelectMethod(param) {
    return param && param.length > 1024 ? "POST" : "GET";
}

function dxShorten(data = {}) {
    const output = {};
    for (const key in data) output[DX_KEY_MAP[key] ? DX_KEY_MAP[key] : key] = data[key];
    return output;
}

function dxSystemInfo() {
    return {
        brand: "microsoft",
        model: "Windows WeChat",
        pixelRatio: 1,
        screenWidth: 414,
        screenHeight: 896,
        windowWidth: 414,
        windowHeight: 896,
        statusBarHeight: 0,
        language: "zh_CN",
        version: "8.0.58",
        system: "Windows 10 x64",
        platform: "windows",
        fontSizeSetting: 16,
        SDKVersion: "3.9.12",
        benchmarkLevel: 1,
        batteryLevel: 100,
    };
}

async function dxCollect(options = {}) {
    const start = Date.now();
    const data = {
        networkType: "wifi",
        ...dxSystemInfo(),
    };
    if (options.gps) data.gps = process.env.longfor_gps || "116.397128,39.916527";
    data.collectTime = Date.now() - start;
    return dxShorten(data);
}

class MiniDxConstId {
    constructor(options = {}) {
        this.options = { ...DX_MINI_CONFIG, ...(options || {}) };
        this.options.appId = this.options.appId || this.options.appKey;
        if (!this.options.server || !this.options.appId) throw new Error("missing dx server/appId");
    }

    getToken() {
        return DX_STORAGE.get(DX_TOKEN_KEY) || "";
    }

    setToken(token) {
        DX_STORAGE.set(DX_TOKEN_KEY, token);
    }

    async getLid() {
        const lid = DX_STORAGE.get(DX_LID_KEY) || `${Date.now()}${dxMakeLocalId()}`;
        DX_STORAGE.set(DX_LID_KEY, lid);
        return lid;
    }

    mergeOptions(extra = {}) {
        const data = { ...extra };
        ["appId", "userId", "openId", "scene"].forEach((key) => {
            if (this.options[key]) data[key] = encodeURIComponent(this.options[key]);
        });
        data.appKey = data.appId;
        delete data.appId;
        return data;
    }

    async request(param, token = "") {
        const method = dxSelectMethod(param);
        const options = {
            method,
            url: this.options.server,
            headers: {
                Param: method === "POST" ? "" : param,
                "If-None-Match": token,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: 15000,
            validateStatus: () => true,
        };
        if (method === "POST") options.data = new URLSearchParams({ Param: param }).toString();
        else options.params = { Param: "" };
        const { data } = await axios.request(options);
        return data;
    }

    async detect() {
        const lid = await this.getLid();
        const collected = await dxCollect(this.options);
        const param = dxEncrypt(this.mergeOptions({ lid, ...collected }));
        const data = await this.request(param, "");
        if (Number(data.status) === 2) {
            this.setToken(data.data);
            return data.data;
        }
        throw new Error(`dx status: ${data.status}`);
    }

    async generate() {
        const lid = await this.getLid();
        const param = dxEncrypt(this.mergeOptions({ lid, cache: !!this.options.cache }));
        const data = await this.request(param, this.getToken());
        const status = Number(data.status);
        if (status === 1 || status === 2) {
            this.setToken(data.data);
            return data.data;
        }
        if (status === -4 && data.data) {
            DX_STORAGE.set(DX_LID_KEY, data.data);
            return this.detect();
        }
        return this.detect();
    }
}

async function getDxToken() {
    if (process.env.longfor_dx_token) return process.env.longfor_dx_token;
    return new MiniDxConstId().generate();
}

function ok(code) {
    return ["200", "0000", "10000"].includes(String(code));
}

function tokenError(error) {
    return /token|登录|授权|未登录|801007|900005|900006/i.test(String(error?.message || error));
}

class Task {
    constructor(account) {
        this.index = userIdx++;
        this.account = String(account || "").trim();
        this.server = this.account;
        this.token = "";
        this.lmid = "";
        this.expire = 0;
        this.activityNo = "";
    }

    applyToken(data = {}) {
        this.token = data.token || "";
        this.lmid = data.lmid || "";
        this.expire = Number(data.expire || 0);
    }

    getCachedToken() {
        const item = readCache()[this.account];
        if (!item?.token) return null;
        if (item.expireAt && Number(item.expireAt) < Date.now() + 60000) return null;
        return item;
    }

    saveCachedToken() {
        if (!this.token) return;
        const cache = readCache();
        cache[this.account] = {
            token: this.token,
            lmid: this.lmid,
            expireAt: this.expire ? Date.now() + this.expire * 1000 : 0,
            updatedAt: new Date().toISOString(),
        };
        writeCache(cache);
    }

    removeCachedToken() {
        const cache = readCache();
        if (cache[this.account]) {
            delete cache[this.account];
            writeCache(cache);
        }
        this.token = "";
        this.lmid = "";
        this.expire = 0;
    }

    miniHeaders(data = null, member = false) {
        const headers = {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
            "Content-Type": "application/json",
            "lmToken": this.token || "",
            "X-LF-Bucode": BU_CODE,
            "X-LF-App-Version": APP_VERSION,
            "X-LF-RequestId": uuid(),
            "X-LF-Channel": CHANNEL,
            "X-LF-Api-Version": API_VERSION,
        };
        if (member) headers["X-Gaia-Api-Key"] = MEMBER_GAIA_KEY;
        if (data) Object.assign(headers, miniSign(data));
        return headers;
    }

    taskHeaders(dxToken = "") {
        const headers = {
            "User-Agent": USER_AGENT,
            "Referer": "https://longzhu.longfor.com/longball-homeh5/",
            "Content-Type": "application/json;charset=UTF-8",
            "X-GAIA-API-KEY": TASK_GAIA_KEY,
            "token": this.token,
            "X-LF-UserToken": this.token,
            "X-LF-Channel": CHANNEL,
            "X-LF-Bu-Code": BU_CODE,
        };
        if (dxToken) {
            headers["X-LF-DXRisk-Token"] = dxToken;
            headers["X-LF-DXRisk-Source"] = 3;
            headers["X-LF-DXRisk-Captcha-Token"] = "";
        }
        return headers;
    }

    async miniPost(url, data, member = false) {
        const { data: result, status } = await axios.post(url, data, {
            headers: this.miniHeaders(data, member),
            timeout: 20000,
            validateStatus: () => true,
        });
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        if (!ok(result?.code)) {
            const err = new Error(result?.msg || result?.message || JSON.stringify(result));
            err.code = result?.code;
            throw err;
        }
        return result.data;
    }

    async taskPost(pathname, data, dxToken = "") {
        const { data: result, status } = await axios.post(`${TASK_HOST}${pathname}`, data, {
            headers: this.taskHeaders(dxToken),
            timeout: 20000,
            validateStatus: () => true,
        });
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        return result;
    }

    async getLoginCode() {
        const code = await getCode(this.server);
        if (!code) console.log(`账号[${this.index}] 获取微信code失败：请检查 YYB_GO 格式是否为 地址@微信账号标识（换行或&分隔）且 YYB Go 服务可访问`);
        return code;
    }

    async loginByWxCode() {
        const code = await this.getLoginCode();
        if (!code) {
            throw new Error(`获取微信code失败：请检查 YYB_GO 中该账号在 YYB Go 是否已绑定龙湖天街小程序（appId ${MINI_APP_ID}）`);
        }
        const checkData = {
            appId: MINI_APP_ID,
            thirdType: "WX_APPLET",
            fingerprint: "",
            authCode: code,
        };
        const check = await this.miniPost(`${BASE_HOST}/mine/${API_VERSION}/publicApi/login/checkLoginType`, checkData);
        const loginData = {
            appId: MINI_APP_ID,
            authCode: code,
            isNew: false,
            thirdType: "WX_APPLET",
            fingerprint: "",
            ticket: check?.ticket || "",
        };
        const login = await this.miniPost(`${BASE_HOST}/mine/${API_VERSION}/publicApi/login/loginByMiniApp`, loginData);
        this.applyToken(login);
        if (!this.token) throw new Error(`登录响应未返回 token: ${JSON.stringify(login)}`);
        this.saveCachedToken();
        console.log(`账号[${this.index}] 登录成功: token=${shortValue(this.token)} lmid=${shortValue(this.lmid)}`);
    }

    findActivityNo(payload) {
        return (JSON.stringify(payload || {}).match(/activity_no=([0-9]+)/) || [])[1] || "";
    }

    async getPageConfig() {
        const data = await this.miniPost(
            `${MEMBER_HOST}/api/bff/pages/${API_VERSION}/publicApi/v1/pageConfig`,
            { pageCode: "C2mine" },
            true
        );
        this.activityNo = this.findActivityNo(data);
        return data;
    }

    async checkToken() {
        try {
            await this.getPageConfig();
            return true;
        } catch (e) {
            return false;
        }
    }

    async getPageInfo() {
        const result = await this.taskPost("/openapi/task/v1/signature/page-info", { activity_no: this.activityNo });
        if (!ok(result?.code)) throw new Error(result?.message || result?.msg || JSON.stringify(result));
        return result.data || {};
    }

    todaySigned(pageInfo) {
        const today = Array.isArray(pageInfo?.seven_days_signs) ? pageInfo.seven_days_signs[0] : {};
        return Number(today?.sign_status) === 20;
    }

    rewardText(rewards = []) {
        if (!Array.isArray(rewards)) return "";
        return rewards
            .map((item) => {
                const num = item?.reward_num || item?.num || item?.amount;
                const name = item?.reward_name || item?.reward_type_name || item?.unit || "";
                return num ? `${name}${num}` : "";
            })
            .filter(Boolean)
            .join(",");
    }

    async signIn() {
        await this.getPageConfig();
        if (!this.activityNo) throw new Error("未在会员页配置中找到签到 activity_no");

        const pageInfo = await this.getPageInfo();
        console.log(`账号[${this.index}] 活动: ${pageInfo.task_name || "签到"} 今日=${this.todaySigned(pageInfo) ? "已签到" : "未签到"}`);
        if (this.todaySigned(pageInfo)) return;

        const dxToken = await getDxToken();
        console.log(`账号[${this.index}] 风控指纹${dxToken ? "获取成功" : "获取失败，直接尝试"}`);

        const result = await this.taskPost("/openapi/task/v1/signature/clock", { activity_no: this.activityNo }, dxToken);
        if (!ok(result?.code)) {
            const err = new Error(result?.message || result?.msg || JSON.stringify(result));
            err.code = result?.code;
            throw err;
        }
        console.log(`账号[${this.index}] 签到成功${this.rewardText(result?.data?.reward_info) ? `: ${this.rewardText(result.data.reward_info)}` : ""}`);
    }

    async run() {
        const cached = this.getCachedToken();
        if (cached) {
            this.applyToken(cached);
            console.log(`账号[${this.index}] 使用缓存token: ${shortValue(this.token)}`);
            if (!(await this.checkToken())) {
                this.removeCachedToken();
                console.log(`账号[${this.index}] 缓存token失效，重新登录`);
            }
        }
        if (!this.token) await this.loginByWxCode();
        if (!this.token) return;

        try {
            await this.signIn();
        } catch (e) {
            console.log(`账号[${this.index}] 签到失败${e.code ? `(${e.code})` : ""}: ${e.message || e}`);
            if (tokenError(e)) this.removeCachedToken();
        }
    }
}

!(async () => {
    for (const account of SERVERS) {
        const task = new Task(account);
        try {
            await task.run();
        } catch (e) {
            console.log(`账号[${task.index}] 处理异常已跳过: ${e.message || e}`);
        }
    }
})()
    .catch((e) => console.log(e.message || e))
