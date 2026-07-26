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


// name: 米其林会员
// cron: 31 9 * * *

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
        const { data } = await axios.post(url, { ref, app_id: 'wx14413dafd16b9540' }, { timeout: 20000, proxy: false });
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
        this.token = 'Bearer ' + this.token
        await this.getUserInfo()
        await this.doPaper()
        for (let i = 0; i < 10; i++) {
            await this.share();
        }
    }
    async share() {
        const options = {
            method: 'POST',
            url: `https://ulp.michelin.com.cn/op/points/share/have`,
            headers: {
                "Host": "ulp.michelin.com.cn",
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.31(0x18001f37) NetType/WIFI Language/zh_CN",
                "Authorization": this.token,
            },
            data: { "type": "ARTICLE", "code": "COM-MHT-93" }
        };
        //post方法
        let { data: result } = await axios.request(options);

        console.log(`转发:${result?.code != 200 ? "转发失败" + result?.message : "转发成功!"}`)
    }
    async getUserToken(code) {
        let options = {
            method: 'GET',
            url: `https://ulp.michelin.com.cn/bff/wechat/login/${code}`,
            headers: {
                "Host": "ulp.michelin.com.cn",
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.31(0x18001f37) NetType/WIFI Language/zh_CN",
                "Referer": "https://servicewechat.com/wx14413dafd16b9540/130/page-frame.html"
            }

        }
        let {
            data: result
        } = await axios.request(options);

        this.token = result?.data?.token?.access_token;
        console.log(`🌸账号[${this.index}] 获取用户Token成功:${this.token}`)

    }

    async getUserInfo() {
        try {
            let { data: result } = await axios.request({
                method: 'GET',
                url: `https://ulp.michelin.com.cn/bff/profile`,
                headers: {
                    "Host": "ulp.michelin.com.cn",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781 NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF XWEB/50249",
                    "Authorization": this.token,
                }
            });

            if (result?.data?.points) {
                console.log(`账号[${this.index}] 获取用户积分成功:${result?.data?.points}`)
            } else {
                console.log(`账号[${this.index}] 获取用户积分失败❌`)
            }

        } catch (e) {
            this.ckStatus = false;
            console.log(`❌查询积分失败！原因为:${e}`);
        }
    }
    async doPaper() {
        //获取问卷
        await this.getPaper();
        //是否已完成问卷
        if (this.paperStatus) {
            //获取本期问卷题目
            await this.getOpenTpaper(this.npsPaperCode);
            let index = 1;
            for (let question of this.questionList) {
                console.log(`问题${index}:${question?.questionChoise?.stemHtml}\n`);
                let options = question?.questionChoise.options;
                for (let option of options) {
                    console.log(`- ${option.optionHtml}`);
                }
                let theQuestion = question.questionChoise.npsQuestionPk;
                //查找对应题目答案
                let detail = this.stdAnswers.find(answer => theQuestion == answer.npsQuestionChoisePk) || {};
                let answer = options.find(o => o.npsQuestionChoiseOptionPk == detail.npsQuestionChoiseOptionPk);
                if (!answer) answer = options[0]; // 如果没有找到匹配的答案，默认选择第一个选项
                //提交答案
                let answerRes = await this.answer(theQuestion, answer?.npsQuestionChoiseOptionPk);
                console.log(`\n答案: ${answer.optionHtml} => ${answerRes}`);
            }
            //提交问卷
            await this.paperScore(this.paperCode);
        } else {
            console.log(`答题任务:本周奖励领取已达到上限，跳过执行`);
        }
    }

    //获取本期答卷
    async getPaper() {

        const options = {
            method: 'POST',
            url: `https://ulp.michelin.com.cn/campaign/paper/user`,
            headers: {
                "Host": "ulp.michelin.com.cn",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781 NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF XWEB/50249",
                "Authorization": this.token,
            },
            data: {}
        };

        let { data: result } = await axios.request(options);
        if (result?.code == 200) {
            console.log(`帐号[${this.index}]本次调查问卷为${result?.data?.npsPaperCode}，总共${result?.data?.questionNum}道题目,状态为${result?.data?.status}`);
            //如果已经答题，则跳过执行答题任务
            if (result?.data?.status == 'DONE') this.paperStatus = false;
            //获取本期问卷期数
            this.npsPaperCode = result?.data?.npsPaperCode;
            //获取本期问卷验证编号
            this.paperCode = result?.data?.paperCode;
        } else {
            this.ckStatus = false;
        }

    }
    //获取问卷题目
    async getOpenTpaper(npsPaperCode) {

        let options = {
            method: 'GET',
            url: `https://ulp.michelin.com.cn/npspaper/nps-admin/open/api/cp/public/get_open_tpaper/${npsPaperCode}`,
            headers: {
                "Host": "ulp.michelin.com.cn",
                "User-Agent": "",
                "Authorization": this.token,
            }
        }

        //post方法
        let result = await axios.request(options);
        if (result?.success) {
            //答案
            this.stdAnswers = result?.data?.stdAnswers;
            //题目
            this.questionList = result?.data?.questionList;
        } else {
            console.log(`🔴帐号[${this.index}]获取问卷列表失败！${result?.message}`)
        }

    }

    async answer(question, answer) {
        try {
            const options = {
                url: `https://ulp.michelin.com.cn/campaign/paper/user/answer`,
                method: 'POST',
                headers: {
                    "Host": "ulp.michelin.com.cn",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781 NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF XWEB/50249",
                    "Authorization": this.token,
                },
                data: { "answerOptionId": [`${answer}`], "paperCode": `${this.paperCode}`, "questionId": `${question}` }
            };
            //post方法
            let { data: result } = await axios.request(options);
            return result?.code == 200 ? "回答成功！" : `回答失败！${result?.message}`
        } catch (e) {
            console.log(`❌回答问题失败！原因为:${e}`);
        }
    }

    async paperScore(paperCode) {
        try {
            const options = {
                url: `https://ulp.michelin.com.cn/campaign/paper/score/${paperCode}`,
                data: {}
            };
            //post方法
            let { data: res } = await axios.request(options);
            console.log(`提交问卷:本期问卷正确率为${res?.data?.score}%,排名${res.data.rank}`);
        } catch (e) {
            console.log(`❌提交问卷失败！原因为:${e}`);
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
    


