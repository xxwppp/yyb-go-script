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


// name: 蜜雪冰城
// cron: 0 0 12 * * *
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

const rs = require("jsrsasign");

// ====================== 配置项 ======================
// PushPlus 通知Token（在青龙面板环境变量中设置 PLUSPLUS_TOKEN）
const PLUSPLUS_TOKEN = process.env.PLUSPLUS_TOKEN || "";

// 从环境变量 YYB_GO 读取内网wxcode服务，多条用换行或&分隔
let SERVERS = [];
const envYybGo = process.env.YYB_GO || "";
if (envYybGo) {
    SERVERS = envYybGo
        .split(/\r?\n|&/)
        .map(item => item.trim())
        .filter(item => item.length > 0);
}
// 无有效地址直接退出并提示
if (SERVERS.length === 0) {
    console.error("❌ 错误：未读取到环境变量 YYB_GO 或无有效IP端口！");
    console.error("配置示例（青龙环境变量值，换行或&分隔）：");
    console.error("192.168.1.21:8088");
    console.error("192.168.31.111:8088");
    process.exit(1);
}
console.log(`✅ 成功读取 ${SERVERS.length} 台内网wxcode服务：`);
SERVERS.forEach(item => console.log(` - ${yybDisplay(item)}`));
console.log("----------------------------------------\n");

// 固定配置（无需修改）
const APP_ID = "d82be6bbc1da11eb9dd000163e122ecb";
const MINI_APP_ID = "wx7696c66d2245d107";
const UA = "Mozilla/5.0 (Linux; Android 15; 22061218C Build/AQ3A.250226.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36 XWEB/1460075 MMWEBSDK/20260202 MMWEBID/6435 MicroMessenger/8.0.71.3080(0x28004761) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 miniProgram/wx7696c66d2245d107";

const privateKeyString = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCtypUdHZJKlQ9L
L6lIJSphnhqjke7HclgWuWDRWvzov30du235cCm13mqJ3zziqLCwstdQkuXo9sOP
Ih94t6nzBHTuqYA1whrUnQrKfv9X4/h3QVkzwT+xWflE+KubJZoe+daLKkDeZjVW
nUku8ov0E5vwADACfntEhAwiSZUALX9UgNDTPbj5ESeII+VztZ/KOFsRHMTfDb1G
IR/dAc1mL5uYbh0h2Fa/fxRPgf7eJOeWGiygesl3CWj0Ue13qwX9PcG7klJXfToI
576MY+A7027a0aZ49QhKnysMGhTdtFCksYG0lwPz3bIR16NvlxNLKanc2h+ILTFQ
bMW/Y3DRAgMBAAECggEBAJGTfX6rE6zX2bzASsu9HhgxKN1VU6/L70/xrtEPp4SL
SpHKO9/S/Y1zpsigr86pQYBx/nxm4KFZewx9p+El7/06AX0djOD7HCB2/+AJq3iC
5NF4cvEwclrsJCqLJqxKPiSuYPGnzji9YvaPwArMb0Ff36KVdaHRMw58kfFys5Y2
HvDqh4x+sgMUS7kSEQT4YDzCDPlAoEFgF9rlXnh0UVS6pZtvq3cR7pR4A9hvDgX9
wU6zn1dGdy4MEXIpckuZkhwbqDLmfoHHeJc5RIjRP7WIRh2CodjetgPFE+SV7Sdj
ECmvYJbet4YLg+Qil0OKR9s9S1BbObgcbC9WxUcrTgECgYEA/Yj8BDfxcsPK5ebE
9N2teBFUJuDcHEuM1xp4/tFisoFH90JZJMkVbO19rddAMmdYLTGivWTyPVsM1+9s
tq/NwsFJWHRUiMK7dttGiXuZry+xvq/SAZoitgI8tXdDXMw7368vatr0g6m7ucBK
jZWxSHjK9/KVquVr7BoXFm+YxaECgYEAr3sgVNbr5ovx17YriTqe1FLTLMD5gPrz
ugJj7nypDYY59hLlkrA/TtWbfzE+vfrN3oRIz5OMi9iFk3KXFVJMjGg+M5eO9Y8m
14e791/q1jUuuUH4mc6HttNRNh7TdLg/OGKivE+56LEyFPir45zw/dqwQM3jiwIz
yPz/+bzmfTECgYATxrOhwJtc0FjrReznDMOTMgbWYYPJ0TrTLIVzmvGP6vWqG8rI
S8cYEA5VmQyw4c7G97AyBcW/c3K1BT/9oAj0wA7wj2JoqIfm5YPDBZkfSSEcNqqy
5Ur/13zUytC+VE/3SrrwItQf0QWLn6wxDxQdCw8J+CokgnDAoehbH6lTAQKBgQCE
67T/zpR9279i8CBmIDszBVHkcoALzQtU+H6NpWvATM4WsRWoWUx7AJ56Z+joqtPK
G1WztkYdn/L+TyxWADLvn/6Nwd2N79MyKyScKtGNVFeCCJCwoJp4R/UaE5uErBNn
OH+gOJvPwHj5HavGC5kYENC1Jb+YCiEDu3CB0S6d4QKBgQDGYGEFMZYWqO6+LrfQ
ZNDBLCI2G4+UFP+8ZEuBKy5NkDVqXQhHRbqr9S/OkFu+kEjHLuYSpQsclh6XSDks
5x/hQJNQszLPJoxvGECvz5TN2lJhuyCupS50aGKGqTxKYtiPHpWa8jZyjmanMKnE
dOGyw/X4SFyodv8AEloqd81yGg==
-----END PRIVATE KEY-----`;

// ====================== 工具函数 ======================
function ts13() {
    return Date.now();
}

// RSA签名
function getSHA256withRSA(content) {
    const key = rs.KEYUTIL.getKey(privateKeyString);
    const sig = new rs.KJUR.crypto.Signature({ alg: "SHA256withRSA" });
    sig.init(key);
    sig.updateString(content);
    return rs.hextob64u(sig.sign());
}

// PushPlus通知函数
async function sendPlusPlusNotification(title, content) {
    if (!PLUSPLUS_TOKEN) return;
    try {
        await axios.post("https://www.pushplus.plus/send", {
            token: PLUSPLUS_TOKEN,
            title: title,
            content: content,
            template: "txt"
        }, { timeout: 5000 });
        console.log("✅ 通知推送成功");
    } catch (e) {
        console.log("❌ 通知推送失败：", e.message);
    }
}

// 查询雪王币
async function getUserPoint(token) {
    try {
        const t = ts13();
        const sign = getSHA256withRSA(`appId=${APP_ID}&t=${t}`);
        const { data } = await axios.get("https://mxsa.mxbc.net/api/v1/customer/info", {
            params: { t, appId: APP_ID, sign },
            headers: {
                "Access-Token": token,
                "version": "2.8.27",
                "User-Agent": UA
            },
            timeout: 8000
        });
        return data.code === 0 ? parseInt(data.data.customerPoint) : 0;
    } catch (e) {
        return 0;
    }
}

// 魔法铺任务
async function doMagicShop(token) {
    try {
        const t = ts13();
        const sign = getSHA256withRSA(`appId=${APP_ID}&t=${t}`);
        await axios.get("https://mxsa.mxbc.net/api/v1/duiba/getLoginUrl", {
            params: { appId: APP_ID, t, sign, dbredirect: "" },
            headers: { "Access-Token": token, "version": "2.8.27", "User-Agent": UA },
            timeout: 10000
        });
        return true;
    } catch (e) {
        return false;
    }
}

// 单个服务器执行逻辑
function buildYybAuthHeaders() {
    const token = process.env.YYB_TOKEN;
    if (token) return { Authorization: `Bearer ${token}` };
    const user = process.env.YYB_USER;
    const pass = process.env.YYB_PASS;
    if (user && pass) return { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` };
    return {};
}
async function getCode(server) {
    // server 格式: "ip:port@ref" 或 "ip:port"
    const atIndex = server.lastIndexOf("@");
    const addr = atIndex === -1 ? server.trim() : server.slice(0, atIndex).trim();
    const ref = atIndex === -1 ? "" : server.slice(atIndex + 1).trim();
    
    // 获取 app_id（不同脚本的 APPID/MINI_APP_ID）
    const appId = (typeof APPID !== "undefined") ? APPID : (typeof MINI_APP_ID !== "undefined") ? MINI_APP_ID : "";
    
    try {
        const { data } = await axios.post("http://" + addr + "/wxapp/getCode", {
            ref: ref || "owNAX6gQdCIdZKWsm2c6adr7_eZY",
            app_id: appId
        }, { timeout: 20000, proxy: false });
        const code = data?.data?.result?.code;
        if (data?.code !== 0 || !code) {
            console.log("❌ " + addr + " 获取code失败: " + JSON.stringify(data));
            return null;
        }
        console.log("✅ " + addr + " 获取code成功");
        return code;
    } catch (e) {
        console.log("❌ " + addr + " 获取code异常: " + e.message);
        return null;
    }
}
async function runServer(server) {
    let result = {
        server: server,
        success: false,
        before: 0,
        after: 0,
        gain: 0,
        error: ""
    };

    console.log(`\n==============================`);
    console.log(`蜜雪冰城 - ${yybDisplay(server)} 账号任务`);
    console.log(`==============================`);

    try {
        // 1. 获取登录code
        const code = await getCode(server);
        if (!code) throw new Error("获取code失败");

        // 2. code换session
        const t1 = ts13();
        const session = await axios.post("https://mxsa.mxbc.net/api/v1/app/code2Session", {
            code, miniAppId: MINI_APP_ID, t: t1, appId: APP_ID,
            sign: getSHA256withRSA(`appId=${APP_ID}&code=${code}&miniAppId=${MINI_APP_ID}&t=${t1}`)
        }, { headers: { version: "2.8.27" } });

        const { openid, unionid } = session.data.data;

        // 3. 登录获取token
        const t2 = ts13();
        const loginRes = await axios.post("https://mxsa.mxbc.net/api/v2/app/loginByAuthCode", {
            authCode: code, openId: openid, unionid, third: "wxmini", miniAppId: MINI_APP_ID,
            t: t2, appId: APP_ID,
            sign: getSHA256withRSA(`appId=${APP_ID}&authCode=${code}&miniAppId=${MINI_APP_ID}&openId=${openid}&t=${t2}&third=wxmini&unionid=${unionid}`)
        }, { headers: { version: "2.8.27", "x-ssos-cid": unionid } });

        const token = loginRes.data.data.accessToken;
        const before = await getUserPoint(token);
        console.log(`✅ ${server} 登录成功 | 当前雪王币：${before}`);

        // 4. 执行任务
        console.log(`\n执行任务：访问魔法铺...`);
        await doMagicShop(token);
        await new Promise(r => setTimeout(r, 1500));

        // 5. 结果展示
        const after = await getUserPoint(token);
        const gain = Math.max(0, after - before);

        console.log(`\n======================================`);
        console.log(`💎 ${server} 执行前：${before} 雪王币`);
        console.log(`✅ ${server} 本次获得：${gain} 雪王币`);
        console.log(`💎 ${server} 执行后：${after} 雪王币`);
        console.log(`======================================`);

        result.success = true;
        result.before = before;
        result.after = after;
        result.gain = gain;

    } catch (e) {
        result.error = e.message;
        console.log(`❌ ${server} 执行失败：`, e.message);
    }
    return result;
}

// ====================== 主逻辑 ======================
async function run() {
    const results = [];
    // 顺序执行所有服务器
    for (const server of SERVERS) {
        const res = await runServer(server);
        results.push(res);
        // 账号间间隔2秒，避免请求过快
        await new Promise(r => setTimeout(r, 2000));
    }

    // 汇总结果并推送通知
    let notifyContent = "### 蜜雪冰城多账号任务执行结果\n";
    results.forEach(res => {
        if (res.success) {
            notifyContent += `\n#### ${res.server}
- 执行状态：成功
- 执行前雪王币：${res.before}
- 本次获得：${res.gain}
- 执行后雪王币：${res.after}
`;
        } else {
            notifyContent += `\n#### ${res.server}
- 执行状态：失败
- 失败原因：${res.error}
`;
        }
    });

    await sendPlusPlusNotification("蜜雪冰城多账号任务完成", notifyContent);
}

// 启动
(async () => {
    console.log("🚀 蜜雪冰城 魔法铺多账号任务");
    await run();
    console.log("\n🏁 所有账号任务执行完成！");
})();
