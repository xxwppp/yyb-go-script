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

# name: 认养一头牛
# cron: 17 9 * * *

"""
认养一头牛签到（YYB Go 版）

功能：
  1. YYB_SERVER 获取微信 code + 手机号加密数据
  2. minilogin 换取 token（本地缓存 + 自动续期）
  3. 每日签到
  4. 试用申请
  5. 中奖记录查询
  6. 社区答题（智能缓存正确答案）
  7. 发帖种草后自动删帖

环境变量：
  YYB_GO        必填：YYB Go 服务地址@openid，多账号用 & 或换行分隔

依赖：
  pip install requests
"""

import json
import os
import random
import time
from datetime import datetime, timezone, timedelta
import io
import sys

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
        if isinstance(url, str) and "/wxapp/" in url:
            kwargs.setdefault("headers", {})
            kwargs["headers"]["Authorization"] = _yyb_auth
        return _orig_requests_post(url, *args, **kwargs)
    requests.post = _yyb_requests_post
# === YYB 协议统一认证 end ===

# 青龙自带通知模块
try:
    from notify import send
except Exception as exc:
    print(f"[警告] 青龙通知模块 notify.py 导入失败：{exc}，将跳过通知推送。")

    def send(title: str, content: str, **kwargs):
        pass


BASE_URL = "https://www.milkcard.mall.ryytngroup.com"
APP_ID = "wx0408f3f20d769a2f"
ACCOUNT_FILE = "token_caches/ryytncookie.json"

# 答题正确答案缓存（内存级，跨账号共享）
ANSWER_CACHE = {}


# ============ YYB Go 解析 ============

def parse_yyb_servers():
    raw = os.getenv("YYB_GO", "")
    return [line.strip() for line in raw.replace("&", "\n").splitlines() if line.strip() and "@" in line.strip()]


def parse_yyb_entry(raw):
    raw = raw.strip()
    at_idx = raw.index("@")
    server = raw[:at_idx].strip()
    ref = raw[at_idx + 1:].strip()
    if server.startswith("http://"):
        server = server[7:]
    elif server.startswith("https://"):
        server = server[8:]
    server = server.rstrip("/")
    return server, ref


def mask_token(token: str) -> str:
    if len(token) <= 12:
        return token
    return f"{token[:6]}****{token[-4:]}"


def mask_phone(phone: str) -> str:
    if len(phone) >= 11:
        return f"{phone[:3]}****{phone[-4:]}"
    return phone


# ============ 业务请求 ============

def request_json(token: str, method: str, path: str, payload: dict | None = None) -> tuple[bool, str, dict | None]:
    url = f"{BASE_URL}{path}"
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.61(0x18003d24) NetType/4G Language/zh_CN",
        "Referer": "https://servicewechat.com/wx0408f3f20d769a2f/305/page-frame.html",
        "X-Auth-Token": token,
        "Accept": "application/json",
    }

    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        else:
            response = requests.post(url, headers=headers, json=payload or {}, timeout=30)
    except Exception as exc:
        return False, f"请求异常: {exc}", None

    text = response.text
    if not response.ok:
        return False, f"HTTP {response.status_code}: {text[:200]}", None

    try:
        data = response.json()
    except Exception as exc:
        return False, f"JSON解析失败: {exc}; body={text[:500]}", None

    if not isinstance(data, dict):
        return False, f"响应不是 JSON 对象: {text[:200]}", data
    if data.get("code") != 200:
        return False, f"请求失败: code={data.get('code')} msg={data.get('msg') or '未知错误'}", data
    return True, "ok", data


def check_checkin_status(token: str):
    return request_json(token, "POST", "/mall/xhr/task/checkin/save")


def get_checkin_rule(token: str):
    return request_json(token, "GET", "/mall/xhr/task/checkin/getRule")


def get_address_list(token: str):
    return request_json(token, "POST", "/mall/xhr/address/receive/list")


def get_trial_list(token: str):
    return request_json(token, "POST", "/mall/xhr/freeTrial/getList", {"pageNum": 1, "pageSize": 10, "statusList": [1, 2]})


def apply_trial(token: str, trial_id: int, address_id: int):
    return request_json(token, "POST", "/mall/xhr/freeTrial/apply", {"id": trial_id, "addressId": address_id})


def get_winning_records(token: str):
    return request_json(token, "POST", "/mall/xhr/freeTrialUser/getList", {"parentTabStatus": 1, "pageNum": 1, "pageSize": 10, "subTabStatus": 1})


def get_quiz_activities(token: str):
    return request_json(token, "GET", "/mall/xhr/quizActivity/activities")


def submit_quiz_answer(token: str, quiz_activity_id: int, user_answer: str):
    return request_json(token, "POST", "/mall/xhr/quizActivity/submit", {"quizActivityId": quiz_activity_id, "userAnswer": user_answer})


def get_quiz_records(token: str):
    return request_json(token, "GET", "/mall/xhr/quizActivity/records")


def get_recommend_items(token: str):
    return request_json(
        token,
        "POST",
        "/mall/xhr/community/home/recommend/item",
        {"recommendationId": 7, "sort": "personalized", "direction": "desc", "pageNum": 1, "pageSize": 3},
    )


def push_community_post(token: str, content: str, image_urls: list):
    return request_json(
        token,
        "POST",
        "/mall/xhr/community/posts/push",
        {
            "postId": None,
            "title": "",
            "content": content,
            "imageUrls": image_urls,
            "topicLabelNames": [],
            "communityTopicActivityId": None,
            "communitPostDraftId": None,
            "freeTrialCommentId": None,
            "productIds": [],
        },
    )


def delete_community_post(token: str, post_id: int):
    return request_json(token, "GET", f"/mall/xhr/community/posts/delete?postId={post_id}")


def beijing_today_0am() -> str:
    now = datetime.now(timezone(timedelta(hours=8)))
    return now.strftime("%Y-%m-%d 00:00:00")


# ============ YYB Go token 获取 ============

def refresh_token(server: str, ref: str) -> str | None:
    """通过 YYB Go 获取 code + 手机号数据，调用 minilogin 换 token"""
    try:
        # 1. 获取 wx.login code
        code_resp = requests.post(
            f"http://{server}/wxapp/getCode",
            json={"ref": ref, "app_id": APP_ID},
            timeout=15,
            proxies={"http": None, "https": None},
        )
        code_data = code_resp.json()
        if code_data.get("code") != 0:
            print(f"  [REFRESH] getCode 失败: {code_data}")
            return None
        wx_code = code_data["data"]["result"]["code"]

        # 2. 获取手机号数据
        phone_resp = requests.post(
            f"http://{server}/wxapp/getPhoneNumber",
            json={"ref": ref, "app_id": APP_ID},
            timeout=15,
            proxies={"http": None, "https": None},
        )
        phone_data = phone_resp.json()
        if phone_data.get("code") != 0:
            print(f"  [REFRESH] getPhoneNumber 失败: {phone_data}")
            return None
        result = phone_data["data"]["result"]
        encrypted_data = result.get("encryptedData")
        iv = result.get("iv")
        phone_code = result.get("code", "")

        if not encrypted_data or not iv:
            print("  [REFRESH] 缺少 encryptedData 或 iv")
            return None

        # 3. 调用 minilogin
        login_payload = {
            "encryptedData": encrypted_data,
            "offset": iv,
            "wxCode": wx_code,
            "code": phone_code,
        }
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.61(0x18003d24) NetType/4G Language/zh_CN",
            "Referer": "https://servicewechat.com/wx0408f3f20d769a2f/323/page-frame.html",
        }
        login_resp = requests.post(
            f"{BASE_URL}/mall/xhr/minilogin",
            headers=headers,
            json=login_payload,
            timeout=30,
        )
        token = login_resp.headers.get("X-Auth-Token")
        if not token:
            try:
                body = login_resp.json()
                if body.get("code") == 200 and "data" in body:
                    token = body["data"].get("token") or body["data"].get("x-auth-token")
            except Exception:
                pass
        if token:
            return token
        else:
            print(f"  [REFRESH] minilogin 未返回 token, 响应: {login_resp.text[:200]}")
            return None
    except Exception as e:
        print(f"  [REFRESH] 刷新 token 异常: {e}")
        return None


# ============ 本地缓存管理 ============

def load_accounts() -> list[dict]:
    if not os.path.exists(ACCOUNT_FILE):
        return []
    try:
        with open(ACCOUNT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict) and "ref" in item and "token" in item]
    except Exception as e:
        print(f"[CACHE] 读取缓存文件失败: {e}")
    return []


def save_accounts(accounts: list[dict]):
    os.makedirs(os.path.dirname(ACCOUNT_FILE), exist_ok=True)
    try:
        with open(ACCOUNT_FILE, "w", encoding="utf-8") as f:
            json.dump(accounts, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[CACHE] 保存缓存文件失败: {e}")


# ============ 核心业务 ============

def run_once(account: dict) -> bool:
    token = account["token"]
    ref = account.get("ref", "unknown")
    server = account.get("server", "")
    nickname = account.get("nickname", ref)

    print(f"\n{'='*15}")
    print(f"账号 {yyb_display(ref)} token:{mask_token(token)}")
    print(f"{'='*15}")

    ok, message, checkin = check_checkin_status(token)
    if not ok:
        print(f"[FAIL] token 失效: {message}")
        print("[RETRY] 尝试刷新 token...")
        new_token = refresh_token(server, ref)
        if not new_token:
            print(f"[FAIL] 刷新 token 失败，跳过该账号")
            return False
        account["token"] = new_token
        token = new_token
        print(f"[INFO] 新 token: {mask_token(new_token)}")
        ok, message, checkin = check_checkin_status(new_token)
        if not ok:
            print(f"[FAIL] 刷新后仍失败: {message}")
            return False

    checkin_data = checkin.get("data") or {}
    grade = checkin_data.get("grade")
    phone = str(checkin_data.get("phone") or "")
    point = checkin_data.get("point", 0)
    print(f"手机号: {mask_phone(phone)}  当前积分: {point}")

    # 签到
    ok, msg, _ = get_checkin_rule(token)
    if ok:
        print("✅ 签到成功")
    else:
        print(f"❌ 签到失败: {msg}")

    # 收货地址
    ok, msg, addr = get_address_list(token)
    address_id = None
    city_name = ""
    if not ok:
        print(f"获取收货地址失败: {msg}")
    else:
        addresses = addr.get("data") if isinstance(addr.get("data"), list) else []
        if addresses:
            address_id = int(addresses[0].get("id"))
            city_name = str(addresses[0].get("cityName") or "")
        else:
            print("需要先在小程序 我的-收货地址 中填写地址")

    # 试用申请
    if address_id:
        ok, msg, trial = get_trial_list(token)
        if not ok:
            print(f"获取试用商品列表失败: {msg}")
        else:
            trial_list = ((trial.get("data") or {}).get("list") or [])
            for item in trial_list:
                if item.get("freeTrialButton") != 3:
                    continue
                grade_list = [str(x) for x in (item.get("gradeList") or [])]
                if grade is None or str(grade) not in grade_list:
                    continue
                trial_id = int(item.get("id"))
                product_name = str(item.get("productName") or "")
                draw_time = str(item.get("drawTime") or "")
                print(f"【{product_name}】可申请试用，开奖时间 {draw_time}")
                ok, msg, _ = apply_trial(token, trial_id, address_id)
                if ok:
                    print(f"✅ 试用申请成功，收货地址 {city_name}")
                else:
                    print(f"❌ 试用申请失败: {msg}")

    # 中奖记录
    ok, msg, win = get_winning_records(token)
    if ok:
        records = ((win.get("data") or {}).get("list") or [])
        if not records:
            print("暂无中奖记录")
        else:
            for item in records:
                print(f"恭喜中奖【{item.get('productName') or ''}】，完成试用后需要提交试用报告")
    else:
        print(f"查询中奖记录失败: {msg}")

    # 社区答题
    try:
        run_quiz(token)
    except Exception as e:
        print(f"❌ 社区答题异常: {e}")

    # 发帖删帖
    try:
        run_community_post(token)
    except Exception as e:
        print(f"❌ 发帖种草异常: {e}")

    return True


def run_quiz(token: str):
    global ANSWER_CACHE

    ok, msg, quiz_res = get_quiz_activities(token)
    if not ok:
        print(f"获取社区答题题库失败: {msg}")
        return

    activities = quiz_res.get("data") if isinstance(quiz_res.get("data"), list) else []
    today = beijing_today_0am()
    today_quiz = next((item for item in activities if item.get("relatedDate") == today), None)
    if not today_quiz:
        print("今日暂无社区答题题目")
        return

    print(f"获取到社区答题题目：{today_quiz.get('questionTitle')}")
    try:
        options = json.loads(today_quiz.get("options") or "[]")
    except Exception:
        print("❌ 解析答题选项失败")
        return
    if not options:
        print("未获取到题目选项，跳过答题")
        return

    today_related_date = today_quiz.get("relatedDate")
    selected_key = ANSWER_CACHE.get(today_related_date)

    if selected_key:
        print(f"使用缓存的正确答案：{selected_key}")
    else:
        ok_rec, msg_rec, records_res = get_quiz_records(token)
        if ok_rec:
            records = records_res.get("data", [])
            today_record = next(
                (r for r in records if r.get("relatedDate") == today_related_date and r.get("isCorrect") == 1),
                None
            )
            if today_record:
                selected_key = today_record.get("correctAnswer")
                if selected_key:
                    ANSWER_CACHE[today_related_date] = selected_key
                    print(f"从答题记录获取正确答案：{selected_key}，已缓存")
        else:
            print(f"获取答题记录失败: {msg_rec}")

        if not selected_key:
            selected = random.choice(options)
            selected_key = selected.get("key")
            print(f"随机选择答案：{selected_key}，提交后将获取正确答案")
            time.sleep(6 + random.random() * 2)

            ok_sub, msg_sub, submit = submit_quiz_answer(token, int(today_quiz.get("id")), selected_key)
            if ok_sub:
                data = submit.get("data") or {}
                correct_answer = data.get("correctAnswer")
                if correct_answer:
                    ANSWER_CACHE[today_related_date] = correct_answer
                    print(f"正确答案是：{correct_answer}，已缓存")
                if data.get("isCorrect") == 1:
                    print(f"回答正确，获得{data.get('point', 0)}积分")
                else:
                    print(f"答案错误，今日未获得积分")
            else:
                print(f"❌ 提交答题失败: {msg_sub}")
            return

    time.sleep(6 + random.random() * 2)
    ok_sub, msg_sub, submit = submit_quiz_answer(token, int(today_quiz.get("id")), selected_key)
    if ok_sub:
        data = submit.get("data") or {}
        if data.get("isCorrect") == 1:
            print(f"回答正确，获得{data.get('point', 0)}积分")
        else:
            correct = data.get("correctAnswer", "")
            print(f"答案错误{'，正确答案是' + str(correct) if correct else ''}，今日未获得积分")
    else:
        print(f"❌ 提交答题失败: {msg_sub}")


def run_community_post(token: str):
    ok, msg, recommend = get_recommend_items(token)
    if not ok:
        print(f"获取推荐内容失败: {msg}")
        return

    items = ((recommend.get("data") or {}).get("list") or [])
    if not items:
        print("未获取到推荐帖子内容，跳过发帖")
        return

    item = random.choice(items)
    content = item.get("content") or ""
    image_urls = item.get("imageUrls") or []
    print(f"准备发帖，内容：{content[:10]}...")
    time.sleep(6 + random.random() * 2)

    ok, msg, push_res = push_community_post(token, content, image_urls)
    if not ok:
        print(f"❌ 发帖失败: {msg}")
        return

    post_id = (push_res.get("data") or None)
    print("发帖成功，准备删帖...")
    if not post_id:
        print("❌ 发帖响应中未获取到 postId，取消删帖")
        return

    ok, msg, _ = delete_community_post(token, int(post_id))
    if ok:
        print("帖子删除成功")
        ok, _, final = check_checkin_status(token)
        if ok:
            print(f"操作完成，当前积分 {(final.get('data') or {}).get('point', 0)}")
    else:
        print(f"❌ 删帖失败: {msg}")


def main():
    # 捕获所有输出，结束后用青龙 notify 推送
    captured = io.StringIO()
    orig_stdout = sys.stdout
    sys.stdout = captured

    try:
        _run()
    finally:
        sys.stdout = orig_stdout
        content = captured.getvalue()
        print(content, end="")
        if content.strip():
            send("认养一头牛签到运行结果", content)


def _run():
    servers = parse_yyb_servers()
    if not servers:
        print("❌ 未配置环境变量 YYB_GO")
        print("格式：地址@微信账号标识，多账号用 & 或换行分隔")
        return

    print(f"✅ 读取到 {len(servers)} 个 YYB Go 账号")

    # 加载缓存
    cached = load_accounts()
    cache_map = {item["ref"]: item for item in cached}

    accounts = []
    for entry in servers:
        server, ref = parse_yyb_entry(entry)
        if not server or not ref:
            print(f"[SKIP] 格式无效: {entry}")
            continue

        cached_acc = cache_map.get(ref)
        if cached_acc and cached_acc.get("token"):
            acc = {
                "ref": ref,
                "server": server,
                "nickname": cached_acc.get("nickname", ref),
                "token": cached_acc["token"],
            }
        else:
            print(f"[LOGIN] 正在为 {yyb_display(ref)} 获取 token...")
            token = refresh_token(server, ref)
            if token:
                acc = {"ref": ref, "server": server, "nickname": ref, "token": token}
                print(f"[LOGIN] token 获取成功: {mask_token(token)}")
            else:
                print(f"[LOGIN] {yyb_display(ref)} token 获取失败，跳过")
                continue
            time.sleep(1.5)

        accounts.append(acc)

    if not accounts:
        print("[MAIN] 无可用账号，退出")
        return

    print(f"[MAIN] 共 {len(accounts)} 个账号待处理")

    for idx, acc in enumerate(accounts):
        try:
            run_once(acc)
        except Exception as e:
            print(f"[{yyb_display(acc.get('ref', ''))}] 异常: {e}")
        if idx < len(accounts) - 1:
            time.sleep(2 + random.random() * 2)

    save_accounts(accounts)
    print("\n所有账号处理完成，缓存已更新")


if __name__ == "__main__":
    main()
