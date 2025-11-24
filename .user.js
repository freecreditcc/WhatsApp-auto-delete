// ==UserScript==
// @name         WhatsApp Web 自动回复+自动删除消息（FCMY出品·终极版）
// @namespace    https://freecredit.cc/1tempermonkey/guide.html
// @version      2025.10.07v7
// @description  FCMY WA Auto Reply + Auto Delete
// @match        https://web.whatsapp.com/*
// @grant        none
// @downloadURL  https://gist.githubusercontent.com/mypikoon2/ee1b3eacd5f886a6475b92fbab50936b/raw/fcmy-whatsapp-auto.user.js
// @updateURL    https://gist.githubusercontent.com/mypikoon2/ee1b3eacd5f886a6475b92fbab50936b/raw/fcmy-whatsapp-auto.user.js

// ==/UserScript==

(function() {
    'use strict';

    // === 配置 ===
    const waitSelectChat = 1500;             // 点击第一个聊天后等待加载
    const waitMenu = 1500;                   // 展开右侧面板等待
    const waitConfirmDelete = 1500;          // 确认删除后缓冲
    const confirmDelayMs = 1500;             // 弹窗出现后再延时点击 Delete
    const confirmPollInterval = 200;         // 轮询检测弹窗的间隔
    const confirmPollTimeout = 8000;         // 弹窗最大等待时间
    const loopInterval = 4000;               // 每轮间隔
    const MAX_FAIL = 3;                      // 最大连续失败次数
    const NO_CHAT_LOG_INTERVAL = 10 * 60 * 1000; // 未找到聊天时的日志间隔
    const MAX_LOGS = 300;                    // 日志保留数量
    const TYPE_SPEED = 130;                  // 打字速度（ms/字符）
    let AUTO_REPLY_ENABLED = 1;              // 自动回复开关 (1=开, 0=关)

    // === 忽略规则 ===
    const IGNORE_KEYWORDS = ["JOIN"];          // 包含这些关键词则不回复
    const IGNORE_REGEX = [/^RF[0-9A-Z]{5,}/i]; // 符合这些正则的内容不回复

    // === 自动回复内容 ===
    const REPLY_TEXTS = [
         "👋 Hi, thanks for reaching out!\n\n😅 We’re unable to reply via WhatsApp.\n💬 For help, please use our website live chat.\n\n🙏 Thank you for understanding!",
         "🙌 Hello! Your message has been received.\n\n⚠️ We can’t respond through WhatsApp.\n💬 Kindly reach us via the live chat on our website.\n\n🙏 Appreciate your support!",
         "👋 Hi there!\n\n😅 Sorry, we don’t provide replies on WhatsApp.\n💬 Please connect with us on the website live chat.\n\n🙏 Thank you!",
         "👋 Hi, terima kasih kerana mesej kami!\n\n😅 Kami tak dapat reply melalui WhatsApp.\n💬 Untuk bantuan, sila gunakan live chat di website.\n\n🙏 Terima kasih atas sokongan!",
         "🙌 Halo! Mesej anda sudah diterima.\n\n⚠️ WhatsApp tidak digunakan untuk balasan.\n💬 Sila hubungi kami melalui live chat di website.\n\n🙏 Hargai kerjasama anda!",
         "👋 Hai, terima kasih hubungi kami!\n\n😅 Maaf, WhatsApp tak boleh untuk reply.\n💬 Untuk pertanyaan, sila guna live chat di website kami.\n\n🙏 Terima kasih!"
    ];
// === STOP！不要随意修改以下内容。 STOP！不要随意修改以下内容。 STOP！不要随意修改以下内容。 ===

    // === 全局变量 ===
    let enabled = true;           // 删除功能开关
    let failCount = 0;            // 连续失败计数
    let lastNoChatLog = 0;        // 上次“未找到聊天”的时间戳
    let lastPaused = false;       // 暂停标记

    // === 日志面板 ===
    function initLogPanel() {
        if (document.querySelector("#wa-log-panel")) return;
        const panel = document.createElement("div");
        panel.id = "wa-log-panel";
        Object.assign(panel.style, {
            position: "fixed",
            right: "10px",
            bottom: "70px",
            width: "360px",
            maxHeight: "260px",
            overflowY: "auto",
            background: "rgba(0,0,0,0.77)",
            fontSize: "11px",
            fontFamily: "monospace",
            padding: "10px",
            zIndex: 9999,
            borderRadius: "10px",
            boxShadow: "0 0 8px #0f0",
            textAlign: "left",
            pointerEvents: "auto"
        });

        // === 日志容器 ===
        const logBox = document.createElement("div");
        logBox.id = "log-container";
        logBox.style.maxHeight = "200px";
        logBox.style.overflowY = "auto";

        // === 清空日志按钮 ===
        const clearBtn = document.createElement("button");
        clearBtn.textContent = "🧹 清空日志 | CLEAR LOG";
        Object.assign(clearBtn.style, {
            display: "block",
            width: "100%",
            background: "#333",
            color: "#00FF88",
            border: "1px solid #0f0",
            borderRadius: "6px",
            padding: "4px 8px",
            marginTop: "8px",
            cursor: "pointer",
            fontSize: "12px"
        });
        clearBtn.onclick = () => {
            logBox.innerHTML = "";
            log("🧹 日志已清空 | Logs Cleared");
        };

        panel.appendChild(logBox);
        panel.appendChild(clearBtn);
        document.body.appendChild(panel);
    }

    // === 删除启停按钮 ===
    function initToggleButton() {
        if (document.querySelector("#wa-toggle-btn")) return;
        const btn = document.createElement("button");
        btn.id = "wa-toggle-btn";
        btn.textContent = "🟢 删除启用中";
        Object.assign(btn.style, {
            position: "fixed",
            top: "10px",
            right: "10px",
            zIndex: 10000,
            background: "#222",
            color: "#00FF88",
            border: "1px solid #0f0",
            padding: "7px 16px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "15px",
            pointerEvents: "auto"
        });

        btn.onclick = () => {
            enabled = !enabled;
            btn.textContent = enabled ? "🟢 删除启用中" : "🔴 删除已暂停";
            btn.style.color = enabled ? "#00FF88" : "#FF4444";
            btn.style.border = enabled ? "1px solid #0f0" : "1px solid #f44";
            log(`状态切换为：${enabled ? "🟢 删除启用中" : "🔴 删除已暂停"}`);
            lastPaused = false;
        };

        document.body.appendChild(btn);
    }

    // === 自动回复开关按钮 ===
    function initReplyToggleButton() {
        if (document.querySelector("#wa-reply-toggle-btn")) return;
        AUTO_REPLY_ENABLED = parseInt(localStorage.getItem("wa-auto-reply-enabled") || "1");
        const btn = document.createElement("button");
        btn.id = "wa-reply-toggle-btn";
        btn.textContent = AUTO_REPLY_ENABLED ? "💬 自动回复开" : "💤 自动回复关";
        Object.assign(btn.style, {
            position: "fixed",
            top: "50px",
            right: "10px",
            zIndex: 10000,
            background: "#222",
            color: AUTO_REPLY_ENABLED ? "#00FF88" : "#FF4444",
            border: "1px solid #0f0",
            padding: "7px 16px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "15px",
            pointerEvents: "auto"
        });

        btn.onclick = () => {
            AUTO_REPLY_ENABLED = AUTO_REPLY_ENABLED ? 0 : 1;
            localStorage.setItem("wa-auto-reply-enabled", AUTO_REPLY_ENABLED); // ✅ 写入本地存储
            btn.textContent = AUTO_REPLY_ENABLED ? "💬 自动回复开" : "💤 自动回复关";
            btn.style.color = AUTO_REPLY_ENABLED ? "#00FF88" : "#FF4444";
            log(`状态切换为：${AUTO_REPLY_ENABLED ? "💬 自动回复开" : "💤 自动回复关"}`);
        };

        document.body.appendChild(btn);
    }

    // === 日志输出 ===
    function log(message, type = "info") {
        const logBox = document.querySelector("#log-container");
        if (!logBox) return;
        const time = new Date().toLocaleTimeString();
        const line = document.createElement("div");
        line.className = "log-line";
        let color = "#00FF88";
        if (type === "warn") color = "#FFD700";
        if (type === "error") color = "#FF4444";
        line.style.color = color;
        line.textContent = `[${time}] ${message}`;
        logBox.appendChild(line);
        while (logBox.children.length > MAX_LOGS) logBox.removeChild(logBox.firstChild);
        logBox.scrollTop = logBox.scrollHeight;
    }

    // === 点击封装 ===
    function realClick(el) {
        if (!el) return;
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    // === 自动回复逻辑 ===
    function getLastPeerMsgInfo() {
        let peerMsgs = document.querySelectorAll('#main .message-in');
        if (!peerMsgs.length) return { text: "", isVoice: false };
        let last = peerMsgs[peerMsgs.length - 1];
        let isVoice = !!last.querySelector('audio,[data-icon*="audio"]');
        let txtNode = last.querySelector('span.selectable-text, span[dir], div[dir]');
        let text = txtNode ? txtNode.textContent.trim() : last.innerText.trim();
        return { text, isVoice };
    }

    // === 模拟逐字打字 ===
    function setInputBoxText(content, cb) {
        const inputDiv = document.querySelector('#main div[contenteditable="true"][role="textbox"]');
        if (!inputDiv) {
            log('❌ 输入框未找到', "error");
            cb && cb(false);
            return false;
        }
        inputDiv.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);

        const chars = content.split('');
        let i = 0;
        function typeChar() {
            if (i < chars.length) {
                if (chars[i] === '\n') {
                    // 模拟换行
                    const event = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, shiftKey: true });
                    inputDiv.dispatchEvent(event);
                    inputDiv.dispatchEvent(new InputEvent('input', { bubbles: true }));
                } else {
                    // 输入普通字符
                    document.execCommand('insertText', false, chars[i]);
                    inputDiv.dispatchEvent(new InputEvent('input', { bubbles: true }));
                }
                i++;
                setTimeout(typeChar, TYPE_SPEED);
            } else {
                setTimeout(() => cb && cb(true), 300);
            }
        }
        typeChar();
        return true;
    }

    // === 点击发送按钮 ===
    function clickSendBtn() {
        let sendBtn = document.querySelector('button[data-testid="compose-btn-send"]');
        if (!sendBtn) sendBtn = document.querySelector('span[data-icon="send"]');
        if (!sendBtn) {
            sendBtn = [...document.querySelectorAll("span, div")]
                .find(el => (el.getAttribute("data-icon") || "").toLowerCase().includes("send"));
        }
        if (!sendBtn) {
            log("❌ 发送按钮未找到", "error");
            return false;
        }
        realClick(sendBtn.closest("button") || sendBtn);
        log("✅ 已点击发送按钮");
        return true;
    }

    // === 删除逻辑 ===
    function doDeleteChat() {
        let avatarBtn = document.querySelector('#main header img[draggable="false"]') || document.querySelector('#main header [data-icon]');
        if (!avatarBtn) {
            plusFail("未找到头像按钮");
            window._deleting = false;
            return;
        }
        realClick(avatarBtn);
        log("已点击头像，等待右侧 INFO");
        setTimeout(() => {
            let delBtn = [...document.querySelectorAll("button, div[role='button'], span, div")]
                .find(el => (el.textContent || '').trim().toLowerCase() === "delete chat");
            if (!delBtn) {
                plusFail("未找到 Delete chat 按钮");
                window._deleting = false;
                return;
            }
            realClick(delBtn);
            log("已点击 Delete chat 按钮 → 开始检测弹窗...");
            const start = performance.now();
            const timer = setInterval(() => {
                const dialog = document.querySelector('div[role="dialog"]');
                if (dialog) {
                    clearInterval(timer);
                    log(`检测到弹窗 → 等待 ${confirmDelayMs}ms 后开始删除`);
                    setTimeout(() => {
                        let confirmBtn = [...dialog.querySelectorAll("button, div[role='button']")]
                            .find(el => (el.textContent || '').trim().toLowerCase() === "delete");
                        if (confirmBtn) {
                            realClick(confirmBtn);
                            log("已点击确认删除");
                            setTimeout(() => {
                                window._deleting = false;
                                log("✅ 删除成功，等待下轮");
                                resetFail();
                            }, waitConfirmDelete);
                        } else {
                            plusFail("未找到确认删除按钮");
                            window._deleting = false;
                        }
                    }, confirmDelayMs);
                }
                if (performance.now() - start > confirmPollTimeout) {
                    clearInterval(timer);
                    plusFail("等待弹窗超时，请尝试刷新");
                    window._deleting = false;
                }
            }, confirmPollInterval);
        }, waitMenu);
    }

    // === 主循环 ===
    function deleteFirstChatIfAny() {
        if (!enabled) {
            if (!lastPaused) {
                log("暂停中，本轮不处理", "warn");
                lastPaused = true;
            }
            return;
        }
        lastPaused = false;
        if (window._deleting) return;
        let chats = document.querySelectorAll("div._ak8l._ap1, div._ak8o");
        if (chats.length === 0) {
            let now = Date.now();
            if (now - lastNoChatLog > NO_CHAT_LOG_INTERVAL) {
                plusFail("未找到聊天");
                lastNoChatLog = now;
            }
            return;
        }
        lastNoChatLog = 0;
        window._deleting = true;
        log("开始处理第一个聊天");
        realClick(chats[0]);
        log("已点击第一个聊天");

        setTimeout(() => {
            let { text, isVoice } = getLastPeerMsgInfo();
            log(`检测到对方最后消息：${text}${isVoice ? "（语音）" : ""}`);

            if (AUTO_REPLY_ENABLED) {
                // === 检查忽略规则 ===
                let skipByKeyword = IGNORE_KEYWORDS.some(word => text.toUpperCase().includes(word.toUpperCase()));
                let skipByRegex = IGNORE_REGEX.some(regex => regex.test(text));
                const needReply = (isVoice || (text && !skipByKeyword && !skipByRegex));

                if (needReply) {
                    log("需自动回复，准备输入回复内容");
                    const AUTO_REPLY_TEXT = REPLY_TEXTS[Math.floor(Math.random() * REPLY_TEXTS.length)];
                    setInputBoxText(AUTO_REPLY_TEXT, (success) => {
                        if (success) {
                            if (clickSendBtn()) {
                                log("自动回复已发送，准备删除");
                                setTimeout(doDeleteChat, 1200);
                            } else {
                                log("❌ 发送按钮未找到，放弃回复，直接删除", "error");
                                doDeleteChat();
                            }
                        } else {
                            log("❌ 未找到输入框，放弃回复，直接删除", "error");
                            doDeleteChat();
                        }
                    });
                } else {
                    log("消息命中过滤规则，跳过回复 → 直接删除");
                    doDeleteChat();
                }
            } else {
                log("⚠️ 自动回复已关闭，直接删除");
                doDeleteChat();
            }
        }, waitSelectChat);
    }

    // === 辅助 ===
    function plusFail(msg) {
        failCount++;
        log(`⚠️ 第${failCount}次失败：${msg}`, "warn");
        if (failCount >= MAX_FAIL) {
            log(`❌ 连续失败${MAX_FAIL}次，自动刷新页面`, "error");
            setTimeout(() => { location.reload(); }, 1500);
        }
    }
    function resetFail() { failCount = 0; }

    // === 启动 ===
    setTimeout(initLogPanel, 1200);
    setTimeout(initToggleButton, 1600);
    setTimeout(initReplyToggleButton, 1800);
    setInterval(deleteFirstChatIfAny, loopInterval);

    log("【WA自动回复+批量删除·终极版】已启用（逐字回复+弹窗检测删除+可控开关+过滤规则）");
})();
