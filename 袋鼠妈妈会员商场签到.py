# === YYB_GO 统一通知注入 begin ===
import os as __os, sys as __sys, io as __io, atexit as __atexit, re as __re
import base64
_yyb_logs = []
class __LogHook(__io.TextIOBase):
    def __init__(self, s): self._s = s
    def write(self, s):
        if s and s != '\n': _yyb_logs.append(s.rstrip('\n'))
        self._s.write(s); return len(s)
    def flush(self): self._s.flush()
if not isinstance(__sys.stdout, __LogHook): __sys.stdout = __LogHook(__sys.stdout)
if not isinstance(__sys.stderr, __LogHook): __sys.stderr = __LogHook(__sys.stderr)

__pushed = False
def __push():
    global __pushed
    if __pushed: return
    try:
        body = '\n'.join(_yyb_logs[-40:])
        title = __os.path.basename(__sys.argv[0]) if __sys.argv else 'YYB_GO'
        sn = None
        try:
            from sendNotify import sendNotify as _sn
            sn = _sn
        except Exception:
            sn = None
        if sn and callable(sn):
            try: sn(title, body); return
            except Exception: pass
        key = __resolve_key()
        if key:
            import json as __json, urllib.request as __ur
            data = __json.dumps({'msgtype':'text','text':{'content':f'【{title}】\n{body}'}}).encode('utf-8')
            req = __ur.Request(f'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={key}', data=data, headers={'Content-Type':'application/json'})
            __ur.urlopen(req, timeout=15)
    except Exception:
        pass
    __pushed = True

def __resolve_key():
    k = __os.environ.get('QYWX_KEY') or __os.environ.get('QYWX') or __os.environ.get('WEWORK_KEY')
    if k: return k
    for cand in ('sendNotify.js', '/ql/data/scripts/sendNotify.js'):
        try:
            t = open(cand, encoding='utf-8').read()
            m = __re.search(r"QYWX_KEY\s*=\s*'([^']+)'", t)
            if not m:
                m = __re.search(r'QYWX_KEY\s*=\s*"([^"]+)"', t)
            if m: return m.group(1)
        except Exception:
            pass
    return None

# 自然退出 / sys.exit 走 atexit；os._exit 绕过 atexit，单独拦截
__orig_os_exit = __os._exit
def __patched_os_exit(code=0):
    global __pushed
    if __pushed:
        return __orig_os_exit(code)
    __pushed = True
    try: __push()
    except Exception: pass
    return __orig_os_exit(code)
try: __os._exit = __patched_os_exit
except Exception: pass

__atexit.register(__push)
# === YYB_GO 统一通知注入 end ===
# === YYB 微信备注映射注入 begin ===
import os as _os_nm
_NAME_MAP = {}
_raw_nm = _os_nm.environ.get("YYB_NAME_MAP", "") or ""
for _line_nm in _raw_nm.replace("&", "\n").splitlines():
    _line_nm = _line_nm.strip()
    if "=" in _line_nm:
        _k_nm, _v_nm = _line_nm.split("=", 1)
        _NAME_MAP[_k_nm.strip()] = _v_nm.strip()

def yyb_display(entry):
    if not entry:
        return entry
    _ref = entry.split("@", 1)[1] if "@" in entry else entry
    return _NAME_MAP.get(_ref, entry)
# === YYB 微信备注映射注入 end ===


# name: 袋鼠妈妈会员商场签到
# cron: 0 20 12 * * *
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
袋鼠妈妈会员商场小程序签到脚本
参考铛铛一下的结构，使用code获取token
支持多个服务器、PlusPlus推送、Pinzuan代理
"""

import json
import os
import random
import time
import traceback
from datetime import datetime
from typing import Any, Dict, List, Tuple
from urllib.parse import quote

import requests

# === YYB 协议统一认证（自动 https + Basic/Bearer） begin ===
import base64
_yyb_token = os.environ.get("YYB_TOKEN", "")
_yyb_user = os.environ.get("YYB_USER", "")
_yyb_pass = os.environ.get("YYB_PASS", "")
_yyb_auth = None
if _yyb_token:
    _yyb_auth = f"Bearer {_yyb_token}"
elif _yyb_user and _yyb_pass:
    _yyb_auth = "Basic " + base64.b64encode(f"{_yyb_user}:{_yyb_pass}".encode()).decode()
if _yyb_auth:
    _orig_requests_post = requests.post
    def _yyb_requests_post(url, *args, **kwargs):
        if isinstance(url, str) and "/wxapp/getCode" in url:
            kwargs.setdefault("headers", {})
            kwargs["headers"]["Authorization"] = _yyb_auth
        return _orig_requests_post(url, *args, **kwargs)
    requests.post = _yyb_requests_post
# === YYB 协议统一认证 end ===


APP_NAME = "袋鼠妈妈会员商场小程序"
APPID = "wxb27b46293d405a20"
KDT_ID = "44587018"
CHECKIN_ID = "17019"

# 从环境变量 YYB_GO 读取内网 IP，多个 IP 用换行或&分隔
SERVERS = [
    s.strip()
    for s in os.getenv("YYB_GO", "").replace("&", "\n").splitlines()
    if s.strip()
]

if not SERVERS:
    print("❌ 未配置环境变量 YYB_GO，请设置后重试")
    print("格式示例：")
    print("  YYB_GO=127.0.0.1:8088")
    print("  或")
    print("  YYB_GO=127.0.0.1:8088\\n192.168.31.36:8088\\n192.168.31.88:8088")
    exit(1)

PLUSPLUS_TOKEN = os.getenv("PLUSPLUS_TOKEN", "")
PROXY_API = os.getenv("PROXY_API", "")
PROXY_TYPE = os.getenv("PROXY_TYPE", "http").lower()

PROXY_RETRY_TIMES = 3
PROXY_VALIDATE_URL = "http://httpbin.org/ip"
PROXY_FETCH_INTERVAL = 3
ENABLE_DIRECT_FALLBACK = True
REQUEST_TIMEOUT = 30

BASE_URL = "https://h5.youzan.com"
LOGIN_URL = f"https://uic.youzan.com/passport/general/auth.json?kdt_id={KDT_ID}&app_id={APPID}"

SIGN_URL = f"{BASE_URL}/wscump/checkin/checkinV2.json"
SIGN_INFO_URL = f"{BASE_URL}/wscump/checkin/check-in-info.json"
ACTIVITY_INFO_URL = f"{BASE_URL}/wscump/checkin/get_activity_by_yzuid_v2.json"
MONTH_SIGN_INFO_URL = f"{BASE_URL}/wscump/checkin/find_checkin_info_by_month.json"
USER_LEVEL_URL = f"{BASE_URL}/retail/h5/user/levelInfo.json"
ASSET_INFO_URL = f"{BASE_URL}/retail/h5/showcase/getAssetInfo.json"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 "
    "MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI "
    "MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) "
    "UnifiedPCWindowsWechat(0xf2541923) XWEB/19899"
)


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def sleep(seconds: float) -> None:
    time.sleep(seconds)


def mask(value: Any) -> str:
    value = str(value or "")
    if len(value) <= 12:
        return value
    return f"{value[:6]}...{value[-6:]}"


def json_preview(data: Any, limit: int = 800) -> str:
    try:
        return json.dumps(data, ensure_ascii=False)[:limit]
    except Exception:
        return str(data)[:limit]


def log_title() -> None:
    print()
    print("╔" + "═" * 50 + "╗")
    print("║ 🦘 袋鼠妈妈会员商场小程序签到脚本 ║")
    print(f"║ 🕒 启动时间: {now_text():<32}║")
    print(f"║ 🔢 账号数量: {len(SERVERS):<34}║")
    print("╚" + "═" * 50 + "╝")


def log_account_header(index: int, total: int, server: str) -> None:
    print()
    print("┌" + "─" * 50 + "┐")
    print(f"│ 🧩 账号 {index} / {total:<37}│")
    print(f"│ 🌍 来源 {server:<40}│")
    print("└" + "─" * 50 + "┘")


def direct_session() -> requests.Session:
    session = requests.Session()
    session.trust_env = False
    return session


def parse_proxy_response(text: Any) -> Dict[str, Any] | None:
    if not isinstance(text, str):
        text = json.dumps(text, ensure_ascii=False)

    text = text.strip()
    if not text:
        return None

    try:
        data = json.loads(text)
        proxy_obj = None

        if isinstance(data.get("data"), list) and data["data"]:
            proxy_obj = data["data"][0]
        elif isinstance(data.get("data"), dict):
            proxy_obj = data["data"]
        elif data.get("ip") and data.get("port"):
            proxy_obj = data
        elif isinstance(data.get("result"), dict):
            proxy_obj = data["result"]

        if proxy_obj:
            host = proxy_obj.get("ip") or proxy_obj.get("host")
            port = proxy_obj.get("port")
            if host and port:
                return {
                    "host": str(host),
                    "port": int(port),
                    "username": proxy_obj.get("user") or proxy_obj.get("username") or "",
                    "password": proxy_obj.get("pass") or proxy_obj.get("password") or "",
                }
    except Exception:
        pass

    if ":" in text:
        parts = text.split(":")
        if len(parts) >= 2:
            return {
                "host": parts[0],
                "port": int(parts[1]),
                "username": parts[2] if len(parts) > 2 else "",
                "password": parts[3] if len(parts) > 3 else "",
            }

    return None


def build_proxy_dict(proxy_info: Dict[str, Any] | None) -> Dict[str, str] | None:
    if not proxy_info:
        return None

    host = proxy_info["host"]
    port = proxy_info["port"]
    username = proxy_info.get("username", "")
    password = proxy_info.get("password", "")

    auth = ""
    if username and password:
        from urllib.parse import quote
        auth = f"{quote(username)}:{quote(password)}@"

    scheme = "socks5" if PROXY_TYPE == "socks5" else "http"
    proxy_url = f"{scheme}://{auth}{host}:{port}"

    print(f"🛠️ [代理] 生成 {scheme.upper()} 代理 {host}:{port}")

    return {
        "http": proxy_url,
        "https": proxy_url,
    }


def validate_proxy(proxies: Dict[str, str] | None) -> Tuple[bool, str]:
    if not proxies:
        return False, ""

    try:
        response = requests.get(PROXY_VALIDATE_URL, proxies=proxies, timeout=15)
        if response.status_code == 200:
            try:
                ip = response.json().get("origin", "未知")
            except Exception:
                ip = "未知"
            print(f"✅ [代理] 验证通过，出口 IP: {ip}")
            return True, ip
    except Exception as exc:
        print(f"⚠️ [代理] 验证失败: {exc}")

    return False, ""


def get_valid_proxy(account_name: str) -> Tuple[Dict[str, str] | None, str]:
    if not PROXY_API:
        print(f"⚠️ [代理] {account_name} 未配置 PROXY_API，使用直连")
        return None, ""

    print(f"🌐 [代理] {account_name} 正在获取品赞代理...")

    for index in range(1, PROXY_RETRY_TIMES + 1):
        try:
            response = direct_session().get(PROXY_API, timeout=15)
            proxy_info = parse_proxy_response(response.text)

            if not proxy_info:
                print(f"⚠️ [代理] 第 {index} 次代理解析失败")
                continue

            print(f"✅ [代理] 提取到 {proxy_info['host']}:{proxy_info['port']}")
            proxies = build_proxy_dict(proxy_info)

            ok, ip = validate_proxy(proxies)
            if ok:
                return proxies, ip

            print(f"⚠️ [代理] 第 {index} 次代理不可用")
        except Exception as exc:
            print(f"⚠️ [代理] 第 {index} 次获取代理异常: {exc}")

        if index < PROXY_RETRY_TIMES:
            sleep(2)

    print("⚠️ [代理] 获取失败，使用直连")
    return None, ""


def request_with_proxy(
    method: str,
    url: str,
    *,
    proxies: Dict[str, str] | None = None,
    server: str = "",
    **kwargs,
) -> requests.Response:
    kwargs.setdefault("timeout", REQUEST_TIMEOUT)

    if proxies:
        try:
            return requests.request(method, url, proxies=proxies, **kwargs)
        except Exception as exc:
            print(f"⚠️ [代理] {server} 代理请求失败: {exc}")
            if not ENABLE_DIRECT_FALLBACK:
                raise
            print("🔁 [兜底] 切换直连重试")

    session = direct_session()
    return session.request(method, url, **kwargs)


def send_pushplus(title: str, content: str) -> None:
    if not PLUSPLUS_TOKEN:
        print("⚠️ [PushPlus] 未配置 PLUSPLUS_TOKEN，跳过推送")
        return

    try:
        requests.post(
            "https://www.pushplus.plus/send",
            json={
                "token": PLUSPLUS_TOKEN,
                "title": title,
                "content": content,
                "template": "txt",
            },
            timeout=10,
        )
        print("✅ [PushPlus] 推送成功")
    except Exception as exc:
        print(f"❌ [PushPlus] 推送失败: {exc}")


def parse_yyb_go_entry(raw_value):
    raw_value = (raw_value or "").strip()
    if not raw_value:
        return None, None

    if "@" not in raw_value:
        print(f"❌ 配置错误：YYB_GO 格式应为 地址@微信账号标识，当前值：{raw_value}")
        return None, None

    server, ref = raw_value.split("@", 1)
    server = server.strip()
    ref = ref.strip()

    if server.startswith("http://"):
        server = server[7:]
    elif server.startswith("https://"):
        server = server[8:]

    server = server.rstrip("/")

    if not server or not ref:
        print(f"❌ 配置错误：YYB_GO 缺少地址或微信账号标识，当前值：{raw_value}")
        return None, None

    return server, ref

def get_code(server: str) -> str | None:
    parsed_server, ref = parse_yyb_go_entry(server)
    if not parsed_server or not ref:
        return None

    url = f"http://{parsed_server}/wxapp/getCode"
    print(f"[{yyb_display(server)}] 请求YYB Go获取code：{url}")

    try:
        res = requests.post(
            url,
            json={"ref": ref, "app_id": APPID},
            timeout=20,
            proxies={"http": None, "https": None},
        )
        data = res.json()
        code = (((data.get("data") or {}).get("result") or {}).get("code"))

        if data.get("code") != 0 or not code:
            print(f"[{yyb_display(server)}] 获取code失败：{data}")
            return None

        print(f"[{yyb_display(server)}] 获取code成功")
        return code
    except Exception as exc:
        print(f"[{yyb_display(server)}] 获取code异常：{exc}")
        return None

def common_headers(token: str | None = None) -> Dict[str, str]:
    headers = {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
        "Accept": "*/*",
        "xweb_xhr": "1",
        "Referer": f"https://servicewechat.com/{APPID}/39/page-frame.html",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    if token:
        headers["Extra-Data"] = json.dumps({
            "is_weapp": 1,
            "sid": "",
            "version": "2.232.5.101",
            "client": "weapp",
            "bizEnv": "wsc",
            "uuid": f"ksf0JQIifXUPu1F1780153190717",
            "ftime": 1780153190714
        })
    return headers


def login_by_code(server: str, code: str, proxies: Dict[str, str] | None) -> Tuple[str | None, Dict[str, Any] | None]:
    try:
        print("🔐 [登录] 使用 code 换 token")
        payload = {
            "appId": APPID,
            "code": code,
            "platformName": "weapp",
            "signature": "windows",
            "clientBiz": "weapp_wsc",
            "inWsc": True,
            "kdtId": KDT_ID,
            "extraBizData": {
                "enterOptions": {
                    "extKdtId": int(KDT_ID),
                    "path": "pages/home/dashboard/index",
                    "query": {},
                    "scene": 1005,
                    "referrerInfo": {},
                    "hostExtraData": {},
                    "apiCategory": "default"
                },
                "guideBizDataMap": {
                    "from_params": ""
                },
                "sceneData": {}
            }
        }

        response = request_with_proxy(
            "POST",
            LOGIN_URL,
            headers=common_headers(),
            json=payload,
            proxies=proxies,
            server=server,
        )

        try:
            data = response.json()
        except Exception:
            data = {"raw": response.text[:800]}

        token = data.get("data", {}).get("accessToken")
        if token and token != "null":
            print(f"✅ [登录] token 获取成功: {mask(token)}")
            return token, data

        print(f"❌ [登录] 未识别 token 字段: {json_preview(data)}")
        return None, data
    except Exception as exc:
        print(f"❌ [登录] 请求异常: {exc}")
        return None, None


def api_get(server: str, url: str, token: str, proxies: Dict[str, str] | None, params: Dict[str, Any] | None = None, session_id: str = "") -> Dict[str, Any]:
    if params is None:
        params = {}

    # 将 access_token 添加到查询参数
    params_with_token = {**params, "app_id": APPID, "kdt_id": KDT_ID, "access_token": token}

    headers = common_headers(token)
    if session_id:
        headers["Extra-Data"] = json.dumps({
            "is_weapp": 1,
            "sid": session_id,
            "version": "2.232.5.101",
            "client": "weapp",
            "bizEnv": "wsc",
            "uuid": f"ksf0JQIifXUPu1F1780153190717",
            "ftime": 1780153190714
        })

    response = request_with_proxy(
        "GET",
        url,
        headers=headers,
        params=params_with_token,
        proxies=proxies,
        server=server,
    )
    try:
        return response.json()
    except Exception:
        return {
            "code": -1,
            "msg": f"JSON解析失败: {response.text[:300]}",
        }


def run_account(index: int, total: int, server: str) -> Dict[str, Any]:
    result = {
        "server": server,
        "success": False,
        "proxyStatus": "未使用代理",
        "proxyIp": "-",
        "token": "-",
        "nickname": "-",
        "userId": "-",
        "signMsg": "-",
        "signDays": "-",
        "points": "-",
        "error": "",
    }

    log_account_header(index, total, server)

    proxies, proxy_ip = get_valid_proxy(server)
    result["proxyStatus"] = "使用专属代理" if proxies else "使用直连"
    result["proxyIp"] = proxy_ip or "-"

    sleep(PROXY_FETCH_INTERVAL)

    delay = random.randint(2, 6)
    print(f"⏳ [延迟] 启动延迟 {delay}s")
    sleep(delay)

    code = get_code(server)
    if not code:
        result["error"] = "获取 code 失败"
        return result

    token, raw_login = login_by_code(server, code, proxies)
    if not token:
        result["error"] = f"登录失败: {json_preview(raw_login)}"
        return result

    result["token"] = mask(token)

    login_data = raw_login.get("data", {})
    if login_data:
        nickname = login_data.get("nickname") or login_data.get("nickName") or "未知用户"
        user_id = login_data.get("userId") or login_data.get("buyerId") or "-"
        session_id = login_data.get("sessionId") or ""
        result["nickname"] = nickname
        result["userId"] = str(user_id)
        print(f"👤 [用户] 昵称: {nickname}, ID: {user_id}, Session: {session_id[:10]}...")

    try:
        asset_resp = api_get(server, ASSET_INFO_URL, token, proxies, {}, session_id)
        if asset_resp.get("code") == 0:
            asset_data = asset_resp.get("data", {})
            level_name = asset_data.get("memberInfo", {}).get("vipName") or "未知等级"
            points = asset_data.get("assetInfo", {}).get("currentPoints") or "0"
            balance = asset_data.get("assetInfo", {}).get("storedBalanceValue") or "0"
            vouchers = asset_data.get("assetInfo", {}).get("voucherNum") or "0"
            result["points"] = points
            print(f"⭐ [等级] {level_name}, 积分: {points}")
            print(f"💰 [资产] 余额: {balance}, 优惠券: {vouchers}")

        month_sign_resp = api_get(server, MONTH_SIGN_INFO_URL, token, proxies, {
            "checkin_id": CHECKIN_ID,
            "year": datetime.now().year,
            "month": datetime.now().month
        }, session_id)
        if month_sign_resp.get("code") == 0:
            sign_data = month_sign_resp.get("data", {})
            checkin_dates = sign_data.get("checkin_date") or []
            sign_days = len(checkin_dates)
            result["signDays"] = f"{sign_days} 天"
            print(f"📅 [签到] 当月签到: {sign_days} 天")

        sign_resp = api_get(server, SIGN_URL, token, proxies, {
            "checkinId": CHECKIN_ID
        }, session_id)
        if sign_resp.get("code") == 0:
            sign_data = sign_resp.get("data", {})
            success = sign_data.get("success", False)
            if success:
                reward_list = sign_data.get("list", [])
                if reward_list:
                    reward = reward_list[0]
                    reward_info = reward.get("infos", {})
                    reward_title = reward_info.get("title", "未知奖励")
                    result["signMsg"] = f"签到成功: 获得 {reward_title}"
                    print(f"✅ [签到] {result['signMsg']}")
                else:
                    result["signMsg"] = "签到成功，但未获得奖励"
                    print(f"✅ [签到] {result['signMsg']}")
            else:
                msg = sign_data.get("desc") or "签到失败"
                result["signMsg"] = f"签到失败: {msg}"
                print(f"⚠️ [签到] {result['signMsg']}")
        else:
            msg = sign_resp.get("msg") or sign_resp.get("message") or "签到失败"
            result["signMsg"] = f"签到失败: {msg}"
            print(f"⚠️ [签到] {result['signMsg']}")

        result["success"] = True
        return result

    except Exception as exc:
        result["error"] = traceback.format_exc().strip()
        print(f"❌ [账号] 执行失败: {exc}")
        return result


def build_notify(results: List[Dict[str, Any]]) -> str:
    success_count = sum(1 for item in results if item["success"])
    fail_count = len(results) - success_count

    content = f"""🦘 袋鼠妈妈会员商场四账号任务结果

━━━━━━━━━━━━━━━━━━━━
🏁 总结：{success_count} 成功 / {fail_count} 失败
🕒 时间：{now_text()}
━━━━━━━━━━━━━━━━━━━━
"""

    for idx, res in enumerate(results, 1):
        icon = "✅" if res["success"] else "❌"

        content += f"""
🧩 账号 {idx}
🌍 来源：{res["server"]}
🌐 代理：{res["proxyStatus"]}
📡 出口IP：{res["proxyIp"]}
👤 昵称：{res["nickname"]}
🆔 用户ID：{res["userId"]}
🔐 Token：{res["token"]}
📝 签到：{res["signMsg"]}
📅 当月签到：{res["signDays"]}
💰 积分：{res["points"]}
{icon} 结果：{"成功" if res["success"] else "失败"}
"""

        if not res["success"]:
            content += f"❌ 原因：{res['error']}\n"

        content += "━━━━━━━━━━━━━━━━━━━━\n"

    return content


def main() -> None:
    log_title()

    results: List[Dict[str, Any]] = []

    for index, server in enumerate(SERVERS, 1):
        try:
            result = run_account(index, len(SERVERS), server)
            results.append(result)
        except Exception as exc:
            print(f"❌ [主程序] {server} 执行异常: {exc}")
            results.append({
                "server": server,
                "success": False,
                "proxyStatus": "-",
                "proxyIp": "-",
                "token": "-",
                "nickname": "-",
                "userId": "-",
                "signMsg": "-",
                "signDays": "-",
                "points": "-",
                "error": traceback.format_exc().strip(),
            })

        if index < len(SERVERS):
            print("⏳ [间隔] 等待 2s 后处理下一个账号")
            sleep(2)

    success_count = sum(1 for item in results if item["success"])
    fail_count = len(results) - success_count

    print()
    print("╔" + "═" * 50 + "╗")
    print("║ 🏁 袋鼠妈妈任务执行完成 ║")
    print(f"║ ✅ 成功: {success_count:<39}║")
    print(f"║ ❌ 失败: {fail_count:<39}║")
    print(f"║ 🕒 结束时间: {now_text():<32}║")
    print("╚" + "═" * 50 + "╝")

    send_pushplus("🦘 袋鼠妈妈四账号任务完成", build_notify(results))


if __name__ == "__main__":
    main()
