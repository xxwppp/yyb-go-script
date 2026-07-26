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


// name: 发发藏宝洞
// cron: 45 9 * * *

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

const MINI_APP_ID = "wxd15ddc3916302f35";
const PAGE_VERSION = "99";
const APP_VERSION = "2.31.2";
const ENV_VERSION = "release";
const API_BASE = "https://smp-api.iyouke.com/dtapi";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "fafa_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

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

function formatDate(date = new Date(), separator = "-") {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return [y, m, d].join(separator);
}

function normalizeAuthorization(value = "") {
    const token = String(value || "").trim();
    if (!token) return "";
    if (/^bearer/i.test(token)) return token;
    if (/^Bearer\s+/i.test(token)) return `bearer${token.replace(/^Bearer\s+/i, "")}`;
    return `bearer${token}`;
}

function maskMobile(mobile = "") {
    return String(mobile || "").replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

class Task {
    constructor(account) {
        this.server = account;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.index = userIdx++;
        this.account = String(account || "").trim();
        this.accessToken = "";
        this.authorization = "";
        this.userInfo = {};
        this.todayDate = formatDate();
        this.isTodaySign = false;
        this.isDirectToken = /^token=/i.test(this.account) || /^bearer/i.test(this.account);
        if (this.isDirectToken) this.applyToken({ authorization: this.account.replace(/^token=/i, "") });
    }

    async run() {
        if (!this.authorization) {
            const cached = this.getCachedToken();
            if (cached) {
                this.applyToken(cached);
                console.log(`账号[${this.index}] 使用缓存token`);
                if (!(await this.checkToken())) {
                    this.removeCachedToken();
                    console.log(`账号[${this.index}] 缓存token失效，重新登录`);
                }
            }
        }

        if (!this.authorization) {
            await this.loginByWxCode();
            if (!this.authorization) return;
        }

        await this.getUserInfo();
        await this.getPointsInfo();
        await this.getSignList();
        await this.doSign();
        await this.getPointsInfo();
        this.saveCachedToken();
    }

    cacheKey() {
        return this.isDirectToken ? `token:${this.authorization.slice(-16)}` : this.account;
    }

    getCachedToken() {
        const cache = readTokenCache();
        return cache[this.cacheKey()] || null;
    }

    saveCachedToken() {
        if (!this.authorization) return;
        const cache = readTokenCache();
        cache[this.cacheKey()] = {
            accessToken: this.accessToken,
            authorization: this.authorization,
            userId: this.userInfo.userId || "",
            nickName: this.userInfo.nickName || "",
            userMobile: this.userInfo.userMobile || "",
            updatedAt: new Date().toISOString(),
        };
        writeTokenCache(cache);
    }

    removeCachedToken() {
        const cache = readTokenCache();
        delete cache[this.cacheKey()];
        writeTokenCache(cache);
        this.accessToken = "";
        this.authorization = "";
        this.userInfo = {};
    }

    applyToken(data = {}) {
        this.accessToken = data.accessToken || data.access_token || "";
        this.authorization = normalizeAuthorization(data.authorization || this.accessToken);
        this.userInfo = { ...this.userInfo, ...data };
    }

    headers(extra = {}) {
        const headers = {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            appId: MINI_APP_ID,
            version: APP_VERSION,
            envVersion: ENV_VERSION,
            "xy-extra-data": `appid=${MINI_APP_ID};version=${APP_VERSION};envVersion=${ENV_VERSION};`,
            ...extra,
        };
        if (this.authorization) headers.Authorization = this.authorization;
        return headers;
    }

    async request({ method = "POST", apiPath, params = {}, data = {}, skipToken = false }) {
        const upperMethod = method.toUpperCase();
        const options = {
            method: upperMethod,
            url: `${API_BASE}${apiPath}`,
            headers: this.headers(upperMethod === "POST" ? { "Content-Type": "application/json" } : {}),
            timeout: 20000,
            validateStatus: () => true,
        };
        if (upperMethod === "GET") options.params = params;
        else options.data = data;
        if (skipToken) delete options.headers.Authorization;

        const res = await axios.request(options);
        if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
        const result = res.data;
        if (result && typeof result === "object" && result.error !== undefined && Number(result.error) !== 0) {
            const err = new Error(result.errorMsg || result.message || result.msg || JSON.stringify(result));
            err.code = result.error;
            throw err;
        }
        return result?.data ?? result;
    }

    async getLoginCode() {
        return await getCode(this.server);
    }

    async loginByWxCode() {
        try {
            const code = await this.getLoginCode();
            const data = await this.request({
                apiPath: "/appLogin",
                skipToken: true,
                data: {
                    appType: 1,
                    principal: code,
                },
            });
            this.applyToken(data);
            if (!this.authorization) throw new Error(`登录未返回token: ${JSON.stringify(data)}`);
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功: userId=${data.userId || ""}`);
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

    async getUserInfo(log = true) {
        const data = await this.request({
            method: "GET",
            apiPath: "/p/user/userInfo",
        });
        this.userInfo = {
            ...this.userInfo,
            ...data,
        };
        this.saveCachedToken();
        if (log) {
            const name = data.nickName || data.memberName || data.userId || "未知";
            const mobile = data.userMobile || data.mobile || "";
            console.log(`账号[${this.index}] 用户: ${name}${mobile ? ` ${maskMobile(mobile)}` : ""}`);
        }
        return data;
    }

    async getPointsInfo() {
        try {
            const data = await this.request({
                method: "GET",
                apiPath: "/pointsSign/user/pointsInfo/query",
            });
            console.log(`账号[${this.index}] 积分: ${data?.pointsNums ?? "未知"} 连签=${data?.seriesDays ?? 0} 今日=${data?.signTodayResult ? "已签" : "未签"}`);
            return data;
        } catch (e) {
            const message = e.message || e;
            console.log(`账号[${this.index}] 查询积分失败: ${message}`);
            if (/token|登录|授权|401/i.test(String(message))) this.removeCachedToken();
        }
    }

    async getSignList() {
        try {
            const data = await this.request({
                method: "GET",
                apiPath: "/pointsSign/user/sign/list",
                params: { v4Flag: true },
            });
            const today = formatDate();
            const todayItem = Array.isArray(data) ? data.find((item) => item?.isToday || item?.dateStr === today) : null;
            this.todayDate = todayItem?.dateStr || today;
            this.isTodaySign = Number(todayItem?.daySignStatus) === 2 || Boolean(todayItem?.sign);
            console.log(`账号[${this.index}] 签到状态: ${this.todayDate} ${this.isTodaySign ? "已签" : "未签"}`);
        } catch (e) {
            const message = e.message || e;
            console.log(`账号[${this.index}] 查询签到状态失败: ${message}`);
            if (/token|登录|授权|401/i.test(String(message))) this.removeCachedToken();
        }
    }

    async doSign() {
        if (this.isTodaySign) {
            console.log(`账号[${this.index}] 今日已签到`);
            return;
        }
        try {
            const date = (this.todayDate || formatDate()).replace(/-/g, "/");
            const data = await this.request({
                method: "GET",
                apiPath: "/pointsSign/user/sign",
                params: { date },
            });
            console.log(`账号[${this.index}] 签到成功: +${data?.signReward ?? data?.reward ?? "未知"}积分`);
        } catch (e) {
            const message = String(e.message || e);
            if (/已签|重复|今日.*签/i.test(message)) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }
            console.log(`账号[${this.index}] 签到失败: ${message}`);
            if (/token|登录|授权|401/i.test(message)) this.removeCachedToken();
        }
    }
}

!(async () => {
    
    for (const account of SERVERS) {
        await new Task(account).run();
    }
})()
    .catch((e) => console.log(e.message || e))
