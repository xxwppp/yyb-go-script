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

# name: 上美广场
# cron: 20 9 * * *

"""
SM广场小程序（YYB Go版）

功能：
  1. YYB_SERVER 获取微信 code
  2. 使用 code 换 token
  3. 自动轮流签到 5 个城市广场：成都、晋江、扬州、厦门、重庆
  4. 查询签到状态
  5. 执行签到
  6. 查询账号积分
  7. 青龙 notify 推送

环境变量：
  YYB_GO        YYB Go 服务地址，格式：server地址@openid，多账号用 & 或换行分隔
  PROXY_API     品赞代理提取 API，可选
  PROXY_TYPE    http / socks5，默认 http
"""

import json
import os
import random
import time
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
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
            if url.startswith("http://"):
                url = url.replace("http://", "https://", 1)
            kwargs.setdefault("headers", {})
            kwargs["headers"]["Authorization"] = _yyb_auth
        return _orig_requests_post(url, *args, **kwargs)
    requests.post = _yyb_requests_post
# === YYB 协议统一认证 end ===

import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

try:
    import notify
except ImportError:
    notify = None

APP_NAME = "SM广场小程序"
APPID = "wx383a677b99e64655"

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

MALL_CONFIG: Dict[str, int] = {
    "成都": 11544,
    "晋江": 12135,
    "扬州": 12540,
    "厦门": 11086,
    "重庆": 12305,
}

BASE_URL = "https://m.mallcoo.cn"
PROJECT_CONFIG_URL = f"{BASE_URL}/api/home/Mall/GetProjectConfigIDStandard"
LOGIN_URL = f"{BASE_URL}/a/liteapp/api/identitys/LoginForThirdV2"
CHECK_SIGN_URL = f"{BASE_URL}/api/user/user/GetNoticeFavoriteAndCheckinCount"
SUBMIT_SIGN_URL = f"{BASE_URL}/api/user/User/CheckinV2"
ACCOUNT_INFO_URL = f"{BASE_URL}/api/user/user/GetUserAndMallCard"

PROXY_API = os.getenv("PROXY_API", "")
PROXY_TYPE = os.getenv("PROXY_TYPE", "http").lower()
PROXY_RETRY_TIMES = 3
ENABLE_DIRECT_FALLBACK = True
REQUEST_TIMEOUT = 30

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 "
    "MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI "
    "MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) "
    "UnifiedPCWindowsWechat(0xf2540615) XWEB/16133"
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
    url = f"https://{parsed_server}/wxapp/getCode"
    print(f"  [授权] 请求YYB Go获取code")
    try:
        resp = requests.post(
            url,
            json={"ref": ref, "app_id": APPID},
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


def parse_proxy_response(text: Any) -> Optional[Dict[str, Any]]:
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
        elif isinstance(data.get("result"), dict):
            proxy_obj = data["result"]
        elif data.get("ip") and data.get("port"):
            proxy_obj = data
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


def build_proxy_dict(proxy_info: Optional[Dict[str, Any]]) -> Optional[Dict[str, str]]:
    if not proxy_info:
        return None
    host = proxy_info["host"]
    port = proxy_info["port"]
    username = proxy_info.get("username", "")
    password = proxy_info.get("password", "")
    auth = ""
    if username and password:
        auth = f"{quote(username)}:{quote(password)}@"
    scheme = "socks5" if PROXY_TYPE == "socks5" else "http"
    proxy_url = f"{scheme}://{auth}{host}:{port}"
    print(f"  [代理] 生成 {scheme.upper()} 代理 {host}:{port}")
    return {"http": proxy_url, "https": proxy_url}


def get_valid_proxy(account_name: str) -> Tuple[Optional[Dict[str, str]], str]:
    if not PROXY_API:
        return None, ""
    print(f"  [代理] {account_name} 正在获取品赞代理...")
    for index in range(1, PROXY_RETRY_TIMES + 1):
        try:
            response = direct_session().get(PROXY_API, timeout=15)
            proxy_info = parse_proxy_response(response.text)
            if not proxy_info:
                print(f"  [代理] 第 {index} 次代理解析失败")
                continue
            print(f"  [代理] 提取到 {proxy_info['host']}:{proxy_info['port']}")
            proxies = build_proxy_dict(proxy_info)
            try:
                resp = requests.get("http://www.baidu.com", proxies=proxies, timeout=10, verify=False)
                if resp.status_code == 200:
                    return proxies, proxy_info["host"]
            except Exception:
                pass
            print(f"  [代理] 第 {index} 次代理不可用")
        except Exception as exc:
            print(f"  [代理] 第 {index} 次获取代理异常: {exc}")
        if index < PROXY_RETRY_TIMES:
            sleep(2)
    print("  [代理] 获取失败，使用直连")
    return None, ""


def request_with_proxy(
    method: str, url: str, *,
    proxies: Optional[Dict[str, str]] = None, server: str = "", **kwargs,
) -> requests.Response:
    kwargs.setdefault("timeout", REQUEST_TIMEOUT)
    kwargs.setdefault("verify", False)
    if proxies:
        try:
            response = requests.request(method, url, proxies=proxies, **kwargs)
            if 200 <= response.status_code < 400:
                return response
            print(f"  [代理] {server} 代理请求 HTTP {response.status_code}")
            if not ENABLE_DIRECT_FALLBACK:
                return response
            print("  [兜底] 切换直连重试")
        except Exception as exc:
            print(f"  [代理] {server} 代理请求失败: {exc}")
            if not ENABLE_DIRECT_FALLBACK:
                raise
            print("  [兜底] 切换直连重试")
    session = direct_session()
    return session.request(method, url, **kwargs)


# ============ 业务逻辑 ============

class SmSignin:
    def __init__(self, mall_name: str, mall_id: int, server: str, proxies: Optional[Dict[str, str]]):
        self.mall_name = mall_name
        self.mall_id = mall_id
        self.server = server
        self.proxies = proxies
        self.project_id: Optional[Any] = None
        self.token: Optional[str] = None
        self.nick_name = "-"
        self.points = "-"
        self.sign_status_msg = "-"
        self.sign_msg = "-"
        print(f"  当前商场：{self.mall_name}SM广场（ID: {self.mall_id}）")

    def headers(self) -> Dict[str, str]:
        return {
            "host": "m.mallcoo.cn",
            "user-agent": USER_AGENT,
            "xweb_xhr": "1",
            "content-type": "application/json",
            "accept": "*/*",
            "referer": f"https://servicewechat.com/{APPID}/15/page-frame.html",
            "accept-language": "zh-CN,zh;q=0.9",
        }

    def system_info(self) -> Dict[str, Any]:
        return {
            "model": "microsoft",
            "SDKVersion": "3.8.10",
            "system": "Windows 10 x64",
            "version": "4.0.6.21",
            "miniVersion": "DZ.2.5.64.1.SM.24",
        }

    def token_header(self) -> str:
        return f"{self.token},{self.project_id}"

    def post_json(self, url: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        headers = self.headers()
        payload_str = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
        headers["content-length"] = str(len(payload_str.encode("utf-8")))
        try:
            response = request_with_proxy(
                "POST", url,
                headers=headers,
                data=payload_str.encode("utf-8"),
                proxies=self.proxies, server=self.server,
            )
            try:
                return response.json()
            except Exception:
                print(f"  [请求] JSON解析失败 HTTP {response.status_code}: {response.text[:300]}")
                return None
        except Exception as exc:
            print(f"  [请求] 异常: {exc}")
            return None

    def get_project_config_id(self) -> bool:
        payload = {"MallID": self.mall_id, "Header": {"Token": None, "systemInfo": self.system_info()}}
        data = self.post_json(PROJECT_CONFIG_URL, payload)
        if data and data.get("m") == 1:
            self.project_id = data.get("d")
            print(f"  [项目] ProjectConfigID: {self.project_id}")
            return True
        print(f"  [项目] 获取失败: {data.get('e', '未知错误') if data else '无响应'}")
        return False

    def login(self, code: str) -> bool:
        if not self.project_id:
            print("  [登录] 未获取到项目ID，无法登录")
            return False
        payload = {
            "MallID": self.mall_id, "Code": code, "AppID": APPID,
            "OpenID": "", "NotVCodeAndGraphicVCode": True, "SNSType": 8,
            "Header": {"Token": None, "systemInfo": self.system_info()},
        }
        data = self.post_json(LOGIN_URL, payload)
        if data and data.get("m") == 1:
            user_data = data.get("d", {}) or {}
            self.token = user_data.get("Token")
            self.nick_name = user_data.get("NickName", "未知用户")
            if self.token:
                print(f"  [登录] {self.nick_name} 登录成功，Token: {mask(self.token)}")
                return True
            print("  [登录] 未获取到 Token")
            return False
        print(f"  [登录] 失败: {data.get('e', '未知错误') if data else '无响应'}")
        return False

    def check_signin_status(self) -> Optional[Dict[str, Any]]:
        if not self.token or not self.project_id:
            return None
        payload = {"MallId": self.mall_id, "Header": {"Token": self.token_header(), "systemInfo": self.system_info()}}
        data = self.post_json(CHECK_SIGN_URL, payload)
        if not data:
            self.sign_status_msg = "查询失败"
            return None
        if data.get("m") == 1:
            checkin_data = data.get("d", {}) or {}
            is_checkin_today = checkin_data.get("IsCheckInToday", False)
            is_open_checkin = checkin_data.get("IsOpenCheckin", False)
            if is_open_checkin and is_checkin_today:
                self.sign_status_msg = "今日已签到"
            elif is_open_checkin:
                self.sign_status_msg = "今日未签到"
            else:
                self.sign_status_msg = "签到未开放"
            print(f"  [签到状态] {self.sign_status_msg}")
            return checkin_data
        self.sign_status_msg = data.get("e", "未知错误")
        return None

    def submit_signin(self) -> Optional[Dict[str, Any]]:
        if not self.token or not self.project_id:
            return None
        payload = {"MallID": self.mall_id, "Header": {"Token": self.token_header(), "systemInfo": self.system_info()}}
        data = self.post_json(SUBMIT_SIGN_URL, payload)
        if not data:
            self.sign_msg = "签到请求失败"
            return None
        if data.get("m") == 1:
            signin_data = data.get("d", {}) or {}
            self.sign_msg = signin_data.get("Msg", "签到成功")
            print(f"  [签到] {self.sign_msg}")
            return signin_data
        self.sign_msg = data.get("e", "未知错误")
        return None

    def get_account_info(self) -> Optional[Dict[str, Any]]:
        if not self.token or not self.project_id:
            return None
        payload = {"MallId": self.mall_id, "Header": {"Token": self.token_header(), "systemInfo": self.system_info()}}
        data = self.post_json(ACCOUNT_INFO_URL, payload)
        if not data:
            return None
        if data.get("m") == 1:
            account_data = data.get("d", {}) or {}
            self.points = account_data.get("Bonus", 0)
            print(f"  [账号] 当前积分: {self.points}")
            return account_data
        return None

    def process_account(self, code: str) -> Dict[str, Any]:
        result = {
            "mallName": self.mall_name, "mallId": self.mall_id,
            "success": False, "token": "-", "nickName": "-",
            "points": "-", "signStatus": "-", "signMsg": "-", "error": "",
        }
        if not self.get_project_config_id():
            result["error"] = "获取项目ID失败"
            return result
        if not self.login(code):
            result["error"] = "登录失败"
            return result
        result["token"] = mask(self.token)
        result["nickName"] = self.nick_name

        signin_status = self.check_signin_status()
        result["signStatus"] = self.sign_status_msg
        if signin_status is None:
            result["error"] = "检查签到状态失败"
            return result

        is_checkin_today = signin_status.get("IsCheckInToday", False)
        is_open_checkin = signin_status.get("IsOpenCheckin", False)

        if not is_open_checkin:
            self.sign_msg = "签到未开放，跳过"
        elif is_checkin_today:
            self.sign_msg = "今日已签到，跳过"
        else:
            signin_result = self.submit_signin()
            if signin_result is None:
                result["error"] = "签到失败"
                result["signMsg"] = self.sign_msg
                self.get_account_info()
                result["points"] = self.points
                return result

        self.get_account_info()
        result["points"] = self.points
        result["signMsg"] = self.sign_msg
        result["success"] = True
        return result


# ============ 执行流程 ============

def run_mall_for_account(
    account_index: int, total_accounts: int, server_entry: str,
    mall_index: int, total_malls: int, mall_name: str, mall_id: int,
    proxies: Optional[Dict[str, str]],
) -> Dict[str, Any]:
    parsed_server, wxid = parse_yyb_go_entry(server_entry)
    print(f"  账号{account_index}/{total_accounts} | 城市{mall_index}/{total_malls}: {mall_name}SM广场")

    result = {
        "server": parsed_server or server_entry, "wxid": yyb_display(server_entry),
        "mallName": mall_name, "mallId": mall_id,
        "success": False, "token": "-", "nickName": "-",
        "points": "-", "signStatus": "-", "signMsg": "-", "error": "",
    }

    try:
        delay = random.randint(1, 2)
        sleep(delay)

        code = get_wx_code(server_entry)
        if not code:
            result["error"] = "获取 code 失败"
            return result

        client = SmSignin(mall_name, mall_id, parsed_server, proxies)
        account_result = client.process_account(code)
        result.update(account_result)
        return result
    except Exception:
        result["error"] = traceback.format_exc().strip()
        return result


def run_account(index: int, total: int, server_entry: str) -> Dict[str, Any]:
    parsed_server, wxid = parse_yyb_go_entry(server_entry)
    account_result = {
        "server": parsed_server or server_entry, "wxid": yyb_display(server_entry),
        "proxyStatus": "未使用代理", "proxyIp": "-",
        "success": False, "mallResults": [], "error": "",
    }

    print(f"\n{'='*50}")
    print(f"账号 {index} / {total} ({yyb_display(server_entry)})")
    print(f"{'='*50}")

    try:
        proxies, proxy_ip = get_valid_proxy(str(parsed_server))
        account_result["proxyStatus"] = "使用专属代理" if proxies else "使用直连"
        account_result["proxyIp"] = proxy_ip or "-"

        mall_items = list(MALL_CONFIG.items())
        mall_results = []

        for mall_index, (mall_name, mall_id) in enumerate(mall_items, 1):
            mall_result = run_mall_for_account(
                index, total, server_entry,
                mall_index, len(mall_items), mall_name, mall_id, proxies,
            )
            mall_results.append(mall_result)
            if mall_index < len(mall_items):
                sleep(2)

        account_result["mallResults"] = mall_results
        account_result["success"] = any(item["success"] for item in mall_results)
        return account_result
    except Exception:
        account_result["error"] = traceback.format_exc().strip()
        return account_result


def build_notify(results: List[Dict[str, Any]]) -> str:
    total_mall = 0
    success_mall = 0
    for account in results:
        for mall in account["mallResults"]:
            total_mall += 1
            if mall["success"]:
                success_mall += 1
    fail_mall = total_mall - success_mall

    lines = [f"SM广场小程序任务结果", "—" * 30]
    lines.append(f"✅ {success_mall}成功 / ❌ {fail_mall}失败")
    lines.append(f"账号数: {len(results)} | 城市数: {len(MALL_CONFIG)}")
    lines.append(f"🕒 {now_text()}")
    lines.append("")

    for idx, account in enumerate(results, 1):
        lines.append(f"账号{idx} ({account.get('wxid', '-')})")
        if account.get("error"):
            lines.append(f"  账号错误: {account['error'][:100]}")
        for mall in account["mallResults"]:
            icon = "✅" if mall["success"] else "❌"
            lines.append(f"  {icon} {mall['mallName']}SM广场")
            lines.append(f"    昵称: {mall['nickName']} | 积分: {mall['points']}")
            lines.append(f"    签到: {mall['signMsg']}")
            if not mall["success"] and mall.get("error"):
                lines.append(f"    错误: {mall['error'][:80]}")
        lines.append("")

    return "\n".join(lines)


def main() -> None:
    print(f"\n{'='*50}")
    print(f"SM广场小程序（YYB Go版）")
    print(f"启动: {now_text()} | 账号: {len(SERVERS)} | 城市: {len(MALL_CONFIG)}")
    print(f"{'='*50}")

    results: List[Dict[str, Any]] = []

    for index, server_entry in enumerate(SERVERS, 1):
        results.append(run_account(index, len(SERVERS), server_entry))
        if index < len(SERVERS):
            sleep(2)

    total_mall = sum(len(a["mallResults"]) for a in results)
    success_mall = sum(1 for a in results for m in a["mallResults"] if m["success"])
    fail_mall = total_mall - success_mall

    print(f"\n{'='*50}")
    print(f"完成: ✅{success_mall} ❌{fail_mall} | 🕒{now_text()}")
    print(f"{'='*50}")

    if notify:
        notify.send(APP_NAME, build_notify(results))


if __name__ == "__main__":
    main()
