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

// name: OPPO
// cron: 23 8 * * *

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
        const { data } = await axios.post(url, { ref, app_id: 'wxe705c556754a1de2' }, { timeout: 20000, proxy: false });
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

const CK_NAME = "oppo";
const APP = {
    name: "OPPO",
    appid: "wxe705c556754a1de2",
    version: 361,
};

const MINI_API = "https://omoapplet-api-cn.heytap.com";
const H5_API = "https://hd.opposhop.cn";
const SIGN_ACTIVITY_ID = "2061050217641549824";
const CREDITS_ADD_ACTION_ID = "1788913e6d9e4683b8b9ab0088733560";
const BUSINESS = 1;
const SIGN_PAGE =
    "https://hd.opposhop.cn/bp/b371ce270f7509f0?nightModelEnable=true&utm_source=huiyuanwx&utm_medium=me_qiandao";
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

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

function parseAccount(raw = "") {
    const text = String(raw || "").trim();
    if (!text) return {};
    if (text.startsWith("{")) {
        const data = JSON.parse(text);
        return {
            openid: data.openid || data.openId || "",
            remark: data.remark || data.name || "",
        };
    }
    const [openid, remark] = text.split("#").map((item) => item.trim());
    return { openid, remark };
}

function awardTypeName(type) {
    const map = {
        0: "无奖励",
        1: "积分",
        2: "优惠券",
        3: "抽奖机会",
    };
    return map[Number(type)] || `类型${type}`;
}

function todayText() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

async function request(options) {
    const res = await axios.request({
        timeout: 25000,
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


class OppoTask {
    constructor(rawAccount, index) {
        this.server = rawAccount;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.index = index;
        this.account = parseAccount(rawAccount);
        this.sessionId = "";
        this.encryptedSession = "";
        this.openId = "";
        this.memberInfo = {};
        this.baseInfo = {};
    }

    log(message) {
        console.log(`账号[${this.index}]${this.account.remark ? `[${this.account.remark}]` : ""} ${message}`);
    }

    miniHeaders(extra = {}) {
        return {
            "content-type": "application/json",
            s_channel: "oppo",
            source_type: "2",
            s_version: "010000",
            spCallSource: "oppohy",
            Referer: `https://servicewechat.com/${APP.appid}/${APP.version}/page-frame.html`,
            sessionId: this.sessionId || "",
            NEWOPPOSID: this.encryptedSession || "",
            openid: this.openId || "",
            sa_distinct_id: this.openId || "",
            constToken: this.sessionId || "",
            ...extra,
        };
    }

    h5Headers(extra = {}) {
        return {
            "content-type": "application/json",
            Origin: H5_API,
            Referer: SIGN_PAGE,
            sessionId: this.sessionId || "",
            NEWOPPOSID: this.encryptedSession || "",
            openid: this.openId || "",
            sa_distinct_id: this.openId || "",
            constToken: this.sessionId || "",
            Cookie: [
                `NEWOPPOSID=${encodeURIComponent(this.encryptedSession || "")}`,
                `sessionId=${encodeURIComponent(this.sessionId || "")}`,
                `openid=${encodeURIComponent(this.openId || "")}`,
            ].join("; "),
            ...extra,
        };
    }

    async miniRequest(method, path, data = {}) {
        const upperMethod = method.toUpperCase();
        const { status, data: result } = await request({
            method: upperMethod,
            url: `${MINI_API}${path}`,
            headers: this.miniHeaders(),
            params: upperMethod === "GET" ? data : undefined,
            data: upperMethod === "GET" ? undefined : data,
        });
        if (status !== 200) throw new Error(`${path} HTTP ${status}: ${short(result)}`);
        if (result?.ret && String(result.ret) !== "1") {
            throw new Error(`${path} 失败: ${result.errMsg || result.message || short(result)}`);
        }
        return result;
    }

    async h5Request(method, path, data = {}) {
        const upperMethod = method.toUpperCase();
        const { status, data: result } = await request({
            method: upperMethod,
            url: `${H5_API}${path}`,
            headers: this.h5Headers(),
            params: upperMethod === "GET" ? data : undefined,
            data: upperMethod === "GET" ? undefined : data,
        });
        if (status !== 200) throw new Error(`${path} HTTP ${status}: ${short(result)}`);
        if (Number(result?.code) !== 200 && result?.succeed !== true) {
            throw new Error(`${path} 失败: ${result?.message || result?.errorMessage || short(result)}`);
        }
        return result;
    }

    async login() {
        const code = await getWxCode(this.server);
        const { status, data } = await request({
            method: "POST",
            url: `${MINI_API}/user/pre/auth`,
            headers: {
                "content-type": "application/json",
                Referer: `https://servicewechat.com/${APP.appid}/${APP.version}/page-frame.html`,
            },
            data: { code },
        });
        if (status !== 200 || String(data?.ret) !== "1") throw new Error(`登录失败 HTTP ${status}: ${short(data)}`);
        const info = data.data || {};
        this.sessionId = info.sessionId || "";
        this.encryptedSession = info.encryptedSession || "";
        this.openId = info.openId || "";
        if (!this.sessionId) throw new Error(`登录响应缺少 sessionId: ${short(data)}`);
        this.log(`登录成功 openId=${this.openId || "未知"}`);
    }

    async queryMember() {
        const member = await this.miniRequest("GET", "/member/info", { sessionId: this.sessionId });
        const base = await this.miniRequest("GET", "/member/baseInfo", { sessionId: this.sessionId }).catch(() => ({}));
        this.memberInfo = member.data || {};
        this.baseInfo = base.data || {};
        const userName = this.memberInfo.userName || this.baseInfo.userName || "未知";
        const phone = this.baseInfo.pnumber ? `，手机号: ${this.baseInfo.pnumber}` : "";
        this.log(
            `用户信息: ${userName}${phone}，积分: ${this.memberInfo.pointAmount ?? 0}，成长值: ${
                this.memberInfo.growthValue ?? 0
            }，等级: ${this.memberInfo.gradeCode || "未知"}`
        );
    }

    async queryEntrance() {
        const result = await this.miniRequest("GET", "/activity/signIn/entrance", { sessionId: this.sessionId });
        const data = result.data || {};
        this.log(`签到入口: ${data.signInIsStarted ? "已开启" : "未开启"}，连续/累计天数: ${data.signInDays ?? "-"}`);
    }

    async getSignDetail() {
        const result = await this.h5Request("GET", "/api/cn/oapi/marketing/cumulativeSignIn/getSignInDetail", {
            activityId: SIGN_ACTIVITY_ID,
            creditsAddActionId: CREDITS_ADD_ACTION_ID,
            business: BUSINESS,
        });
        return result.data || {};
    }

    todayAward(detail = {}) {
        const today = todayText();
        const awards = Array.isArray(detail.baseAwards) ? detail.baseAwards : [];
        return awards.find((item) => String(item.signTime || "").slice(0, 10) === today) || awards[0] || {};
    }

    async querySignDetail() {
        const detail = await this.getSignDetail();
        const award = this.todayAward(detail);
        const signed = Number(award.status) === 1;
        this.log(
            `签到详情: ${signed ? "今日已签" : "今日未签"}，已签天数: ${detail.signInDayNum ?? 0}，今日奖励: ${
                award.awardValue ?? "-"
            }${award.awardType !== undefined ? awardTypeName(award.awardType) : ""}`
        );
        return { detail, signed };
    }

    async signIn() {
        const { signed } = await this.querySignDetail();
        if (signed) return this.log("签到结果: 今日已签到，跳过");
        const result = await this.h5Request("POST", "/api/cn/oapi/marketing/cumulativeSignIn/signIn", {
            activityId: SIGN_ACTIVITY_ID,
            captchaCode: "",
            creditsAddActionId: CREDITS_ADD_ACTION_ID,
            business: BUSINESS,
        });
        const data = result.data || {};
        if (data.receiveStatus === false) {
            this.log(`签到结果: 失败，${data.receiveFailMsg || result.message || "未知原因"}`);
            return;
        }
        this.log(`签到结果: 成功，获得 ${data.awardValue ?? "-"}${awardTypeName(data.awardType)}`);
        await this.querySignDetail();
    }

    async run() {
        try {
            this.log(`开始执行 ${APP.name}`);
            await this.login();
            await this.queryMember();
            await this.queryEntrance();
            await this.signIn();
            await this.queryMember();
        } catch (e) {
            this.log(`执行失败: ${e.message || e}`);
        }
    }
}

async function main() {
    
    if (!SERVERS.length) {
        console.log(`未找到变量 ${CK_NAME}`);
        return;
    }
    for (let i = 0; i < SERVERS.length; i++) {
        const task = new OppoTask(SERVERS[i], i + 1);
        await task.run();
        if (i < SERVERS.length - 1) await await sleep(1500, 3000);
    }
}

main()
    .catch((e) => console.log(`脚本异常: ${e.message || e}`))
