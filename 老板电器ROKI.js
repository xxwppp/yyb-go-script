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


// name: 老板电器ROKI
// cron: 44 8 * * *

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
// ====================== YYB Go 账号（环境变量 YYB_GO = 地址@微信账号标识，换行或&） ======================
const SERVERS = (process.env.YYB_GO || "")
    .split(/\r?\n|&/)
    .map(s => s.trim())
    .filter(Boolean);
if (!SERVERS.length) {
    console.error("未配置环境变量 YYB_GO，请设置后重试（格式：地址@微信账号标识，换行或&）");
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

const MINI_APP_ID = "wxba70fb8e3eb3aab9";
const API_BASE = process.env.roki_api_base || "https://aio.myroki.com/api/v1/mini-app";
const APP_ENV = process.env.roki_app_env || "release";
const ROKI_APP_ID = "roki_app";
const SIGN_SECRET = "ee8694419924a22f04ac0e01368683521daa659f";
const AES_SECRET = "1234567890123456";
const APP_VERSION = 5000;
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "roki_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

function readTokenCache() {
    try {
        if (!fs.existsSync(TOKEN_CACHE_FILE)) return {};
        return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf8")) || {};
    } catch (e) {
        return {};
    }
}

function writeTokenCache(cache) {
    try {
        fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
    } catch (e) {
        console.log(`写入token缓存失败: ${e.message || e}`);
    }
}

function maskPhone(phone = "") {
    return String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function shortValue(value = "") {
    const text = String(value || "");
    return text ? `${text.slice(0, 4)}***${text.slice(-4)}` : "";
}

function getSignString(params) {
    return Object.keys(params)
        .map((key) => `${key}=${params[key]}`)
        .join("&");
}

function signRequest(timestamp) {
    const payload = {
        aesEncryptSecret: AES_SECRET,
        appId: ROKI_APP_ID,
        nonce: AES_SECRET,
        secret: SIGN_SECRET,
        timestamp,
    };
    const raw = getSignString(payload);
    return encodeURIComponent(crypto.createHmac("sha256", SIGN_SECRET).update(raw).digest("base64"));
}

function isTokenError(error) {
    return /token|登录|授权|401|10001|unauthorized/i.test(String(error && (error.message || error)));
}

class Task {
    constructor(account) {
        this.server = account;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.index = userIdx++;
        this.account = String(account || "").trim();
        this.token = "";
        this.aiToken = "";
        this.expireTime = 0;
        this.userInfo = {};
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

        if (!this.token) {
            await this.loginByWxCode();
            if (!this.token) return;
        }

        await this.getUserInfo();
        await this.signIn();
        await this.getRecentSignIn();
        await this.getMemberPoints();
    }

    getCachedToken() {
        const cache = readTokenCache();
        const item = cache[this.account];
        if (!item || !item.token) return null;
        if (item.expireTime && Number(item.expireTime) < Date.now()) return null;
        return item;
    }

    saveCachedToken() {
        if (!this.token) return;
        const cache = readTokenCache();
        cache[this.account] = {
            token: this.token,
            aiToken: this.aiToken,
            expireTime: this.expireTime,
            userId: this.userInfo.id || "",
            mobile: this.userInfo.mobile || "",
            updatedAt: new Date().toISOString(),
        };
        writeTokenCache(cache);
    }

    removeCachedToken() {
        const cache = readTokenCache();
        if (cache[this.account]) {
            delete cache[this.account];
            writeTokenCache(cache);
        }
        this.token = "";
        this.aiToken = "";
        this.expireTime = 0;
    }

    applyToken(data = {}) {
        this.token = data.token || "";
        this.aiToken = data.aiToken || "";
        this.expireTime = Number(data.expireTime || 0);
    }

    getHeaders(extra = {}) {
        const timestamp = Date.now();
        const headers = {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/454/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            "Content-type": "application/json",
            "X-App-Env": APP_ENV,
            "X-USER-TOKEN": this.token || "",
            "app-id": ROKI_APP_ID,
            timestamp,
            nonce: AES_SECRET,
            secret: AES_SECRET,
            signature: signRequest(timestamp),
            "app-version": APP_VERSION,
            ...extra,
        };
        return headers;
    }

    async request({ method = "GET", apiPath, params = {}, data = {}, skipToken = false }) {
        const upperMethod = method.toUpperCase();
        const headers = this.getHeaders();
        if (skipToken) headers["X-USER-TOKEN"] = "";

        const options = {
            method: upperMethod,
            url: `${API_BASE}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`,
            headers,
            timeout: 20000,
            validateStatus: () => true,
        };
        if (upperMethod === "GET") options.params = params;
        else options.data = data;

        const { data: result, status } = await axios.request(options);
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);

        const code = result && result.code;
        if (code && ![200, 0].includes(Number(code))) {
            const err = new Error(result.message || result.msg || JSON.stringify(result));
            err.code = code;
            err.raw = result;
            throw err;
        }
        return result;
    }

    async getLoginCode() {
        return await getCode(this.server);
    }

    async loginByWxCode() {
        try {
            const code = await this.getLoginCode();
            const result = await this.request({
                method: "POST",
                apiPath: "/user/login",
                skipToken: true,
                data: {
                    code,
                    param: {
                        "qr-code": "",
                    },
                },
            });
            const data = result.data || {};
            this.applyToken(data);
            if (!this.token) throw new Error(`登录响应未返回 token: ${JSON.stringify(result)}`);
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功: token=${shortValue(this.token)}`);
        } catch (e) {
            console.log(`账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkToken() {
        try {
            await this.getUserInfo(false);
            return true;
        } catch (e) {
            return false;
        }
    }

    async getUserInfo(needLog = true) {
        const result = await this.request({ apiPath: "/user/profile" });
        this.userInfo = result.data || {};
        this.saveCachedToken();
        if (needLog) {
            const name = this.userInfo.nickName || this.userInfo.nickname || this.userInfo.name || this.userInfo.id || "未知";
            const mobile = this.userInfo.mobile ? ` ${maskPhone(this.userInfo.mobile)}` : "";
            const points = this.userInfo.points ?? this.userInfo.memberPoints ?? "未知";
            console.log(`账号[${this.index}] 用户: ${name}${mobile} 积分=${points} 今日签到=${this.userInfo.todayIsCheckIn ? "是" : "否"}`);
        }
        return this.userInfo;
    }

    async signIn() {
        try {
            if (Number(this.userInfo.todayIsCheckIn) === 1 || this.userInfo.todayIsCheckIn === true) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }

            const result = await this.request({
                method: "POST",
                apiPath: "/user/check-in-record/check-in",
                data: {},
            });
            console.log(`账号[${this.index}] 签到成功: ${result.message || result.msg || "ok"}`);
            await this.getUserInfo(false);
        } catch (e) {
            console.log(`账号[${this.index}] 签到失败: ${e.message || e}`);
            if (isTokenError(e)) this.removeCachedToken();
        }
    }

    async getRecentSignIn() {
        try {
            const result = await this.request({ apiPath: "/user/check-in-record/recent/record" });
            const data = result.data || {};
            const days = data.consecutiveDays ?? data.continuousDays ?? data.days ?? "未知";
            console.log(`账号[${this.index}] 连续签到: ${days}天`);
        } catch (e) {
            console.log(`账号[${this.index}] 查询签到记录失败: ${e.message || e}`);
        }
    }

    async getMemberPoints() {
        try {
            const result = await this.request({ apiPath: "/user/member/points" });
            const data = result.data || {};
            const points = data.points ?? data.availablePoints ?? data.totalPoints ?? data;
            console.log(`账号[${this.index}] 当前积分: ${typeof points === "object" ? JSON.stringify(points) : points}`);
        } catch (e) {
            console.log(`账号[${this.index}] 查询积分失败: ${e.message || e}`);
        }
    }
}

!(async () => {
    
    for (const account of SERVERS) {
        await new Task(account).run();
    }
})()
    .catch((e) => console.log(e.message || e))
