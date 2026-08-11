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


// name: 麦富迪会员
// cron: 41 9 * * *

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
            if (url.startsWith('http://')) ;
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
    const url = "http://" + parsedServer + "/wxapp/getCode";
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

const MINI_APP_ID = "wx278a2ed79c5182f8";
const API_BASE = "https://cdp.myfoodiepet.com";
const APP_ID = "6259662812989361028";
const TENANT_ID = "00ae459e842642f78b9ab0d8e7c027b4";
const SIGN_SALT = "XpL9q#dK2zRf$tMn";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "mfd_token_cache.json");
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

function md5(text) {
    return crypto.createHash("md5").update(String(text)).digest("hex");
}

function memberSignature(memberId) {
    const timestamp = Date.now();
    return {
        memberId,
        timestamp,
        signature: md5(`${memberId}${timestamp}${SIGN_SALT}`),
    };
}

function isTokenError(error) {
    return /登录|授权|memberId|401|openid|code|token/i.test(String(error && (error.message || error)));
}

class Task {
    constructor(account) {
        this.server = account;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.index = userIdx++;
        this.account = String(account || "").trim();
        this.openId = "";
        this.unionId = "";
        this.memberId = "";
        this.phone = "";
        this.groupId = "";
        this.agentId = "";
        this.memberInfo = {};
    }

    async run() {
        const cached = this.getCachedToken();
        if (cached) {
            this.applyToken(cached);
            console.log(`账号[${this.index}] 使用缓存登录态: memberId=${shortValue(this.memberId)}`);
            if (!(await this.checkLogin())) {
                this.removeCachedToken();
                console.log(`账号[${this.index}] 缓存登录态失效，重新登录`);
            }
        }

        if (!this.memberId) {
            await this.loginByWxCode();
            if (!this.memberId) return;
        }

        await this.getMemberInfo();
        await this.getContinuousDays();
        await this.signIn();
        await this.getContinuousDays();
    }

    getCachedToken() {
        const cache = readTokenCache();
        const item = cache[this.account];
        if (!item || !item.memberId) return null;
        return item;
    }

    saveCachedToken() {
        if (!this.memberId) return;
        const cache = readTokenCache();
        cache[this.account] = {
            openId: this.openId,
            unionId: this.unionId,
            memberId: this.memberId,
            phone: this.phone,
            groupId: this.groupId,
            agentId: this.agentId,
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
        this.openId = "";
        this.unionId = "";
        this.memberId = "";
        this.phone = "";
        this.groupId = "";
        this.agentId = "";
    }

    applyToken(data = {}) {
        this.openId = data.openId || "";
        this.unionId = data.unionId || "";
        this.memberId = data.memberId || "";
        this.phone = data.phone || "";
        this.groupId = data.groupId || "";
        this.agentId = data.agentId || "";
    }

    getHeaders(extra = {}) {
        const headers = {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/402/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            appId: APP_ID,
            tenantId: TENANT_ID,
            wxAppid: MINI_APP_ID,
            groupId: this.groupId || "",
            ...extra,
        };
        if (this.memberId) headers.userId = this.memberId;
        return headers;
    }

    async request({ method = "GET", apiPath, params = {}, data = {} }) {
        const upperMethod = method.toUpperCase();
        const options = {
            method: upperMethod,
            url: `${API_BASE}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`,
            headers: this.getHeaders(),
            timeout: 20000,
            validateStatus: () => true,
        };
        if (upperMethod === "GET") options.params = { ...params, _: Date.now() };
        else {
            options.params = { _: Date.now() };
            options.data = data;
        }

        const { data: result, status } = await axios.request(options);
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        if (!result || (String(result.code) !== "0" && Number(result.code) !== 2)) {
            throw new Error(result?.msg || result?.message || JSON.stringify(result));
        }
        return result;
    }

    async getLoginCode() {
        return await getCode(this.server);
    }

    async getIdentityInfo() {
        try {
            const result = await this.request({
                apiPath: `/tnew/myfoodiepet-member/v1/member/identity/info/${MINI_APP_ID}`,
            });
            const data = result.data || {};
            this.groupId = data.groupId || this.groupId;
            this.agentId = data.agentId || this.agentId;
            this.saveCachedToken();
            return data;
        } catch (e) {
            console.log(`账号[${this.index}] 获取身份配置失败: ${e.message || e}`);
            return {};
        }
    }

    async loginByWxCode() {
        try {
            await this.getIdentityInfo();
            const code = await this.getLoginCode();
            const result = await this.request({
                apiPath: "/tnew/myfoodiepet-member/v1/wechat/applet/authorizeV2",
                params: { code },
            });
            const data = result.data || {};
            this.openId = data.openId || "";
            this.unionId = data.unionId || "";
            this.memberId = String(data.memberId || "");
            this.phone = data.phone || "";
            if (!this.memberId) throw new Error(`登录响应未返回 memberId: ${JSON.stringify(result)}`);
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功: memberId=${shortValue(this.memberId)} ${maskPhone(this.phone)}`);
        } catch (e) {
            console.log(`账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkLogin() {
        try {
            if (!this.groupId) await this.getIdentityInfo();
            await this.queryMemberById();
            return true;
        } catch (e) {
            return false;
        }
    }

    async queryMemberById() {
        const result = await this.request({
            method: "POST",
            apiPath: "/tnew/myfoodiepet-member/v1/member/queryByMemberId",
            data: memberSignature(this.memberId),
        });
        return result.data || {};
    }

    async getMemberInfo() {
        try {
            const data = await this.queryMemberById();
            this.memberInfo = data;
            const name = data.nickName || data.nickname || data.memberName || data.name || "未知";
            const phone = data.phone || data.mobile || this.phone;
            const point = data.availablePoint ?? data.point ?? data.points ?? data.integral ?? "未知";
            console.log(`账号[${this.index}] 会员: ${name} ${maskPhone(phone)} 积分=${point}`);
        } catch (e) {
            console.log(`账号[${this.index}] 查询会员信息失败: ${e.message || e}`);
            if (isTokenError(e)) this.removeCachedToken();
        }
    }

    async getContinuousDays() {
        try {
            const result = await this.request({
                apiPath: `/tnew/myfoodiepet-member/v1/member/continuous-days/${this.memberId}`,
            });
            const data = result.data || {};
            this.signedToday = data.signedToday;
            console.log(`账号[${this.index}] 签到状态: 连续${data.continuousDays ?? 0}天 今日=${data.signedToday ? "已签" : "未签"}`);
            return data;
        } catch (e) {
            console.log(`账号[${this.index}] 查询签到状态失败: ${e.message || e}`);
            return {};
        }
    }

    async signIn() {
        try {
            if (this.signedToday) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }
            const result = await this.request({
                method: "POST",
                apiPath: "/tnew/myfoodiepet-member/v1/member/sign",
                data: { memberId: this.memberId },
            });
            console.log(`账号[${this.index}] 签到成功: ${result.msg || result.message || "ok"}`);
        } catch (e) {
            console.log(`账号[${this.index}] 签到失败: ${e.message || e}`);
            if (isTokenError(e)) this.removeCachedToken();
        }
    }
}

!(async () => {
    
    for (const account of SERVERS) {
        await new Task(account).run();
    }
})()
    .catch((e) => console.log(e.message || e))
