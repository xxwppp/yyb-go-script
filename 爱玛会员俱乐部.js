/*
爱玛会员俱乐部 - 自动签到脚本
变量名：aima
变量值：账号标识/openid（支持多账号，用 & 或换行分隔）
CODE登录依赖：wx_server_url、wx_auth
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
};

// ================== 配置区 ==================
const ACTIVITY_ID = "100001192";
const BASE_URL = "https://scrm.aimatech.com";
const WXCLIENT_URL = `${BASE_URL}/aima/wxclient`;
const MINI_APPID = "wx2dcfb409fd5ddfb4";
const APP_ID = "scrm";
const TOKEN_CACHE_FILE = path.join(__dirname, "aima_token_cache.json");
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 15; 23013RK75C Build/AQ3A.250226.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.7444.173 Mobile Safari/537.36 XWEB/1420229 MMWEBSDK/20251101 MMWEBID/6369 MicroMessenger/8.0.67.3000(0x28004333) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 MiniProgramEnv/android";

// ================== 工具函数 ==================
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function md5(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

function maskToken(token = "") {
  if (!token) return "";
  if (token.length <= 12) return `${token.slice(0, 3)}***`;
  return `${token.slice(0, 6)}***${token.slice(-6)}`;
}

function isToken(value = "") {
  return /^eyJ/.test(value.trim()) || value.length > 120;
}

function readCache() {
  try {
    if (!fs.existsSync(TOKEN_CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function writeCache(cache) {
  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    $.log(`⚠️ token缓存写入失败: ${e.message}`);
  }
}

function updateCachedToken(account, token) {
  if (!account || !token || isToken(account)) return;
  const cache = readCache();
  cache[account] = {
    token,
    updatedAt: new Date().toISOString(),
  };
  writeCache(cache);
}

function getResponseToken(headers = {}) {
  return (
    headers["set-access-token"] ||
    headers["Set-Access-Token"] ||
    headers["SET-ACCESS-TOKEN"] ||
    ""
  );
}

function buildHeaders(token = "") {
  const timestamp = Date.now().toString();
  const traceLogId = generateUUID();
  const signToken = token ? token.substring(50, 80) : "";
  const signStr = `App-Id${APP_ID}Time-Stamp${timestamp}TraceLog-Id${traceLogId}Access-Token${signToken}AimaScrm321_^`;

  return {
    "App-Id": APP_ID,
    "Time-Stamp": timestamp,
    "TraceLog-Id": traceLogId,
    "Access-Token": token,
    Sign: md5(signStr).toLowerCase(),
    "content-type": "application/json",
    charset: "utf-8",
    Referer: "https://servicewechat.com/wx2dcfb409fd5ddfb4/223/page-frame.html",
    "User-Agent": USER_AGENT,
  };
}

async function request(method, url, token, options = {}) {
  const res = await axios({
    method,
    url,
    headers: buildHeaders(token),
    timeout: 15000,
    validateStatus: () => true,
    ...options,
  });

  const newToken = getResponseToken(res.headers);
  if (newToken && options.account) {
    options.onToken?.(newToken);
    updateCachedToken(options.account, newToken);
  }

  return res;
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

// YYB 模式：通过 YYB_GO 内网服务换取微信 code（替代 wx_server_url / wx_auth）
async function getWxCode(entry) {
  const { server, ref } = parseYybGoEntry(entry);
  if (!server || !ref) throw new Error("YYB_GO 格式错误: " + entry);
  console.log(`[${yybDisplay(entry)}] 请求 YYB Go 获取 code: https://${server}/wxapp/getCode`);
  const res = await axios.post(
    `https://${server}/wxapp/getCode`,
    { ref, app_id: MINI_APPID },
    { timeout: 20000, proxy: false, validateStatus: () => true }
  );
  const code =
    (res.data && res.data.data && res.data.data.result && res.data.data.result.code) ||
    (res.data && res.data.data && res.data.data.code) ||
    (res.data && res.data.code);
  if (res.status !== 200 || !code) {
    throw new Error(`获取code失败: HTTP ${res.status} ${JSON.stringify(res.data)}`);
  }
  console.log(`[${yybDisplay(entry)}] 获取 code 成功`);
  return code;
}

async function loginByCode(account) {
  $.log("🔐 正在获取code并登录...");
  const code = await getWxCode(account);
  const res = await request("post", `${WXCLIENT_URL}/user/members:login`, "", {
    data: { code },
    account,
  });

  const token = getResponseToken(res.headers);
  if (res.status !== 200 || res.data?.code !== 200 || !token) {
    throw new Error(`登录失败: HTTP ${res.status} ${JSON.stringify(res.data)}`);
  }

  updateCachedToken(account, token);
  $.log(`✅ 登录成功，已缓存token: ${maskToken(token)}`);
  return token;
}

async function validateToken(account, token) {
  const res = await request("get", `${WXCLIENT_URL}/member/IndexInfo`, token, {
    account,
  });
  const ok = res.status === 200 && res.data?.code === 200;
  if (!ok) {
    $.log(`⚠️ 缓存token失效: HTTP ${res.status} ${JSON.stringify(res.data)}`);
  }
  return ok;
}

async function getAccessToken(account) {
  const value = account.trim();
  if (isToken(value)) {
    $.log(`ℹ️ 检测到旧token变量，将直接使用: ${maskToken(value)}`);
    return value;
  }

  const cache = readCache();
  const cachedToken = cache[value]?.token;
  if (cachedToken) {
    $.log(`🔎 使用缓存token校验: ${maskToken(cachedToken)}`);
    if (await validateToken(value, cachedToken)) {
      $.log("✅ 缓存token有效");
      return cachedToken;
    }
  }

  return loginByCode(value);
}

// ================== 核心逻辑 ==================
async function signIn(account, index) {
  let token = await getAccessToken(account);
  const setToken = (newToken) => {
    token = newToken;
  };

  $.log(`🚀 账号【${index}】查询签到状态...`);
  const searchRes = await request(
    "post",
    `${WXCLIENT_URL}/mkt/activities/sign:search`,
    token,
    {
      data: { activityId: ACTIVITY_ID },
      account,
      onToken: setToken,
    }
  );

  if (searchRes.status !== 200 || searchRes.data?.code !== 200) {
    throw new Error(`查询签到状态失败: HTTP ${searchRes.status} ${JSON.stringify(searchRes.data)}`);
  }

  const signStatus = searchRes.data?.content?.signStatus;
  if (signStatus === 1) {
    $.log(`✅ 账号【${index}】今日已签到！`);
    return;
  }

  $.log(`⏳ 账号【${index}】正在签到...`);
  const joinRes = await request(
    "post",
    `${WXCLIENT_URL}/mkt/activities/sign:join`,
    token,
    {
      data: { activityId: ACTIVITY_ID, activitySceneId: null },
      account,
      onToken: setToken,
    }
  );

  if (joinRes.status === 200 && joinRes.data?.code === 200) {
    const point = joinRes.data.content?.point || joinRes.data.content?.points || 0;
    $.log(`🎉 账号【${index}】签到成功！${point ? `获得 ${point} 积分` : ""}`);
  } else {
    throw new Error(`签到失败: HTTP ${joinRes.status} ${JSON.stringify(joinRes.data)}`);
  }
}

// ================== 主函数 ==================
!(async () => {
  console.log("\n🔔 爱玛会员俱乐部, 开始!");

  // YYB 模式：账号来自环境变量 YYB_GO（格式：地址@微信账号标识，多账号用 & 或换行分隔）
  const accounts = (process.env.YYB_GO || "")
    .split(/\r?\n|&/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (accounts.length === 0) {
    console.error("❌ 未配置环境变量 YYB_GO，请设置后重试（格式：地址@微信账号标识，换行或&）");
    return;
  }

  console.log(`共找到${accounts.length}个账号`);

  for (let i = 0; i < accounts.length; i++) {
    try {
      console.log(`\n🚀 user:【${i + 1}】 start work`);
      await signIn(accounts[i], i + 1);
    } catch (e) {
      console.log(`❌ 账号【${i + 1}】执行失败: ${e.message}`);
    }
  }

  // await $.sendMsg($.logs.join("\n"));
})()
  .catch((e) => console.log(e))
  .finally(() => $.done());
