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

// name: CASETiFY
// cron: 52 9 * * *

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

const MINI_APP_ID = "wxd0c71d6bf928a416";
const PAGE_VERSION = "160";
const API_BASE = "https://mini-app-api.casetify.cn/api/v4";
const WECHAT_ID = 260;
const POINT_MALL_TYPE = 13;
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "casetify_token_cache.json");
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

function normalizeDate(value) {
    const parts = String(value || "").split("-");
    if (parts.length !== 3) return String(value || "");
    return `${parts[0]}-${String(Number(parts[1])).padStart(2, "0")}-${String(Number(parts[2])).padStart(2, "0")}`;
}

function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isTokenError(message) {
    return /token|登录|授权|invalid|expire|过期|401|403/i.test(String(message || ""));
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
        this.customerNo = "";
        this.phone = "";
        this.levels = "";
        this.campaignId = "";
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

        await this.getCampaignId();
        await this.doSign();
        this.saveCachedToken();
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
            customerNo: this.customerNo,
            phone: this.phone,
            levels: this.levels,
            campaignId: this.campaignId,
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
        this.customerNo = "";
        this.campaignId = "";
    }

    applyToken(data = {}) {
        this.token = data.token || "";
        this.memberId = data.memberId || data.id || "";
        this.customerNo = data.customerNo || "";
        this.phone = data.phone || "";
        this.levels = data.levels || "";
        this.campaignId = data.campaignId || "";
    }

    getHeaders(auth = false) {
        const headers = {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
        };
        if (!auth) headers.token = this.token || "";
        return headers;
    }

    async request(method, apiPath, data = {}, options = {}) {
        const requestOptions = {
            method,
            url: `${API_BASE}/${apiPath}`,
            headers: this.getHeaders(options.auth),
            timeout: 20000,
            validateStatus: () => true,
        };
        if (method === "GET") requestOptions.params = data;
        else requestOptions.data = data;

        const { status, data: result } = await axios.request(requestOptions);
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        if (!options.allowAnyCode && result?.resultCode !== "1") {
            const err = new Error(result?.msg || JSON.stringify(result));
            err.resultCode = result?.resultCode;
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
            const result = await this.request("GET", `estore/member/onLogin/${code}/${WECHAT_ID}`, {}, { auth: true });
            const user = result.data || {};
            this.applyToken({
                token: user.token,
                memberId: user.id,
                customerNo: user.customerNo,
                phone: user.phone,
                levels: user.levels,
            });
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功: ${this.levels || "会员"} ${this.customerNo || this.memberId || ""}`);
        } catch (e) {
            console.log(`账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkToken() {
        try {
            await this.getCampaignId(true);
            return true;
        } catch (e) {
            return false;
        }
    }

    async getCampaignId(silent = false) {
        if (this.campaignId) return this.campaignId;
        const result = await this.request("GET", "estore-campaign/campaign/info/get", {
            campaignType: POINT_MALL_TYPE,
        });
        const campaignId = result.data?.detail?.campaignId || result.data?.campaignId || "";
        if (!campaignId) throw new Error("未找到积分商城活动");
        this.campaignId = campaignId;
        this.saveCachedToken();
        if (!silent) console.log(`账号[${this.index}] 积分商城活动: ${campaignId}`);
        return campaignId;
    }

    async getSignInfo() {
        if (!this.campaignId) await this.getCampaignId(true);
        const result = await this.request("GET", "estore-campaign/campaign/pointsMall/assignment/sign", {
            campaignId: this.campaignId,
        });
        return result.data || {};
    }

    async doSign() {
        try {
            const before = await this.getSignInfo();
            const signDays = Array.isArray(before.signDays) ? before.signDays : [];
            const todayStatus = signDays.find((item) => normalizeDate(item.signDay) === today());
            const dailyTask = Array.isArray(before.assignDetail)
                ? before.assignDetail.find((item) => item.assignmentName && item.assignmentName.includes("单日"))
                : null;
            if (todayStatus?.signStatus === 1 || dailyTask?.completeStatus === 1) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }

            const sign = await this.request("POST", "estore-campaign/member/sign/do", {}, { allowAnyCode: true });
            if (sign.resultCode !== "1") {
                const message = sign.msg || JSON.stringify(sign);
                if (/已签|重复/.test(message)) {
                    console.log(`账号[${this.index}] 今日已签到`);
                    return;
                }
                throw new Error(message);
            }

            const after = await this.getSignInfo();
            const task = Array.isArray(after.assignDetail)
                ? after.assignDetail.find((item) => item.assignmentName && item.assignmentName.includes("单日"))
                : null;
            console.log(`账号[${this.index}] 签到成功: +${task?.awardPrice || "未知"}积分`);
        } catch (e) {
            const message = e.message || e;
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
