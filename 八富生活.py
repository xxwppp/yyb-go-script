#!/usr/bin/env python3
# # 当前脚本来自于 http://script.nnioj.com/ 脚本库下载！
# # 当前脚本来自于 http://script.nnioj.com/ 脚本库下载！
# # 当前脚本来自于 http://script.nnioj.com/ 脚本库下载！
# # 脚本库中的所有脚本文件均来自热心网友上传和互联网收集。
# # 脚本库仅提供文件上传和下载服务，不提供脚本文件的审核。
# # 您在使用脚本库下载的脚本时自行检查判断风险。
# # 所涉及到的 账号安全、数据泄露、设备故障、软件违规封禁、财产损失等问题及法律风险，与脚本库无关！均由开发者、上传者、使用者自行承担。

# -*- coding: utf-8 -*-
"""
八富生活 - 自动刷广告脚本
环境变量: BAFU=手机号#密码  多账号用&或换行分隔
"""

import requests
import json
import os
import sys
import time
import urllib3
from concurrent.futures import ThreadPoolExecutor, as_completed

urllib3.disable_warnings()

BASE_URL = "https://bafunet.com/portal-server"
X_TENANT_ID = "1992418264477876226"
REFERER = "https://servicewechat.com/wxb9be8e4f98c3fbe5/23/page-frame.html"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf2541c18) XWEB/25297"


def get_envs(name, split_char="&"):
    value = os.environ.get(name, "")
    if not value:
        return []
    result = []
    for item in value.replace("\n", split_char).split(split_char):
        item = item.strip()
        if item:
            result.append(item)
    return result


class BaFu:
    def __init__(self, username, password, index=1):
        self.username = username
        self.password = password
        self.index = index
        self.session = requests.Session()
        self.token = ""
        self.sid = ""
        self.user_id = ""

    def headers(self):
        return {
            "User-Agent": USER_AGENT,
            "xweb_xhr": "1",
            "Content-Type": "application/json",
            "X-Tenant-ID": X_TENANT_ID,
            "token": self.token,
            "Referer": REFERER,
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }

    def login(self):
        """登录"""
        print(f"【账号{self.index}】正在登录...")
        url = f"{BASE_URL}/login"
        data = {
            "username": self.username,
            "type": "N",
            "password": self.password,
            "clientType": "mp-weixin"
        }
        try:
            resp = self.session.post(url, headers=self.headers(), json=data, verify=False)
            result = resp.json()
            
            if result.get("code") == 200:
                self.token = resp.headers.get("token", "")
                self.sid = resp.headers.get("sid", "")
                if self.token and ":" in self.token:
                    parts = self.token.split(":")
                    if len(parts) >= 2:
                        self.user_id = parts[1]
                print(f"【账号{self.index}】登录成功！用户ID: {self.user_id}")
                self.get_user_info()
                print(f"【账号{self.index}】完成任务即可获取金币，次日自动到账")
                return True
            else:
                print(f"【账号{self.index}】登录失败: {result.get('msg', '未知错误')}")
                return False
        except Exception as e:
            print(f"【账号{self.index}】登录异常: {e}")
            return False

    def get_user_info(self):
        url = f"{BASE_URL}/user/getBaseInfoAnon"
        try:
            resp = self.session.get(url, headers=self.headers(), verify=False)
            result = resp.json()
            if result.get("code") == 200:
                data = result.get("data", {})
                nickname = data.get("nickname", "")
                total_profit = data.get("totalProfit", 0)
                print(f"【账号{self.index}】{nickname} | 八富豆: {total_profit}")
                return data
            else:
                print(f"【账号{self.index}】获取用户信息失败: {result.get('msg', '')}")
                return None
        except Exception as e:
            print(f"【账号{self.index}】获取用户信息异常: {e}")
            return None

    def check_limit(self, adpid="2919867719"):
        """获取广告ID和剩余次数"""
        url = f"{BASE_URL}/ad/checkLimit"
        params = {"adpid": adpid}
        try:
            resp = self.session.get(url, headers=self.headers(), params=params, verify=False)
            result = resp.json()
            if result.get("code") == 200:
                data = result.get("data", {})
                count = int(data.get("count", "0"))
                total = int(data.get("totalAds", 0))
                ad_id = data.get("id", "")
                limited = data.get("limited", False)
                remaining = total - count
                print(f"【账号{self.index}】广告进度: 已完成{count}/{total}, 剩余{remaining}次")
                return {
                    "count": count,
                    "total": total,
                    "ad_id": ad_id,
                    "limited": limited
                }
            else:
                print(f"【账号{self.index}】获取广告ID失败: {result.get('msg', '')}")
                return None
        except Exception as e:
            print(f"【账号{self.index}】获取广告ID异常: {e}")
            return None

    def complete_ad(self, ad_id, adpid="2919867719"):
        """完成广告，领取奖励"""
        url = f"{BASE_URL}/ad/complete"
        params = {
            "id": ad_id,
            "adpid": adpid
        }
        try:
            resp = self.session.post(url, headers=self.headers(), params=params, json={}, verify=False)
            result = resp.json()
            if result.get("code") == 200:
                data = result.get("data", {})
                count = int(data.get("count", "0"))
                total = int(data.get("totalAds", 0))
                limited = data.get("limited", False)
                remaining = total - count
                print(f"【账号{self.index}】第{count}次广告完成！剩余{remaining}次")
                return {
                    "count": count,
                    "total": total,
                    "limited": limited
                }
            else:
                print(f"【账号{self.index}】广告完成失败: {result.get('msg', '')}")
                return None
        except Exception as e:
            print(f"【账号{self.index}】广告完成异常: {e}")
            return None

    def watch_ads(self, adpid="2919867719"):
        """循环看广告"""
        import random
        print(f"\n【账号{self.index}】开始看广告...")
        
        success_count = 0
        max_loops = 50
        loop = 0
        
        while loop < max_loops:
            loop += 1
            
            ad_info = self.check_limit(adpid)
            if not ad_info:
                break
            
            if ad_info["limited"]:
                print(f"【账号{self.index}】今日广告已达上限")
                break
            
            remaining = ad_info["total"] - ad_info["count"]
            if remaining <= 0:
                print(f"【账号{self.index}】今日广告已看完")
                break
            
            ad_id = ad_info["ad_id"]
            if not ad_id:
                print(f"【账号{self.index}】未获取到广告ID，等待2秒后重试")
                time.sleep(2)
                continue
            
            watch_time = random.randint(18, 30)
            print(f"【账号{self.index}】正在观看第{ad_info['count'] + 1}个广告，等待{watch_time}秒...")
            time.sleep(watch_time)
            
            result = self.complete_ad(ad_id, adpid)
            if result:
                success_count += 1
                sleep_time = random.randint(5, 8)
                print(f"【账号{self.index}】休息{sleep_time}秒后继续...")
                time.sleep(sleep_time)
            else:
                print(f"【账号{self.index}】广告完成失败，等待3秒后重试")
                time.sleep(3)
        
        print(f"【账号{self.index}】广告任务结束，成功完成 {success_count} 次")
        self.get_user_info()
        return success_count

    def run(self):
        """运行主任务"""
        if not self.login():
            return False
        
        self.watch_ads()
        
        return True


def main():
    envs = get_envs("BAFU")
    if not envs:
        print("未设置环境变量 BAFU")
        print("格式: BAFU=手机号#密码  多账号用&分隔")
        return
    
    accounts = []
    for env in envs:
        if "#" in env:
            parts = env.split("#", 1)
            accounts.append((parts[0], parts[1]))
    
    if not accounts:
        print("环境变量格式错误")
        return
    
    print(f"共找到 {len(accounts)} 个账号\n")
    
    max_workers = min(len(accounts), 5)
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = []
        for i, (username, password) in enumerate(accounts, 1):
            bafu = BaFu(username, password, i)
            futures.append(executor.submit(bafu.run))
        
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                print(f"任务异常: {e}")
    
    print("\n所有任务执行完毕")


if __name__ == "__main__":
    main()
