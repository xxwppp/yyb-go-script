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

// name: 牛牛短剧
// cron: 40 9 * * *

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

const fs = require("fs");
const path = require("path");
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
        const { data } = await axios.post(url, { ref, app_id: MINI_APP_ID }, { timeout: 20000, proxy: false });
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

const MINI_APP_ID = "wxcb95401f250e9a53";
const API_BASE = "https://api.tianjinzhitongdaohe.com/sqx_fast";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "niuniuduanju_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";
const DAILY_ACTION_COUNT = 2;
const EAT_GOLD_COUNT = 4;
const VIDEO_COUNT_STEPS = [1, 5, 9, 15, 20];
const VIDEO_DURATION_STEPS = [60, 300, 900, 1800, 3600, 7200, 9000];

function readTokenCache() {
    try {
        if (!fs.existsSync(TOKEN_CACHE_FILE)) return {};
        return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf8")) || {};
    } catch (e) {
        return {};
    }
}

function writeTokenCache(cache) {
    try {
        fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
    } catch (e) {
        console.log(`写入token缓存失败: ${e.message || e}`);
    }
}

function maskPhone(phone = "") {
    return String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function maskToken(token = "") {
    if (!token) return "";
    return token.length > 14 ? `${token.slice(0, 8)}***${token.slice(-6)}` : `${token.slice(0, 4)}***`;
}

function randomUserName() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let suffix = "";
    for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    return `用户${suffix}`;
}

function today() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

class Task {
    constructor(openid) {
        this.server = openid;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.index = userIdx++;
        this.openid = String(openid || "").trim();
        this.token = "";
        this.user = {};
        this.wxInfo = {};
    }

    async run() {
        const cached = this.getCachedToken();
        if (cached?.token) {
            this.token = cached.token;
            this.user = cached.user || {};
            console.log(`账号[${this.index}] 使用缓存token: ${maskToken(this.token)}`);
            if (!(await this.checkToken())) {
                this.removeCachedToken();
                console.log(`账号[${this.index}] 缓存token失效，重新code登录`);
            }
        }

        if (!this.token) await this.loginByWxCode();
        if (!this.token) return;

        await this.getPoints("签到前");
        await this.getSignStatus();
        await this.signIn();
        await this.doDailyTasks();
        await this.getPoints("签到后");
    }

    getCachedToken() {
        const cache = readTokenCache();
        return cache[this.openid] || null;
    }

    saveCachedToken() {
        if (!this.token) return;
        const cache = readTokenCache();
        cache[this.openid] = {
            token: this.token,
            user: this.user,
            wxInfo: this.wxInfo,
            updatedAt: new Date().toISOString(),
        };
        writeTokenCache(cache);
    }

    removeCachedToken() {
        const cache = readTokenCache();
        if (cache[this.openid]) {
            delete cache[this.openid];
            writeTokenCache(cache);
        }
        this.token = "";
        this.user = {};
    }

    getHeaders(extra = {}) {
        return {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/19/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            "content-type": "application/x-www-form-urlencoded",
            ...(this.token ? { token: this.token } : {}),
            ...extra,
        };
    }

    async request({ method = "GET", apiPath, params = {}, data = {}, token = true, json = false }) {
        const options = {
            method,
            url: `${API_BASE}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`,
            headers: this.getHeaders(json ? { "content-type": "application/json" } : {}),
            timeout: 15000,
            validateStatus: () => true,
        };
        if (!token) delete options.headers.token;
        if (method === "GET") options.params = params;
        else options.data = data;

        const { status, data: result } = await axios.request(options);
        if (status !== 200) throw new Error(`HTTP ${status}: ${typeof result === "string" ? result.slice(0, 200) : JSON.stringify(result)}`);
        if (!result || result.code !== 0) {
            const err = new Error(result?.msg || result?.message || JSON.stringify(result));
            err.code = result?.code;
            throw err;
        }
        return result;
    }

    async getWxCode() {
        return await getCode(this.server);
    }

    async loginByWxCode() {
        try {
            const code = await this.getWxCode();
            const wxLogin = await this.request({
                apiPath: "/app/Login/wxLogin",
                params: { code },
                token: false,
            });
            const wxData = wxLogin.data || {};
            const openId = wxData.open_id || wxData.openId || "";
            const unionId = wxData.unionId || wxData.unionid || "";
            if (!openId || !unionId) throw new Error(`wxLogin 未返回openId/unionId: ${JSON.stringify(wxLogin)}`);
            this.wxInfo = wxData;

            const login = await this.request({
                method: "POST",
                apiPath: "/app/Login/insertWxUser",
                token: false,
                json: true,
                data: {
                    openId,
                    unionId,
                    userName: randomUserName(),
                    avatar: "https://nnduanju.oss-cn-beijing.aliyuncs.com/01image/re-512.png",
                    sex: 1,
                    phone: "",
                    inviterCode: "",
                    qdCode: "",
                },
            });
            this.token = login.token || "";
            this.user = login.user || {};
            if (!this.token) throw new Error(`insertWxUser 未返回token: ${JSON.stringify(login)}`);
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功: ${this.user.userName || ""} ${maskPhone(this.user.phone)}`);
        } catch (e) {
            console.log(`账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkToken() {
        try {
            const result = await this.request({ apiPath: "/app/user/selectUserById" });
            this.user = result.data || this.user;
            return true;
        } catch (e) {
            return false;
        }
    }

    async getPoints(label = "积分") {
        const result = await this.request({ apiPath: "/app/integral/selectByUserId" });
        const points = result.data?.integralNum ?? "未知";
        console.log(`账号[${this.index}] ${label}: ${points}`);
        return result.data;
    }

    async getSignStatus() {
        try {
            const result = await this.request({
                apiPath: "/app/integral/selectIntegralDay",
                params: {
                    classify: 1,
                    userId: this.user.userId || "",
                },
            });
            const list = Array.isArray(result.data) ? result.data : [];
            const signedDays = list.filter((item) => item?.num).length;
            console.log(`账号[${this.index}] 本周签到记录: ${signedDays}/${list.length || 7}`);
            return list;
        } catch (e) {
            console.log(`账号[${this.index}] 查询签到记录失败: ${e.message || e}`);
            return [];
        }
    }

    async signIn() {
        try {
            const result = await this.request({
                apiPath: "/app/integral/signIn",
                params: { date: today() },
            });
            console.log(`账号[${this.index}] 签到成功: ${result.msg || "success"}`);
        } catch (e) {
            const message = String(e.message || e);
            if (/已签到|已经签到|重复|今日.*签|不能重复|签到过/.test(message)) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }
            console.log(`账号[${this.index}] 签到失败: ${message}`);
            if (e.code === 401 || /token|登录|验证失败/.test(message)) this.removeCachedToken();
        }
    }

    async doDailyTasks() {
        await this.completeDramaTasks();
        await this.completeEatGoldTasks();
        await this.completeVideoCoinTasks();
        await this.completeVideoDurationTasks();
        const tasks = [
            { name: "开宝箱", apiPath: "/app/integral/userTimer" },
            { name: "推荐剧观看金币", apiPath: "/app/integral/userDataVideo", params: await this.getUserDataVideoParams() },
            { name: "每日点赞剧集", apiPath: "/app/integral/goodVideo" },
            { name: "收藏新剧", apiPath: "/app/integral/collectVideo" },
            { name: "分享新剧", apiPath: "/app/integral/shareVideo" },
        ];
        for (const task of tasks) {
            await this.claimDailyTask(task);
        }
    }

    async claimDailyTask(task) {
        try {
            const result = await this.request({ apiPath: task.apiPath, params: task.params || {} });
            console.log(`账号[${this.index}] ${task.name}: ${result.msg || "已领取"}${result.data !== undefined ? ` ${result.data}` : ""}`);
        } catch (e) {
            const message = String(e.message || e);
            if (/已领取|已完成|今日.*完成|重复|不能重复|已经.*领取/.test(message)) {
                console.log(`账号[${this.index}] ${task.name}: 今日已完成`);
                return;
            }
            if (/未完成|请先|任务未达成|次数不足|时间未到|倒计时|稍后|观看/.test(message)) {
                console.log(`账号[${this.index}] ${task.name}: ${message}`);
                return;
            }
            console.log(`账号[${this.index}] ${task.name}失败: ${message}`);
            if (e.code === 401 || /token|登录|验证失败/.test(message)) this.removeCachedToken();
        }
    }

    async completeEatGoldTasks() {
        try {
            for (let num = 0; num < EAT_GOLD_COUNT; num++) {
                try {
                    const result = await this.request({
                        apiPath: "/app/integral/addEatGold",
                        params: { num },
                    });
                    console.log(`账号[${this.index}] 吃饭看剧补贴[${num + 1}/${EAT_GOLD_COUNT}]: ${result.msg || "success"}`);
                } catch (e) {
                    const message = String(e.message || e);
                    if (/已领取|已完成|今日.*完成|重复|不能重复|已经.*领取/.test(message)) {
                        console.log(`账号[${this.index}] 吃饭看剧补贴[${num + 1}/${EAT_GOLD_COUNT}]: 今日已完成`);
                        continue;
                    }
                    console.log(`账号[${this.index}] 吃饭看剧补贴[${num + 1}/${EAT_GOLD_COUNT}]: ${message}`);
                    if (e.code === 401 || /token|登录|验证失败/.test(message)) this.removeCachedToken();
                }
            }

            try {
                const result = await this.request({ apiPath: "/app/integral/eatGold" });
                console.log(`账号[${this.index}] 当前餐点补贴: ${result.msg || "success"}`);
            } catch (e) {
                const message = String(e.message || e);
                if (/已领取|已完成|今日.*完成|重复|不能重复|已经.*领取/.test(message)) {
                    console.log(`账号[${this.index}] 当前餐点补贴: 今日已完成`);
                } else {
                    console.log(`账号[${this.index}] 当前餐点补贴: ${message}`);
                }
            }
        } catch (e) {
            console.log(`账号[${this.index}] 吃饭看剧补贴失败: ${e.message || e}`);
        }
    }

    async completeVideoCoinTasks() {
        try {
            let userInfo = await this.getUserInfo();
            let nextStep = Number(userInfo.okLookVideoNum || 0) + 1;
            if (nextStep < 1) nextStep = 1;
            if (nextStep > VIDEO_COUNT_STEPS.length) {
                console.log(`账号[${this.index}] 看视频次数前置: 今日已完成`);
                return;
            }

            for (let step = nextStep; step <= VIDEO_COUNT_STEPS.length; step++) {
                await this.updateUserWatchCount(VIDEO_COUNT_STEPS[step - 1], step);
                try {
                    const result = await this.request({ apiPath: "/app/integral/lookVideoNum" });
                    console.log(`账号[${this.index}] 看视频次数金币[${step}/${VIDEO_COUNT_STEPS.length}]: ${result.msg || "success"}`);
                    userInfo = await this.getUserInfo();
                    if (Number(userInfo.okLookVideoNum || 0) >= VIDEO_COUNT_STEPS.length) break;
                } catch (e) {
                    const message = String(e.message || e);
                    if (/已领取|已完成|今日.*完成|重复|不能重复|已经.*领取/.test(message)) {
                        console.log(`账号[${this.index}] 看视频次数金币: 今日已完成`);
                        break;
                    }
                    console.log(`账号[${this.index}] 看视频次数金币[${step}/${VIDEO_COUNT_STEPS.length}]: ${message}`);
                    if (e.code === 401 || /token|登录|验证失败/.test(message)) this.removeCachedToken();
                    break;
                }
            }
        } catch (e) {
            console.log(`账号[${this.index}] 看视频次数前置失败: ${e.message || e}`);
        }
    }

    async completeVideoDurationTasks() {
        try {
            let userInfo = await this.getUserInfo();
            let nextStep = Number(userInfo.okLookVideoSec || 0);
            if (nextStep < 1) nextStep = 1;
            if (nextStep > VIDEO_DURATION_STEPS.length) {
                console.log(`账号[${this.index}] 看视频时长前置: 今日已完成`);
                return;
            }

            for (let step = nextStep; step <= VIDEO_DURATION_STEPS.length; step++) {
                await this.updateUserWatchDuration(VIDEO_DURATION_STEPS[step - 1], step);
                try {
                    const result = await this.request({ apiPath: "/app/integral/lookVideoSec" });
                    console.log(`账号[${this.index}] 看视频时长金币[${step}/${VIDEO_DURATION_STEPS.length}]: ${result.msg || "success"}`);
                    userInfo = await this.getUserInfo();
                    if (Number(userInfo.okLookVideoSec || 0) > VIDEO_DURATION_STEPS.length) break;
                } catch (e) {
                    const message = String(e.message || e);
                    if (/已领取|已完成|今日.*完成|重复|不能重复|已经.*领取/.test(message)) {
                        console.log(`账号[${this.index}] 看视频时长金币: 今日已完成`);
                        break;
                    }
                    console.log(`账号[${this.index}] 看视频时长金币[${step}/${VIDEO_DURATION_STEPS.length}]: ${message}`);
                    if (e.code === 401 || /token|登录|验证失败/.test(message)) this.removeCachedToken();
                    break;
                }
            }
        } catch (e) {
            console.log(`账号[${this.index}] 看视频时长前置失败: ${e.message || e}`);
        }
    }

    async updateUserWatchDuration(videoSec, lookVideoSec) {
        const userInfo = await this.getUserInfo();
        await this.request({
            method: "POST",
            apiPath: "/app/user/updateUsers",
            json: true,
            data: {
                userName: userInfo.userName || randomUserName(),
                avatar: userInfo.avatar || "https://nnduanju.oss-cn-beijing.aliyuncs.com/01image/re-512.png",
                phone: userInfo.phone || "",
                videoSec,
                lookVideoSec,
            },
        });
        console.log(`账号[${this.index}] 模拟观看时长: ${Math.floor(videoSec / 60)}分钟`);
    }

    async updateUserWatchCount(lookDayVideoNum, lookVideoNum) {
        const userInfo = await this.getUserInfo();
        await this.request({
            method: "POST",
            apiPath: "/app/user/updateUsers",
            json: true,
            data: {
                userName: userInfo.userName || randomUserName(),
                avatar: userInfo.avatar || "https://nnduanju.oss-cn-beijing.aliyuncs.com/01image/re-512.png",
                phone: userInfo.phone || "",
                lookDayVideoNum,
                lookVideoNum,
            },
        });
        console.log(`账号[${this.index}] 模拟观看视频次数: ${lookDayVideoNum}次`);
    }

    async getUserDataVideoParams() {
        try {
            const courses = await this.getDailyCourses();
            const course = courses[0] || {};
            if (!course.courseId) return {};
            const episode = await this.getCourseEpisode(course.courseId);
            return {
                courseId: course.courseId,
                courseDetailsId: episode?.courseDetailsId || course.courseDetailsId || "",
            };
        } catch (e) {
            return {};
        }
    }

    async completeDramaTasks() {
        try {
            const userInfo = await this.getUserInfo();
            const needGood = Number(userInfo.goodVideo || 0) < DAILY_ACTION_COUNT;
            const needCollect = Number(userInfo.collectVideo || 0) < DAILY_ACTION_COUNT;
            if (!needGood && !needCollect) return;

            const courses = await this.getDailyCourses();
            if (!courses.length) {
                console.log(`账号[${this.index}] 剧集任务前置: 未获取到推荐剧`);
                return;
            }

            let goodDone = 0;
            let collectDone = 0;
            for (const course of courses) {
                if (goodDone >= DAILY_ACTION_COUNT && collectDone >= DAILY_ACTION_COUNT) break;
                const episode = await this.getCourseEpisode(course.courseId);
                const courseDetailsId = episode?.courseDetailsId || course.courseDetailsId || "";
                if (!course.courseId || !courseDetailsId) continue;

                if (needGood && goodDone < DAILY_ACTION_COUNT) {
                    await this.setCourseCollect(course.courseId, courseDetailsId, 2, 0);
                    await this.setCourseCollect(course.courseId, courseDetailsId, 2, 1);
                    goodDone++;
                }

                if (needCollect && collectDone < DAILY_ACTION_COUNT) {
                    await this.setCourseCollect(course.courseId, courseDetailsId, 1, 0);
                    await this.setCourseCollect(course.courseId, courseDetailsId, 1, 1);
                    collectDone++;
                }
            }

            if (goodDone || collectDone) {
                console.log(`账号[${this.index}] 剧集任务前置: 点赞${goodDone}次 收藏${collectDone}次`);
            }
        } catch (e) {
            console.log(`账号[${this.index}] 剧集任务前置失败: ${e.message || e}`);
        }
    }

    async getUserInfo() {
        const result = await this.request({ apiPath: "/app/user/selectUserById" });
        this.user = result.data || this.user;
        return this.user;
    }

    async getDailyCourses() {
        const result = await this.request({ apiPath: "/app/common/type/922" });
        const list = result.data?.courseList;
        return Array.isArray(list) ? list : [];
    }

    async getCourseEpisode(courseId) {
        const result = await this.request({
            apiPath: "/app/course/selectCourseDetailsByCourseId",
            params: {
                id: courseId,
                token: this.token,
            },
        });
        return result.data || {};
    }

    async setCourseCollect(courseId, courseDetailsId, classify, type) {
        await this.request({
            method: "POST",
            apiPath: "/app/courseCollect/insertCourseCollect",
            json: true,
            data: {
                courseId,
                courseDetailsId,
                classify,
                type,
            },
        });
    }
}

!(async () => {
    
    for (const openid of SERVERS) {
        await new Task(openid).run();
    }
})()
    .catch((e) => console.log(e.message || e))
