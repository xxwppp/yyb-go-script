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

# name: 比亚迪海洋
# cron: 28 9 * * *

"""
比亚迪海洋小程序签到脚本（code 版）
By 南归
功能：
  1. WeChatLoader 获取微信 code
  2. 使用 code 换取 session_id
  3. 每日签到
  4. AES-128-CBC 加解密

环境变量：
  YYB_GO             YYB Go 服务地址，格式：server地址@openid，多账号用 & 或换行分隔
"""

import base64
import hashlib
import json
import os
import sys
import time
import traceback
import uuid as uuid_mod
from datetime import datetime
from typing import Any, Dict, List, Tuple

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests

# === YYB 协议统一认证（自动 https + Basic/Bearer） begin ===
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

import notify

from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

APP_NAME = "比亚迪海洋小程序签到"
APPID = "wxf62054ec313d6f53"

# 从环境变量 YYB_GO 读取内网服务，格式：server地址@openid，多账号用 & 或换行分隔
SERVERS = []
env_YYB_GO = os.getenv("YYB_GO", "")
if env_YYB_GO:
    raw_lines = env_YYB_GO.replace("&", "\n").splitlines()
    SERVERS = [line.strip() for line in raw_lines if line.strip()]

if len(SERVERS) == 0:
    print("❌ 未配置环境变量 YYB_GO")
    print("格式：地址@微信账号标识，多账号用 & 或换行分隔")
    print("192.168.1.21:8088@微信账号2")
    exit(1)

print(f"✅ 读取到 {len(SERVERS)} 个 YYB Go 账号")
print("-" * 60 + "\n")

AES_KEY = os.getenv("BYD_AES_KEY", "3993014457161851").encode()
AES_IV = os.getenv("BYD_AES_IV", "PDVcDRWMrBlLHTqh").encode()
APPKEY = os.getenv("BYD_APPKEY", "hyMinaApi")
APPSECRET = os.getenv("BYD_APPSECRET", "Kfl%BOk6C5PwARw8")

BASE_URL = "https://mina.bydoceanauto.com"
DECRYPT_CODE_URL = f"{BASE_URL}/?service=mina.decryptCode"
SIGN_URL = f"{BASE_URL}/?s=ForCommonUcSrv.forward&serviceDir=activity/sign/signIn"
INTEGRAL_URL = f"{BASE_URL}/App/Forward2Rights/integral?serviceDir=/Integral/User/user"

REQUEST_TIMEOUT = 30

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 "
    "MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI "
    "MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) "
    "UnifiedPCWindowsWechat(0xf2541938) XWEB/19823"
)


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def mask(value: Any) -> str:
    value = str(value or "")
    if len(value) <= 12:
        return value
    return f"{value[:6]}...{value[-6:]}"


def gen_nonce(length: int = 16) -> str:
    import random
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return "".join(random.choice(chars) for _ in range(length))


def gen_client_trace_id() -> str:
    return f"mina-{uuid_mod.uuid4()}"


def gen_checksum(nonce: str, curtime: str) -> str:
    raw = f"{APPSECRET}{nonce}{curtime}"
    return hashlib.sha256(raw.encode()).hexdigest()


def aes_encrypt(plaintext: str) -> str:
    cipher = AES.new(AES_KEY, AES.MODE_CBC, AES_IV)
    padded = pad(plaintext.encode("utf-8"), AES.block_size)
    encrypted = cipher.encrypt(padded)
    return base64.b64encode(encrypted).decode("utf-8")


def aes_decrypt(ciphertext: str) -> str:
    cipher = AES.new(AES_KEY, AES.MODE_CBC, AES_IV)
    decoded = base64.b64decode(ciphertext)
    decrypted = unpad(cipher.decrypt(decoded), AES.block_size)
    return decrypted.decode("utf-8")


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
        return None, None
    return server, ref


def get_code(server_entry: str) -> str | None:
    parsed_server, ref = parse_yyb_go_entry(server_entry)
    if not parsed_server or not ref:
        return None
    url = f"https://{parsed_server}/wxapp/getCode"
    print(f"[{yyb_display(server_entry)}] 请求YYB Go获取code：{url}")
    try:
        res = requests.post(
            url,
            json={"ref": ref, "app_id": APPID},
            timeout=20,
            proxies={"http": None, "https": None},
        )
        data = res.json()
        if not isinstance(data, dict):
            print(f"[{yyb_display(server_entry)}] 获取code失败：响应非JSON对象 {str(data)[:200]}")
            return None
        code = (((data.get("data") or {}).get("result") or {}).get("code"))
        if data.get("code") != 0 or not code:
            print(f"[{yyb_display(server_entry)}] 获取code失败：{str(data)[:300]}")
            return None
        print(f"[{yyb_display(server_entry)}] 获取code成功")
        return code
    except Exception as exc:
        print(f"[{yyb_display(server_entry)}] 获取code异常：{exc}")
        return None


def common_headers() -> Dict[str, str]:
    nonce = gen_nonce()
    curtime = str(int(time.time()))
    return {
        "Content-Type": "application/json",
        "X-Clienttraceid": gen_client_trace_id(),
        "Nonce": nonce,
        "Curtime": curtime,
        "Checksum": gen_checksum(nonce, curtime),
        "Appkey": APPKEY,
        "User-Agent": USER_AGENT,
        "Xweb_xhr": "1",
        "Accept": "*/*",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        "Referer": f"https://servicewechat.com/{APPID}/115/page-frame.html",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }


def get_session_id(code: str) -> str:
    payload_plain = json.dumps({"code": code})
    encrypted_payload = aes_encrypt(payload_plain)

    resp = requests.post(
        DECRYPT_CODE_URL,
        headers=common_headers(),
        data=encrypted_payload,
        timeout=REQUEST_TIMEOUT,
    )

    resp_text = resp.text.strip()
    data = None
    try:
        decrypted = aes_decrypt(resp_text)
        data = json.loads(decrypted)
    except Exception:
        try:
            json_data = resp.json()
            if isinstance(json_data, dict):
                data = json_data
        except Exception:
            pass

    if not isinstance(data, dict):
        raise Exception(f"解密/解析响应失败，原始内容: {resp_text[:200]}")

    session_id = data.get("session_id") or (data.get("data") or {}).get("session_id")
    if not session_id:
        raise Exception(f"未获取到 session_id: {json.dumps(data, ensure_ascii=False)[:200]}")
    return session_id


def do_sign(session_id: str) -> Dict[str, Any]:
    payload_plain = json.dumps({
        "date": "",
        "belong_brand": "hy",
        "session_id": session_id,
        "app_version": "460",
        "app_client": "mina",
    })
    encrypted_payload = aes_encrypt(payload_plain)

    resp = requests.post(
        SIGN_URL,
        headers=common_headers(),
        data=encrypted_payload,
        timeout=REQUEST_TIMEOUT,
    )

    resp_text = resp.text.strip()
    data = None
    try:
        decrypted = aes_decrypt(resp_text)
        data = json.loads(decrypted)
    except Exception:
        try:
            json_data = resp.json()
            if isinstance(json_data, dict):
                data = json_data
        except Exception:
            pass

    if not isinstance(data, dict):
        raise Exception(f"解密/解析签到响应失败，原始内容: {resp_text[:200]}")
    return data



def get_user_integral(session_id: str) -> Dict[str, Any]:
    """查询积分信息"""
    payload_plain = json.dumps({
        "session_id": session_id,
        "app_version": "460",
        "app_client": "mina",
    })
    encrypted_payload = aes_encrypt(payload_plain)

    resp = requests.post(
        INTEGRAL_URL,
        headers=common_headers(),
        data=encrypted_payload,
        timeout=REQUEST_TIMEOUT,
    )

    resp_text = resp.text.strip()
    data = None
    try:
        decrypted = aes_decrypt(resp_text)
        data = json.loads(decrypted)
    except Exception:
        try:
            json_data = resp.json()
            if isinstance(json_data, dict):
                data = json_data
        except Exception:
            pass

    if not isinstance(data, dict):
        raise Exception(f"解密/解析积分响应失败，原始内容: {resp_text[:200]}")
    return data


def run_account(index: int, total: int, server_entry: str) -> Dict[str, Any]:
    _, wxid = parse_yyb_go_entry(server_entry)
    result = {
        "wxid": yyb_display(server_entry),
        "success": False,
        "msg": "",
    }

    print()
    print(f"┌{'─' * 50}┐")
    print(f"│ 账号 {index} / {total}: {yyb_display(server_entry):<37}│")
    print(f"└{'─' * 50}┘")

    code = get_code(server_entry)
    if not code:
        result["msg"] = "获取 code 失败"
        return result
    print(f"✅ [授权] code 获取成功")

    try:
        session_id = get_session_id(code)
        print(f"✅ [登录] session_id 获取成功: {mask(session_id)}")
    except Exception as exc:
        print(f"❌ [登录] session_id 获取失败: {exc}")
        result["msg"] = f"获取 session_id 失败: {exc}"
        return result

    try:
        sign_data = do_sign(session_id)
        ret = sign_data.get("ret")
        sign_detail = sign_data.get("data") or {}
        if ret == 200:
            duplicate = sign_detail.get("duplicate", False)
            days = sign_detail.get("durationDays", 0)
            integral = sign_detail.get("integral", 0)
            if duplicate:
                print(f"⚠️ [签到] 重复签到，今日已签到")
                print(f"   本次积分: +{integral} | 累计签到: {days}天")
                msg = f"重复签到 +{integral}积分 累计{days}天"
            else:
                print(f"✅ [签到] 签到成功")
                print(f"   本次积分: +{integral} | 累计签到: {days}天")
                msg = f"签到成功 +{integral}积分 累计{days}天"
            result["success"] = True
            result["msg"] = msg
            # 查询积分
            try:
                integral_data = get_user_integral(session_id)
                i_ret = integral_data.get("ret")
                if i_ret == 200:
                    inner = integral_data.get("data") or {}
                    avail = inner.get("available_integral_sum", 0)
                    freezing = inner.get("freezing_integral_sum", 0)
                    gained = inner.get("gain_integral_sum", 0)
                    expiring = inner.get("going_expired_integral_sum", 0)
                    print(f"💰 [积分] 可用: {avail} | 累计获得: {gained} | 冻结: {freezing} | 即将过期: {expiring}")
                    result["msg"] += f" | 积分{avail}"
                else:
                    print(f"⚠️ [积分] 查询失败: ret={i_ret}")
            except Exception as exc:
                print(f"⚠️ [积分] 查询异常: {exc}")
        else:
            msg = sign_data.get("msg") or json.dumps(sign_data, ensure_ascii=False)[:100]
            print(f"❌ [签到] 失败: {msg}")
            result["msg"] = msg
    except Exception as exc:
        print(f"❌ [签到] 签到失败: {exc}")
        result["msg"] = f"签到失败: {exc}"

    return result


def build_notify(results: List[Dict[str, Any]]) -> str:
    lines = []
    for i, res in enumerate(results, 1):
        status = "✅" if res["success"] else "❌"
        lines.append(f"账号{i} {res['wxid']}: {status}{res['msg']}")
    return "\n".join(lines)


def main() -> None:
    print()
    print("╔" + "═" * 50 + "╗")
    print(f"║ 比亚迪海洋小程序签到（YYB Go版）                  ║")
    print(f"║ 启动时间: {now_text():<36}║")
    print(f"║ 账号数量: {len(SERVERS):<36}║")
    print("╚" + "═" * 50 + "╝")

    results: List[Dict[str, Any]] = []
    for index, server_entry in enumerate(SERVERS, 1):
        result = run_account(index, len(SERVERS), server_entry)
        results.append(result)
        if index < len(SERVERS):
            time.sleep(2)

    success_count = sum(1 for r in results if r["success"])
    fail_count = len(results) - success_count
    print()
    print("╔" + "═" * 50 + "╗")
    print(f"║ 比亚迪海洋签到任务执行完成                       ║")
    print(f"║ 成功: {success_count:<40}║")
    print(f"║ 失败: {fail_count:<40}║")
    print(f"║ 结束时间: {now_text():<36}║")
    print("╚" + "═" * 50 + "╝")

    notify.send(APP_NAME, build_notify(results))


if __name__ == "__main__":
    main()
