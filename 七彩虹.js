// name: 七彩虹签到
// cron: 30 10 * * *

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
        if (url.includes('/wxapp/')) {
            if (url.startsWith('http://')) ;
            if (yybAuth) {
                config.headers = config.headers || {};
                config.headers.Authorization = yybAuth;
            }
        }
        return config;
    });
})();
function buildYybAuthHeaders() {
    const token = process.env.YYB_TOKEN;
    if (token) return { Authorization: `Bearer ${token}` };
    const user = process.env.YYB_USER;
    const pass = process.env.YYB_PASS;
    if (user && pass) return { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` };
    return {};
}
// === YYB 协议统一认证 end ===
const crypto = require("crypto");
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
async function getCode(serverEntry) {
    const { server, ref } = parseYybGoEntry(serverEntry);
    if (!server || !ref) return null;
    const url = "http://" + server + "/wxapp/getCode";
    const who = yybDisplay(serverEntry);
    try {
        const { data } = await axios.post(url, { ref, app_id: MINI_APP_ID }, { timeout: 20000, proxy: false });
        const code = data && data.data && data.data.result && data.data.result.code;
        if (!data || data.code !== 0 || !code) {
            console.log(who + " 获取code失败: " + JSON.stringify(data));
            return null;
        }
        console.log(who + " 获取code成功");
        return code;
    } catch (e) {
        console.log(who + " 获取code异常: " + e.message);
        return null;
    }
}
async function getPhoneCode(serverEntry) {
    const { server, ref } = parseYybGoEntry(serverEntry);
    if (!server || !ref) return null;
    const url = "http://" + server + "/wxapp/getPhoneNumber";
    const who = yybDisplay(serverEntry);
    try {
        const { data } = await axios.post(url, { ref, app_id: MINI_APP_ID }, { timeout: 20000, proxy: false });
        const code = data && data.data && data.data.result && data.data.result.code;
        if (!data || data.code !== 0 || !code) {
            console.log(who + " 获取手机号code失败: " + JSON.stringify(data));
            return null;
        }
        console.log(who + " 获取手机号code成功");
        return code;
    } catch (e) {
        console.log(who + " 获取手机号code异常: " + e.message);
        return null;
    }
}

// ====================== 业务常量 ======================
const MINI_APP_ID = "wx49018277e65fc3e1";
const PAGE_VERSION = "92";
const API_BASE = "https://interface.skycolorful.com";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "qch_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const LIKE_DAILY_LIMIT = 5;
const BBS_MODULE_ID = "09539c50-6de2-4a0c-adc8-535e488a419e";
const defaultUserAgent =
    "Mozilla/5.0 (Linux; Android 16; 2308CPXD0C Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.178 Mobile Safari/537.36 XWEB/1460217 MMWEBSDK/20260202 MMWEBID/6435 MicroMessenger/8.0.70.3060(0x28004652) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 MiniProgramEnv/android";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function randomDelay(minSec, maxSec) {
    const sec = Math.random() * (maxSec - minSec) + minSec;
    await sleep(sec * 1000);
}
function md5(str) { return crypto.createHash("md5").update(str).digest("hex"); }
function isTokenError(message) {
    return /401|403|token|登录|授权|未登录|无效|过期|失效/i.test(String(message || ""));
}
function isSuccess(result) {
    return Number(result?.Code) === 0 && result?.Success !== false;
}
function shortToken(token = "") {
    const v = String(token || "").replace(/^Bearer\s+/i, "");
    return v ? `${v.slice(0, 6)}***${v.slice(-6)}` : "";
}
function maskPhone(phone = "") {
    return String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

// ========== Token 缓存 ==========
function readTokenCache() {
    try {
        if (!fs.existsSync(TOKEN_CACHE_FILE)) return {};
        return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf8")) || {};
    } catch (e) { return {}; }
}
function writeTokenCache(cache) {
    try { fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8"); }
    catch (e) { console.log("写入token缓存失败: " + (e.message || e)); }
}

let userIdx = 1;

class Task {
    constructor(serverEntry) {
        this.serverEntry = serverEntry;
        const { ref } = parseYybGoEntry(serverEntry);
        this.ref = ref;
        const _seq = userIdx++;
        const _disp = yybDisplay(serverEntry);
        this.index = (_disp && _disp !== serverEntry) ? _disp : _seq;
        this.token = "";
        this.refreshToken = "";
        this.openId = "";
        this.userInfo = {};
        this.signStatus = false;
        this.likeCount = 0;
    }

    cacheKey() { return this.ref; }

    async run() {
        const cached = this.getCachedToken();
        if (cached?.token) {
            this.applyToken(cached);
            console.log(`【七彩虹】账号[${this.index}] 使用缓存token: ${shortToken(this.token)}`);
            if (!(await this.checkToken())) {
                this.removeCachedToken();
                console.log(`【七彩虹】账号[${this.index}] 缓存token失效，重新登录`);
            }
        }

        if (!this.token) {
            await this.loginByWxCode();
            if (!this.token) return;
        }

        await this.getUserInfo();
        await this.getSignInfo();
        await randomDelay(3, 5);

        if (this.signStatus) {
            console.log(`【七彩虹】账号[${this.index}] 今日已签到`);
        } else {
            await this.signInV2();
        }

        await this.doLikeTask();
    }

    getCachedToken() {
        const cache = readTokenCache();
        return cache[this.cacheKey()] || null;
    }

    saveCachedToken() {
        if (!this.token) return;
        const cache = readTokenCache();
        cache[this.cacheKey()] = {
            token: this.token,
            refreshToken: this.refreshToken,
            openId: this.openId,
            userInfo: this.userInfo,
            updatedAt: new Date().toISOString(),
        };
        writeTokenCache(cache);
    }

    removeCachedToken() {
        const cache = readTokenCache();
        if (cache[this.cacheKey()]) {
            delete cache[this.cacheKey()];
            writeTokenCache(cache);
        }
        this.token = "";
        this.refreshToken = "";
        this.userInfo = {};
    }

    applyToken(data = {}) {
        this.token = data.token || "";
        this.refreshToken = data.refreshToken || "";
        this.openId = data.openId || this.openId;
        this.userInfo = data.userInfo || {};
    }

    signedHeaders(extra = {}, auth = true) {
        const appid = "815d8026-9a52-4445-a42c-a5443134232e";
        const requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        const ticks = Date.now();
        const headers = {
            "User-Agent": defaultUserAgent,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Content-Type": "application/json",
            "charset": "utf-8",
            "requestId": requestId,
            "AppId": appid,
            "Ticks": String(ticks),
            "Sign": md5(appid + ticks + requestId + "2b5c01fb-7640-401a-8188-43a13190a626"),
            "source": "Wx",
            "UcSource": "30",
            "User-from": "xcx",
            "version": "2.0.0",
            "xweb_xhr": "1",
            ...extra,
        };
        if (auth) {
            headers.Authorization = this.token ? `Bearer ${this.token}` : "";
            headers["X-Authorization"] = this.refreshToken ? `Bearer ${this.refreshToken}` : "";
        }
        return headers;
    }

    async request(apiPath, { method = "GET", data, params, auth = true } = {}) {
        const options = {
            method,
            url: new URL(apiPath, API_BASE).toString(),
            params,
            headers: this.signedHeaders({}, auth),
            timeout: 15000,
            validateStatus: () => true,
        };
        if (data !== undefined) options.data = data;
        const { data: result, status, headers } = await axios.request(options);
        if (headers?.["access-token"]) this.token = headers["access-token"];
        if (headers?.["x-access-token"]) this.refreshToken = headers["x-access-token"];
        if (status === 401 || status === 403) throw new Error(`HTTP ${status}: ${result?.Message || JSON.stringify(result)}`);
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        if (!isSuccess(result)) throw new Error(`${result?.Code ?? ""} ${result?.Message || result?.msg || JSON.stringify(result)}`.trim());
        if (this.token) this.saveCachedToken();
        return result;
    }

    async loginByWxCode() {
        try {
            const wxCode = await getCode(this.serverEntry);
            if (!wxCode) throw new Error("获取wx code失败");
            const loginRes = await this.request("/api/User/OnLogin", {
                method: "POST", auth: false, data: { Code: wxCode },
            });
            this.openId = loginRes?.Data?.OpenId || "";
            if (!this.openId) throw new Error("OnLogin未返回OpenId");

            await sleep(1000);

            const phoneCode = await getPhoneCode(this.serverEntry);
            if (!phoneCode) throw new Error("获取手机号code失败");
            const phoneRes = await this.request("/api/User/DecryptPhoneNumber", {
                method: "POST", auth: false, data: { OpenId: this.openId, Code: phoneCode },
            });

            const token = phoneRes?.Data?.Token || "";
            const refreshToken = phoneRes?.Data?.RefreshToken || "";
            if (!token) throw new Error("DecryptPhoneNumber未返回Token");

            this.token = token;
            this.refreshToken = refreshToken;
            this.saveCachedToken();
            console.log(`【七彩虹】账号[${this.index}] 登录成功: ${shortToken(this.token)}`);
        } catch (e) {
            console.log(`【七彩虹】账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkToken() {
        try {
            await this.request("/api/User/RefreshLoginTime", { method: "POST", data: { phone: "" } });
            return true;
        } catch (e) { return false; }
    }

    async signInV2() {
        try {
            const result = await this.request("/api/User/SignV2", { method: "POST", data: {} });
            console.log(`【七彩虹】🌸账号[${this.index}]🕊签到${result.Message || "成功"}🎉`);
        } catch (e) {
            const message = String(e.message || e);
            if (/已签到|已签|重复/.test(message)) {
                console.log(`【七彩虹】🌸账号[${this.index}] 今日已签到`);
                return;
            }
            console.log(`【七彩虹】🌸账号[${this.index}] 签到失败:${message}❌`);
            if (isTokenError(message)) this.removeCachedToken();
        }
    }

    async getSignInfo() {
        try {
            const result = await this.request("/api/User/IsSignV2");
            this.signStatus = Boolean(result?.Data?.IsSign);
        } catch (e) {
            const message = String(e.message || e);
            console.log(`【七彩虹】账号[${this.index}] 查询签到状态失败: ${message}`);
            if (isTokenError(message)) this.removeCachedToken();
        }
    }

    async getUserInfo() {
        try {
            const result = await this.request("/api/User/GetUserInfo");
            this.userInfo = result?.Data || {};
            this.saveCachedToken();
            console.log(`【七彩虹】🌸账号[${this.index}]昵称:${this.userInfo.NickName || maskPhone(this.userInfo.Mobile) || "未知"} 积分:${this.userInfo.Point ?? "未知"}`);
        } catch (e) {
            const message = String(e.message || e);
            console.log(`【七彩虹】账号[${this.index}] 查询用户失败: ${message}`);
            if (isTokenError(message)) this.removeCachedToken();
        }
    }

    async getPostingList(page = 1, size = 10) {
        try {
            const result = await this.request("/api/Bbs/GetPostingList", {
                method: "GET",
                params: { Page: page, Size: size, ModuleId: BBS_MODULE_ID, SubClassId: "    ", IsNewest: true, IsEssence: false, SearchValue: "" },
            });
            return result?.Data?.DataList || [];
        } catch (e) {
            const message = String(e.message || e);
            console.log(`【七彩虹】账号[${this.index}] 获取帖子列表失败: ${message}`);
            if (isTokenError(message)) this.removeCachedToken();
            return [];
        }
    }

    async likePost(postId) {
        try {
            const result = await this.request("/api/Bbs/Like", {
                method: "POST", data: { postId: String(postId), postReplyId: "0" },
            });
            return { success: true, message: result.Message || "点赞成功" };
        } catch (e) {
            const message = String(e.message || e);
            if (/已点赞|重复|已经|不能|今日/.test(message)) return { success: false, repeated: true, message };
            if (isTokenError(message)) this.removeCachedToken();
            return { success: false, message };
        }
    }

    async doLikeTask() {
        console.log(`【七彩虹】👍账号[${this.index}] 开始社区点赞任务（每日上限${LIKE_DAILY_LIMIT}次，每次2积分）`);
        let page = 1;
        let totalLiked = 0;
        const maxPages = 5;

        while (totalLiked < LIKE_DAILY_LIMIT && page <= maxPages) {
            const posts = await this.getPostingList(page, 10);
            if (!posts.length) {
                console.log(`【七彩虹】👍账号[${this.index}] 第${page}页无更多帖子，停止点赞`);
                break;
            }
            for (const post of posts) {
                if (totalLiked >= LIKE_DAILY_LIMIT) break;
                const postId = post.Id || "";
                const title = post.Title || "未知标题";
                if (!postId) continue;
                if (post.IsLike === true) continue;
                await randomDelay(3, 5);
                const result = await this.likePost(postId);
                if (result.success) {
                    totalLiked++;
                    console.log(`【七彩虹】👍账号[${this.index}] 点赞成功(${totalLiked}/${LIKE_DAILY_LIMIT}): ${title.slice(0, 20)}`);
                } else if (result.repeated) {
                    continue;
                } else {
                    console.log(`【七彩虹】👍账号[${this.index}] 点赞失败: ${result.message}`);
                }
            }
            page++;
        }

        this.likeCount = totalLiked;
        if (totalLiked >= LIKE_DAILY_LIMIT) {
            console.log(`【七彩虹】✅账号[${this.index}] 今日点赞已达上限 ${LIKE_DAILY_LIMIT} 次，获得 ${LIKE_DAILY_LIMIT * 2} 积分`);
        } else {
            console.log(`【七彩虹】👍账号[${this.index}] 本轮共点赞 ${totalLiked} 次，获得 ${totalLiked * 2} 积分`);
        }
    }
}

// ========== 主入口 ==========
(async () => {
    console.log(`【七彩虹】读取到 ${SERVERS.length} 个 YYB Go 账号`);
    for (let i = 0; i < SERVERS.length; i++) {
        try {
            await new Task(SERVERS[i]).run();
        } catch (e) {
            console.log(`【七彩虹】账号执行异常: ${e.message || e}`);
        }
        if (i < SERVERS.length - 1) {
            const delaySec = Math.floor(Math.random() * (15 - 7 + 1)) + 7;
            console.log(`【七彩虹】⏳ 等待 ${delaySec} 秒后切换下一个账号...`);
            await sleep(delaySec * 1000);
        }
    }
    console.log("【七彩虹】任务执行完毕");
})().catch(e => console.log(e));
