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


// name: 飞鹤
// cron: 35 9 * * *

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
    if (!value) return { scheme: "", server: "", ref: "" };
    const atIndex = value.indexOf("@");
    if (atIndex === -1) {
        console.log("YYB_GO 格式应为 地址@微信账号标识，当前值: " + value);
        return { scheme: "", server: "", ref: "" };
    }
    let server = value.slice(0, atIndex).trim();
    const ref = value.slice(atIndex + 1).trim();
    let scheme = "https";
    if (server.startsWith("http://")) { scheme = "http"; server = server.slice(7); }
    else if (server.startsWith("https://")) { scheme = "https"; server = server.slice(8); }
    server = server.replace(/\/+$/, "");
    if (!server || !ref) return { scheme: "", server: "", ref: "" };
    return { scheme, server, ref };
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
    const { scheme, server: parsedServer, ref } = parseYybGoEntry(server);
    if (!parsedServer || !ref) return null;
    const url = `${scheme}://${parsedServer}/wxapp/getCode`;
    try {
        const { data } = await axios.post(url, { ref, app_id: MINI_APP_ID }, { timeout: 20000, proxy: false, headers: buildYybAuthHeaders() });
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

const MINI_APP_ID = "wx4205ec55b793245e";
const API_BASE = "https://www.feihevip.com";
const APP_ID = "xmyx";
const APP_KEY = "TwUQ01lKS1Km5zlV2f7amsZc5EQYkTbv";
const SIGN_TASK_TYPE = "DJSYQD";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "feihe_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";


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

function maskToken(token = "") {
    if (!token) return "";
    return token.length > 16 ? `${token.slice(0, 8)}***${token.slice(-8)}` : `${token.slice(0, 4)}***`;
}

function randomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

function md5Upper(text) {
    return crypto.createHash("md5").update(text).digest("hex").toUpperCase();
}

function buildSignedHeaders({ data = null, token = "" } = {}) {
    const headers = {
        fhAppid: APP_ID,
        fhNonceStr: randomString(16),
        fhTimestamp: Math.floor(Date.now() / 1000),
        token,
        source: 1,
        "Content-Type": "application/json",
        OrderUpdate: 1,
        visit: "",
    };
    const dataSignValue = data && typeof data === "object" ? JSON.stringify(data) : data ? String(data) : "";
    const signKeys = ["fhAppid", "fhNonceStr", "fhTimestamp", dataSignValue].sort();
    const signText = signKeys.reduce((text, key) => {
        if (Object.prototype.hasOwnProperty.call(headers, key)) {
            return text + key + headers[key];
        }
        return text + key;
    }, "");

    return {
        ...headers,
        fhSign: md5Upper(signText + APP_KEY),
        Referer: `https://servicewechat.com/${MINI_APP_ID}/420/page-frame.html`,
        "User-Agent": USER_AGENT,
        Accept: "application/json, text/plain, */*",
    };
}

function buildUrl(apiPath, query = {}) {
    const params = new URLSearchParams();
    Object.entries(query || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.append(key, String(value));
    });
    return `${API_BASE}${apiPath}${params.toString() ? `?${params.toString()}` : ""}`;
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
        this.userInfo = {};
    }

    async run() {
        const cached = this.getCachedToken();
        if (cached) {
            this.token = cached.token || "";
            console.log(`账号[${this.index}] 使用缓存token: ${maskToken(this.token)}`);
            if (!(await this.checkToken())) {
                console.log(`账号[${this.index}] 缓存token失效，重新code登录`);
                this.removeCachedToken();
                this.token = "";
            }
        }

        if (!this.token) {
            await this.loginByCode();
        }
        if (!this.token) return;

        await this.getIndexInfo();
        await this.signIn();
    }

    getCachedToken() {
        const cache = readCache();
        return cache[this.account] || null;
    }

    saveCachedToken() {
        if (!this.token) return;
        const cache = readCache();
        cache[this.account] = {
            token: this.token,
            userInfo: this.userInfo,
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
    }

    async request({ method = "GET", apiPath, query = {}, data = null, token = this.token, allowFail = false }) {
        const options = {
            method,
            url: buildUrl(apiPath, query),
            headers: buildSignedHeaders({ data: method === "GET" ? null : data, token }),
            timeout: 15000,
            validateStatus: () => true,
        };
        if (method !== "GET") options.data = data || {};

        const { status, data: result } = await axios.request(options);
        const ok = status === 200 && String(result?.code) === "200";
        if (!ok && !allowFail) {
            throw new Error(`HTTP ${status} ${JSON.stringify(result)}`);
        }
        return result;
    }

    async getWxCode() {
        return await getCode(this.server);
    }

    async loginByCode() {
        const code = await this.getWxCode();
        const result = await this.request({
            apiPath: "/api/starMember/getUserToken",
            query: { code },
            token: "",
        });
        const data = result.data || {};
        this.token = result.token || data.token || "";
        this.userInfo = {
            crmId: data.crmId,
            openId: data.openId,
            unionId: data.unionId,
            loginStatus: data.loginStatus,
            expireTime: data.expireTime,
        };
        if (!this.token) throw new Error(`登录成功但未返回token: ${JSON.stringify(result)}`);
        this.saveCachedToken();
        console.log(`账号[${this.index}] code登录成功: ${data.crmId || data.openId || ""} token=${maskToken(this.token)}`);
    }

    async checkToken() {
        try {
            const result = await this.request({
                method: "POST",
                apiPath: "/api/structures/index",
                data: { id: "" },
                allowFail: true,
            });
            return String(result?.code) === "200";
        } catch (e) {
            return false;
        }
    }

    async getIndexInfo() {
        const result = await this.request({
            method: "POST",
            apiPath: "/api/structures/index",
            data: { id: "" },
            allowFail: true,
        });
        if (String(result?.code) === "200") {
            const signModule = (result.data?.modules || []).find((item) => String(item.moduleType) === "17");
            console.log(`账号[${this.index}] 首页签到入口: ${signModule ? "已发现" : "未发现"}`);
        } else {
            console.log(`账号[${this.index}] 首页信息查询失败: ${result?.msg || JSON.stringify(result)}`);
        }
    }

    async signIn() {
        const finish = await this.request({
            apiPath: "/api/member/signin/tofinish",
            query: { taskType: SIGN_TASK_TYPE },
            allowFail: true,
        });
        if (String(finish?.code) === "200") {
            // data 为 true=本次新增上报；为 null/其它=今日已签到（幂等），均视为签到成功
            console.log(`账号[${this.index}] 签到上报成功${finish.data === true ? "（新增）" : "（今日已签到）"}`);
        } else {
            throw new Error(`签到失败: ${finish?.msg || JSON.stringify(finish)}`);
        }

        const complete = await this.request({
            apiPath: "/api/member/signin/completeTask",
            query: { taskType: SIGN_TASK_TYPE },
            allowFail: true,
        });
        if (String(complete?.code) === "200") {
            const points = complete.data?.awardSendPoints || complete.data?.awardPoint || "";
            console.log(`账号[${this.index}] 签到完成确认${points ? `，获得${points}积分` : ""}`);
        } else {
            // 非 200 通常是「今日已领过/无需再领」的幂等响应，记录但不视为失败
            console.log(`账号[${this.index}] 签到完成确认返回(可能今日已领): ${complete?.msg || JSON.stringify(complete)}`);
        }
    }
}

!(async () => {
    
    if (!SERVERS.length) return;

    for (const account of SERVERS) {
        const task = new Task(account);
        try {
            await task.run();
        } catch (e) {
            console.log(`账号[${task.index}] 运行失败: ${e.message || e}`);
        }
    }
})()
    .catch((e) => console.log(`运行异常: ${e.message || e}`))
