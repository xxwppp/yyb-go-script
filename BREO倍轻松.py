#by:哆啦A梦
#入口:http://mx.qrurl.net/h5/wxa/link?sid=26407uif5Oq
#BREO 变量填写 YYB_GO：地址@微信账号标识，多账号换行或&分隔
#账号变量名：YYB_GO（不再用 BREO / wx_server_url / wx_auth）
#new Env("BREO")
#cron 8 9,10,11 * * *

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

import requests
import json
import os
import sys
import time
from pathlib import Path

if hasattr(__sys.stdout, "reconfigure"):
    __sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(__sys.stderr, "reconfigure"):
    __sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# === YYB 协议统一认证（自动 https + Basic/Bearer） begin ===
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
        if isinstance(url, str) and "/wxapp/getCode" in url:
            kwargs.setdefault("headers", {})
            kwargs["headers"]["Authorization"] = _yyb_auth
        return _orig_requests_post(url, *args, **kwargs)
    requests.post = _yyb_requests_post
# === YYB 协议统一认证 end ===

MINI_APP_ID = "wx61457400e4212cec"
TOKEN_CACHE_PATH = Path(__file__).with_name("BREO_token_cache.json")
LOGIN_BASE = "https://breoplus.breo.cn/app/minic"
APP_BASE = "https://breoplus.breo.cn/breo-app"
DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF"

session = requests.Session()

def read_token_cache():
    try:
        if not TOKEN_CACHE_PATH.exists():
            return {}
        return json.loads(TOKEN_CACHE_PATH.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}

def write_token_cache(cache):
    try:
        TOKEN_CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"⚠️ 写入token缓存失败: {e}")

def mask_token(token):
    if not token:
        return ""
    return f"{token[:6]}***{token[-6:]}"

def is_success(result):
    return result.get("success") is True or str(result.get("code")) in ("0000", "200", "200.0")

def is_token_error(message):
    text = str(message)
    return any(key in text for key in ["40101", "40102", "token", "登录", "授权", "过期", "失效"])

def wx_headers():
    return {
        "User-Agent": DEFAULT_UA,
        "Content-Type": "application/json",
    }

def app_headers(token=None):
    headers = {
        "User-Agent": DEFAULT_UA,
        "content-Type": "application/json",
        "Content-Type": "application/json",
        "deviceInfo": "{}",
        "Referer": "https://servicewechat.com/wx61457400e4212cec/390/page-frame.html",
    }
    if token:
        headers["token"] = token
    return headers

def breo_task_headers(token):
    return {
        "token": token,
        "device-type": "Xiaomi",
        "device-version": "10",
        "channel": "Breo",
        "version_code": "30201",
        "version": "3.2.1",
        "encrypt": "1",
        "Content-Type": "application/json; charset=UTF-8",
        "Referer": "https://servicewechat.com/wx61457400e4212cec/390/page-frame.html",
        "User-Agent": DEFAULT_UA,
    }

def parse_yyb_go_entry(raw_value):
    raw_value = (raw_value or "").strip()
    if not raw_value or "@" not in raw_value:
        return None, None
    server, ref = raw_value.split("@", 1)
    server = server.strip()
    if server.startswith("http://"):
        server = server[7:]
    elif server.startswith("https://"):
        server = server[8:]
    server = server.rstrip("/")
    ref = ref.strip()
    if not server or not ref:
        return None, None
    return server, ref

# YYB 模式：通过 YYB_GO 内网服务换取微信 code（替代 wx_server_url / wx_auth）
def get_wx_code(entry):
    server, ref = parse_yyb_go_entry(entry)
    if not server or not ref:
        raise RuntimeError(f"YYB_GO 格式错误: {entry}")
    # YYB 认证头（session.post 不经过 requests.post 补丁，这里手动带上）
    _tok = os.getenv("YYB_TOKEN", "")
    _u = os.getenv("YYB_USER", "")
    _p = os.getenv("YYB_PASS", "")
    _auth = ""
    if _tok:
        _auth = f"Bearer {_tok}"
    elif _u and _p:
        _auth = "Basic " + _b64.b64encode(f"{_u}:{_p}".encode()).decode()
    url = f"http://{server}/wxapp/getCode"
    print(f"[{yyb_display(entry)}] 请求 YYB Go 获取 code: {url}")
    resp = session.post(
        url,
        json={"ref": ref, "app_id": MINI_APP_ID},
        headers={"Authorization": _auth} if _auth else {},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    code = ((data.get("data") or {}).get("result") or {}).get("code")
    if data.get("code") != 0 or not code:
        raise RuntimeError(f"YYB Go 未返回 code: {data}")
    print(f"[{yyb_display(entry)}] 获取 code 成功")
    return code

def login_with_code(account_id):
    code = get_wx_code(account_id)
    login_resp = session.get(
        f"{LOGIN_BASE}/login/{code}",
        headers=app_headers(),
        timeout=30,
    )
    login_resp.raise_for_status()
    login_data = login_resp.json()
    if str(login_data.get("code")) != "200" or not login_data.get("data"):
        raise RuntimeError(f"code登录失败: {login_data}")
    user_info = login_data["data"]
    uid = user_info.get("uid")
    open_id = user_info.get("openId")
    union_id = user_info.get("unionId")
    if not uid:
        raise RuntimeError(f"登录响应缺少uid: {login_data}")

    token_resp = session.post(
        f"{APP_BASE}/customer/loginByUid",
        json={"uid": uid, "openId": open_id, "unionId": union_id},
        headers=app_headers(),
        timeout=30,
    )
    token_resp.raise_for_status()
    token_data = token_resp.json()
    if not is_success(token_data) or not (token_data.get("result") or {}).get("token"):
        raise RuntimeError(f"业务token登录失败: {token_data}")
    return {
        "token": token_data["result"]["token"],
        "uid": uid,
        "openId": open_id,
        "unionId": union_id,
        "userInfo": user_info,
        "customer": token_data.get("result", {}),
        "updatedAt": int(time.time()),
    }

def get_cached_token(account_id):
    return read_token_cache().get(account_id)

def save_cached_token(account_id, auth_info):
    cache = read_token_cache()
    cache[account_id] = auth_info
    write_token_cache(cache)

def remove_cached_token(account_id):
    cache = read_token_cache()
    if account_id in cache:
        del cache[account_id]
        write_token_cache(cache)

def validate_token(token):
    try:
        resp = session.post(
            f"{APP_BASE}/getUserLevelInfoByUid",
            headers=app_headers(token),
            timeout=15,
        )
        if resp.status_code != 200:
            return False
        data = resp.json()
        if is_success(data):
            return True
        return not is_token_error(data)
    except Exception:
        return False

def get_token_for_account(account_id, index):
    cached = get_cached_token(account_id)
    if cached and cached.get("token"):
        print(f"账号 {index} 使用缓存token: {mask_token(cached['token'])}")
        if validate_token(cached["token"]):
            return cached["token"]
        print(f"账号 {index} 缓存token失效，重新登录")
        remove_cached_token(account_id)

    auth_info = login_with_code(account_id)
    save_cached_token(account_id, auth_info)
    user_info = auth_info.get("userInfo") or {}
    print(f"账号 {index} code登录成功: {user_info.get('nickname') or user_info.get('telephone') or auth_info.get('uid')}")
    return auth_info["token"]

def get_random_one_word():
    try:
        response = requests.get("https://uapis.cn/api/say")
        if response.status_code == 200:
            return response.text.strip()
        else:
            return "无法获取一言"
    except Exception as e:
        print(f"获取一言时出错: {e}")
        return "无法获取一言"

def get_proclamation():
    primary_url = "https://github.com/3288588344/toulu/raw/refs/heads/main/tl.txt"
    backup_url = "https://tfapi.cn/TL/tl.json"
    try:
        response = requests.get(primary_url, timeout=10)
        if response.status_code == 200:
            print("\n" + "=" * 50)
            print("📢 公告信息")
            print("=" * 35)
            print(response.text)
            print("=" * 35 + "\n")
            print("公告获取成功，开始执行任务...\n")
            return
    except requests.exceptions.RequestException as e:
        print(f"获取公告时发生错误: {e}, 尝试备用链接...")

    try:
        response = requests.get(backup_url, timeout=10)
        if response.status_code == 200:
            print("\n" + "=" * 50)
            print("📢 公告信息")
            print("=" * 35)
            print(response.text)
            print("=" * 35 + "\n")
            print("公告获取成功，开始执行任务...\n")
        else:
            print(f"⚠️ 获取公告失败，状态码: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"⚠️ 获取公告时发生错误: {e}, 可能是网络问题或链接无效。")

def post_to_breo(token, content, title):
    url = "https://breoplus.breo.cn/breo-app/communityBaseInfo/releasePost"
    headers = breo_task_headers(token)
    data = {
        "anonymoused": 1,
        "content": content,
        "expressText": "",
        "images": [],
        "subTitle": "",
        "title": title,
        "topicText": ""
    }
    try:
        response = requests.post(url, headers=headers, data=json.dumps(data))
        if response.status_code == 200:
            result = response.json()
            if result.get("success", False):
                print("✅ 发帖成功！")
                print(f"帖子 ID: {result['result']['id']}")
                print(f"帖子标题: {result['result']['title']}")
                return result["result"]["id"]
            else:
                print(f"❌ 发帖失败，错误信息：{result.get('message', '未知错误')}")
                return None
        else:
            print(f"❌ 请求失败，状态码：{response.status_code}")
            return None
    except Exception as e:
        print(f"❌ 请求错误: {e}")
        return None

def collect_post(token, post_id):
    url = "https://breoplus.breo.cn/breo-app/communityBaseInfo/collect"
    headers = breo_task_headers(token)
    data = {
        "postId": post_id
    }
    try:
        response = requests.post(url, headers=headers, data=json.dumps(data))
        if response.status_code == 200:
            result = response.json()
            if result.get("success", False):
                print("✅ 收藏成功！")
                reward = result.get("result") or {}
                print(f"获得点数: {reward.get('point', 0)}")
                print(f"成长值: {reward.get('grow', 0)}")
            else:
                print(f"❌ 收藏失败，错误信息：{result.get('message', '未知错误')}")
        else:
            print(f"❌ 请求失败，状态码：{response.status_code}")
    except Exception as e:
        print(f"❌ 请求错误: {e}")

def comment_post(token, post_id):
    for _ in range(2):  # 评论2次
        comment_content = get_random_one_word()  # 使用随机一言作为评论内容
        url = "https://breoplus.breo.cn/breo-app/communityBaseInfo/comment"
        headers = breo_task_headers(token)
        data = {
            "anonymoused": 0,
            "commentText": comment_content,
            "postId": post_id
        }
        try:
            response = requests.post(url, headers=headers, data=json.dumps(data))
            if response.status_code == 200:
                result = response.json()
                if result.get("success", False):
                    print("✅ 评论成功！")
                    reward = result.get("result") or {}
                    root = reward.get("rootOutVO") or {}
                    print(f"评论内容: {root.get('commentText', comment_content)}")
                    print(f"获得点数: {reward.get('point', 0)}")
                    print(f"成长值: {reward.get('grow', 0)}")
                else:
                    print(f"❌ 评论失败，错误信息：{result.get('message', '未知错误')}")
            else:
                print(f"❌ 请求失败，状态码：{response.status_code}")
        except Exception as e:
            print(f"❌ 请求错误: {e}")
        time.sleep(1)  # 避免频繁请求

def browse_mall(token):
    url = "https://breoplus.breo.cn/breo-app/user/po-task-info/mall"
    headers = breo_task_headers(token)
    try:
        response = requests.post(url, headers=headers)
        if response.status_code == 200:
            result = response.json()
            if result.get("success", False):
                print("✅ 浏览商城成功！")
                reward = result.get("result") or {}
                print(f"获得点数: {reward.get('point', 0)}")
                print(f"成长值: {reward.get('grow', 0)}")
            else:
                print(f"❌ 浏览商城失败，错误信息：{result.get('message', '未知错误')}")
        else:
            print(f"❌ 请求失败，状态码：{response.status_code}")
    except Exception as e:
        print(f"❌ 请求错误: {e}")

def punch_in(token):
    url = "https://breoplus.breo.cn/breo-app/user/po-task-info/punch"
    headers = breo_task_headers(token)
    try:
        response = requests.post(url, headers=headers)
        if response.status_code == 200:
            result = response.json()
            if result.get("success", False):
                print("✅ 签到成功！")
                reward = result.get("result") or {}
                print(f"获得点数: {reward.get('point', 0)}")
                print(f"成长值: {reward.get('grow', 0)}")
            else:
                print(f"❌ 签到失败，错误信息：{result.get('message', '未知错误')}")
        else:
            print(f"❌ 请求失败，状态码：{response.status_code}")
    except Exception as e:
        print(f"❌ 请求错误: {e}")

if __name__ == "__main__":
    # 获取公告
    #get_proclamation()

    # 从环境变量读取 wx_server 账号标识/openid
    # YYB 模式：账号来自环境变量 YYB_GO（格式：地址@微信账号标识，多账号用 & 或换行分隔）
    accounts = [item.strip() for item in os.getenv("YYB_GO", "").replace("&", "\n").splitlines() if item.strip()]

    if not accounts:
        print("❌ 未检测到 账号信息，退出脚本。")
    else:
        skip_community = os.getenv("BREO_SKIP_COMMUNITY", "").lower() in ("1", "true", "yes")
        print("=============== 开始执行任务 ===============")
        for i, account in enumerate(accounts, 1):
            print(f"\n-------------- 账号 {i} 开始 --------------")
            try:
                token = get_token_for_account(account, i)
            except Exception as e:
                print(f"❌ 账号 {i} 登录失败: {e}")
                continue

            print("🚀 正在签到...")
            punch_in(token)

            if skip_community:
                print("\n📝 已跳过发帖/收藏/评论任务")
            else:
                print("\n📝 正在发布帖子...")
                post_id = post_to_breo(token, "这是一个自动发布的帖子", "自动化测试")
                if post_id:
                    print("\n⭐ 正在收藏帖子...")
                    collect_post(token, post_id)

                    print("\n💬 正在评论帖子...")
                    comment_post(token, post_id)
                else:
                    print("❌ 发帖失败，跳过后续操作。")

            print("\n🛒 正在浏览商城...")
            browse_mall(token)

            print(f"-------------- 账号 {i} 结束 --------------")

        print("\n=============== 所有任务执行完毕 ===============")
