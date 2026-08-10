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

// 轻量 Env 兼容层（替代 ../tools/env，避免外部依赖；在青龙 node 环境下等效）
const $ = {
  isNode: () => true,
  log: (...a) => console.log(...a),
  msg: (...a) => console.log(...a),
  error: (...a) => console.error(...a),
  logs: [],
  done: () => {},
  sendMsg: () => {},
  wait: (min, max) => new Promise(r => setTimeout(r, max != null ? (min + Math.random() * (max - min)) : min)),
  userList: [],
  userCount: 0,
  checkEnv: function (name) {
    const raw = process.env.YYB_GO || "";
    this.userList = raw.split(/[\n&]/).map(s => s.trim()).filter(Boolean);
    this.userCount = this.userList.length;
    if (!this.userCount) this.log(`未配置 YYB_GO（无账号）`);
  },
};

function parseYybGoEntry(entry) {
  const e = String(entry == null ? "" : entry);
  const i = e.indexOf("@");
  if (i <= 0) throw new Error('账号 "' + e + '" 需为 server@openid 格式，并配置 YYB_GO');
  return { server: e.slice(0, i), openid: e.slice(i + 1) };
}

/*
风云再起北京 - 每日签到
cron: 20 8 * * *

变量名：fyzq
变量值：wx_server 中保存的 openid/账号标识，多账号用 & 或换行分隔
依赖变量：wx_server_url、wx_auth
*/

const ckName = "fyzq";
const MINI_APP_ID = "wxbc00cc79a68e2305";
const BRAND_KEY = "bjfyzq";
const CITY_NAME = "北京";
const APPLET_BASE = "https://aplet.njqsmx.com".replace("aplet", "applet");
const SIGN_KEY = Buffer.from("rwCyegYqZjtnBPND", "utf8");
const TOKEN_CACHE_FILE = path.join(__dirname, "fyzq_token_cache.json");

const wechat = {
  appid: MINI_APP_ID,
  async getCode(entry) {
    const { server, openid } = parseYybGoEntry(entry);
    const { data } = await axios.post(`https://${server}/wxapp/getCode`, { ref: openid, app_id: MINI_APP_ID }, { timeout: 15000, validateStatus: () => true });
    const code = data && (data.code || (data.data && data.data.code));
    if (!code) throw new Error('YYB_GO 获取 code 失败: ' + JSON.stringify(data));
    return { data: { status: true, code: code, data: { code: code } } };
  },
};

function readCache() {
  try {
    if (!fs.existsSync(TOKEN_CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) {
    $.log(`token缓存写入失败: ${e.message || e}`);
  }
}

function makeSign(params) {
  const text = Object.keys(params)
    .sort()
    .filter((key) => params[key] !== null && params[key] !== undefined && params[key] !== "")
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const cipher = crypto.createCipheriv("aes-128-ecb", SIGN_KEY, null);
  cipher.setAutoPadding(true);
  return Buffer.concat([
    cipher.update(Buffer.from(`"${text}"`, "utf8")),
    cipher.final(),
  ]).toString("base64").replace(/=/g, "");
}

function mask(value = "") {
  value = String(value);
  if (value.length <= 12) return `${value.slice(0, 3)}***`;
  return `${value.slice(0, 6)}***${value.slice(-6)}`;
}

async function appletPost(urlPath, params = {}, token = "") {
  const body = {
    ...params,
    deviceType: "4",
    channel: "wxxcx",
  };
  if (token) body.token = token;
  body.sign = makeSign(body);

  const { data } = await axios.post(`${APPLET_BASE}${urlPath}`, new URLSearchParams(body).toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `https://servicewechat.com/${MINI_APP_ID}/52/page-frame.html`,
      "User-Agent": "Mozilla/5.0 MicroMessenger MiniProgramEnv/Windows",
    },
    timeout: 15000,
    validateStatus: () => true,
  });
  return data;
}

class Task {
  constructor(account) {
    this.index = $.userIdx++;
    this.account = account.trim();
    this.token = "";
  }

  getCachedToken() {
    return readCache()[this.account]?.token || "";
  }

  saveToken(token, extra = {}) {
    if (!token) return;
    const cache = readCache();
    cache[this.account] = {
      token,
      ...extra,
      updatedAt: new Date().toISOString(),
    };
    writeCache(cache);
  }

  removeToken() {
    const cache = readCache();
    if (cache[this.account]) {
      delete cache[this.account];
      writeCache(cache);
    }
  }

  async getWxCode() {
    const { data } = await wechat.getCode(this.account);
    if (!data?.status) throw new Error(data?.message || "wx_server 获取 code 失败");
    const code = data.data?.code || data.code;
    if (!code) throw new Error(`wx_server 未返回 code: ${JSON.stringify(data)}`);
    return code;
  }

  async login() {
    const code = await this.getWxCode();
    const res = await appletPost("/min/min-user/find_brand_key", {
      code,
      brandKey: BRAND_KEY,
    });

    if (String(res.code) !== "1") {
      throw new Error(res.message || `登录失败: ${JSON.stringify(res)}`);
    }

    const token = res.data?.data?.token || res.data?.token || "";
    if (!token) throw new Error(`账号未绑定或接口未返回 token: ${JSON.stringify(res)}`);

    this.token = token;
    this.saveToken(token, {
      brandId: res.data?.brandId || "",
      isBind: res.data?.isBind,
    });
    $.log(`账号[${this.index}] 登录成功: ${mask(token)}`);
  }

  async signBanner() {
    const res = await appletPost("/min/min-homePage/sign_show_banner", {}, this.token);
    if (String(res.code) !== "1") throw new Error(res.message || `查询签到状态失败: ${JSON.stringify(res)}`);
    return res.data || {};
  }

  async doSign() {
    const res = await appletPost("/min/min-mall/sign_sign_in", {}, this.token);
    if (String(res.code) !== "1") throw new Error(res.message || `签到失败: ${JSON.stringify(res)}`);
    return res.data || {};
  }

  async run() {
    $.log(`\n账号[${this.index}] ${mask(this.account)}`);
    this.token = this.getCachedToken();

    if (this.token) {
      $.log(`账号[${this.index}] 使用缓存 token`);
      try {
        const status = await this.signBanner();
        await this.handleStatus(status);
        return;
      } catch (e) {
        $.log(`账号[${this.index}] 缓存失效: ${e.message || e}`);
        this.removeToken();
      }
    }

    await this.login();
    const status = await this.signBanner();
    await this.handleStatus(status);
  }

  async handleStatus(status) {
    if (status.signed) {
      $.log(`账号[${this.index}] 今日已签到，连续签到 ${status.continuous ?? "未知"} 天`);
      return;
    }

    await this.doSign();
    const after = await this.signBanner();
    $.log(`账号[${this.index}] 签到成功，连续签到 ${after.continuous ?? "未知"} 天`);
  }
}

!(async () => {
  $.checkEnv(ckName);
  if (!$.userCount) return;
  for (const account of $.userList) {
    try {
      await new Task(account).run();
    } catch (e) {
      $.log(`账号执行失败: ${e.message || e}`);
    }
  }
})()
  .catch((e) => $.log(`脚本异常: ${e.message || e}`))
  .finally(() => $.done && $.done());
