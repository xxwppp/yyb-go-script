/*
------------------------------------------
@Author: sm
@Date: 2026.06.01
@Description:  IQOO社区小程序 积分脚本
cron: 30 8 * * *
------------------------------------------
#Notice:
变量名 YYB_GO
变量值：server@openid，多账号&或换行
需要配置：YYB_GO（server@openid 格式；YYB_TOKEN 或 YYB_USER+YYB_PASS 认证）

⚠️【免责声明】
------------------------------------------
1、此脚本仅用于学习研究，不保证其合法性、准确性、有效性，请根据情况自行判断，本人对此不承担任何保证责任。
2、由于此脚本仅用于学习研究，您必须在下载后 24 小时内将所有内容从您的计算机或手机或任何存储设备中完全删除，若违反规定引起任何事件本人对此均不负责。
3、请勿将此脚本用于任何商业或非法目的，若违反规定请自行对此负责。
4、此脚本涉及应用与本人无关，本人对因此引起的任何隐私泄漏或其他后果不承担任何责任。
5、本人对任何脚本引发的问题概不负责，包括但不限于由脚本错误引起的任何损失和损害。
6、如果任何单位或个人认为此脚本可能涉嫌侵犯其权利，应及时通知并提供身份证明，所有权证明，我们将在收到认证文件确认后删除此脚本。
7、所有直接或间接使用、查看此脚本的人均应该仔细阅读此声明。本人保留随时更改或补充此声明的权利。一旦您使用或复制了此脚本，即视为您已接受此免责声明。
*/

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

const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// === YYB 协议统一认证（自动 https + Basic/Bearer；覆盖 /wxapp/getCode、/wxapp/operateWxData、/wxapp/getPhoneNumber） begin ===
(function () {
    const token = process.env.YYB_TOKEN;
    const user = process.env.YYB_USER;
    const pass = process.env.YYB_PASS;
    let yybAuth = null;
    if (token) yybAuth = `Bearer ${token}`;
    else if (user && pass) yybAuth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
    axios.interceptors.request.use(config => {
        let url = config.url || '';
        if (url.includes('/wxapp/getCode') || url.includes('/wxapp/operateWxData')) {
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

// 轻量 Env 兼容层（替代 ../tools/env，避免外部依赖；在青龙 node 环境下等效）
const $ = {
  userIdx: 0,
  userList: (process.env.YYB_GO || "")
    .split(/\r?\n|&/)
    .map((t) => t.trim())
    .filter(Boolean),
  isNode: () => true,
  log: (...a) => console.log(...a),
  msg: (...a) => console.log(...a),
  error: (...a) => console.error(...a),
  logs: [],
  done: () => {},
  sendMsg: () => {},
  checkEnv: () => {},
  wait: (min, max) => new Promise(r => setTimeout(r, max != null ? (min + Math.random() * (max - min)) : min)),
};

const ckName = "iqoo";
const strSplitor = "#";
const MINI_APP_ID = "wxcf4266fbc9463132";
const PAGE_VERSION = "253";
const API_BASE = "https://bbs-api.iqoo.com/api/";
const TOKEN_CACHE_FILE = path.join(__dirname, "iqoo_token_cache.json");
const SIGN_SECRET = "2618194b0ebb620055e19cf9811d3c13";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf254173b) XWEB/19027";
const defaultUserAgent = USER_AGENT;

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
        $.log(`写入token缓存失败: ${e.message || e}`);
    }
}

function shortToken(token = "") {
    const value = String(token || "").replace(/^Bearer\s+/i, "");
    return value ? `${value.slice(0, 6)}***${value.slice(-6)}` : "";
}

function isSuccess(result) {
    return Number(result?.Code) === 0;
}

function isTokenError(message) {
    return /-4011|401|403|token|登录|授权|请先登录|跳转到登录页|访客没有权限/i.test(String(message || ""));
}

function maskName(value = "") {
    const text = String(value || "");
    return text.length > 10 ? `${text.slice(0, 4)}***${text.slice(-3)}` : text;
}

// ====================== YYB Go 账号（环境变量 YYB_GO = 地址@微信账号标识，换行或&） ======================
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

class Task {
    constructor(env) {
        this.index = $.userIdx++;
        this.user = String(env || "").trim().split(strSplitor);
        this.openid = this.user[0].trim();
        this.token = "";
        this.refreshToken = "";
        this.userId = "";
        this.userInfo = {};
        this.postId = "";
        this.threadId = "";
        this.visitor = crypto.createHash("md5").update(this.openid || String(Date.now())).digest("hex");
    }

    async run() {
        const cached = this.getCachedToken();
        if (cached?.accessToken) {
            this.applyToken(cached);
            $.log(`账号[${this.index}] 使用缓存token: ${shortToken(this.token)}`);
            if (!(await this.checkToken())) {
                this.removeCachedToken();
                $.log(`账号[${this.index}] 缓存token失效，重新登录`);
            }
        }

        if (!this.token) {
            await this.loginByWxCode();
            if (!this.token) return;
        }

        await this.userInfoRequest();
        await this.getTreadList();
        if (this.threadId && this.postId) {
            await this.likePost(this.threadId, this.postId);
            await $.wait(5000);
            await this.sharePost(this.threadId);
            await $.wait(5000);
            await this.viewPost(this.threadId);
            await $.wait(5000);
            await this.commonPost(this.threadId);
        }
        await this.getDrawNum();
        await this.signIn();
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
            refreshToken: this.refreshToken,
            userId: this.userId,
            userInfo: this.userInfo,
            visitor: this.visitor,
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
        this.refreshToken = "";
        this.userId = "";
        this.userInfo = {};
    }

    applyToken(data = {}) {
        this.token = data.accessToken || data.token || "";
        this.refreshToken = data.refreshToken || "";
        this.userId = data.userId || data.uid || data.userInfo?.userId || data.userInfo?.uid || "";
        this.userInfo = data.userInfo || data.user || {};
        this.visitor = data.visitor || this.visitor;
    }

    queryString(data = {}) {
        const list = [];
        for (const [key, value] of Object.entries(data || {})) {
            if (value === undefined || value === null) continue;
            list.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
        return list.join("&");
    }

    getSign(method, apiPath, data = {}) {
        const upperMethod = method.toUpperCase();
        const timestamp = Math.floor(Date.now() / 1000);
        const query = upperMethod === "GET" ? this.queryString(data) : "";
        const body = upperMethod === "GET" ? "" : JSON.stringify(data || {});
        const raw = `${upperMethod}&/api/${apiPath}&${query}&${body}&appid=1002&timestamp=${timestamp}`;
        const signature = crypto.createHmac("sha256", SIGN_SECRET).update(raw).digest("base64");
        return `IQOO-HMAC-SHA256 appid=1002,timestamp=${timestamp},signature=${signature}`;
    }

    headers(method, apiPath, data, extra = {}) {
        return {
            Authorization: this.token ? `Bearer ${this.token}` : "Bearer ",
            "X-Visitor": this.visitor,
            "X-Platform": "mini",
            SIGN: this.getSign(method, apiPath, data),
            "Content-Nonce": "",
            "User-Agent": USER_AGENT,
            Referer: `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
            ...extra,
        };
    }

    async request(apiPath, data = {}, options = {}) {
        const method = (options.method || "POST").toUpperCase();
        const req = {
            method,
            url: new URL(apiPath, API_BASE).toString(),
            headers: this.headers(method, apiPath, data, options.headers || {}),
            timeout: 20000,
            validateStatus: () => true,
        };
        if (method === "GET") req.params = data;
        else req.data = data || {};

        const { data: result, status } = await axios.request(req);
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        if (!isSuccess(result)) throw new Error(`${result?.Code ?? ""} ${result?.Message || JSON.stringify(result)}`.trim());
        return result;
    }

    async getOperateData() {
        const { server, ref } = parseYybGoEntry(this.openid);
        if (!server || !ref) throw new Error("YYB_GO 格式错误: " + this.openid);
        // 1) wx login code（/wxapp/getCode）
        const { data: cRes } = await axios.post(`http://${server}/wxapp/getCode`, { ref, app_id: MINI_APP_ID }, { timeout: 15000, validateStatus: () => true });
        const code = cRes && (cRes.code || (cRes.data && cRes.data.code));
        if (!code) throw new Error(`YYB Go 获取 code 失败: ${JSON.stringify(cRes)}`);
        // 2) encryptedData / iv（/wxapp/operateWxData → getUserInfo）
        const { data: uRes } = await axios.post(`http://${server}/wxapp/operateWxData`, {
            ref, app_id: MINI_APP_ID,
            payload: { api_name: "getUserInfo", data: {}, env: 1 },
        }, { timeout: 45000, validateStatus: () => true });
        const up = (uRes && uRes.data) || {};
        const encryptedData = up.encryptedData || (up.data && up.data.encryptedData);
        const iv = up.iv || (up.data && up.data.iv);
        if (!encryptedData || !iv) throw new Error(`YYB Go operateWxData(getUserInfo) 未返回 encryptedData/iv: ${JSON.stringify(uRes)}`);
        console.log(`[${yybDisplay(this.openid)}] 已获取登录数据(code/encryptedData/iv)`);
        return { code, encryptedData, iv };
    }

    async loginByWxCode() {
        try {
            const wxData = await this.getOperateData();
            const payload = {
                code: wxData.code,
                encryptedData: wxData.encryptedData,
                iv: wxData.iv,
                from: 46,
            };
            const result = await this.request("v3/users/vivo/mini", payload);
            const data = result?.Data || {};
            const token = data.accessToken || data.token || "";
            if (!token) throw new Error(`登录响应未返回token: ${JSON.stringify(result)}`);
            this.token = token;
            this.refreshToken = data.refreshToken || "";
            this.userId = data.userId || data.uid || "";
            this.userInfo = data.user || data;
            this.saveCachedToken();
            $.log(`账号[${this.index}] CODE登录成功: ${maskName(this.userInfo?.nickname || this.userInfo?.username || this.userId)}`);
        } catch (e) {
            $.log(`账号[${this.index}] CODE登录失败: ${e.message || e}`);
        }
    }

    async checkToken() {
        try {
            if (!this.userId) return false;
            await this.request("v3/user", { userId: this.userId }, { method: "GET" });
            return true;
        } catch (e) {
            return false;
        }
    }

    async userInfoRequest() {
        if (!this.userId) return;
        try {
            const result = await this.request("v3/user", { userId: this.userId }, { method: "GET" });
            this.userInfo = result?.Data || this.userInfo;
            this.saveCachedToken();
            const name = this.userInfo?.nickname || this.userInfo?.username || this.userInfo?.userName || this.userId;
            const score = this.userInfo?.score ?? this.userInfo?.points ?? this.userInfo?.coolCoin ?? "未知";
            $.log(`账号[${this.index}] 用户:${maskName(name)} 酷币:${score}`);
        } catch (e) {
            const message = String(e.message || e);
            $.log(`账号[${this.index}] 获取用户信息失败:${message}`);
            if (isTokenError(message)) this.removeCachedToken();
        }
    }

    async getDrawNum() {
        try {
            const result = await this.request("v3/today.draw.count", {}, { method: "GET" });
            if (result?.Data?.count === 0) {
                await this.draw();
            } else {
                $.log(`账号[${this.index}] 今日已抽奖`);
            }
        } catch (e) {
            $.log(`账号[${this.index}] 查询抽奖次数失败:${e.message || e}`);
        }
    }

    async draw() {
        try {
            const result = await this.request("v3/luck.draw", {});
            $.log(`账号[${this.index}] 抽奖成功 获得${result?.Data?.prize_name || "奖励"}`);
        } catch (e) {
            $.log(`账号[${this.index}] 抽奖失败:${e.message || e}`);
        }
    }

    async signIn() {
        try {
            const result = await this.request("v3/sign", { from: "group" });
            $.log(`🌸账号[${this.index}]🕊当前已签到${result.Data.serialDays}天🎉 获得积分${result.Data.score} 当前积分${result.Data.scoreCount}`);
        } catch (e) {
            const message = String(e.message || e);
            if (/已签|重复|今日|13006/.test(message)) {
                $.log(`🌸账号[${this.index}] 今日已签到`);
                return;
            }
            $.log(`🌸账号[${this.index}] 签到失败:${message}❌`);
            if (isTokenError(message)) this.removeCachedToken();
        }
    }

    async likePost(threadId, postId) {
        try {
            await this.request("v3/posts.update", { id: threadId, postId, data: { attributes: { isLiked: true } } });
            $.log(`账号[${this.index}] 帖子点赞成功`);
        } catch (e) {
            $.log(`账号[${this.index}] 帖子点赞失败:${e.message || e}❌`);
        }
        try {
            await this.request("v3/posts.update", { id: threadId, postId, data: { attributes: { isLiked: false } } });
            $.log(`账号[${this.index}] 帖子取消点赞成功`);
        } catch (e) {
            $.log(`账号[${this.index}] 帖子取消点赞失败:${e.message || e}❌`);
        }
    }

    async sharePost(threadId) {
        try {
            await this.request("v3/thread.share", { threadId });
            $.log(`账号[${this.index}] 帖子分享成功`);
        } catch (e) {
            $.log(`账号[${this.index}] 帖子分享失败:${e.message || e}❌`);
        }
    }

    async viewPost(threadId) {
        try {
            await this.request("v3/view.count", { threadId, type: 0 }, { method: "GET" });
            $.log(`账号[${this.index}] 帖子浏览成功`);
        } catch (e) {
            $.log(`账号[${this.index}] 帖子浏览失败:${e.message || e}❌`);
        }
    }

    async commonPost(threadId) {
        try {
            await this.request("v3/posts.create", { id: threadId, type: 0, content: "666", source: "", attachments: [] });
            $.log(`账号[${this.index}] 帖子评论成功`);
        } catch (e) {
            $.log(`账号[${this.index}] 帖子评论失败:${e.message || e}❌`);
        }
    }

    async getTreadList() {
        try {
            const result = await this.request("v3/thread.list", {
                scope: 5,
                page: 1,
                perPage: 10,
                "filter[sort]": 4,
                "filter[essence]": 1,
                sequence: 0,
            }, { method: "GET" });
            const first = result?.Data?.pageData?.[0] || {};
            this.threadId = first.threadId || "";
            this.postId = first.postId || "";
        } catch (e) {
            $.log(`账号[${this.index}] 获取帖子列表失败:${e.message || e}`);
        }
    }
}

!(async () => {
    await getNotice();
    $.checkEnv(ckName);

    for (const user of $.userList) {
        await new Task(user).run();
    }
})()
    .catch((e) => console.log(e))
    .finally(() => $.done());

async function getNotice() {
    try {
        const options = {
            url: "https://ghproxy.net/https://raw.githubusercontent.com/smallfawn/Note/refs/heads/main/Notice.json",
            headers: {
                "User-Agent": defaultUserAgent,
            },
            timeout: 3000,
        };
        const { data: res } = await axios.request(options);
        $.log(res);
        return res;
    } catch (e) {}
}
