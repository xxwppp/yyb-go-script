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

// name: 顾家
// cron: 50 9 * * *

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

const MINI_APP_ID = "wx0770280d160f09fe";
const PAGE_VERSION = "286";
const API_BASE = "https://mc.kukahome.com/club-server";
const INTEGRAL_BASE = "https://mc.kukahome.com/integral-server";
const BRAND_CODE = "K001";
const SMALL_APPLICATION_ID = "667516";
const SMALL_CRYPTO = "FH3yRrHG2RfexND8";
const VERSION_NUMBER = "2.8.6";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "gujiajiaju_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

function md5(input) {
  return crypto.createHash("md5").update(String(input)).digest("hex");
}

function readTokenCache() {
  try {
    if (!fs.existsSync(TOKEN_CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf8")) || {};
  } catch {
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

function isObject(val) {
  return Object.prototype.toString.call(val) === "[object Object]";
}

function buildParameterBase(data) {
  if (!data) return null;
  if (Array.isArray(data) || typeof data === "string") return null;
  if (!isObject(data)) return null;
  const keys = Object.keys(data).sort((a, b) => {
    const ac = [...a].map((ch) => ch.charCodeAt(0));
    const bc = [...b].map((ch) => ch.charCodeAt(0));
    for (let i = 0; i < Math.min(ac.length, bc.length); i++) {
      if (ac[i] !== bc[i]) return ac[i] - bc[i];
    }
    return ac.length - bc.length;
  });
  const pairs = [];
  for (const key of keys) {
    const value = data[key];
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) continue;
    if (typeof value === "object" && value !== null) {
      pairs.push(`${key}=${JSON.stringify(value)}`);
      continue;
    }
    if (typeof value === "number" && value === 0) {
      pairs.push(`${key}=0`);
      continue;
    }
    pairs.push(`${key}=${value}`);
  }
  return pairs.length ? pairs.join("&") : null;
}

function buildParameterSign(data, timestamp) {
  const base = buildParameterBase(data);
  if (!base) return "";
  const salt = String(timestamp).substring(4, 10);
  return md5(md5(base) + salt);
}

class Task {
  constructor(openid) {
        this.server = openid;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
    this.index = userIdx++;
    this.openid = String(openid || "").trim();
    this.tmpToken = "";
    this.accessToken = "";
    this.memberId = "";
    this.userInfo = {};
  }

  cacheKey() {
    return this.openid;
  }

  getCachedToken() {
    const cache = readTokenCache();
    return cache[this.cacheKey()] || null;
  }

  saveCachedToken() {
    if (!this.accessToken || !this.memberId) return;
    const cache = readTokenCache();
    cache[this.cacheKey()] = {
      accessToken: this.accessToken,
      memberId: this.memberId,
      nickName: this.userInfo.nickName || "",
      mobile: this.userInfo.mobile || "",
      updatedAt: new Date().toISOString(),
    };
    writeTokenCache(cache);
  }

  clearCachedToken() {
    const cache = readTokenCache();
    delete cache[this.cacheKey()];
    writeTokenCache(cache);
    this.tmpToken = "";
    this.accessToken = "";
    this.memberId = "";
    this.userInfo = {};
  }

  applyToken(data = {}) {
    this.accessToken = data.accessToken || data.token || this.accessToken;
    this.memberId = String(data.memberId || this.memberId || "");
  }

  async request({ method = "POST", url, data = {}, params = {}, withAuth = true, withTmpToken = true }) {
    const timestamp = Date.now();
    const sign = md5(`${SMALL_APPLICATION_ID}${SMALL_CRYPTO}${timestamp}`).toLowerCase();
    const bodyForSign = method.toUpperCase() === "GET" ? params : data;
    const parameterSign = buildParameterSign(bodyForSign, timestamp);
    const headers = {
      "User-Agent": USER_AGENT,
      Referer: `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "X-Customer": this.memberId || "",
      brandCode: BRAND_CODE,
      appid: SMALL_APPLICATION_ID,
      sign,
      timestamp,
      versionNumber: VERSION_NUMBER,
    };
    if (parameterSign) headers.parameterSign = parameterSign;
    if (withAuth && this.accessToken) headers.AccessToken = this.accessToken;
    if (withTmpToken && this.tmpToken) headers.tmpToken = this.tmpToken;

    const res = await axios.request({
      method,
      url,
      data,
      params,
      headers,
      timeout: 20000,
      validateStatus: () => true,
    });

    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    }
    const result = res.data || {};
    if (result.code !== undefined && ![0, 401, 402, 515].includes(Number(result.code))) {
      throw new Error(result.message || result.msg || JSON.stringify(result));
    }
    return result;
  }

  async getWxCode() {
        return await getCode(this.server);
    }

  async login() {
    const code = await this.getWxCode();
    const identify = await this.request({
      method: "POST",
      url: `${API_BASE}/api/user/identify`,
      params: { code },
      withAuth: false,
      withTmpToken: false,
    });
    if (identify.code !== 0 || !identify.data) {
      throw new Error(`identify失败: ${identify.message || JSON.stringify(identify)}`);
    }
    if (Number(identify.data.status) !== 4) {
      throw new Error(`登录状态异常: status=${identify.data.status}`);
    }
    this.tmpToken = identify.data.token || "";
    if (!this.tmpToken) throw new Error("identify未返回tmpToken");

    const auth = await this.request({
      method: "POST",
      url: `${API_BASE}/api/user/authorizeLogin`,
      data: { source: "顾家小程序", contentName: "" },
      withAuth: false,
      withTmpToken: true,
    });
    if (auth.code !== 0 || !auth.data?.token) {
      throw new Error(`authorizeLogin失败: ${auth.message || JSON.stringify(auth)}`);
    }
    this.accessToken = auth.data.token;
    this.memberId = String(auth.data.memberId || "");
    this.tmpToken = "";
  }

  async getUserInfo() {
    const info = await this.request({
      method: "POST",
      url: `${API_BASE}/api/user/info`,
      data: {},
      withAuth: true,
      withTmpToken: false,
    });
    if (!info.data) throw new Error("user/info返回为空");
    this.userInfo = info.data;
    this.applyToken(info.data);
    const name = this.userInfo.nickName || this.userInfo.name || this.memberId || "未知";
    console.log(`账号[${this.index}] 用户: ${name}`);
  }

  async ensureLogin() {
    const cached = this.getCachedToken();
    if (cached) {
      this.applyToken(cached);
      console.log(`账号[${this.index}] 使用缓存token`);
      try {
        await this.getUserInfo();
        return;
      } catch {
        this.clearCachedToken();
        console.log(`账号[${this.index}] 缓存失效，重新登录`);
      }
    }
    await this.login();
    await this.getUserInfo();
    this.saveCachedToken();
    console.log(`账号[${this.index}] 登录成功 memberId=${this.memberId}`);
  }

  async checkCalendar() {
    try {
      const ret = await this.request({
        method: "GET",
        url: `${INTEGRAL_BASE}/user/sign/calendar`,
        params: {},
      });
      console.log(`账号[${this.index}] 日历查询: code=${ret.code}`);
    } catch (e) {
      console.log(`账号[${this.index}] 日历查询失败: ${e.message || e}`);
    }
  }

  async sign() {
    try {
      const ret = await this.request({
        method: "POST",
        url: `${INTEGRAL_BASE}/scenePoint/scene/point`,
        data: {
          scene: "sign",
          brandCode: BRAND_CODE,
        },
      });
      if (ret.code === 0) {
        console.log(`账号[${this.index}] 签到成功`);
        return;
      }
      const msg = ret.message || ret.msg || JSON.stringify(ret);
      if (/已签|重复|already|今日/.test(msg)) {
        console.log(`账号[${this.index}] 今日已签到`);
        return;
      }
      throw new Error(msg);
    } catch (e) {
      const msg = e.message || String(e);
      if (/已签|重复|already|今日/.test(msg)) {
        console.log(`账号[${this.index}] 今日已签到`);
        return;
      }
      throw e;
    }
  }

  async run() {
    try {
      await this.ensureLogin();
      await this.checkCalendar();
      await this.sign();
      this.saveCachedToken();
    } catch (e) {
      const msg = e.message || String(e);
      console.log(`账号[${this.index}] 执行失败: ${msg}`);
      if (/401|token|登录|失效|过期/i.test(msg)) this.clearCachedToken();
    }
  }
}

!(async () => {
  
  for (const openid of SERVERS) {
    await new Task(openid).run();
  }
})()
  .catch((e) => console.log(e.message || e))
