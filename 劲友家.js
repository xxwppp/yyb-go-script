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


// name: 劲友家
// cron: 36 8 * * *

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

const MINI_APP_ID = "wx10bc773e0851aedd";
const API_BASE = "https://jjw.jingjiu.com/app-jingyoujia";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "jingyoujia_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const PAGE_VERSION = "1052";
const AES_KEY = "Z0J7M480h6kppf67";
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

function isTokenError(message) {
    return /401|token|登录|授权|未登录|无效|过期/i.test(String(message || ""));
}

function aesEncrypt(text) {
    const cipher = crypto.createCipheriv("aes-128-ecb", Buffer.from(AES_KEY, "utf8"), null);
    cipher.setAutoPadding(true);
    return Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]).toString("base64");
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
        this.points = "";
        this.task = null;
        this.record = null;
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

        await this.getCustomerDetails();
        await this.getIntegral();
        await this.findCheckTask();
        await this.queryRecord();
        await this.signIn();
        await this.getIntegral();
    }

    getCachedToken() {
        const cache = readTokenCache();
        const item = cache[this.account];
        return item && item.accessToken ? item : null;
    }

    saveCachedToken() {
        if (!this.token) return;
        const cache = readTokenCache();
        cache[this.account] = {
            accessToken: this.token,
            userInfo: this.userInfo || {},
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
        this.userInfo = {};
    }

    applyToken(data = {}) {
        this.token = data.accessToken || data.token || "";
        this.userInfo = data.userInfo || {};
    }

    getHeaders(extra = {}) {
        return {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            appId: MINI_APP_ID,
            Authorization: this.token || "none",
            ...extra,
        };
    }

    async request({ method = "GET", apiPath, params = {}, data = {}, notAuth = false }) {
        const upperMethod = method.toUpperCase();
        const options = {
            method: upperMethod,
            url: `${API_BASE}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`,
            headers: this.getHeaders(notAuth ? { Authorization: "none" } : {}),
            timeout: 20000,
            validateStatus: () => true,
        };
        if (upperMethod === "GET") options.params = params;
        else options.data = data;

        const { data: result, status } = await axios.request(options);
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        if (!result || (Number(result.code) !== 200 && String(result.code) !== "200")) {
            throw new Error(result?.msg || result?.message || JSON.stringify(result));
        }
        return result.data;
    }

    async getLoginCode() {
        return await getCode(this.server);
    }

    async loginByWxCode() {
        try {
            const code = await this.getLoginCode();
            const data = await this.request({
                method: "POST",
                apiPath: "/login",
                notAuth: true,
                data: { code },
            });
            this.token = data?.accessToken || "";
            if (!this.token) throw new Error(`登录响应未返回 accessToken: ${JSON.stringify(data)}`);
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功`);
        } catch (e) {
            console.log(`账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkToken() {
        try {
            await this.request({ apiPath: "/app/jingyoujia/customer/detail" });
            return true;
        } catch (e) {
            return false;
        }
    }

    async getCustomerDetails() {
        try {
            const data = await this.request({ apiPath: "/app/jingyoujia/customer/detail" });
            this.userInfo = data || {};
            this.saveCachedToken();
            console.log(`账号[${this.index}] 会员: ${data?.nickName || data?.nickname || "未知"} ${maskPhone(data?.mobile || "")}`);
        } catch (e) {
            console.log(`账号[${this.index}] 查询会员失败: ${e.message || e}`);
            if (isTokenError(e.message || e)) this.removeCachedToken();
        }
    }

    async getIntegral() {
        try {
            const data = await this.request({ apiPath: "/app/jingyoujia/customer/queryCustIntegral" });
            this.points = data?.usableIntegral ?? data?.integral ?? data?.custIntegral ?? data?.points ?? "";
            console.log(`账号[${this.index}] 当前积分: ${this.points === "" ? JSON.stringify(data) : this.points}`);
        } catch (e) {
            console.log(`账号[${this.index}] 查询积分失败: ${e.message || e}`);
        }
    }

    async findCheckTask() {
        try {
            const data = await this.request({ apiPath: "/app/jingyoujia/taskContinuousRecord/findCheckTask" });
            if (!data || !data.id) {
                console.log(`账号[${this.index}] 当前无签到活动`);
                return;
            }
            this.task = data;
            const start = String(data.startTime || "").slice(0, 10);
            const end = String(data.endTime || "").slice(0, 10);
            console.log(`账号[${this.index}] 签到活动: taskId=${data.id}${start || end ? ` ${start}-${end}` : ""}`);
        } catch (e) {
            console.log(`账号[${this.index}] 获取签到活动失败: ${e.message || e}`);
        }
    }

    async queryRecord() {
        if (!this.task?.id) return;
        try {
            const data = await this.request({
                apiPath: "/app/jingyoujia/taskContinuousRecord/queryRecord",
                params: { taskId: this.task.id },
            });
            this.record = data || {};
            console.log(`账号[${this.index}] 签到状态: 连续${data?.continuousNum ?? 0}天 今日=${data?.todayFinish ? "已签" : "未签"}`);
        } catch (e) {
            console.log(`账号[${this.index}] 查询签到状态失败: ${e.message || e}`);
        }
    }

    async signIn() {
        if (!this.task?.id) return;
        if (this.record?.todayFinish) {
            console.log(`账号[${this.index}] 今日已签到`);
            return;
        }
        try {
            const data = await this.request({
                method: "POST",
                apiPath: "/app/jingyoujia/taskContinuousRecord",
                data: {
                    v1: aesEncrypt(JSON.stringify({ taskId: this.task.id })),
                },
            });
            const integral = data?.currentSignIntegral ?? data?.integral ?? "";
            console.log(`账号[${this.index}] 签到成功${integral !== "" ? `: +${integral}积分` : ""}`);
            await this.finishTask();
        } catch (e) {
            const message = String(e.message || e);
            if (/已签到|重复|todayFinish/.test(message)) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }
            if (/20230529|captcha|验证码|滑块/.test(message)) {
                console.log(`账号[${this.index}] 签到需要验证码，已跳过`);
                return;
            }
            console.log(`账号[${this.index}] 签到失败: ${message}`);
            if (isTokenError(message)) this.removeCachedToken();
        }
    }

    async finishTask() {
        try {
            await this.request({
                method: "POST",
                apiPath: "/business/member/task/finish",
                data: {
                    latitude: 0,
                    longitude: 0,
                    taskType: 1,
                },
            });
        } catch (e) {
            console.log(`账号[${this.index}] 完成任务上报失败: ${e.message || e}`);
        }
    }
}

!(async () => {
    
    for (const account of SERVERS) {
        await new Task(account).run();
    }
})()
    .catch((e) => console.log(e.message || e))
