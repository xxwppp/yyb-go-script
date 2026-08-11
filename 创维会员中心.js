/*
创维会员中心 - 签到/查询
cron: 38 8 * * *

变量名：skyworth 或 chuangwei
变量值：
  1. wx_server 中保存的 openid，多账号用 & 或换行分隔
  2. openid#token，可直接复用登录 token
  3. JSON：{"openid":"...","token":"...","remark":"..."}

依赖变量：wx_server_url、wx_auth
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
};

const MINI_APP_ID = "wxff438d3c60c63fb6";
const PACKAGE_VERSION = "371";
const API_BASE = "https://uc-api.skyallhere.com/miniprogram/api";
const SIGN_TASK_CODES = ["TS00016", "TS00017"];
const TASK_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIBPAIBAAJBAMJrqTwwvDRo/NP3Pjq0wfeHtfAcwRu5vk5yTfdGmKAAqG9M9Bu8
COIBN/B0lGUcUx4HP4eIvK17HoIut8shun8CAwEAAQJAXVNWymjOfw4ChzFAsud/
0HVZlWgIHmn7+yYNXOyLaQnv8I7GTrVe85lnAvcmboSvpr5KFGzhY0KDpAnCcDsh
QQIhAPzyeP4ncY7cLkftHPUTSg7Tkve/gJUFZN7q2pW0KEGfAiEAxMRcDf8yqSXP
VfUmJpnzranrFRIAs9Eqi1jzbB4KmyECIQCu2hJHZg66uXuInuEQjKf5+PJzLj79
RIBJFEHLkIDvcwIhALvLwSQmvd5MVN9wU1IiOz0zYEfC3+K/LkDCy8kTvwGhAiEA
8OKljQOdOhQcWver4UsvF5jwGPC5CqkPq/not9YLtU4=
-----END RSA PRIVATE KEY-----`;

function splitAccounts(value = "") {
  return String(value)
    .split(/\n|&/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function short(value, max = 500) {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function mask(value = "") {
  value = String(value || "");
  if (!value) return "";
  if (value.length <= 12) return `${value.slice(0, 3)}***`;
  return `${value.slice(0, 6)}***${value.slice(-6)}`;
}

function parseAccount(raw = "") {
  const text = String(raw || "").trim();
  if (!text) return {};

  if (text.startsWith("{")) {
    const data = JSON.parse(text);
    return {
      openid: data.openid || data.openId || "",
      token: data.token || data.accessToken || "",
      remark: data.remark || data.name || "",
    };
  }

  const [openid, token, remark] = text.split("#").map((item) => item.trim());
  if (!token && /^eyJ/.test(openid)) return { token: openid, openid: "", remark: "" };
  return { openid, token, remark };
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function taskSignHeaders(data = {}) {
  const payload = { ...data };
  const nonce = uuid();
  const timestamp = Date.now();
  payload.nonce = nonce;
  payload.timestamp = timestamp;

  const preSign = Object.keys(payload)
    .sort()
    .filter((key) => key !== "taskCode" && key !== "snCode")
    .map((key) => `${key}=${payload[key]}&`)
    .join("");

  const sign = crypto.createSign("RSA-SHA256").update(preSign).sign(TASK_PRIVATE_KEY, "base64");
  return { sign, timestamp: String(timestamp), nonce };
}

async function request(options) {
  const res = await axios.request({
    timeout: 25000,
    validateStatus: () => true,
    ...options,
    headers: {
      "User-Agent": "Mozilla/5.0 MicroMessenger MiniProgramEnv/Windows",
      Accept: "application/json, text/plain, */*",
      "content-type": "application/json",
      Referer: `https://servicewechat.com/${MINI_APP_ID}/${PACKAGE_VERSION}/page-frame.html`,
      ...(options.headers || {}),
    },
  });
  return { status: res.status, data: res.data, headers: res.headers || {} };
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
  console.log(`[${yybDisplay(entry)}] 请求 YYB Go 获取 code`);
  const { status, data } = await request({
    method: "POST",
    url: `http://${server}/wxapp/getCode`,
    data: { ref, app_id: MINI_APP_ID },
  });
  const code = data?.data?.result?.code || data?.data?.code || data?.code;
  if (status !== 200 || !code) throw new Error(`获取 code 失败 HTTP ${status}: ${short(data)}`);
  return code;
}

class Skyworth {
  constructor(rawAccount, index) {
    this.index = index;
    this.account = parseAccount(rawAccount);
    this.token = this.account.token || "";
    this.profile = null;
  }

  log(message) {
    $.log(`账号[${this.index}]${this.account.remark ? `[${this.account.remark}]` : ""} ${message}`);
  }

  async api(method, path, data = {}, headers = {}) {
    const { status, data: result } = await request({
      method,
      url: `${API_BASE}${path}`,
      params: method.toUpperCase() === "GET" ? data : undefined,
      data: method.toUpperCase() === "GET" ? undefined : data,
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...headers,
      },
    });
    if (status !== 200) throw new Error(`${path} HTTP ${status}: ${short(result)}`);
    return result;
  }

  assertOk(data, name) {
    if (Number(data?.code) !== 0) throw new Error(`${name}失败: ${short(data)}`);
    return data.data;
  }

  async login() {
    if (this.token) {
      this.log(`使用已有 token: ${mask(this.token)}`);
      return;
    }
    if (!this.account.openid) throw new Error("账号格式错误，请配置 wx_server 中的 openid 或直接配置 token");

    const code = await getWxCode(this.account.openid);
    const ticketData = this.assertOk(await this.api("POST", "/v2/user/exchange", { code }), "换取 ticket");
    const ticket = ticketData?.ticket || "";
    if (!ticket) throw new Error(`换取 ticket 响应异常: ${short(ticketData)}`);

    const loginData = this.assertOk(await this.api("POST", "/v2/user/signin", { ticket }), "登录");
    this.token = loginData?.token || "";
    if (!this.token) throw new Error(`登录响应缺少 token: ${short(loginData)}`);
    this.log(`登录成功 token=${mask(this.token)}`);
  }

  async queryUser() {
    const data = this.assertOk(await this.api("GET", "/v1/get-user"), "用户查询");
    const base = data?.baseInfo || {};
    this.profile = base;
    this.log(
      `用户信息: ${base.nickName || base.phone || "-"}，维豆: ${base.userScore ?? "-"}，成长值: ${
        base.growthValue ?? "-"
      }，今日维豆: ${base.todayScore ?? 0}，今日成长: ${base.todayGrowth ?? 0}，等级: ${base.userGrade ?? "-"}`
    );
    return data;
  }

  async queryTasks() {
    const data = this.assertOk(await this.api("GET", "/v1/index-task"), "任务查询");
    const list = Array.isArray(data?.list) ? data.list : [];
    const signTasks = list.filter((item) => SIGN_TASK_CODES.includes(item.taskLabel));
    if (signTasks.length) {
      this.log(
        `签到任务: ${signTasks
          .map((item) => `${item.taskLabel}/${item.taskTitle}/状态${item.taskStatus}/进度${item.doneNum || 0}/${item.limitNum || 1}`)
          .join("，")}`
      );
    } else {
      this.log("签到任务: 列表中未显示，可能今日已完成或入口隐藏");
    }
    return list;
  }

  async completeTask(taskCode) {
    const headers = taskSignHeaders({ taskCode });
    const result = await this.api("GET", `/v1/complete-task/${taskCode}`, { taskCode }, headers);
    if (Number(result?.code) === 20043 && String(result?.msg || "").includes("已完成")) {
      this.log(`签到上报 ${taskCode}: 今日已完成`);
      return result.msg;
    }
    const data = this.assertOk(result, `完成任务 ${taskCode}`);
    this.log(`签到上报 ${taskCode}: ${data || "成功"}`);
    return data;
  }

  async sign() {
    const tasks = await this.queryTasks();
    const visibleSignCodes = tasks
      .filter((item) => SIGN_TASK_CODES.includes(item.taskLabel))
      .map((item) => item.taskLabel);
    const codes = visibleSignCodes.length ? visibleSignCodes : SIGN_TASK_CODES;

    for (const code of codes) {
      try {
        await this.completeTask(code);
      } catch (e) {
        this.log(`签到上报 ${code}: ${e.message || e}`);
      }
      await $.wait(500, 1000);
    }
  }

  async run() {
    try {
      this.log("开始执行");
      await this.login();
      await this.queryUser();
      await this.sign();
      await this.queryTasks();
      await this.queryUser();
    } catch (e) {
      this.log(`执行失败: ${e.message || e}`);
    }
  }
}

async function main() {
  // YYB 模式：账号来自环境变量 YYB_GO（格式：地址@微信账号标识，多账号用 & 或换行分隔）
  const accounts = (process.env.YYB_GO || "")
    .split(/\r?\n|&/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!accounts.length) {
    console.error("❌ 未配置环境变量 YYB_GO，请设置后重试（格式：地址@微信账号标识，换行或&）");
    return;
  }
  for (let i = 0; i < accounts.length; i++) {
    await new Skyworth(accounts[i], i + 1).run();
    if (i < accounts.length - 1) await $.wait(1500, 3000);
  }
}

main()
  .catch((e) => $.log(`脚本异常: ${e.message || e}`))
  .finally(() => $.done());
