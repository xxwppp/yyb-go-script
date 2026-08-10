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
        if (url.includes('/wxapp/getCode') || url.includes('/wxapp/operateWxData') || url.includes('/wxapp/getPhoneNumber')) {
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
复游会 - 签到活动
cron: 25 8 * * *

变量名：YYB_GO
变量值：
  1. YYB Go 的 server@openid，多账号用 & 或换行分隔
  2. openid#folidayMallToken，可首次写入/刷新本地缓存
  3. 仅 folidayMallToken，也可查询/签到，但不会携带当天 wxcode

依赖变量：YYB_GO（server@openid 格式）
可选变量：fuyouhui_token（单账号 token 兜底）
*/

const ckName = "fuyouhui";
const MINI_APP_ID = "wx1fa4da2889526a37";
const API_BASE = "https://apis.folidaymall.com";
const SIGN_SALT = "3d83f7d9";
const TOKEN_CACHE_FILE = path.join(__dirname, "fuyouhui_token_cache.json");

const wechat = {
  appid: MINI_APP_ID,
  async getCode(entry) {
    const { server, openid } = parseYybGoEntry(entry);
    const { data } = await axios.post(`https://${server}/wxapp/getCode`, { ref: openid, app_id: MINI_APP_ID }, { timeout: 15000, validateStatus: () => true });
    const code = data && (data.code || (data.data && data.data.code));
    if (!code) throw new Error('YYB_GO 获取 code 失败: ' + JSON.stringify(data));
    return { data: { status: true, code: code, data: { code: code } } };
  },
  async getuserinfo(entry) {
    const { server, openid } = parseYybGoEntry(entry);
    // 1) wx login code
    const { data: c } = await axios.post(`https://${server}/wxapp/getCode`, { ref: openid, app_id: MINI_APP_ID }, { timeout: 15000, validateStatus: () => true });
    const code = c && (c.code || (c.data && c.data.code));
    if (!code) throw new Error('YYB_GO 获取 code 失败: ' + JSON.stringify(c));
    // 2) encryptedData / iv via operateWxData(getUserInfo)
    const { data: u } = await axios.post(`https://${server}/wxapp/operateWxData`, {
      ref: openid, app_id: MINI_APP_ID,
      payload: { api_name: "getUserInfo", data: {}, env: 1 },
    }, { timeout: 45000, validateStatus: () => true });
    const up = (u && u.data) || {};
    const encryptedData = up.encryptedData || (up.data && up.data.encryptedData);
    const iv = up.iv || (up.data && up.data.iv);
    if (!encryptedData || !iv) throw new Error('YYB_GO operateWxData(getUserInfo) 未返回 encryptedData/iv: ' + JSON.stringify(u));
    return { code, encryptedData, iv };
  },
  async getphonenumber(entry) {
    const { server, openid } = parseYybGoEntry(entry);
    const { data } = await axios.post(`https://${server}/wxapp/getPhoneNumber`, { ref: openid, app_id: MINI_APP_ID }, { timeout: 60000, validateStatus: () => true });
    const code = data && data.data && data.data.result && data.data.result.code;
    if (!code) throw new Error('YYB_GO 获取手机号 code 失败: ' + JSON.stringify(data));
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

function md5(text) {
  return crypto.createHash("md5").update(String(text)).digest("hex");
}

function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
}

function mask(value = "") {
  value = String(value);
  if (!value) return "";
  if (value.length <= 12) return `${value.slice(0, 3)}***`;
  return `${value.slice(0, 6)}***${value.slice(-6)}`;
}

function clientInfo() {
  return JSON.stringify({
    app_version: "4.0.5",
    client_key: "wx_mini_tc",
    client_name: encodeURIComponent("复游会微信小程序"),
    os: "windows",
    app_key: "WX_MINI_TC",
  });
}

function parseAccount(raw) {
  const text = String(raw || "").trim();
  if (!text) return { openid: "", token: "" };

  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text);
      return {
        openid: data.openid || data.openId || data.account || "",
        token: data.token || data.folidayMallToken || "",
      };
    } catch {}
  }

  for (const sep of ["#", "|"]) {
    if (text.includes(sep)) {
      const [openid, ...rest] = text.split(sep);
      return { openid: openid.trim(), token: rest.join(sep).trim() };
    }
  }

  if (text.includes(".") || text.startsWith("eyJ")) return { openid: "", token: text };
  return { openid: text, token: "" };
}

async function request(method, urlPath, { token = "", data = null, params = null, headers = {} } = {}) {
  const res = await axios({
    method,
    url: `${API_BASE}${urlPath}`,
    data,
    params,
    timeout: 15000,
    validateStatus: () => true,
    headers: {
      version: "1.0",
      "User-Agent": "Mozilla/5.0 MicroMessenger MiniProgramEnv/Windows",
      Referer: `https://servicewechat.com/${MINI_APP_ID}/250/page-frame.html`,
      "X-Call-Client-Info": clientInfo(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  return res.data;
}

function assertOk(res, action) {
  if (!res || res.hasError || String(res.responseCode) !== "0") {
    throw new Error(`${action}失败: ${res?.errorMessage || res?.message || JSON.stringify(res)}`);
  }
  return res.data || {};
}

class Task {
  constructor(raw) {
    this.index = $.userIdx++;
    const account = parseAccount(raw);
    this.openid = account.openid;
    this.token = account.token || process.env.fuyouhui_token || "";
    this.member = {};
    this.wxcode = "";
    this.cacheKey = this.openid || (this.token ? md5(this.token).slice(0, 16) : `account_${this.index}`);
  }

  getCached() {
    return readCache()[this.cacheKey] || {};
  }

  saveCache(extra = {}) {
    const cache = readCache();
    cache[this.cacheKey] = {
      ...(cache[this.cacheKey] || {}),
      ...(this.token ? { token: this.token } : {}),
      ...(this.member?.id ? { memberId: this.member.id } : {}),
      ...extra,
      updatedAt: new Date().toISOString(),
    };
    writeCache(cache);
  }

  removeToken() {
    const cache = readCache();
    if (cache[this.cacheKey]) {
      delete cache[this.cacheKey].token;
      writeCache(cache);
    }
  }

  async getWxCode() {
    if (!this.openid) return "";
    const { data } = await wechat.getCode(this.openid);
    if (!data?.status) throw new Error(data?.message || "wx_server 获取 code 失败");
    const code = data.data?.code || data.code;
    if (!code) throw new Error(`wx_server 未返回 code: ${JSON.stringify(data)}`);
    this.wxcode = code;
    return code;
  }

  async getOperateData() {
    if (!this.openid) throw new Error("缺少 openid，无法自动授权");
    const info = await wechat.getuserinfo(this.openid);
    if (!info || !info.code || !info.iv || !info.encryptedData) {
      throw new Error(`YYB_GO 获取登录数据缺少必要字段: ${JSON.stringify(info)}`);
    }
    return info;
  }

  async loginByOperateData() {
    const op = await this.getOperateData();
    const data = assertOk(
      await request("post", "/usercenter/online/wxmp/registerWxUserInfo", {
        data: {
          code: op.code,
          appChannel: "",
          appKey: "WX_MINI_TC",
          memberCode: "foryouclub_minipro_regs",
          iv: op.iv,
          encryptedData: op.encryptedData,
          joinXingXuan: false,
        },
      }),
      "自动授权"
    );
    const token = data.token || "";
    if (!token) throw new Error(`自动授权未返回 token: ${JSON.stringify(data)}`);
    this.token = token;
    this.saveCache({
      hasMobile: data.hasMobile,
      fkMember: data.fkMember || "",
    });
    $.log(`账号[${this.index}] 自动授权成功: ${mask(token)}`);
  }

  ensureToken() {
    if (!this.token) this.token = this.getCached().token || "";
    if (!this.token) {
      throw new Error("缺少 folidayMallToken。请将变量设置为 openid#token，或设置 fuyouhui_token。");
    }
  }

  async getMemberInfo() {
    const data = assertOk(
      await request("post", "/usercenter/online/mem/getMemberDetails", { token: this.token }),
      "查询会员信息"
    );
    this.member = data || {};
    if (data.refreshToken) this.token = data.refreshToken;
    this.saveCache({
      member: {
        id: data.id || "",
        phone: data.phone || "",
        openId: data.openId || "",
        account: data.account || "",
      },
    });
    return data;
  }

  signHeaders() {
    const timestamp = Date.now();
    const nonce = uuid();
    const memberId = this.member.id || this.getCached().memberId || "";
    if (!memberId) throw new Error("缺少会员ID，无法生成签到签名");
    return {
      "X-Sign-Timestamp": timestamp,
      "X-Sign-Nonce": nonce,
      "X-Sign-Signature": md5(`${memberId}${timestamp}${nonce}${SIGN_SALT}`),
      "X-Wx-Code": this.wxcode || "",
    };
  }

  async getUserSign() {
    const data = assertOk(
      await request("get", "/online/cms-api/sign/userSign", {
        token: this.token,
        headers: this.signHeaders(),
      }),
      "签到/查询状态"
    );
    return data.signInfo || {};
  }

  async queryAllRewards() {
    try {
      const data = assertOk(
        await request("get", "/online/cms-api/sign/queryAllRewards", { token: this.token }),
        "查询奖励列表"
      );
      return Array.isArray(data) ? data : data.queryAllRewards || data.rewards || [];
    } catch (e) {
      $.log(`账号[${this.index}] 奖励列表查询失败: ${e.message || e}`);
      return [];
    }
  }

  async queryScrollScreen() {
    try {
      const data = assertOk(
        await request("get", "/online/cms-api/sign/queryScrollScreen", { token: this.token }),
        "查询活动滚屏"
      );
      return Array.isArray(data) ? data : data.list || data.records || [];
    } catch (e) {
      $.log(`账号[${this.index}] 活动滚屏查询失败: ${e.message || e}`);
      return [];
    }
  }

  async queryPhoto() {
    try {
      const data = assertOk(await request("get", "/online/cms-api/sign/getPhoto"), "查询活动背景");
      return data.sign || {};
    } catch {
      return {};
    }
  }

  async receiveCoupon(cpId) {
    if (!cpId) return;
    try {
      const data = assertOk(
        await request("get", `/online/capi/cp/receiveCoupon?cpId=${encodeURIComponent(cpId)}`, {
          token: this.token,
        }),
        "领取优惠券"
      );
      $.log(`账号[${this.index}] 优惠券领取结果: ${JSON.stringify(data).slice(0, 120)}`);
    } catch (e) {
      $.log(`账号[${this.index}] 优惠券领取失败: ${e.message || e}`);
    }
  }

  printSignInfo(signInfo) {
    const parts = [
      `连续${signInfo.continousSignDays ?? "未知"}天`,
      `积分${signInfo.currentIntegral ?? "未知"}`,
    ];
    if (signInfo.changeIntegeral) parts.push(`本次+${signInfo.changeIntegeral}`);
    if (signInfo.couponName) parts.push(`券:${signInfo.couponName}`);
    if (signInfo.signRewardMsg) parts.push(String(signInfo.signRewardMsg).replace(/<[^>]+>/g, ""));

    const signedNow = signInfo.hasSign === false;
    const signedBefore = signInfo.hasSign === true;
    $.log(`账号[${this.index}] ${signedNow ? "签到成功" : signedBefore ? "今日已签到" : "签到状态"}，${parts.join("，")}`);
  }

  async run() {
    $.log(`\n账号[${this.index}] ${mask(this.openid || this.cacheKey)}`);

    if (this.openid) {
      try {
        await this.getWxCode();
      } catch (e) {
        $.log(`账号[${this.index}] 获取 wxcode 失败，继续使用 token: ${e.message || e}`);
      }
    }

    if (!this.token) this.token = this.getCached().token || "";
    if (!this.token) await this.loginByOperateData();
    this.ensureToken();

    try {
      const member = await this.getMemberInfo();
      $.log(`账号[${this.index}] 会员: ${mask(member.phone || member.account || member.id || "")}`);
    } catch (e) {
      this.removeToken();
      throw e;
    }

    if (this.openid) {
      try {
        await this.getWxCode();
      } catch (e) {
        $.log(`账号[${this.index}] 刷新签到 wxcode 失败: ${e.message || e}`);
      }
    }

    const signInfo = await this.getUserSign();
    this.printSignInfo(signInfo);
    await this.receiveCoupon(signInfo.cpId);

    const rewards = await this.queryAllRewards();
    if (rewards.length) $.log(`账号[${this.index}] 奖励列表: ${rewards.length}条`);

    const scroll = await this.queryScrollScreen();
    if (scroll.length) $.log(`账号[${this.index}] 滚屏记录: ${scroll.length}条`);

    const photo = await this.queryPhoto();
    if (photo.activityImg) $.log(`账号[${this.index}] 活动背景已获取`);
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
