#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
八富生活（看广告赚金币）
Cron: 35 6 * * *
进入八富生活小程序
注册地址：https://bafunet.com/pages/index/index?invCode=U75803F7
    解析 YYB_GO 环境变量
    格式: host:port@ref
    例如: https://8000-8e6d4dc6c7b37e0c.monkeycode-ai.online@owNAX6mkpZiXq4i9EP_tXp1KnxEk 多账号直接换行
    跑不了 请改59行
code获取地址：https://8000-8e6d4dc6c7b37e0c.monkeycode-ai.online/
公众版的
"""

import os
import sys
import json
import time
import random

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# === YYB 协议统一认证（自动注入 Authorization 到 /wxapp/getCode 与 /wxapp/getPhoneNumber） begin ===
import base64 as _b64
_yyb_token = os.environ.get("YYB_TOKEN", "")
_yyb_user = os.environ.get("YYB_USER", "")
_yyb_pass = os.environ.get("YYB_PASS", "")
_yyb_auth = None
if _yyb_token:
    _yyb_auth = f"Bearer {_yyb_token}"
elif _yyb_user and _yyb_pass:
    _yyb_auth = "Basic " + _b64.b64encode(f"{_yyb_user}:{_yyb_pass}".encode()).decode()
if _yyb_auth:
    _orig_requests_post = requests.post
    def _yyb_requests_post(url, *args, **kwargs):
        if isinstance(url, str) and ("/wxapp/getCode" in url or "/wxapp/getPhoneNumber" in url):
            kwargs.setdefault("headers", {})
            kwargs["headers"]["Authorization"] = _yyb_auth
        return _orig_requests_post(url, *args, **kwargs)
    requests.post = _yyb_requests_post
# === YYB 协议统一认证 end ===

# ---------- SSL 补丁 ----------
_ORIG_REQUEST = requests.Session.request


def _patched_request(self, *args, **kwargs):
    kwargs.setdefault("verify", False)
    return _ORIG_REQUEST(self, *args, **kwargs)


requests.Session.request = _patched_request


def _mount_retry(session, retries=2):
    retry = urllib3.util.retry.Retry(
        total=retries, backoff_factor=0.5,
        status_forcelist=[502, 503, 504],
        allowed_methods=frozenset(["GET", "POST"]),
    )
    adapter = requests.adapters.HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)


# ---------- 配置 ----------
APPID = "wxb9be8e4f98c3fbe5"
PORTAL = "https://bafunet.com/portal-server"
WX_REWARD_AD_UNIT_ID = "adunit-43caae09a5474fc9"
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.30(0x18001e22) "
      "NetType/WIFI Language/zh_CN")

AD_WATCH_SECONDS = 30
AD_GAP_MIN = 5
AD_GAP_EXTRA = 3
AD_CHECK_GAP = 2

QYWX_KEY = os.environ.get("QYWX_KEY", "")
ACCOUNT_ICONS = "🍺🍷🍸🍹🥂🍶🧉☕🍵🥃"
DRY_RUN = os.environ.get("DRY_RUN", "") == "1"

INVITER_CODE = os.environ.get("BFSH_INVITER_CODE", "U75803F7")
FORCE_REBIND = os.environ.get("BFSH_FORCE_REBIND", "1") != "0"

CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bfsh_session_cache.json")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# === YYB 微信备注映射注入 begin ===
import os as _os_nm
_NAME_MAP = {}
_raw_nm = _os_nm.environ.get("YYB_NAME_MAP", "") or ""
for _line_nm in _raw_nm.replace("&", "\n").splitlines():
    _line_nm = _line_nm.strip()
    if "=" in _line_nm:
        _k_nm, _v_nm = _line_nm.split("=", 1)
        _NAME_MAP[_k_nm.strip()] = _v_nm.strip()

def yyb_display_ref(ref):
    if not ref:
        return ref
    return _NAME_MAP.get(ref, ref)
# === YYB 微信备注映射注入 end ===


def log(msg=""):
    print(msg, flush=True)


# ---------- adpid 计算 ----------
def get_server_adpid() -> int:
    s = WX_REWARD_AD_UNIT_ID
    if s.startswith("adunit-"):
        s = s[len("adunit-"):]
    sub = s[4:12]
    return int(sub, 16)


# =====================================================================
# Feistel 签名
# =====================================================================
MASK32 = (1 << 32) - 1
MASK64 = (1 << 64) - 1
DELTA = 0x9E3779B97F4A7C15


def _rotl32(x, r):
    return ((x << r) | (x >> (32 - r))) & MASK32


def _rotl64(x, r):
    return ((x << r) | (x >> (64 - r))) & MASK64


def _feistel_round(v, k):
    u = (v ^ (k & MASK32)) & MASK32
    u = _rotl32(u, 7)
    u = (0x9E3779B9 * u) & MASK32
    u = (u ^ (u >> 13)) & MASK32
    u = _rotl32(u, 3)
    return u & MASK32


def feistel_encrypt(ad_id, user_id) -> str:
    ad_id = int(ad_id) & MASK64
    user_id = int(user_id) & MASK64
    keys = [user_id]
    cur = user_id
    for g in range(1, 12):
        cur = (_rotl64(cur, 13) ^ (DELTA * g)) & MASK64
        keys.append(cur)
    f = (ad_id >> 32) & MASK32
    a = ad_id & MASK32
    for g in range(12):
        v = (f ^ _feistel_round(a, keys[g])) & MASK32
        f = a
        a = v
    result = ((a << 32) | f) & MASK64
    if result >= (1 << 63):
        result -= (1 << 64)
    return str(result)


# ---------- YYB GO 接口 ----------
def parse_yyb_go_env(line: str = None):
    """
    解析单条 YYB_GO 配置 host:port@ref
    :param line: 传入单行 host:port@ref；不传则读取全局YYB_GO（兼容旧代码）
    格式: host:port@ref
    例如: 127.0.0.1:8000@owNAX6mkpZiXq4i9EP_tXp1KnxEk
    """
    if line is None:
        env = os.environ.get("YYB_GO", "").strip()
    else:
        env = line.strip()

    if not env:
        return None, None

    if "@" in env:
        host_port, ref = env.split("@", 1)
        return host_port.strip(), ref.strip()
    return env, None


def get_yyb_wechat_code(ref, host_port, appid=APPID):
    """
    通过 YYB GO 获取微信登录 code
    兼容新版 POST 与旧版 GET（旧版 wxapp 接口只接受 GET，参数走 query string）
    """
    if not host_port:
        log("  ❌ host_port 为空")
        return None

    if not host_port.startswith("http://") and not host_port.startswith("https://"):
        host_port = "http://" + host_port

    url = f"{host_port}/wxapp/getCode"
    headers = {"Authorization": _yyb_auth} if _yyb_auth else {}
    params = {"ref": ref, "app_id": appid}

    try:
        resp = requests.post(url, json=params, headers=headers, timeout=10)
        if resp.status_code == 405:
            resp = requests.get(url, params=params, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            inner_data = data.get("data", {}) or {}
            result = inner_data.get("result", {}) if isinstance(inner_data.get("result"), dict) else {}
            code = result.get("code") or inner_data.get("code")
            if code:
                return code
            log(f"  ⚠️ YYB GO 返回 code 为空: {data}")
        else:
            log(f"  ⚠️ YYB GO 请求失败: {resp.status_code} - {resp.text[:100]}")
    except Exception as e:
        log(f"  ⚠️ YYB GO 请求异常: {e}")
    return None


def get_yyb_phone_code(ref, host_port, appid=APPID):
    """
    通过 YYB GO 获取手机号授权 code
    兼容新版 POST 与旧版 GET（旧版 wxapp 接口只接受 GET，参数走 query string）
    """
    if not host_port:
        return None

    if not host_port.startswith("http://") and not host_port.startswith("https://"):
        host_port = "http://" + host_port

    url = f"{host_port}/wxapp/getPhoneNumber"
    headers = {"Authorization": _yyb_auth} if _yyb_auth else {}
    params = {"ref": ref, "app_id": appid}

    try:
        resp = requests.post(url, json=params, headers=headers, timeout=10)
        if resp.status_code == 405:
            resp = requests.get(url, params=params, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            inner_data = data.get("data", {}) or {}
            result = inner_data.get("result", {}) if isinstance(inner_data.get("result"), dict) else {}
            code = result.get("code") or inner_data.get("code")
            if code:
                return code
            log(f"  ⚠️ YYB GO 返回 phone code 为空: {data}")
        else:
            log(f"  ⚠️ YYB GO 请求 phone code 失败: {resp.status_code}")
    except Exception as e:
        log(f"  ⚠️ YYB GO 请求 phone code 异常: {e}")
    return None


# ---------- 账号来源 ----------
def load_accounts():
    """从 YYB_GO 环境变量解析多账号，换行分隔，支持#注释"""
    accounts = []

    yyb_go_raw = os.environ.get("YYB_GO", "").strip()
    if yyb_go_raw:
        lines = yyb_go_raw.splitlines()
        for line in lines:
            line = line.strip()
            # 空行 / #注释行跳过
            if not line or line.startswith("#"):
                continue
            host_port, ref = parse_yyb_go_env(line)
            if ref and host_port:
                _nm = _NAME_MAP.get(ref)
                accounts.append({
                    "openid": ref,
                    "display_name": _nm if _nm else ref[:8] + "...",
                    "source": "yyb_go",
                    "ref": ref,
                    "host_port": host_port,  # 存入host_port，后面BfshAccount调用
                })
                log(f"  📥 从 YYB_GO 解析到账号: {ref[:8]}...")
            else:
                log(f"  ⚠️ YYB_GO 当前行格式错误: {line}")

    # 回退到 BFSH_TOKEN
    if not accounts:
        env = os.environ.get("BFSH_TOKEN", "").strip()
        if env:
            for line in env.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "#" in line:
                    openid, name = line.split("#", 1)
                else:
                    openid, name = line, line[:6]
                _nm = _NAME_MAP.get(openid.strip())
                accounts.append({"openid": openid.strip(), "display_name": _nm if _nm else name.strip(), "source": "env"})

    return accounts


# ---------- 缓存 ----------
def load_cache():
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_cache(data):
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log(f"  ⚠️ 写缓存失败: {e}")


def ok_resp(data):
    if not isinstance(data, dict):
        return False
    if data.get("_error"):
        return False
    if data.get("error"):
        return False
    code = data.get("code")
    return code in (None, 0, 200)


def _need_first_verify(msg):
    if not msg:
        return False
    return "首次验证" in str(msg)


# ---------- 账号类 ----------
class BfshAccount:
    def __init__(self, acc):
        self.openid = acc.get("openid")
        self.display_name = acc.get("display_name") or self.openid or "?"
        self.source = acc.get("source")
        self.ref = acc.get("ref") or self.openid  # YYB GO 的 ref
        self.host_port = acc.get("host_port") 
        self.jsessionid = ""
        self.tenant_id = ""
        self.user_id = ""
        self.code = None
        self.err = ""
        self.session = requests.Session()
        _mount_retry(self.session)

    def _build_url(self, path):
        url = PORTAL + path
        if self.jsessionid:
            if "?" in url:
                url = url.replace("?", f";jsessionid={self.jsessionid}?", 1)
            else:
                url += f";jsessionid={self.jsessionid}"
        return url

    def _headers(self):
        h = {
            "User-Agent": UA,
            "xweb_xhr": "1",
            "Content-Type": "application/json",
            "Accept": "*/*",
            "Sec-Fetch-Site": "cross-site",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            "Referer": "https://servicewechat.com/wxb9be8e4f98c3fbe5/26/page-frame.html",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }
        if self.tenant_id:
            h["X-Tenant-ID"] = self.tenant_id
        return h

    def _req(self, method, path, params=None, json=None):
        url = self._build_url(path)
        try:
            r = self.session.request(method, url, params=params, json=json,
                                      headers=self._headers(), timeout=20)
        except Exception as e:
            return None, {}, str(e)
        sid = r.headers.get("sid") or r.headers.get("Sid")
        if not sid:
            for c in self.session.cookies:
                if "JSESSIONID" in c.name.upper():
                    sid = c.value
                    break
        if sid:
            self.jsessionid = sid
            self.session.cookies.clear()
        uc = r.headers.get("token") or r.headers.get("Token")
        if uc:
            self.uc = uc
        try:
            data = r.json()
        except Exception:
            data = {"_error": f"非JSON:{r.status_code}", "_text": r.text[:200]}
        return data, r.headers, None

    def _get_wechat_code(self):
        """通过 YYB GO 获取微信登录 code"""
        if not self.ref or not self.host_port:
            log("  ❌ 缺少 ref / host_port")
            return None
        return get_yyb_wechat_code(self.ref, self.host_port, APPID)

    def _get_phone_code(self):
        """通过 YYB GO 获取手机号授权 code"""
        if not self.ref or not self.host_port:
            log("  ❌ 缺少 ref / host_port")
            return None
        return get_yyb_phone_code(self.ref, self.host_port, APPID)

    def _open_anon_session(self, code):
        data, _, err = self._req("GET", "/platform-user/getOpenidAnon",
                                 params={"code": code, "gzh": "false"})
        if err or data.get("_error"):
            self.err = f"getOpenidAnon 失败: {err or data.get('_error')}"
            return False
        if not self.jsessionid:
            self.err = "getOpenidAnon 未返回 jsessionid"
            return False
        return True

    def _load_tenant(self):
        cfg, _, _ = self._req("GET", "/user/getMallConfigAnon",
                              params={"code": "1001", "clientType": "mp-weixin"})
        if ok_resp(cfg) and isinstance(cfg.get("data"), dict):
            self.tenant_id = cfg["data"].get("$tenantId", "") or ""
        return True

    def _get_base_info(self):
        data, _, err = self._req("GET", "/user/getBaseInfoAnon")
        if err or data.get("_error"):
            return None
        if ok_resp(data):
            return data.get("data") or {}
        return None

    def _phone_login(self):
        wxcode = self._get_phone_code()
        if not wxcode:
            log("  ⚠️ 未获取到手机号授权 code")
            return False
        log(f"  📱 获取到手机号授权 code: {wxcode[:20]}...")
        payload = {"wxCode": wxcode, "type": "N", "parentId": "", "clientType": "mp-weixin"}
        data, _, err = self._req("POST", "/phoneLogin", json=payload)
        if err:
            log(f"  ⚠️ phoneLogin 请求异常: {err}")
            return False
        if ok_resp(data):
            log(f"  ✅ phoneLogin 成功")
            return True
        log(f"  ⚠️ phoneLogin 失败: {data.get('msg') or data.get('code')}")
        return False

    def _load_injected(self):
        raw = os.environ.get("BFSH_SESSION", "").strip()
        if not raw:
            return False
        try:
            try:
                data = json.loads(raw)
            except Exception:
                with open(raw, "r", encoding="utf-8") as f:
                    data = json.load(f)
        except Exception:
            return False
        entry = data.get(self.openid) if self.openid else None
        if not isinstance(entry, dict) and len(data) == 1:
            entry = list(data.values())[0]
        if isinstance(entry, dict) and entry.get("jsessionid") and entry.get("user_id"):
            self.jsessionid = entry["jsessionid"]
            self.tenant_id = entry.get("tenant_id", "")
            self.user_id = str(entry["user_id"])
            log("  🔑 使用注入会话 (BFSH_SESSION)")
            return True
        return False

    def _save(self, cache):
        if not self.openid:
            return
        cache[self.openid] = {
            "jsessionid": self.jsessionid,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
        }
        save_cache(cache)

    def login(self, force=False):
        cache = load_cache()
        if not force and self.openid and self.openid in cache:
            c = cache[self.openid]
            if c.get("jsessionid") and c.get("user_id"):
                self.jsessionid = c["jsessionid"]
                self.tenant_id = c.get("tenant_id", "")
                self.user_id = c["user_id"]
                if self._get_base_info() is not None and self.user_id:
                    return True
                log("  🔄 缓存会话失效，重新登录")

        # 1. 获取微信登录 code
        code = self._get_wechat_code()
        if not code:
            log("  ❌ 无法获取 wx.login code（检查 YYB_GO 环境变量）")
        else:
            self.code = code
            log(f"  ✅ 获取到 wx.login code: {code[:10]}...")
            
            # 2. 建立匿名会话
            if self._open_anon_session(code):
                self._load_tenant()
                
                # 3. 手机号登录
                if self._phone_login():
                    info = self._get_base_info()
                    if info and info.get("id"):
                        self.user_id = str(info["id"])
                        self._save(cache)
                        log(f"  ✅ 登录成功，user_id={self.user_id}")
                        return True
                    log("  ⚠️ phoneLogin 后未返回用户 id")
                
                # 4. 如果手机号登录失败，尝试获取匿名用户信息
                info = self._get_base_info()
                if info and info.get("id"):
                    self.user_id = str(info["id"])
                    self._save(cache)
                    log(f"  ✅ 匿名登录成功，user_id={self.user_id}")
                    return True
                log("  ⚠️ 未获取到 user_id")

        # 5. 尝试注入会话
        if self._load_injected():
            return True

        # 6. 尝试从缓存恢复 user_id
        if self.openid and self.openid in cache:
            c = cache[self.openid]
            if c.get("user_id"):
                self.user_id = c["user_id"]
                return True

        self.err = "无法获得用户 id：请检查 YYB_GO 配置"
        log(f"  ❌ {self.err}")
        return False

    def refresh_session(self):
        return self.login(force=True)

    def check_limit(self, adpid):
        data, _, err = self._req("GET", "/ad/checkLimit", params={"adpid": adpid})
        if err or data.get("_error"):
            return None
        d = data.get("data") or {}
        return {
            "count": int(d.get("count", 0) or 0),
            "limited": bool(d.get("limited", False)),
            "totalAds": int(d.get("totalAds", 10) or 10),
            "adProfit": d.get("adProfit", 0),
            "needLogin": bool(d.get("needLogin", False)),
            "id": d.get("id"),
            "msg": data.get("msg") or data.get("message") or "",
            "code": data.get("code"),
        }

    def complete(self, adpid, ad_task_id, need_login):
        if not self.user_id:
            log("  ❌ 缺少 user_id，无法完成广告")
            return False, "缺少 user_id"
        token = feistel_encrypt(ad_task_id, self.user_id)
        path = f"/ad/complete?token={token}&adpid={adpid}"
        if need_login and self.code:
            path += f"&code={self.code}"
        data, _, err = self._req("POST", path, json={})
        if err:
            return False, err
        if ok_resp(data):
            return True, data.get("msg") or "ok"
        return False, (data.get("msg") or data.get("message") or str(data)[:80])

    def _get_inviter(self):
        data, _, err = self._req("GET", "/user/getInviter")
        if err or data.get("_error"):
            return "error", err or data.get("_error")
        code = data.get("code")
        if code == 200 and data.get("data"):
            return "bound", data["data"]
        if code in (401, "401"):
            return "unauth", None
        return "unbound", None

    def _set_inviter(self, code=INVITER_CODE):
        data, _, err = self._req("POST", "/user/setInviter", params={"code": code})
        if err or data.get("_error"):
            return False, err or data.get("_error")
        if data.get("code") == 200:
            return True, data.get("msg") or "ok"
        return False, data.get("msg") or str(data.get("code"))

    def ensure_inviter(self):
        kind, payload = self._get_inviter()
        if kind == "unauth":
            self.login(force=True)
            kind, payload = self._get_inviter()
        if kind == "error":
            log(f"  ⚠️ 查询邀请人失败: {payload}")
            return "查询失败"

        already = payload if kind == "bound" else None
        if already and not FORCE_REBIND:
            name = already.get("nickname") or already.get("phone") or "?"
            log(f"  🤝 已绑定: {name}")
            return f"已绑定:{name}"

        if already:
            name = already.get("nickname") or already.get("phone") or "?"
        else:
            log(f"  🔗 未绑定邀请人")

        if DRY_RUN:
            return "待绑定(查)"
        ok, msg = self._set_inviter()
        if ok:
            k2, d2 = self._get_inviter()
            if k2 == "bound":
                nm = d2.get("nickname") or d2.get("phone") or "?"
                log(f"  ✅ 已绑定邀请人: {nm}")
                return f"已绑定:{nm}"
            return "绑定存疑"
        if "hasCycleInvite" in str(msg):
            log(f"  ℹ️ 本账号即邀请码持有者（{INVITER_CODE}），无需绑定，跳过")
            return "本人邀请码"
        if "errorReq" in str(msg):
            return "不可改绑"
        log(f"  ⚠️ 绑定邀请人失败: {msg}")
        return f"绑定失败:{msg}"

    def run(self):
        result = {"name": self.display_name, "watched": 0}
        if not self.login():
            log(f"  ❌ 登录失败: {self.err or '登录失败'}")
            result["errors"] = [self.err or "登录失败"]
            return result

        result["inviter"] = self.ensure_inviter()

        adpid = get_server_adpid()
        log(f"  🔑 会话就绪 | user_id={self.user_id} | adpid={adpid}"
            + (f" | tenant={self.tenant_id}" if self.tenant_id else ""))

        watched = 0
        while True:
            info = self.check_limit(adpid)
            if info is None:
                result.setdefault("errors", []).append("查询广告上限失败")
                break

            if _need_first_verify(info.get("msg")):
                log(f"  ⚠️ 需完成首次验证（{info.get('msg')}）")
                log(f"  💡 请在微信小程序「八富生活」内手动看一次广告解除限制")
                result["skipped"] = "需完成首次验证(小程序内手动看广告)"
                break

            count = info["count"]
            total = info["totalAds"]
            log(f"  📺 广告状态: 已看 {count}/{total} | limited={info['limited']} "
                f"| needLogin={info['needLogin']} | adId={info['id']} | 单条收益={info['adProfit']}")

            if info["limited"] or count >= total:
                log("  ✅ 今日广告已达上限，结束")
                break

            if DRY_RUN:
                remaining = max(0, total - count)
                log(f"  🔍 DRY_RUN: 将观看 {remaining} 个广告（不实际等待/完成）")
                result["watched"] = remaining
                result["dry_run"] = True
                break

            if info["needLogin"]:
                fresh = self._get_wechat_code()
                if fresh:
                    self.code = fresh
                    log("  🔑 取得新鲜 wx.login code 用于完成")
                else:
                    if not self.refresh_session():
                        result.setdefault("errors", []).append("needLogin 且无法获取 code/刷新会话")
                        break

            time.sleep(random.uniform(AD_CHECK_GAP, AD_CHECK_GAP + 1))
            info2 = self.check_limit(adpid)
            if info2 is None:
                result.setdefault("errors", []).append("第二次 checkLimit 失败")
                break
            ad_task_id = info2["id"]
            log(f"  📺 开始观看广告 (adTaskId={ad_task_id})...")

            watch_time = AD_WATCH_SECONDS + random.uniform(1, 5)
            log(f"  ⏳ 等待 {watch_time:.0f} 秒（模拟广告播放）...")
            time.sleep(watch_time)

            ok, msg = self.complete(adpid, ad_task_id, info2["needLogin"])
            if ok:
                watched += 1
                log(f"  ✅ 完成第 {watched} 个广告: {msg}")
            elif _need_first_verify(msg):
                log(f"  ⚠️ 需完成首次验证（{msg}）")
                log(f"  💡 请在微信小程序「八富生活」内手动看一次广告解除限制")
                result["skipped"] = "需完成首次验证(小程序内手动看广告)"
                break
            elif "时间不足" in str(msg) or "不足" in str(msg):
                log(f"  ⚠️ 服务端返回: {msg}（可能需要更长的等待时间）")
                result.setdefault("errors", []).append(f"时间不足:{msg}")
                time.sleep(random.uniform(AD_GAP_MIN, AD_GAP_MIN + AD_GAP_EXTRA))
                continue
            else:
                log(f"  ⚠️ 完成失败: {msg}")
                result.setdefault("errors", []).append(f"广告完成失败:{msg}")
                time.sleep(random.uniform(AD_GAP_MIN, AD_GAP_MIN + AD_GAP_EXTRA))
                continue

            gap = random.uniform(AD_GAP_MIN, AD_GAP_MIN + AD_GAP_EXTRA)
            log(f"  💤 间隔 {gap:.1f}s 后继续")
            time.sleep(gap)

        result["watched"] = watched
        return result


# ---------- 汇总推送 ----------
def push_all_summary(results):
    if not results:
        return
    lines = ["📣 八富生活 看广告赚金币 汇总"]
    lines.append("─" * 28)
    for i, r in enumerate(results):
        icon = ACCOUNT_ICONS[i % len(ACCOUNT_ICONS)]
        name = r.get("name", "?")
        line = f"{icon} {name}"
        if r.get("skipped"):
            line += f"  ⏭️ {r['skipped']}"
        elif r.get("errors"):
            line += "  ⚠️ " + "; ".join(r["errors"])
        else:
            watched = r.get("watched", 0)
            if r.get("dry_run"):
                line += f"  🔍 将观看{watched}个(查)"
            else:
                line += f"  观看{watched}个广告✓"
        inviter = r.get("inviter")
        if inviter:
            line += f"  | 邀请人:{inviter}"
        lines.append(line)
        lines.append("─" * 28)
    text = "\n".join(lines)
    log("")
    log(text)
    if not QYWX_KEY:
        log("  ℹ️ 未配置 QYWX_KEY，跳过企业微信推送")
        return
    try:
        resp = requests.post(
            "https://qyapi.weixin.qq.com/cgi-bin/webhook/send",
            params={"key": QYWX_KEY},
            json={"msgtype": "text", "text": {"content": text}},
            timeout=10,
        )
        if resp.json().get("errcode") == 0:
            log("  ✅ 企业微信推送成功")
        else:
            log(f"  ⚠️ 企业微信推送失败: {resp.text[:120]}")
    except Exception as e:
        log(f"  ⚠️ 企业微信推送异常: {e}")


# ---------- 入口 ----------
def main():
    log("🚀 开始八富生活 看广告赚金币 自动任务")
    if DRY_RUN:
        log("🔍 DRY_RUN 模式：只查询广告状态，不实际观看/完成")
    adpid = get_server_adpid()
    log(f"🎯 广告位 adpid={adpid}")
    accounts = load_accounts()
    if not accounts:
        log("❌ 未获取到任何账号：请配置 YYB_GO 环境变量")
        log("   格式: YYB_GO=host:port@ref")
        log("   例如: YYB_GO=127.0.0.1:8000@owNAX6mkpZiXq4i9EP_tXp1KnxEk")
        return
    src = accounts[0]["source"]
    log(f"📋 获取到 {len(accounts)} 个账号（来源：{src}）")
    results = []
    for idx, acc in enumerate(accounts, 1):
        log(f"▶ [{idx}/{len(accounts)}] 处理账号: {acc.get('display_name')}")
        a = BfshAccount(acc)
        try:
            r = a.run()
        except Exception as e:
            r = {"name": a.display_name, "errors": [f"异常: {e}"]}
            log(f"  ❌ 异常: {e}")
        results.append(r)
    push_all_summary(results)
    log("🏁 全部账号处理完成")


if __name__ == "__main__":
    main()
