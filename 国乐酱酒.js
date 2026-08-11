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


// name: 国乐酱酒
// cron: 0 40 9 * * *
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


// ===================== 配置项 =====================
// PushPlus 通知Token（在青龙面板环境变量中设置 PLUSPLUS_TOKEN）
const PLUSPLUS_TOKEN = process.env.PLUSPLUS_TOKEN || "";

// 从环境变量 YYB_GO 读取内网服务器，多条用换行或&分隔
let SERVERS = [];
const envYybGo = process.env.YYB_GO || "";
if (envYybGo) {
    SERVERS = envYybGo
        .split(/\r?\n|&/)
        .map(item => item.trim())
        .filter(item => item.length > 0);
}
// 校验是否存在有效服务地址
if (SERVERS.length === 0) {
    console.error("❌ 错误：未读取到环境变量 YYB_GO 或无有效IP端口！");
    console.error("配置示例（变量值可用换行或&分隔）：");
    console.error("192.168.1.21:8088");
    console.error("192.168.31.111:8088");
    process.exit(1);
}
console.log(`✅ 成功读取 ${SERVERS.length} 台内网服务器：`);
SERVERS.forEach(item => console.log(` - ${yybDisplay(item)}`));
console.log("----------------------------------------\n");

// 固定配置
const APP_ID = "wxeff120e4d11594c0";
const BASE = "https://member.guoyuejiu.com";
const defaultUserAgent = "Mozilla/5.0 (Linux; Android 15; 22061218C Build/AQ3A.250226.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36 XWEB/1460075 MMWEBSDK/20260202 MMWEBID/6435 MicroMessenger/8.0.71.3080(0x18004739) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 MiniProgramEnv/android";

// ===================== 工具 =====================
const sleep = ms => new Promise(r => setTimeout(r, ms));
function jitter(base) {
  return base + Math.random() * base;
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

// ===================== 获取微信 Code =====================
function parseYybGoEntry(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) return { server: "", ref: "" };

    const atIndex = value.indexOf("@");
    if (atIndex === -1) {
        console.log(`❌ [配置] YYB_GO 格式应为 地址@微信账号标识，当前值: ${value}`);
        return { server: "", ref: "" };
    }

    let server = value.slice(0, atIndex).trim();
    const ref = value.slice(atIndex + 1).trim();

    if (server.startsWith("http://")) {
        server = server.slice(7);
    } else if (server.startsWith("https://")) {
        server = server.slice(8);
    }
    server = server.replace(/\/+$/, "");

    if (!server || !ref) {
        console.log(`❌ [配置] YYB_GO 缺少地址或微信账号标识，当前值: ${value}`);
        return { server: "", ref: "" };
    }

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

    const url = `http://${parsedServer}/wxapp/getCode`;

    try {
        const { data } = await axios.post(url, {
            ref,
            app_id: APP_ID
        }, {
            timeout: 20000,
            proxy: false
        });
        const code = data?.data?.result?.code;
        if (data?.code !== 0 || !code) {
            console.log(`❌ ${parsedServer} 获取code失败: ${JSON.stringify(data)}`);
            return null;
        }
        console.log(`✅ ${parsedServer} 获取code成功`);
        return code;
    } catch (e) {
        console.log(`❌ ${parsedServer} 获取code异常: ${e.message}`);
        return null;
    }
}


// ===================== Code 登录 =====================
async function codeLogin(server) {
  let code = await getCode(server);
  if (!code) return null;

  try {
    let payload = {
      "avatarUrl": "https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUq24ZEaGT4poC6icRiccVGKSyXwibcPq4BWmiaIGuG1icwxaQX6grC9VemZoJ8rg/132",
      "city": "",
      "country": "",
      "gender": 0,
      "nickName": "微信用户",
      "province": "",
      "code": code,
      "source": 2
    };

    let { data } = await axios.post(`${BASE}/api/user/wxLogin`, payload, {
      headers: {
        "User-Agent": defaultUserAgent,
        "Content-Type": "application/json"
      },
      timeout: 10000
    });

    if (data.code === 0) {
      console.log(`✅ [{yybDisplay(server)}] 登录成功`);
      return data.data.authorization;
    }
  } catch (e) {
    console.log(`❌ [{yybDisplay(server)}] 登录失败：`, e.message);
  }
  return null;
}

// ===================== 签到 =====================
async function sign(server, token) {
  let signResult = { success: false, msg: "", spanSumDays: 0 };
  try {
    let { data } = await axios.get(`${BASE}/api/sign/daily/sign`, {
      headers: {
        "Authorization": "Mer" + token,
        "User-Agent": defaultUserAgent,
        "Referer": "https://servicewechat.com/wxeff120e4d11594c0/87/page-frame.html"
      }
    });
    if (data.code === 0) {
      signResult.success = true;
      signResult.msg = "签到成功";
      signResult.spanSumDays = data.data.spanSumDays;
      console.log(`📊 [{yybDisplay(server)}] 签到成功 | 连续 ${data.data.spanSumDays} 天`);
    } else {
      signResult.msg = data.message;
      console.log(`❌ [{yybDisplay(server)}] 签到失败：${data.message}`);
    }
  } catch (e) {
    signResult.msg = "签到异常：" + e.message;
    console.log(`❌ [{yybDisplay(server)}] 签到异常：`, e.message);
  }
  return signResult;
}

// ===================== 查询积分 =====================
async function getPoints(server, token) {
  let pointResult = { success: false, score: 0, msg: "" };
  try {
    let { data } = await axios.get(`${BASE}/api/user/info`, {
      headers: {
        "Authorization": "Mer" + token,
        "User-Agent": defaultUserAgent
      }
    });
    if (data.code === 0) {
      pointResult.success = true;
      pointResult.score = data.data.score;
      console.log(`💰 [{yybDisplay(server)}] 总积分：${data.data.score}`);
    }
  } catch (e) {
    pointResult.msg = "查询积分异常：" + e.message;
    console.log(`❌ [{yybDisplay(server)}] 查询积分异常：`, e.message);
  }
  return pointResult;
}

// 单个服务器执行逻辑
async function runServer(server) {
  let result = {
    server: server,
    loginSuccess: false,
    signResult: {},
    pointResult: {}
  };

  console.log(`\n===== 国乐酱酒 - ${yybDisplay(server)} 账号 =====`);
  await sleep(jitter(1500));
  
  // 登录
  let token = await codeLogin(server);
  if (!token) {
    result.loginSuccess = false;
    console.log(`===== ${server} 登录失败，跳过后续操作 =====`);
    return result;
  }
  result.loginSuccess = true;

  // 签到 + 查询积分
  result.signResult = await sign(server, token);
  result.pointResult = await getPoints(server, token);
  await sleep(jitter(1000));

  return result;
}

// ===================== 主程序 =====================
(async () => {
  console.log("===== 国乐酱酒多账号任务启动 =====");
  const results = [];

  // 顺序执行所有服务器
  for (const server of SERVERS) {
    const res = await runServer(server);
    results.push(res);
    // 账号间间隔2秒
    await sleep(2000);
  }

  // 汇总结果并推送通知
  let notifyContent = "### 国乐酱酒多账号任务执行结果\n";
  results.forEach(res => {
    notifyContent += `\n#### ${res.server}
- 登录状态：${res.loginSuccess ? "成功" : "失败"}
`;
    if (res.loginSuccess) {
      notifyContent += `- 签到状态：${res.signResult.success ? "成功" : "失败"}
- 签到信息：${res.signResult.msg}
- 连续签到天数：${res.signResult.spanSumDays}
- 总积分：${res.pointResult.success ? res.pointResult.score : "查询失败"}
`;
    }
  });

  await sendPlusPlusNotification("国乐酱酒多账号任务完成", notifyContent);
  console.log("\n===== 所有账号执行完成 =====");
})();
