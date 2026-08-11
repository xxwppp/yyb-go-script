#!/usr/bin/env python3
# -*- coding: utf-8 -*-
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

# name: 鸿星尔克
# cron: 18 9 * * *

"""
鸿星尔克小程序（YYB Go版）

功能：
  1. YYB_SERVER 获取微信 code
  2. code 换 memberId（on_login.json）
  3. 每日签到
  4. 青龙 notify 推送

环境变量：
  YYB_GO        YYB Go 服务地址，格式：server地址@openid，多账号用 & 或换行分隔
  PROXY_API     品赞代理提取 API，可选
  PROXY_TYPE    http / socks5，默认 http
"""

import hashlib
import json
import os
import random
import time
import traceback
from datetime import datetime, timezone, timedelta
from urllib.parse import quote, urlencode

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

try:
    import notify
except ImportError:
    notify = None

APP_NAME = "鸿星尔克"
APP_ID = "wxa1f1fa3785a47c7d"
ENTERPRISE_ID = "ff8080817d9fbda8017dc20674f47fb6"
SECRET = "damogic8888"

# YYB_GO 解析
SERVERS = []
env_YYB_GO = os.getenv("YYB_GO", "")
if env_YYB_GO:
    raw_lines = env_YYB_GO.replace("&", "\n").splitlines()
    SERVERS = [line.strip() for line in raw_lines if line.strip()]

if not SERVERS:
    print("❌ 未配置环境变量 YYB_GO")
    print("格式：地址@微信账号标识，多账号用 & 或换行分隔")
    exit(1)

print(f"✅ 读取到 {len(SERVERS)} 个 YYB Go 账号")

PROXY_API = os.getenv("PROXY_API", "")
PROXY_TYPE = os.getenv("PROXY_TYPE", "http").lower()
PROXY_RETRY_TIMES = 3
ENABLE_DIRECT_FALLBACK = True

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 "
    "MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI "
    "MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) "
    "UnifiedPCWindowsWechat(0xf2541923) XWEB/19823"
)


def sleep(seconds: float) -> None:
    time.sleep(seconds)


def china_timestamp() -> str:
    return datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S")


def mask_member_id(member_id: str) -> str:
    if len(member_id) <= 6:
        return member_id
    return f"{member_id[:3]}****{member_id[-3:]}"


def json_preview(data, limit: int = 300) -> str:
    try:
        return json.dumps(data, ensure_ascii=False)[:limit]
    except Exception:
        return str(data)[:limit]


# ============ YYB Server 交互 ============

def parse_yyb_go_entry(raw_value: str):
    raw_value = (raw_value or "").strip()
    if not raw_value:
        return None, None
    if "@" not in raw_value:
        print(f"❌ YYB_GO 格式应为 地址@微信账号标识，当前值：{raw_value}")
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
        return None, None
    return server, ref


def get_wx_code(server_entry: str) -> str | None:
    parsed_server, ref = parse_yyb_go_entry(server_entry)
    if not parsed_server or not ref:
        return None
    url = f"http://{parsed_server}/wxapp/getCode"
    print(f"  [授权] 请求YYB Go获取code")
    try:
        resp = requests.post(
            url,
            json={"ref": ref, "app_id": APP_ID},
            timeout=20,
            proxies={"http": None, "https": None},
        )
        data = resp.json()
        code = (((data.get("data") or {}).get("result") or {}).get("code"))
        if data.get("code") == 0 and code:
            print(f"  [授权] code获取成功")
            return code
        else:
            print(f"  [授权] code获取失败: {str(data)[:200]}")
            return None
    except Exception as exc:
        print(f"  [授权] code获取异常: {exc}")
        return None


# ============ 代理系统（可选） ============

_persistent_session = None

def get_persistent_session() -> requests.Session:
    global _persistent_session
    if _persistent_session is None:
        _persistent_session = requests.Session()
        _persistent_session.trust_env = False
    return _persistent_session


def direct_session() -> requests.Session:
    return get_persistent_session()


def parse_proxy_response(text) -> dict | None:
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
                    "host": str(host), "port": int(port),
                    "username": proxy_obj.get("user") or proxy_obj.get("username") or "",
                    "password": proxy_obj.get("pass") or proxy_obj.get("password") or "",
                }
    except Exception:
        pass
    if ":" in text:
        parts = text.split(":")
        if len(parts) >= 2:
            return {
                "host": parts[0], "port": int(parts[1]),
                "username": parts[2] if len(parts) > 2 else "",
                "password": parts[3] if len(parts) > 3 else "",
            }
    return None


def build_proxy_dict(proxy_info: dict | None) -> dict | None:
    if not proxy_info:
        return None
    host, port = proxy_info["host"], proxy_info["port"]
    username, password = proxy_info.get("username", ""), proxy_info.get("password", "")
    auth = f"{quote(username)}:{quote(password)}@" if username and password else ""
    scheme = "socks5" if PROXY_TYPE == "socks5" else "http"
    proxy_url = f"{scheme}://{auth}{host}:{port}"
    print(f"  [代理] 生成 {scheme.upper()} 代理 {host}:{port}")
    return {"http": proxy_url, "https": proxy_url}


def get_valid_proxy(server: str) -> dict | None:
    if not PROXY_API:
        return None
    for i in range(1, PROXY_RETRY_TIMES + 1):
        try:
            resp = direct_session().get(PROXY_API, timeout=15)
            info = parse_proxy_response(resp.text)
            if not info:
                continue
            proxies = build_proxy_dict(info)
            try:
                r = requests.get("http://www.baidu.com", proxies=proxies, timeout=10)
                if r.status_code == 200:
                    return proxies
            except Exception:
                pass
        except Exception as exc:
            print(f"  [代理] 第{i}次获取异常: {exc}")
        if i < PROXY_RETRY_TIMES:
            sleep(2)
    print("  [代理] 获取失败，使用直连")
    return None


def request_with_proxy(method: str, url: str, *, proxies: dict | None = None, server: str = "", **kwargs):
    kwargs.setdefault("timeout", 30)
    if proxies:
        try:
            return requests.request(method, url, proxies=proxies, **kwargs)
        except Exception as exc:
            print(f"  [代理] {server} 请求失败: {exc}")
            if not ENABLE_DIRECT_FALLBACK:
                raise
            print("  [兜底] 切换直连重试")
    return direct_session().request(method, url, **kwargs)


# ============ 业务逻辑 ============

def make_sign(timestamp: str, random_int: int, member_id: str = "-1") -> str:
    sign_raw = (
        f"timestamp={timestamp}transId={APP_ID}{timestamp}"
        f"secret={SECRET}random={random_int}memberId={member_id}"
    )
    return hashlib.md5(sign_raw.encode("utf-8")).hexdigest()


def build_system_info() -> str:
    return json.dumps(
        {
            "SDKVersion": "3.16.0", "batteryLevel": "0", "brand": "microsoft",
            "fontSizeSetting": "-1", "language": "zh_CN", "model": "microsoft",
            "pixelRatio": 1, "platform": "windows", "screenHeight": 780,
            "screenWidth": 414, "statusBarHeight": 20, "system": "Windows 10 x64",
            "version": "4.1.9.35", "windowHeight": 716, "windowWidth": 414,
            "benchmarkLevel": -1,
            "safeArea": {"bottom": 780, "height": 716, "left": 0, "right": 414, "top": 64, "width": 414},
            "theme": "light", "host": {"appId": "", "env": "WeChat"},
            "enableDebug": "-1", "mode": "-1", "deviceOrientation": "-1",
            "bluetoothEnabled": "-1", "locationEnabled": True, "wifiEnabled": True,
            "albumAuthorized": True, "cameraAuthorized": True, "locationAuthorized": True,
            "microphoneAuthorized": True, "notificationAuthorized": True,
            "notificationAlertAuthorized": "-1", "notificationBadgeAuthorized": "-1",
            "notificationSoundAuthorized": "-1", "phoneCalendarAuthorized": "-1",
            "bluetoothAuthorized": "-1", "locationReducedAccuracy": "-1",
            "devicePixelRatio": 1, "renderer": "-1", "environment": "-1",
        },
        ensure_ascii=False, separators=(",", ":"),
    )


def extract_member_id(data) -> str | None:
    if not isinstance(data, dict):
        return None
    candidates = [data.get("memberId"), data.get("member_id")]
    response = data.get("response")
    if isinstance(response, dict):
        candidates.extend([response.get("memberId"), response.get("member_id")])
        member = response.get("member")
        if isinstance(member, dict):
            candidates.extend([member.get("memberId"), member.get("member_id"), member.get("id")])
        user = response.get("user")
        if isinstance(user, dict):
            candidates.extend([user.get("memberId"), user.get("member_id"), user.get("id")])
    inner = data.get("data")
    if isinstance(inner, dict):
        candidates.extend([inner.get("memberId"), inner.get("member_id")])
        member = inner.get("member")
        if isinstance(member, dict):
            candidates.extend([member.get("memberId"), member.get("member_id"), member.get("id")])
    for item in candidates:
        if item not in (None, "", "-1", -1):
            return str(item)
    return None


def login_by_code(server: str, code: str, proxies: dict | None) -> tuple[str | None, dict | None]:
    timestamp = china_timestamp()
    random_int = random.randint(1000000, 9999999)
    sign = make_sign(timestamp, random_int, "-1")

    url = "https://hope.demogic.com/gic-wx-app/on_login.json"
    headers = {
        "Host": "hope.demogic.com",
        "Connection": "keep-alive",
        "sign": "",
        "User-Agent": UA,
        "channelEntrance": "wx_app",
        "xweb_xhr": "1",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "*/*",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        "Referer": f"https://servicewechat.com/{APP_ID}/89/page-frame.html",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    body = {
        "systemInfo": build_system_info(),
        "jcode": code,
        "openid": "", "scene": "1027",
        "memberId": "-1", "cliqueId": "-1", "cliqueMemberId": "-1", "useClique": "0",
        "enterpriseId": "", "unionid": "", "wxOpenid": "",
        "random": str(random_int),
        "appid": APP_ID,
        "transId": f"{APP_ID}{timestamp}",
        "sign": sign,
        "timestamp": timestamp,
        "gicWxaVersion": "3.9.74",
        "launchOptions": json.dumps(
            {"path": "pages/authorize/authorize", "query": {}, "scene": 1027, "referrerInfo": {}, "apiCategory": "default"},
            ensure_ascii=False, separators=(",", ":"),
        ),
    }

    try:
        print(f"  [登录] 使用 code 换 memberId")
        res = request_with_proxy("POST", url, headers=headers, data=urlencode(body), proxies=proxies, server=server)
        try:
            data = res.json()
        except Exception:
            data = {"raw": res.text[:800]}

        member_id = extract_member_id(data)
        if member_id:
            print(f"  [登录] 成功，memberId={mask_member_id(member_id)}")
            return member_id, data

        print(f"  [登录] 失败: {json_preview(data)}")
        return None, data
    except Exception as exc:
        print(f"  [登录] 异常: {exc}")
        return None, None


def sign_once(server: str, member_id: str, proxies: dict | None) -> dict:
    timestamp = china_timestamp()
    random_int = random.randint(1000000, 9999999)
    trans_id = f"{APP_ID}{timestamp}"
    sign = make_sign(timestamp, random_int, member_id)

    url = "https://hope.demogic.com/gic-wx-app/member_sign.json"
    headers = {
        "xweb_xhr": "1", "channelEntrance": "wx_app", "User-Agent": UA,
        "sign": ENTERPRISE_ID,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "*/*",
        "Referer": f"https://servicewechat.com/{APP_ID}/89/page-frame.html",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    body = {
        "memberId": member_id, "cliqueId": "-1", "cliqueMemberId": "-1", "useClique": "0",
        "enterpriseId": ENTERPRISE_ID,
        "random": str(random_int), "sign": sign,
        "timestamp": timestamp, "transId": trans_id,
        "gicWxaVersion": "3.9.74",
        "launchOptions": json.dumps(
            {"path": "pages/authorize/authorize", "query": {}, "scene": 1256, "referrerInfo": {}, "apiCategory": "default"},
            ensure_ascii=False, separators=(",", ":"),
        ),
    }

    response = request_with_proxy("POST", url, headers=headers, data=urlencode(body), proxies=proxies, server=server)

    if not response.ok:
        return {"success": False, "message": f"HTTP {response.status_code}", "points": "-"}

    try:
        data = response.json()
    except Exception:
        return {"success": False, "message": f"JSON解析失败", "points": "-"}

    errcode = data.get("errcode")
    if errcode == 0:
        result = data.get("response") or {}
        member_sign = result.get("memberSign") or {}
        integral = member_sign.get("integralCount", "未知")
        continuous = member_sign.get("continuousCount", "未知")
        points = result.get("points", "未知")
        return {"success": True, "message": f"签到成功，获得积分 {integral}，连续签到 {continuous} 天", "points": points}

    errmsg = data.get("errmsg") or data.get("msg") or (data.get("response") or {}).get("errmsg") or ""
    return {"success": False, "message": f"签到失败(errcode={errcode}): {errmsg}", "points": "-"}


def run_account(index: int, total: int, server_entry: str) -> dict:
    parsed_server, wxid = parse_yyb_go_entry(server_entry)
    result = {
        "server": parsed_server or server_entry,
        "wxid": yyb_display(server_entry),
        "success": False,
        "proxy_status": "未使用代理",
        "member_id": "-",
        "sign_msg": "-",
        "points": "-",
        "error": "",
    }

    print(f"\n{'='*50}")
    print(f"账号 {index}/{total} ({yyb_display(server_entry)})")
    print(f"{'='*50}")

    proxies = get_valid_proxy(str(parsed_server))
    result["proxy_status"] = "使用专属代理" if proxies else "使用直连"

    delay = random.randint(2, 6)
    sleep(delay)

    code = get_wx_code(server_entry)
    if not code:
        result["error"] = "获取 code 失败"
        return result

    member_id, raw = login_by_code(parsed_server, code, proxies)
    if not member_id:
        result["error"] = "登录失败或未识别 memberId"
        return result

    result["member_id"] = mask_member_id(member_id)

    sign_result = sign_once(parsed_server, member_id, proxies)
    result["success"] = bool(sign_result["success"])
    result["sign_msg"] = sign_result["message"]
    result["points"] = sign_result["points"]

    if result["success"]:
        print(f"  [签到] {result['sign_msg']}，积分余额 {result['points']}")
    else:
        print(f"  [签到] {result['sign_msg']}")

    return result


def build_notify(results: list) -> str:
    ok = sum(1 for r in results if r.get("success"))
    fail = len(results) - ok
    lines = [f"鸿星尔克签到结果", "—" * 30]
    lines.append(f"✅ {ok}成功 / ❌ {fail}失败")
    lines.append(f"🕒 {china_timestamp()}")
    lines.append("")
    for i, r in enumerate(results, 1):
        icon = "✅" if r.get("success") else "❌"
        lines.append(f"{icon} 账号{i} ({r.get('wxid', '-')})")
        lines.append(f"  memberId: {r['member_id']}")
        lines.append(f"  签到: {r['sign_msg']}")
        if r.get("success"):
            lines.append(f"  积分: {r['points']}")
        else:
            lines.append(f"  错误: {r.get('error', '')[:80]}")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    print(f"\n{'='*50}")
    print(f"鸿星尔克（YYB Go版）")
    print(f"启动: {china_timestamp()} | 账号: {len(SERVERS)}")
    print(f"{'='*50}")

    results = []
    for idx, server_entry in enumerate(SERVERS):
        try:
            r = run_account(idx + 1, len(SERVERS), server_entry)
            results.append(r)
        except Exception as exc:
            _, wxid = parse_yyb_go_entry(server_entry)
            results.append({
                "server": server_entry, "wxid": yyb_display(server_entry),
                "success": False, "error": str(exc),
                "member_id": "-", "sign_msg": "-", "points": "-",
                "proxy_status": "-",
            })
        if idx < len(SERVERS) - 1:
            sleep(2)

    ok = sum(1 for r in results if r.get("success"))
    fail = len(results) - ok
    print(f"\n{'='*50}")
    print(f"完成: ✅{ok} ❌{fail} | 🕒{china_timestamp()}")
    print(f"{'='*50}")

    if notify:
        notify.send(APP_NAME, build_notify(results))


if __name__ == "__main__":
    main()
