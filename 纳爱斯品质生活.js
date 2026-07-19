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

// name: 纳爱斯品质生活
// cron: 47 8 * * *

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

const MINI_APP_ID = "wx231879a144b5879e";
const PAGE_VERSION = "290";
const API_BASE = "https://m.pailifan.com/xcx";
const BRAND_ID = 2655;
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "nice_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const ENCRYPT_SALT = "tMFw=RXrEF7y^=7QXy2h2C_g_^";
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

function maskPhone(phone = "") {
    return String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function md5(text) {
    return crypto.createHash("md5").update(String(text)).digest("hex");
}

function formatDateTime(timestamp) {
    const d = new Date(timestamp * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function zeroPad(buffer) {
    const rest = buffer.length % 16;
    if (rest === 0) return buffer;
    return Buffer.concat([buffer, Buffer.alloc(16 - rest)]);
}

function encryptPayload(data) {
    const t = Math.floor(Date.now() / 1000);
    const date = formatDateTime(t);
    const key = Buffer.from(md5(ENCRYPT_SALT + date + t).substring(8, 24));
    const iv = Buffer.from(md5(date + t + ENCRYPT_SALT).substring(8, 24));
    const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
    cipher.setAutoPadding(false);
    const input = zeroPad(Buffer.from(JSON.stringify(data), "utf8"));
    const encode = Buffer.concat([cipher.update(input), cipher.final()]).toString("base64");
    return { encode, t, bd: BRAND_ID };
}

function isTokenError(message) {
    return /40313|40317|unlogin|token|登录|授权|invalid/i.test(String(message || ""));
}

class Task {
    constructor(openid) {
        this.server = openid;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.index = userIdx++;
        this.openid = String(openid || "").trim();
        this.token = "";
        this.memberId = "";
        this.phone = "";
        this.todaySigned = false;
    }

    async run() {
        const cached = this.getCachedToken();
        if (cached) {
            this.applyToken(cached);
            console.log(`账号[${this.index}] 使用缓存token`);
            if (!(await this.checkToken())) {
                this.removeCachedToken();
                console.log(`账号[${this.index}] 缓存token失效，重新登录`);
            }
        }

        if (!this.token) {
            await this.loginByWxCode();
            if (!this.token) return;
        }

        await this.getUser();
        await this.getSignLog();
        await this.doSign();
    }

    getCachedToken() {
        const cache = readTokenCache();
        return cache[this.openid] || null;
    }

    saveCachedToken() {
        if (!this.token) return;
        const cache = readTokenCache();
        cache[this.openid] = {
            token: this.token,
            memberId: this.memberId,
            phone: this.phone,
            updatedAt: new Date().toISOString(),
        };
        writeTokenCache(cache);
    }

    removeCachedToken() {
        const cache = readTokenCache();
        if (cache[this.openid]) {
            delete cache[this.openid];
            writeTokenCache(cache);
        }
        this.token = "";
        this.memberId = "";
        this.phone = "";
    }

    applyToken(data = {}) {
        this.token = data.token || data.accessToken || "";
        this.memberId = data.memberId || data.member_id || "";
        this.phone = data.phone || data.mobile || "";
    }

    getHeaders(extra = {}) {
        return {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "VERSION": "2022072802",
            "brand": "devtools",
            "model": "Windows",
            "platform": "windows",
            "system": "Windows 10",
            "deviceOrientation": "portrait",
            "version": "8.0.5",
            "size": "414,896",
            ...extra,
        };
    }

    buildPayload(data = {}) {
        return {
            ...data,
            b: BRAND_ID,
            lat: data.lat || "",
            lng: data.lng || "",
        };
    }

    async request(apiPath, data = {}, options = {}) {
        const payload = this.buildPayload(options.skipToken ? data : { token: this.token, ...data });
        const res = await axios.post(`${API_BASE}${apiPath}`, encryptPayload(payload), {
            headers: this.getHeaders(),
            timeout: 15000,
            validateStatus: () => true,
        });
        const result = res.data;
        if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${JSON.stringify(result)}`);
        if (!result || result.flag !== 0) {
            const message = result?.msg || result?.data?.message || result?.data?.reason || JSON.stringify(result);
            const err = new Error(message);
            err.flag = result?.flag;
            throw err;
        }
        if (result?.data?.reason === "unlogin") {
            const err = new Error("unlogin");
            err.flag = result.flag;
            throw err;
        }
        return result.data;
    }

    async getLoginCode() {
        return await getCode(this.server);
    }

    async loginByWxCode() {
        try {
            const code = await this.getLoginCode();
            const data = await this.request("/v2/user_login", { code }, { skipToken: true });
            this.applyToken({
                token: data?.token,
                memberId: data?.member_id || data?.u,
                phone: data?.p,
            });
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功: ${this.memberId || "未知"} ${maskPhone(this.phone) || ""}`);
        } catch (e) {
            console.log(`账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkToken() {
        try {
            await this.getSignLog(true);
            return true;
        } catch (e) {
            return false;
        }
    }

    async getUser() {
        try {
            const data = await this.request("/m/user");
            const user = data?.user || {};
            this.memberId = user.member_id || user.memberId || this.memberId;
            this.phone = user.phone || user.mobile || this.phone;
            this.saveCachedToken();
            console.log(`账号[${this.index}] 用户: memberId=${this.memberId || "未知"} ${maskPhone(this.phone) || ""}`);
        } catch (e) {
            const message = e.message || e;
            console.log(`账号[${this.index}] 查询用户失败: ${message}`);
            if (isTokenError(message)) this.removeCachedToken();
        }
    }

    async getSignLog(silent = false) {
        const data = await this.request("/u/signinlog");
        const info = data?.member_sign_info || {};
        const showDay = Number(info.show_day || 0);
        const totalCoins = info.zongCoin ?? data?.zongCoin ?? 0;
        this.todaySigned = Number(info.sign_today || 0) === 1;
        if (!silent) {
            console.log(`账号[${this.index}] 签到状态: ${this.todaySigned ? "今日已签" : "今日未签"} 连续${showDay}天 积分${totalCoins}`);
        }
        return data;
    }

    async doSign() {
        if (this.todaySigned) return;
        try {
            const data = await this.request("/u/signin", { data: "2019-09-23" });
            const signData = data?.data || {};
            console.log(`账号[${this.index}] 签到成功: +${signData.coin ?? "未知"} 当前积分${signData.total_coins ?? "未知"}`);
            await this.getSignLog(true);
        } catch (e) {
            const message = String(e.message || e);
            if (/已签到|重复|already/i.test(message)) {
                console.log(`账号[${this.index}] 今日已签到`);
                this.todaySigned = true;
                return;
            }
            console.log(`账号[${this.index}] 签到失败: ${message}`);
            if (isTokenError(message)) this.removeCachedToken();
        }
    }
}

!(async () => {
    
    for (const openid of SERVERS) {
        await new Task(openid).run();
    }
})()
    .catch((e) => console.log(e.message || e))
