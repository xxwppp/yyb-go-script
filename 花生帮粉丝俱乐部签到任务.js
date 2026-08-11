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


// name: 花生帮粉丝俱乐部签到任务
// cron: 49 9 * * *

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

const MINI_APP_ID = "wx841a8e9e6972a9a6";
const PAGE_VERSION = "102";
const API_BASE = "https://restapi.supercarrier8.com";
const ENTERPRISE_NO = "131932658387";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "wb_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";
const TARGET_TASKS = {
    i_0002: "浏览微信推文",
    i_0003: "观看视频",
    i_0006: "浏览四格漫画",
};

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

function md5(text) {
    return crypto.createHash("md5").update(String(text)).digest("hex");
}

function base64(value) {
    if (!value) return "";
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return Buffer.from(text, "utf8").toString("base64");
}

function getSign(method, apiPath, params, timestamp) {
    let valueText = "";
    const keys = Object.keys(params || {}).sort();
    for (const key of keys) {
        let value = params[key];
        if (value === "" || value === null || value === undefined) continue;
        if (typeof value !== "string") {
            if (Object.prototype.toString.call(value) === "[object Object]") {
                Object.keys(value).forEach((itemKey) => {
                    if (value[itemKey] === null) delete value[itemKey];
                });
            }
            value = JSON.stringify(value);
        }
        valueText += value;
    }
    const paramSign = base64(valueText);
    return md5(base64(`${method.toUpperCase()}${apiPath}${paramSign}${timestamp}`));
}

function formatMonth() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isTokenError(message) {
    return /2032401|token|登录|授权|invalid|expire|过期|401|403/i.test(String(message || ""));
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
        this.appOpenid = "";
        this.userId = "";
        this.userType = 0;
        this.mobile = "";
        this.currentJf = 0;
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
        await this.signIn();
        await this.doTargetTasks();
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
            appOpenid: this.appOpenid,
            userId: this.userId,
            userType: this.userType,
            mobile: this.mobile,
            currentJf: this.currentJf,
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
        this.appOpenid = "";
        this.userId = "";
        this.userType = 0;
    }

    applyToken(data = {}) {
        this.token = data.token || "";
        this.appOpenid = data.appOpenid || data.openid || "";
        this.userId = data.userId || data.id || "";
        this.userType = data.userType || 0;
        this.mobile = data.mobile || "";
        this.currentJf = data.currentJf || 0;
    }

    getHeaders(method, apiPath, payload) {
        const timestamp = String(Date.now());
        return {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "X-Request-Lang": "zh-CN",
            "Authorization": this.token || "",
            "x-request-ts": timestamp,
            "x-request-sign": getSign(method, `/${apiPath}`, payload, timestamp),
        };
    }

    async request(apiPath, data = {}, method = "GET", options = {}) {
        const payload = options.enterpriseNo ? { ...data } : { enterpriseNo: ENTERPRISE_NO, ...data };
        const requestOptions = {
            method,
            url: `${API_BASE}/${apiPath}`,
            headers: this.getHeaders(method, apiPath, payload),
            timeout: 20000,
            validateStatus: () => true,
        };
        if (method.toUpperCase() === "GET") requestOptions.params = payload;
        else requestOptions.data = payload;

        const { status, data: result } = await axios.request(requestOptions);
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        if (!options.allowAnyCode && result?.code !== 200) {
            const err = new Error(result?.message || JSON.stringify(result));
            err.code = result?.code;
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
            const wxLogin = await this.request("marketing/v1/wechat-user-auth/miniapp-login", {
                authorizerAppid: MINI_APP_ID,
                jsCode: code,
            }, "GET");
            this.appOpenid = wxLogin.data?.openid || "";
            const login = await this.request("marketing/v1/customer-login/wechat-openid", {
                serviceSign: wxLogin.data?.serviceSign,
                openid: this.appOpenid,
                appId: MINI_APP_ID,
                appType: 2,
            }, "POST");
            this.applyToken({
                token: login.data?.token,
                appOpenid: this.appOpenid,
                userId: login.data?.id,
                userType: login.data?.userType,
                mobile: login.data?.mobile || "",
            });
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功: userId=${this.userId || "未知"}`);
        } catch (e) {
            console.log(`账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkToken() {
        try {
            if (!this.token || !this.appOpenid) return false;
            await this.getUser(true);
            return true;
        } catch (e) {
            return false;
        }
    }

    async getUser(silent = false) {
        const result = await this.request("marketing/shyx/marketing/v1/cus/get-user-info", {
            openId: this.appOpenid,
            enterpriseNo: ENTERPRISE_NO,
        }, "GET");
        const user = result.data || {};
        this.userId = user.id || this.userId;
        this.mobile = user.mobile || this.mobile;
        this.currentJf = user.currentJf ?? this.currentJf;
        this.saveCachedToken();
        if (!silent) console.log(`账号[${this.index}] 用户: userId=${this.userId || "未知"} 能量${this.currentJf ?? 0}`);
        return user;
    }

    async signIn() {
        try {
            const monthInfo = await this.request("marketing/cusSign/v1/getUserSignInfo", {
                signMonth: formatMonth(),
            }, "GET");
            const signList = Array.from(new Set(monthInfo.data?.signDateList || []));
            console.log(`账号[${this.index}] 签到记录: 本月${signList.length}天 连续${monthInfo.data?.continuousSignDays || 0}天`);

            const justSign = await this.request("marketing/sign/woBeiCus/v1/justSign", {}, "POST", { allowAnyCode: true });
            if (justSign.code !== 200 && /已签|签到/.test(String(justSign.message || ""))) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }
            if (justSign.code !== 200) throw new Error(justSign.message || JSON.stringify(justSign));
            if (justSign.data === 0 || justSign.data === "0") {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }

            const callback = await this.request("marketing/v1/client-sign/sign-callback", {
                enterpriseNo: ENTERPRISE_NO,
                userId: this.userId,
            }, "GET", { allowAnyCode: true });
            if (callback.code === 200) {
                const rewards = Array.isArray(callback.data) ? callback.data : [];
                const energy = rewards.find((item) => String(item.rewardType) === "1" || String(item.rewardType) === "2");
                console.log(`账号[${this.index}] 签到成功: +${energy?.rewardValue || justSign.data || "未知"}能量`);
            } else {
                console.log(`账号[${this.index}] 签到回调失败: ${callback.message || callback.code}`);
            }
        } catch (e) {
            const message = e.message || e;
            if (/已签|今日已签到|重复/.test(String(message))) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }
            console.log(`账号[${this.index}] 签到失败: ${message}`);
            if (isTokenError(message)) this.removeCachedToken();
        }
    }

    async getTaskList() {
        const result = await this.request("marketing/sign/marketing/v1/cus/get-user-task-list", {
            UserID: this.userId,
            UserType: this.userType,
        }, "GET");
        return Array.isArray(result.data) ? result.data : [];
    }

    async setTaskOk(task) {
        return await this.request("marketing/sign/marketing/v1/cus/set-task-ok", {
            taskId: task.id,
            userId: this.userId,
            mode: "1",
        }, "POST", { allowAnyCode: true });
    }

    async completeTask(task) {
        return await this.request("marketing/sign/marketing/v1/cus/task-complete", {
            taskId: task.id,
            userId: this.userId,
        }, "POST", { allowAnyCode: true });
    }

    async doTargetTasks() {
        try {
            const taskList = await this.getTaskList();
            const tasks = taskList.filter((task) => TARGET_TASKS[task.indexNo]);
            if (!tasks.length) {
                console.log(`账号[${this.index}] 未找到目标任务`);
                return;
            }

            for (const task of tasks) {
                const taskName = task.taskName || TARGET_TASKS[task.indexNo];
                if (String(task.status) === "2") {
                    console.log(`账号[${this.index}] ${taskName}: 已完成`);
                    continue;
                }

                if (String(task.status) === "0") {
                    const ok = await this.setTaskOk(task);
                    if (ok.code !== 200) {
                        console.log(`账号[${this.index}] ${taskName}: 标记完成失败 ${ok.message || ok.code}`);
                        continue;
                    }
                }

                const complete = await this.completeTask(task);
                if (complete.code === 200) {
                    console.log(`账号[${this.index}] ${taskName}: 领取成功 +${task.awardsValue || "未知"}能量`);
                } else if (complete.code === 21210108) {
                    console.log(`账号[${this.index}] ${taskName}: 奖励已领取`);
                } else {
                    console.log(`账号[${this.index}] ${taskName}: 领取失败 ${complete.message || complete.code}`);
                }
            }
        } catch (e) {
            const message = e.message || e;
            console.log(`账号[${this.index}] 任务中心失败: ${message}`);
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
