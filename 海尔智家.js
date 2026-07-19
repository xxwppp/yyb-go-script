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

// name: 海尔智家
// cron: 30 7 * * *

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
function randomString(len = 12) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}
let userIdx = 1;

const strSplitor = "#";

const defaultUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.31(0x18001e31) NetType/WIFI Language/zh_CN miniProgram"
const MINI_APP_ID = "wxe24b2f1f4e378891";
const PAGE_VERSION = "475";
const HA_APP_ID = "MB-SHEZJAPPWXXCX-0000";
const HA_APP_KEY = "79ce99cc7f9804663939676031b8a427";
const API_HOST = "https://zj.haier.net";

function sign256(path, body, timestamp) {
    const bodyStr = body ? JSON.stringify(body) : "";
    return crypto.createHash("sha256").update(path + bodyStr + HA_APP_ID + HA_APP_KEY + timestamp).digest("hex");
}

function maskToken(token = "") {
    if (!token) return "";
    return token.length > 14 ? `${token.slice(0, 6)}...${token.slice(-6)}` : token;
}

class Task {
    constructor(env) {
        this.server = env;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.index = userIdx++
        this.user = env.split(strSplitor);
        this.openid = this.openid.trim();
        this.token = "";
        this.clientId = `${Date.now()}${randomString(12)}`;

    }
    request(options) {
        const path = options.path || new URL(options.url).pathname;
        const timestamp = Date.now();
        let baseHeaers = {
            "host": "zj.haier.net",
            "Content-Type": "application/json;charset=UTF-8",
            "appId": HA_APP_ID,
            "appKey": HA_APP_KEY,
            "timestamp": timestamp,
            "platForm": "sc-mp-wx-zjapp",
            "ENV": "",
            "accessToken": options.isHeaderDelToken ? "" : this.token,
            "accountToken": options.isHeaderDelToken ? "" : this.token,
            "ak": options.isHeaderDelToken ? "" : this.token,
            "clientId": this.clientId,
            "accept": "*/*",
            "accept-language": "zh-CN,zh-Hans;q=0.9",
            "user-agent": defaultUserAgent,
            "referer": `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
        }
        if (options.isSign256) {
            baseHeaers.sign = sign256(path, options.data, timestamp);
        }
        options.headers = Object.assign(baseHeaers, options.headers || {});
        delete options.path;
        delete options.isSign256;
        delete options.isHeaderDelToken;
        return axios.request(options)
    }

    async run() {
        await this.loginByWxCode();
        if (!this.token) return;
        await this.pointInfo()
        await this.signIn()
    }

    async getLoginCode() {
        return await getCode(this.server);
    }

    async loginByWxCode() {
        try {
            const code = await this.getLoginCode();
            const tokenInfo = await this.jscode2session(code);
            const accountToken = tokenInfo?.accountToken;
            if (!accountToken) throw new Error(`登录响应未返回 accountToken: ${JSON.stringify(tokenInfo)}`);
            await this.queryUserInfo(accountToken);
            this.token = accountToken;
            console.log(`账号[${this.index}] CODE登录成功: ${maskToken(this.token)}`);
        } catch (e) {
            console.log(`账号[${this.index}] CODE登录失败: ${e.message || e}`);
        }
    }

    async jscode2session(code) {
        const path = "/api-gw/oauthserver/applet/v1/jscode2session";
        let options = {
            method: "POST",
            url: API_HOST + path,
            path,
            isSign256: true,
            isHeaderDelToken: true,
            data: { code },
        };
        const { data: result } = await this.request(options);
        if (result?.retCode !== "00000" && result?.code !== 200 && !result?.success) {
            throw new Error(result?.retInfo || result?.message || JSON.stringify(result));
        }
        return result?.data?.tokenInfo || result?.data || {};
    }

    async queryUserInfo(accountToken) {
        const path = "/api-gw/oauthserver/applet/v1/userinfo/query";
        let options = {
            method: "POST",
            url: API_HOST + path,
            path,
            isSign256: true,
            isHeaderDelToken: true,
            data: { accountToken },
        };
        const { data: result } = await this.request(options);
        if (result?.retCode !== "00000" && result?.code !== 200 && !result?.success) {
            throw new Error(result?.retInfo || result?.message || JSON.stringify(result));
        }
        const info = result?.data?.userinfo || {};
        const name = info.nickName || info.nickname || info.userName || "未知用户";
        const phone = info.mobile || info.phoneNumber || "";
        console.log(`账号[${this.index}] 用户: ${name}${phone ? ` ${phone.slice(0, 3)}****${phone.slice(-4)}` : ""}`);
        return info;
    }

    async pointInfo() {
        const path = "/zjapi/zjBaseServer/signDetail/getUserPointsAndWallet";
        let options = {
            method: 'POST',
            url: API_HOST + path,
            path,
            headers: {},
            data: {

            }
        };
        let { data: result } = await this.request(options);

        if (result.retCode == '00000') {
            console.log(`海贝：${result.data.haiBeiTotal}`)
            console.log(`红包：${result.data.wallet}`)
        } else {
            console.log(`查询余额失败: ${result.retInfo}`)
        }
    }

    async signIn() {
        const path = "/api-gw/zjBaseServer/daily/sign";
        let options = {
            method: 'POST',
            url: API_HOST + path,
            path,
            headers: {},
            data: {

            }
        };
        let { data: result } = await this.request(options);
        if (result?.retCode == '00000') {
            //打印签到结果
            console.log(`🌸账号[${this.index}]` + `🕊当前已签到${result.data.totalSignDay}天🎉`);
        } else {
            console.log(`🌸账号[${this.index}] 签到-失败:${result.retInfo}❌`)
        }

    }

}

!(async () => {
    for (let user of SERVERS) {
        await new Task(user).run();
    }
})()
    .catch((e) => console.log(e))
    


