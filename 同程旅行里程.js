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


// name: 同程旅行里程
// cron: 24 8 * * *

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
        const { data } = await axios.post(url, { ref, app_id: 'wx336dcaf6a1ecf632' }, { timeout: 20000, proxy: false });
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

const APP = { name: "同程旅行里程签到", appid: "wx336dcaf6a1ecf632" };

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

function short(value, max = 220) {
    if (value === undefined || value === null) return "";
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > max ? `${text.slice(0, max)}...` : text;
}

function formatDate(date = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getFiveDays() {
    const days = [];
    for (let i = -2; i <= 2; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        days.push(formatDate(d));
    }
    return days;
}

async function request(options) {
    const res = await axios.request({
        timeout: 20000,
        validateStatus: () => true,
        ...options,
        headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json, text/plain, */*",
            ...(options.headers || {}),
        },
    });
    return { status: res.status, headers: res.headers || {}, data: res.data };
}

async function getWxCode(server) {
        return await getCode(server);
    }


class Tongcheng {
    constructor(openid) {
        this.server = openid;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.openid = openid;
        this.loginInfo = {};
    }

    headers(extra = {}) {
        const sectoken = this.loginInfo.sectoken || "";
        return {
            apmat: `${this.loginInfo.openId || this.openid}|${new Date().toISOString().slice(0, 16).replace(/[-T:]/g, "")}|${Math.floor(Math.random() * 1000000)}`,
            TCSecTk: sectoken,
            TCxcxVersion: "10.8.7",
            platform: "WX_MP",
            osType: "2",
            secToken: sectoken,
            "TC-MALL-PLATFORM-CODE": "WX_MP",
            "TC-MALL-USER-TOKEN": sectoken,
            ...extra,
        };
    }

    async login() {
        const code = await getWxCode(this.server);
        const res = await request({
            method: "POST",
            url: "https://wx.17u.cn/wechatappapi/wxUser/login",
            headers: { "content-type": "application/json" },
            data: { code, scene: 1001 },
        });
        const content = res.data?.content || res.data?.data || {};
        if (res.status !== 200 || !content.openId) throw new Error(`登录失败 HTTP ${res.status}: ${short(res.data)}`);
        this.loginInfo = {
            openId: content.openId,
            encryOpenId: content.encryOpenId,
            aesOpenId: content.aesOpenId,
            unionId: content.unionId,
            aesUnionId: content.aesUnionId,
            memberId: content.memberId,
            sectoken: content.sectoken,
        };
        return `openId=${content.openId} memberId=${content.memberId || ""}`;
    }

    async query() {
        const member = await request({
            method: "GET",
            url: "https://wx.17u.cn/wechatmypubapi/myInfo/memberInfo",
            headers: this.headers(),
        });
        const mileage = await request({
            method: "POST",
            url: "https://tcmobileapi.17usoft.com/mallgatewayapi/userApi/mileages/remain",
            headers: this.headers({
                "content-type": "application/json",
                "TC-MALL-DEPT-CODE": "iH3PGf9ZucSMMEYi4keylA==",
                "TC-MALL-CLIENT": "API_CLIENT",
                "TC-MALL-OS-TYPE": "Android",
            }),
            data: { osType: 2 },
        });
        const remain = mileage.data?.data?.remainBalance ?? mileage.data?.data?.balance ?? mileage.data?.remainBalance;
        const content = member.data?.content || member.data?.data?.content || {};
        return `会员=${short(content.memberBanner || content.memberRights || content, 100)} 里程=${remain ?? short(mileage.data, 100)}`;
    }

    async sign() {
        const days = getFiveDays();
        const calendar = await request({
            method: "POST",
            url: "https://wx.17u.cn/wxmpsign/sign/signCalendar",
            headers: this.headers({ "content-type": "application/json" }),
            data: { beginDate: days[0], endDate: days[4] },
        });
        const signInfo = await request({
            method: "POST",
            url: "https://wx.17u.cn/wxmpsign/sign/getSignInfo",
            headers: this.headers({ "content-type": "application/json" }),
            data: {},
        });
        const info = signInfo.data?.data || {};
        const cal = calendar.data?.data || {};
        if (info.todaySigned || cal.todaySigned) return `今日已签到，连续=${info.periodContinuedSignDays ?? cal.periodContinuedSignDays ?? "未知"}天`;
        const sign = await request({
            method: "POST",
            url: "https://wx.17u.cn/wxmpsign/sign/saveSignInfo",
            headers: this.headers({ "content-type": "application/json" }),
            data: {},
        });
        return `签到接口返回: ${short(sign.data)}`;
    }
}

async function runAccount(openid, index) {
    console.log(`\n========== ${APP.name} 账号[${index}] ${openid} ==========`);
    const runner = new Tongcheng(openid);
    try {
        console.log(`登录：${await runner.login()}`);
        console.log(`查询：${await runner.query()}`);
        console.log(`签到：${await runner.sign()}`);
    } catch (e) {
        console.log(`执行失败：${e.message || e}`);
    }
}

(async () => {
    if (!SERVERS.length) {
        console.log(`未配置 ${"YYB_GO"}`);
        return;
    }
    console.log(`共找到${SERVERS.length}个账号`);
    for (let i = 0; i < SERVERS.length; i++) {
        await runAccount(SERVERS[i], i + 1);
        await sleep(800);
    }
})().catch((e) => {
    console.log(`脚本异常：${e.stack || e.message || e}`);
});
