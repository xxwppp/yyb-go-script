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
      if (p) { const t = fs.readFileSync(p, 'utf-8'); const m = t.match(/QYWX_KEY\s*=\s*['"]([^'"]+)['"]/); if (m) return m[1]; }
    } catch (e) {}
    return null;
  }
  let __flushed = false;
  function __flush() {
    if (__flushed) return; __flushed = true;
    const title = (process.argv[1] || 'YYB_GO').split(/[\/]/).pop();
    const body = __logs.slice(-40).join('\n');
    const _ol = console.log, _oe = console.error; console.log = function () {}; console.error = function () {};
    try {
      let sn; try { sn = require('./sendNotify'); } catch (e) { try { sn = require('/ql/data/scripts/sendNotify'); } catch (e2) { sn = null; } }
      if (sn) { if (typeof sn === 'function') { try { sn(title, body); } catch (e) {} } else if (sn.sendNotify && typeof sn.sendNotify === 'function') { try { sn.sendNotify(title, body); } catch (e) {} } }
    } catch (e) {}
    console.log = _ol; console.error = _oe;
    try {
      const key = __resolveKey();
      if (key) { const fs = require('fs'); const cp = require('child_process'); const tmp = '/tmp/yyb_notify_' + process.pid + '.json';
        fs.writeFileSync(tmp, JSON.stringify({ msgtype: 'text', text: { content: '【' + title + '】\n' + body } }));
        cp.execSync('curl -s -m 15 -X POST -H "Content-Type: application/json" --data @' + tmp + ' "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + key + '"', { stdio: 'ignore' });
        try { fs.unlinkSync(tmp); } catch (e) {} }
    } catch (e) {}
  }
  let __exiting = false;
  const __origExit = (typeof process.exit === 'function') ? process.exit.bind(process) : function (c) { throw new Error('exit ' + c); };
  process.exit = function (code) { if (__exiting) return __origExit(code); __exiting = true; try { __flush(); } catch (e) {} return __origExit(code); };
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

// === YYB 协议统一认证（自动 https + Authorization） begin ===
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
            if (yybAuth) { config.headers = config.headers || {}; config.headers.Authorization = yybAuth; }
        }
        return config;
    });
})();
// === YYB 协议统一认证 end ===

// 轻量 Env 兼容层（替代 ../tools/env，避免外部依赖）
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
    if (!this.userCount) this.log('未配置 YYB_GO（无账号）');
  },
};

function parseYybGoEntry(entry) {
  const e = String(entry == null ? "" : entry);
  const i = e.indexOf("@");
  if (i <= 0) throw new Error('账号 "' + e + '" 需为 server@openid 格式，并配置 YYB_GO');
  return { server: e.slice(0, i), openid: e.slice(i + 1) };
}

const axios = require("axios");

const CK_NAME = "qqpcmgr";
const APP_ID = "wx5cd60c5d4817a188";

const QRCONNECT_URL =
    process.env.qqpcmgr_qrconnect_url ||
    "https://open.weixin.qq.com/connect/qrconnect?appid=wx5cd60c5d4817a188&scope=snsapi_login&redirect_uri=https%3A%2F%2Fsecurity.guanjia.qq.com%2Flogin&state=233&login_type=jssdk&self_redirect=true";
const CLIENT_GUID = process.env.qqpcmgr_guid || "fff4328476c4ffc836d21e82918faa19";
const SDIAID = process.env.qqpcmgr_sdiaid || "2025121115391911962";
const LOTTERY_ID = process.env.qqpcmgr_lid || "Lottery2";
const VERSION = process.env.qqpcmgr_version || "18.2.30604.301";
const COMPUTER_NAME = process.env.qqpcmgr_computer || "smallfawn";
const USER_AGENT =
    process.env.qqpcmgr_ua ||
    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/143.0.13.0 Tencent QQPCMgr/18.2.30604.301";

function splitAccounts(raw = "") {
    return String(raw)
        .split(/\n|&/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function pick(source = {}, keys = []) {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
}

function findLoginPayload(source) {
    if (!source || typeof source !== "object") return null;
    const loginKey = pick(source, ["loginKey", "LoginKey", "loginkey", "login_key"]);
    const openid =
        pick(source, ["openid", "openId", "OpenId", "OpenID"]) ||
        pick(source.thirdPartyAccInfo, ["bindAccount", "openid", "openId", "OpenId", "OpenID"]);
    if (loginKey && openid) return source;

    for (const value of Object.values(source)) {
        if (value && typeof value === "object") {
            const found = findLoginPayload(value);
            if (found) return found;
        }
    }
    return null;
}

function cookieValue(value) {
    return String(value ?? "").replace(/[;\r\n]/g, "");
}

function buildCookie(profile) {
    const commonid = profile.commonid || profile.openid;
    const encodedNickname = encodeURIComponent(profile.nickname || "");
    const pairs = {
        _gj_acc_type: 2,
        _gj_commonid: commonid,
        _gj_version: VERSION,
        _gj_computername: COMPUTER_NAME,
        _gj_client_guid: profile.guid,
        _gj_server_guid: profile.serverGuid || "",
        _gj_vip: profile.vip || 0,
        _gj_nickname: profile.nickname || "",
        _gj_accountid: profile.account,
        _gj_loginkey: profile.loginKey,
        _gj_openid: profile.openid,
        _gj_sex: profile.sex || 0,
        _gj_headimgurl: profile.headimgurl || "",
        _gj_expired: 0,
        _gj_support: "[0,1,2,3,4,5,6,8,10,11,12,13,14,15,18]",
        _gj_encoded_nickname: encodedNickname,
        _gj_level: profile.level || 0,
    };
    return Object.entries(pairs)
        .map(([key, value]) => `${key}=${cookieValue(value)}`)
        .join("; ");
}

async function getAuthCode(entry) {
    if (process.env.qqpcmgr_authCode) return process.env.qqpcmgr_authCode;
    if (!entry) throw new Error("未配置 qqpcmgr openid（YYB_GO），无法获取 code");
    const code = await qrcodeAuth(entry);
    return code;
}


async function qrcodeAuth(entry) {
    const { server, openid } = parseYybGoEntry(entry);
    const { data, status } = await axios.request({
        method: "POST",
        url: `https://${server}/wxapp/getCode`,
        headers: { "Content-Type": "application/json" },
        data: { ref: openid, app_id: APP_ID },
        timeout: 30000,
        validateStatus: () => true,
    });
    if (status !== 200) throw new Error(`/wxapp/getCode HTTP ${status}: ${JSON.stringify(data)}`);
    const code =
        data?.code ||
        data?.wxCode ||
        data?.data?.code ||
        data?.data?.wxCode ||
        data?.data?.data?.code ||
        data?.data?.data?.wxCode;
    if (!code) throw new Error(`/wxapp/getCode 未返回 code: ${JSON.stringify(data)}`);
    return code;
}

async function loginByCode(authCode, guid) {
    const { data } = await axios.request({
        method: "POST",
        url: "https://jprx.m.qq.com/data/3078/forward",
        headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "sec-ch-ua": '"Chromium";v="109"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            Origin: "https://webcdn.m.qq.com",
            "Sec-Fetch-Site": "same-site",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            Referer: "https://webcdn.m.qq.com/",
            "Accept-Language": "zh-CN,zh;q=0.9",
        },
        data: {
            req: {
                platType: 3,
                loginAccType: 32,
                authCode,
                clientGuid: guid,
            },
        },
        timeout: 20000,
        validateStatus: () => true,
    });
    const payload = findLoginPayload(data);
    if (!payload) throw new Error(`登录响应未找到 loginKey/openid: ${JSON.stringify(data)}`);
    return payload;
}

function normalizeProfile(payload, guid) {
    const third = payload.thirdPartyAccInfo || {};
    const account = pick(payload, ["account", "accountId", "Account", "userId", "UserId", "uin"]);
    return {
        loginKey: pick(payload, ["loginKey", "LoginKey", "loginkey", "login_key"]),
        openid: pick(payload, ["openid", "openId", "OpenId", "OpenID"]) || pick(third, ["bindAccount", "openid", "openId", "OpenId", "OpenID"]),
        nickname: pick(payload, ["nickname", "nickName", "NickName"]) || pick(third, ["nickname", "nickName", "NickName"]) || "JOY",
        account,
        userId: pick(payload, ["userId", "UserId"]) || account,
        headimgurl: pick(payload, ["headimgurl", "headImgUrl", "HeadImgUrl", "headImg"]) || pick(third, ["headUrl", "headimgurl", "headImgUrl", "HeadImgUrl"]),
        guid: pick(payload, ["guid", "clientGuid", "ClientGuid"]) || guid,
        imei: pick(payload, ["imei", "Imei"]) || account,
        commonid: pick(payload, ["commonid", "commonId", "CommonId"]) || pick(third, ["commonid", "commonId", "CommonId", "unionId"]),
        serverGuid: pick(payload, ["serverGuid", "server_guid", "ServerGuid"]),
        sex: pick(payload, ["sex", "Sex"]) || 0,
        vip: pick(payload, ["vip", "Vip"]) || 0,
        level: pick(payload, ["level", "Level"]) || 0,
    };
}

async function createAuth(profile, cookie) {
    const { data, status } = await axios.request({
        method: "POST",
        url: "https://sdi.m.qq.com/public/auth/create",
        headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
            "sec-ch-ua": '"Chromium";v="109"',
            sdiaid: SDIAID,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            Origin: "https://sdi.3g.qq.com",
            "Sec-Fetch-Site": "same-site",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            Referer: "https://sdi.3g.qq.com/",
            "Accept-Language": "zh-CN,zh;q=0.9",
            Cookie: cookie,
        },
        data: {
            loginKey: profile.loginKey,
            openid: profile.openid,
            nickname: profile.nickname,
            account: Number(profile.account) || profile.account,
            userId: Number(profile.userId) || profile.userId,
            headimgurl: profile.headimgurl,
            guid: profile.guid,
            imei: Number(profile.imei) || profile.imei,
            loginType: "wx",
            platformId: "pcmgr16",
            loginAccType: 2,
        },
        timeout: 20000,
        validateStatus: () => true,
    });
    return { status, data };
}

async function doLottery(sessionKey, cookie) {
    const { data, status } = await axios.request({
        method: "POST",
        url: "https://sdi.m.qq.com/private/lottery/doLottery",
        headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
            "sec-ch-ua": '"Chromium";v="109"',
            sessionkey: sessionKey,
            sdiaid: SDIAID,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            Origin: "https://sdi.3g.qq.com",
            "Sec-Fetch-Site": "same-site",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            Referer: "https://sdi.3g.qq.com/",
            "Accept-Language": "zh-CN,zh;q=0.9",
            Cookie: cookie,
        },
        data: { lid: LOTTERY_ID },
        timeout: 20000,
        validateStatus: () => true,
    });
    return { status, data };
}

async function runAccount(account, index) {
    const guid = process.env[`${CK_NAME}_guid_${index}`] || CLIENT_GUID;
    $.log(`\n[账号${index}] 开始处理 ${account || "authCode"}`);
    const authCode = await getAuthCode(account);
    $.log(`[账号${index}] 获取 authCode 成功 ${String(authCode).slice(0, 8)}***`);

    const payload = await loginByCode(authCode, guid);
    const profile = normalizeProfile(payload, guid);
    if (!profile.loginKey || !profile.openid) throw new Error("登录资料缺少 loginKey/openid");

    const cookie = buildCookie(profile);
    $.log(`[账号${index}] 登录资料: account=${profile.account} openid=${profile.openid} nickname=${profile.nickname}`);
    $.log(`[账号${index}] Cookie: ${cookie}`);

    const auth = await createAuth(profile, cookie);
    $.log(`[账号${index}] auth/create HTTP ${auth.status}`);
    $.log(`[账号${index}] auth/create 返回: ${JSON.stringify(auth.data)}`);

    const sessionKey = auth.data?.data?.userInfo?.sessionKey || auth.data?.data?.sessionKey || auth.data?.sessionKey;
    if (!sessionKey) throw new Error(`auth/create 未返回 sessionKey: ${JSON.stringify(auth.data)}`);

    const lottery = await doLottery(sessionKey, cookie);
    $.log(`[账号${index}] doLottery(${LOTTERY_ID}) HTTP ${lottery.status}`);
    $.log(`[账号${index}] doLottery 返回: ${JSON.stringify(lottery.data)}`);
}

(async () => {
    const accounts = process.env.qqpcmgr_authCode ? [""] : splitAccounts(process.env.YYB_GO || "");
    if (!accounts.length) throw new Error(`未配置 YYB_GO，或设置 qqpcmgr_authCode 直接测试`);

    for (let i = 0; i < accounts.length; i++) {
        try {
            await runAccount(accounts[i], i + 1);
        } catch (e) {
            $.log(`[账号${i + 1}] 失败: ${e.message || e}`);
        }
    }
})()
    .catch((e) => $.log(`执行失败: ${e.message || e}`))
    .finally(() => $.done());
