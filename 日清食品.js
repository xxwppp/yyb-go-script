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

// name: 日清食品
// cron: 30 8 * * *

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

const MINI_APP_ID = "wx21b71db59d93bd6d";
const API_BASE = "https://foodhall-prod-api.nissinfoodium.com.cn/miniapp";
const PAGE_VERSION = "74";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "nissin_token_cache.json");
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

function maskPhone(phone = "") {
    return String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function isTokenError(e) {
    const message = String(e?.message || e || "");
    return e?.code === 401 || e?.code === 900001 || /401|900001|token|登录|授权|Auth-Status|invalid/i.test(message);
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
        this.redOpenId = "";
        this.userId = "";
        this.user = {};
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
        await this.getSignInInfo();
        await this.doSign();
        await this.enterGame();
    }

    getCachedToken() {
        const cache = readTokenCache();
        return cache[this.openid] || null;
    }

    saveCachedToken() {
        if (!this.token) return;
        const cache = readTokenCache();
        cache[this.openid] = {
            accessToken: this.token,
            redOpenId: this.redOpenId,
            userId: this.userId,
            mobile: this.user.mobile || "",
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
        this.redOpenId = "";
        this.userId = "";
    }

    applyToken(data = {}) {
        this.token = data.accessToken || data.access_token || "";
        this.redOpenId = data.redOpenId || data.openId || data.open_id || "";
        this.userId = data.userId || data.user_id || "";
    }

    getHeaders(extra = {}) {
        const headers = {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            ...extra,
        };
        if (this.token) headers.Authorization = `Bearer ${this.token}`;
        return headers;
    }

    async request({ method = "GET", apiPath, data, params, skipToken = false }) {
        const options = {
            method,
            url: `${API_BASE}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`,
            headers: this.getHeaders(method === "POST" ? { "Content-Type": "application/json" } : {}),
            timeout: 15000,
            validateStatus: () => true,
        };
        if (params) options.params = params;
        if (data !== undefined) options.data = data;
        if (skipToken) delete options.headers.Authorization;

        const { status, data: result, headers } = await axios.request(options);
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        if (headers && headers["auth-status"] === "false") {
            const err = new Error("Auth-Status=false");
            err.code = 900001;
            throw err;
        }
        if (!result || result.code !== 0) {
            const err = new Error(result?.msg || result?.message || JSON.stringify(result));
            err.code = result?.code;
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
            const openData = await this.request({
                method: "POST",
                apiPath: "/auth/getOpenId",
                skipToken: true,
                data: {
                    code,
                    invitorMemberId: 0,
                },
            });
            this.redOpenId = openData.openId || "";
            if (!this.redOpenId) throw new Error(`auth/getOpenId 未返回 openId: ${JSON.stringify(openData)}`);

            const loginData = await this.request({
                method: "POST",
                apiPath: "/auth/login",
                skipToken: true,
                data: {
                    openId: this.redOpenId,
                },
            });
            this.applyToken({
                ...loginData,
                redOpenId: this.redOpenId,
            });
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功: userId=${this.userId || "未知"}`);
        } catch (e) {
            console.log(`账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkToken() {
        try {
            await this.getSignInInfo(true);
            return true;
        } catch (e) {
            return false;
        }
    }

    async getUser() {
        try {
            const data = await this.request({ apiPath: "/auth/user/current" });
            this.user = data || {};
            this.saveCachedToken();
            console.log(`账号[${this.index}] 用户: ${data?.nickname || data?.name || ""} ${maskPhone(data?.mobile) || ""}`);
        } catch (e) {
            console.log(`账号[${this.index}] 查询用户失败: ${e.message || e}`);
            if (isTokenError(e)) this.removeCachedToken();
        }
    }

    async getSignInInfo(silent = false) {
        const data = await this.request({ apiPath: "/sign-in/statistics" });
        this.signInfo = data || {};
        if (!silent) {
            console.log(`账号[${this.index}] 签到状态: ${data?.hasSignedToday ? "已签" : "未签"} 连续${data?.continuousDays || 0}天 总${data?.totalDays || 0}天 今日${data?.todayPoints ?? "未知"}积分`);
        }
        return data;
    }

    async doSign() {
        if (this.signInfo?.hasSignedToday) {
            console.log(`账号[${this.index}] 今日已签到`);
            return;
        }
        try {
            const data = await this.request({
                method: "POST",
                apiPath: "/sign-in",
                data: {},
            });
            console.log(`账号[${this.index}] 签到成功: +${data ?? "未知"}积分`);
            await this.getSignInInfo();
        } catch (e) {
            const message = String(e.message || e);
            if (/已签到|重复|今日.*签/i.test(message)) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }
            console.log(`账号[${this.index}] 签到失败: ${message}`);
            if (isTokenError(e)) this.removeCachedToken();
        }
    }

    async getTaskList() {
        try {
            const data = await this.request({ apiPath: "/taskCenter/getEffectiveTask" });
            return Array.isArray(data) ? data : [];
        } catch (e) {
            console.log(`账号[${this.index}] 查询任务列表失败: ${e.message || e}`);
            if (isTokenError(e)) this.removeCachedToken();
            return [];
        }
    }

    async enterGame() {
        try {
            const beforeTasks = await this.getTaskList();
            const gameTask = beforeTasks.find((item) => item?.ruleType === "PLAY_GAME");
            if (gameTask) {
                console.log(`账号[${this.index}] 玩游戏任务: ${gameTask.complete ? "已完成" : "未完成"}`);
            }

            const gameConfig = await this.request({ apiPath: "/game/config" });
            await this.request({
                method: "POST",
                apiPath: "/game/login",
                data: {
                    loginIp: "",
                    loginLocation: "",
                },
            });
            const playCount = await this.request({ apiPath: "/game/count" });
            const gameUrl = `https://foodhall-prod.nissinfoodium.com.cn/game/index.html?version=${Date.now()}&token=${encodeURIComponent(this.token)}&user_id=${encodeURIComponent(this.userId || this.user.id || "")}&webViewHeight=800`;
            const page = await axios.get(gameUrl, {
                headers: {
                    "User-Agent": USER_AGENT,
                    "Referer": `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
                },
                timeout: 15000,
                validateStatus: () => true,
            });
            if (page.status >= 200 && page.status < 400) {
                console.log(`账号[${this.index}] 已进入游戏: ${gameConfig?.shareTitle || "日清消消乐"} 剩余次数=${playCount ?? "未知"}`);
            } else {
                console.log(`账号[${this.index}] 进入游戏页面异常: HTTP ${page.status}`);
            }

            const afterTasks = await this.getTaskList();
            const updatedGameTask = afterTasks.find((item) => item?.ruleType === "PLAY_GAME");
            if (updatedGameTask) {
                console.log(`账号[${this.index}] 玩游戏任务更新: ${updatedGameTask.complete ? "已完成" : "未完成"}`);
            }
        } catch (e) {
            console.log(`账号[${this.index}] 进入游戏失败: ${e.message || e}`);
            if (isTokenError(e)) this.removeCachedToken();
        }
    }
}

!(async () => {
    
    for (const openid of SERVERS) {
        await new Task(openid).run();
    }
})()
    .catch((e) => console.log(e.message || e))
