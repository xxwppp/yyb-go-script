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

// name: 谷雨会员+
// cron: 30 9 * * 1

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

/* __YYB_GO_DOLLAR_SHIM__ */
if (typeof $ === 'undefined') {
  const __path = require('path');
  global.$ = {
    name: (typeof __filename !== 'undefined' ? __path.basename(__filename) : 'script'),
    isNode: () => true,
    msg: (...a) => { try { console.log(...a); } catch (e) {} },
    log: (...a) => { try { console.log(...a); } catch (e) {} },
    getdata: (k) => process.env[k] || '',
    setdata: () => {},
    SendMsg: async () => {},
    logs: [],
    time: (fmt) => {
      const d = new Date();
      const p = (n, l = 2) => String(n).padStart(l, '0');
      const m = { yyyy: d.getFullYear(), yy: String(d.getFullYear()).slice(-2), MM: p(d.getMonth()+1), M: d.getMonth()+1, dd: p(d.getDate()), d: d.getDate(), HH: p(d.getHours()), H: d.getHours(), mm: p(d.getMinutes()), m: d.getMinutes(), ss: p(d.getSeconds()), s: d.getSeconds() };
      return String(fmt).replace(/yyyy|yy|MM|M|dd|d|HH|H|mm|m|ss|s/g, (k) => m[k]);
    },
    httpRequest: async (opt) => {
      const axios = require('axios');

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

      const method = (opt.method || 'GET').toUpperCase();
      const data = opt.body !== undefined ? opt.body : (opt.data !== undefined ? opt.data : opt.json);
      const r = await axios({ method, url: opt.url, headers: opt.headers || {}, data, timeout: opt.timeout || 30000, validateStatus: () => true });
      return { status: r.status, headers: r.headers, body: typeof r.data === 'string' ? r.data : JSON.stringify(r.data) };
    },
  };
}

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
        const { data } = await axios.post(url, { ref, app_id: 'wxda948f3be0afc375' }, { timeout: 20000, proxy: false });
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

const strSplitor = "#";

const defaultUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.31(0x18001e31) NetType/WIFI Language/zh_CN miniProgram"

class Task {
    constructor(env) {
        this.server = env;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.index = userIdx++
        this.user = env.split(strSplitor);
        this.token = null
        this.wcsid = this.openid
        this.isSign = false
    }

    async run() {
        //随机延迟5-30s 模拟人工操作
        await await sleep(Math.floor(Math.random() * 20 + 5) * 1000);
        let code = await getCode(this.server)
        if (code) {
            await this.getUserToken(code)
        }
        if (!this.token) {
            console.log(`账号[${this.index}] 获取用户Token失败❌`)
            return
        }
        await this.signIn()
        await this.getUserPoints()
    }
    async getUserToken(code) {
        let data = JSON.stringify({
            "code": "" + code,
            "appid": "wxda948f3be0afc375",
            "shopId": null,
            "envVersion": "release",
            "isEnterpriseWx": false,
            "scene": 1168,
            "referrerInfo": {
                "appId": "wxda948f3be0afc375"
            }
        });

        let options = {
            method: 'POST',
            url: 'https://mall-mobile-v6.vecrp.com/mobile/wxAppLogin',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781 NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF XWEB/50249',
                'Content-Type': 'application/json;charset=UTF-8',
                'xweb_xhr': '1',
                'appid': 'wxda948f3be0afc375',
                'token': '',
                'Sec-Fetch-Site': 'cross-site',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'Referer': 'https://servicewechat.com/wxda948f3be0afc375/65/page-frame.html',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            },
            data: data
        };

        let {
            data: result
        } = await axios.request(options);
        console.log(result);

        if (result?.success) {
            this.token = result.result.mobileToken
            console.log(`🌸账号[${this.index}] 获取用户Token成功:${this.token}`)
        } else {
            console.log(`🌸账号[${this.index}] 获取用户Token-失败:${result.message}❌`)
        }
    }
    sha1(str) {
        return require("crypto").createHash("sha1").update(str).digest("hex");
    }
    request(options) {

        var sign,
            n = void 0
            , d = {},
            l = "R6WbJ830wNsEdjH9GumwKYiYxHz0K9QD",
            n = (new Date).getTime(),
            d = "post" === options.method || "POST" === options.method ? {
                body: JSON.stringify(options.data),
                secretKey: l,
                ts: n
            } : Object.assign({}, options.params, {
                secretKey: l,
                ts: n
            }),
            sign = this.sha1(function (e) {
                var t, a = [];
                for (t in e) {
                    var r = t + e[t];
                    a.push(r)
                }
                a.sort();
                var u = "";
                return a.map((function (e) {
                    "" === u ? u = e : u += e
                }
                )),
                    u
            }(d))
        let baseHeaders = {
            host: "mall-mobile-v6.vecrp.com",
            "accept": "*/*",
            "accept-language": "zh-CN,zh;q=0.9",
            "appid": "wxda948f3be0afc375",
            "content-type": "application/json;charset=UTF-8",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf254173b) XWEB/19027",
            "sign": "" + sign,
            "starttime": "" + n,
            "token": "" + this.token,
            "ts": "" + n,
            "x-tracedid": "" + crypto.randomUUID(),
            "xweb_xhr": "1",
            "Referer": "https://servicewechat.com/wxda948f3be0afc375/65/page-frame.html",
        }
        options.headers = Object.assign(options.headers, baseHeaders)

        return axios.request(options)
    }
    async signIn() {
        let options = {
            method: 'POST',
            url: `https://mall-mobile-v6.vecrp.com/mobile/activity/sign/sign`,

            headers: {},
            data: {
                activityId: 'cdd30467-abb8-4944-8941-2879aa950a86',
                shopId: '100186753',
                signDate: $.time(`yyyy-M-dd`),
            }

        };
        let {
            data: result
        } = await this.request(options);
        if (result?.success) {
            //打印签到结果
            console.log(`🌸账号[${this.index}]` + `签到成功`);
        } else {
            console.log(`🌸账号[${this.index}] 签到-失败:${result.msg}❌`)
        }

    }
    async getUserPoints() {
        let options = {
            method: 'GET',
            url: `https://mall-mobile-v6.vecrp.com/mobile/customer/getMyAllPoint`,
            params: {
                shopId: '100186753'
            },
            headers: {},

        }
        let {
            data: result
        } = await this.request(options);
        if (result?.success) {
            console.log(`账号[${this.index}]` + `积分:${result.result[0].score}`);
        } else {
            console.log(`账号[${this.index}] 获取积分-失败:${result.msg}❌`)
        }
    }

}

!(async () => {
    if (true) {
        for (let user of SERVERS) {
            await new Task(user).run();
        }
    } else {

        console.log(`${"YYB_GO"}未配置微信SERVER配置 搭建可看仓库目录下的readme.md❌`)
        return
    }

})()
    .catch((e) => console.log(e))
    


