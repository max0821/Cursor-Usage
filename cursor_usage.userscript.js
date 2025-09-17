// ==UserScript==
// @name         Cursor Usage Stats (v9.1 - 拖動功能修正)
// @namespace    http://tampermonkey.net/
// @version      9.1
// @description  在 Cursor 儀表板上提供一個功能完整的浮動面板，支援中英雙語、自訂日期、自動翻頁、每日圖表與記憶功能。
// @author       程式夥伴
// @match        https://cursor.com/cn/dashboard*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_getResourceText
// @connect      cursor.com
// @require      https://cdn.jsdelivr.net/npm/chart.js
// @require      https://cdn.jsdelivr.net/npm/flatpickr
// @resource     flatpickr_css https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css
// @icon         https://www.google.com/s2/favicons?sz=64&domain=cursor.com
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. 國際化 (i18n) 資源 ---
    const i18n = {
        en: {
            title: "Cursor Usage Stats",
            today: "Today",
            days7: "7 Days",
            days30: "30 Days",
            startDate: "Start Date",
            endDate: "End Date",
            query: "Query",
            selectRange: "Please select a date range",
            loading: "Querying",
            page: "Page",
            fetching: "Fetching",
            records: "records",
            error: "Error",
            fetchFailed: "Request Failed",
            noRecords: "No usage records found in this period.",
            requests: "Requests",
            inputTokens: "Input Tokens",
            outputTokens: "Output Tokens",
            cacheRead: "Cache Read",
            cacheWrite: "Cache Write",
            totalTokens: "Total Tokens",
            totalCost: "Total Cost",
            chartLabel: "Daily Cost ($)",
            alert_select_dates: "Please select both a start and end date!",
            langSwitch: "中"
        },
        zh: {
            title: "Cursor 用量統計",
            today: "今天",
            days7: "7 天",
            days30: "30 天",
            startDate: "開始日期",
            endDate: "結束日期",
            query: "查詢",
            selectRange: "請選擇查詢範圍",
            loading: "查詢中",
            page: "第",
            fetching: "已獲取",
            records: "筆",
            error: "錯誤",
            fetchFailed: "請求失敗",
            noRecords: "此期間內沒有用量紀錄。",
            requests: "請求次數",
            inputTokens: "輸入 Tokens",
            outputTokens: "輸出 Tokens",
            cacheRead: "快取讀取",
            cacheWrite: "快取寫入",
            totalTokens: "總 Tokens",
            totalCost: "總花費",
            chartLabel: "每日花費 ($)",
            alert_select_dates: "請選擇開始和結束日期！",
            langSwitch: "EN"
        }
    };

    const PANEL_ID = 'usage-stats-panel-v9';
    const API_URL = 'https://cursor.com/api/dashboard/get-filtered-usage-events';
    const PAGE_SIZE = 100;
    let myCursorUsageChart = null;
    let flatpickrStart, flatpickrEnd;
    let currentLang = 'en';
    let lastFetchedData = null;

    // --- 2. 核心功能函式 ---

    // 建立面板的基礎結構 (只執行一次)
    function createPanelShell() {
        if (document.getElementById(PANEL_ID)) return;
        const flatpickrCss = GM_getResourceText("flatpickr_css");
        GM_addStyle(flatpickrCss);
        GM_addStyle(`
            /* 主面板樣式 */
            #${PANEL_ID} { position: fixed; bottom: 20px; left: 20px; width: 380px; background-color: #282a36; border: 1px solid #44475a; border-radius: 8px; z-index: 9999; color: #f8f82f; font-family: monospace, sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-size: 13px; }
            #${PANEL_ID}-header { display: flex; justify-content: space-between; align-items: center; padding: 10px; cursor: move; background-color: #44475a; border-bottom: 1px solid #6272a4; border-top-left-radius: 8px; border-top-right-radius: 8px; font-weight: bold; color: #f8f8f2; font-size: 14px; }
            #${PANEL_ID}-lang-switch { background: none; border: 1px solid #f8f8f2; color: #f8f8f2; border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 12px; }

            /* 控制區整體 */
            #${PANEL_ID}-controls { display: flex; flex-direction: column; gap: 10px; padding: 10px; border-bottom: 1px solid #44475a; }
            .control-row { display: flex; justify-content: space-around; align-items: center; gap: 5px; }

            /* 按鈕樣式 */
            #${PANEL_ID}-controls button { background-color: #6272a4; color: #f8f82f; border: none; padding: 6px 10px; border-radius: 5px; cursor: pointer; font-family: inherit; font-size: 12px; transition: background-color 0.2s; flex-grow: 1; }
            #${PANEL_ID}-controls button.query-btn { background-color: #50fa7b; color: #282a36; font-weight: bold; }
            #${PANEL_ID}-controls button:hover { background-color: #bd93f9; }
            #${PANEL_ID}-controls button:disabled { background-color: #333; cursor: not-allowed; }
            #${PANEL_ID}-controls button.active-button { background-color: #bd93f9; font-weight: bold; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); }

            /* 日期選擇器輸入框 */
            .flatpickr-input { background-color: #44475a; border: 1px solid #6272a4; color: #f8f8f2; padding: 5px; border-radius: 4px; width: 120px; text-align: center; font-family: inherit; font-size: 12px; }

            /* 統計和圖表區 */
            #${PANEL_ID}-content { padding: 15px; color: #f8f8f2; border-bottom: 1px solid #44475a;}
            #${PANEL_ID}-content table { width: 100%; border-collapse: collapse; }
            #${PANEL_ID}-content td { padding: 5px; }
            #${PANEL_ID}-content td:first-child { font-weight: bold; color: #8be9fd; }
            #${PANEL_ID}-content td:last-child { text-align: right; color: #50fa7b; }
            #${PANEL_ID}-chart-container { padding: 10px; }
        `);

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        document.body.appendChild(panel);

        makeDraggable(panel);
    }

    // 更新面板內容 (切換語言、初始化時呼叫)
    function updatePanelContent() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel) return;
        const T = i18n[currentLang];

        panel.innerHTML = `
            <div id="${PANEL_ID}-header">
                <span>📊 ${T.title} (v9.1)</span>
                <button id="${PANEL_ID}-lang-switch">${T.langSwitch}</button>
            </div>
            <div id="${PANEL_ID}-controls">
                <div class="control-row">
                    <button data-days="1">${T.today}</button>
                    <button data-days="7">${T.days7}</button>
                    <button data-days="30">${T.days30}</button>
                </div>
                <div class="control-row">
                    <input type="text" id="start-date-picker" placeholder="${T.startDate}">
                    <input type="text" id="end-date-picker" placeholder="${T.endDate}">
                    <button class="query-btn">${T.query}</button>
                </div>
            </div>
            <div id="${PANEL_ID}-content">${T.selectRange}</div>
            <div id="${PANEL_ID}-chart-container">
                <canvas id="${PANEL_ID}-chart"></canvas>
            </div>
        `;

        flatpickrStart = flatpickr("#start-date-picker", { dateFormat: "Y-m-d" });
        flatpickrEnd = flatpickr("#end-date-picker", { dateFormat: "Y-m-d" });
        loadSavedDates();
        panel.querySelector(`#${PANEL_ID}-controls`).addEventListener('click', handleControlClick);
        panel.querySelector(`#${PANEL_ID}-lang-switch`).addEventListener('click', handleLangSwitch);
    }

    // 處理拖動功能
    function makeDraggable(panel) {
        let isDragging = false, offsetX, offsetY;

        panel.addEventListener('mousedown', (e) => {
            if (e.target.closest(`#${PANEL_ID}-header`)) {
                isDragging = true;
                offsetX = e.clientX - panel.getBoundingClientRect().left;
                offsetY = e.clientY - panel.getBoundingClientRect().top;
                document.body.style.userSelect = 'none';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                panel.style.left = `${e.clientX - offsetX}px`;
                panel.style.top = `${e.clientY - offsetY}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
            }
        });
    }

    // 處理語言切換
    async function handleLangSwitch() {
        currentLang = (currentLang === 'en') ? 'zh' : 'en';
        await GM_setValue('language', currentLang);
        updatePanelContent();
        if (lastFetchedData) {
            processAndDisplayData(lastFetchedData);
        }
    }

    // 處理日期選擇和查詢
    async function handleControlClick(e) {
        const target = e.target;
        if (target.tagName !== 'BUTTON') return;

        const allQuickButtons = document.querySelectorAll(`#${PANEL_ID}-controls button[data-days]`);
        allQuickButtons.forEach(btn => btn.classList.remove('active-button'));

        let startDate, endDate = new Date();

        if (target.dataset.days) {
            target.classList.add('active-button');
            const days = parseInt(target.dataset.days, 10);
            startDate = new Date();
            startDate.setUTCHours(0, 0, 0, 0);
            startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

            flatpickrStart.setDate(startDate, false);
            flatpickrEnd.setDate(endDate, false);

        } else if (target.classList.contains('query-btn')) {
             if (flatpickrStart.selectedDates[0] && flatpickrEnd.selectedDates[0]) {
                startDate = flatpickrStart.selectedDates[0];
                endDate = flatpickrEnd.selectedDates[0];
                endDate.setHours(23, 59, 59, 999);
             } else {
                alert(T.alert_select_dates);
                return;
             }
        }

        if (startDate && endDate) {
            await GM_setValue('saved_start_date', startDate.getTime());
            await GM_setValue('saved_end_date', endDate.getTime());
            fetchAllUsageData(startDate.getTime(), endDate.getTime());
        }
    }

    // 讀取儲存的日期
    async function loadSavedDates() {
        const savedStart = await GM_getValue('saved_start_date', null);
        const savedEnd = await GM_getValue('saved_end_date', null);

        if (savedStart && savedEnd) {
            flatpickrStart.setDate(new Date(savedStart), false);
            flatpickrEnd.setDate(new Date(savedEnd), false);
        } else {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 6);
            flatpickrStart.setDate(startDate, false);
            flatpickrEnd.setDate(endDate, false);
        }
    }

    // 抓取所有分頁數據
    async function fetchAllUsageData(startDateTimestamp, endDateTimestamp) {
        const contentDiv = document.getElementById(`${PANEL_ID}-content`);
        const buttons = document.querySelectorAll(`#${PANEL_ID}-controls button`);
        buttons.forEach(b => b.disabled = true);
        if (myCursorUsageChart) { myCursorUsageChart.destroy(); }

        const T = i18n[currentLang];
        contentDiv.innerHTML = `${T.loading} (${T.page} 1)...`;

        let currentPage = 1, allEvents = [], totalEventsCount = 0;
        try {
            do {
                const payload = { endDate: String(endDateTimestamp), startDate: String(startDateTimestamp), pageSize: PAGE_SIZE, page: currentPage, teamId: null };
                const responseText = await makeRequest(payload);
                const data = JSON.parse(responseText);
                if (data.error) throw new Error(data.error);
                if (data.usageEventsDisplay && data.usageEventsDisplay.length > 0) {
                    allEvents = allEvents.concat(data.usageEventsDisplay);
                }
                totalEventsCount = data.totalUsageEventsCount || 0;
                contentDiv.innerHTML = `${T.fetching} ${allEvents.length} / ${totalEventsCount} ${T.records}`;
                currentPage++;
            } while (allEvents.length < totalEventsCount && totalEventsCount > 0);

            lastFetchedData = allEvents;
            processAndDisplayData(allEvents);

        } catch (error) {
            console.error('[Cursor腳本] 獲取資料時發生錯誤:', error);
            contentDiv.innerHTML = `${T.error}: ${error.message || T.fetchFailed}`;
            lastFetchedData = null;
        } finally {
            buttons.forEach(b => b.disabled = false);
        }
    }

    // 處理並顯示數據
    function processAndDisplayData(allEvents) {
        const contentDiv = document.getElementById(`${PANEL_ID}-content`);
        const T = i18n[currentLang];

        if (allEvents.length === 0) {
            contentDiv.innerHTML = T.noRecords;
            if (myCursorUsageChart) { myCursorUsageChart.destroy(); }
            return;
        }
        let totalRequests = 0, totalInputTokens = 0, totalOutputTokens = 0, totalCostCents = 0, totalCacheReadTokens = 0, totalCacheWriteTokens = 0;
        allEvents.forEach(event => {
            if (event.kind && !event.kind.toUpperCase().includes('NOT_CHARGED') && !event.kind.toUpperCase().includes('USER_API_KEY')) {
                totalRequests++;
                if (event.tokenUsage) {
                    totalInputTokens += parseFloat(event.tokenUsage.inputTokens || 0);
                    totalOutputTokens += parseFloat(event.tokenUsage.outputTokens || 0);
                    totalCostCents += parseFloat(event.tokenUsage.totalCents || 0);
                    totalCacheReadTokens += parseFloat(event.tokenUsage.cacheReadTokens || 0);
                    totalCacheWriteTokens += parseFloat(event.tokenUsage.cacheWriteTokens || 0);
                }
            }
        });
        const totalTokens = totalInputTokens + totalOutputTokens + totalCacheReadTokens + totalCacheWriteTokens;
        const totalCostDollars = totalCostCents / 100;
        contentDiv.innerHTML = `
            <table>
                <tr><td>${T.requests}:</td><td>${totalRequests.toLocaleString()}</td></tr>
                <tr><td>${T.inputTokens}:</td><td>${totalInputTokens.toLocaleString()}</td></tr>
                <tr><td>${T.outputTokens}:</td><td>${totalOutputTokens.toLocaleString()}</td></tr>
                <tr><td>${T.cacheRead}:</td><td>${totalCacheReadTokens.toLocaleString()}</td></tr>
                <tr><td>${T.cacheWrite}:</td><td>${totalCacheWriteTokens.toLocaleString()}</td></tr>
                <tr><td>${T.totalTokens}:</td><td>${totalTokens.toLocaleString()}</td></tr>
                <tr><td>${T.totalCost}:</td><td><b>$${totalCostDollars.toFixed(4)}</b></td></tr>
            </table>
        `;
        const chartData = processDataForChart(allEvents);
        renderChart(chartData);
    }

    // 處理圖表數據
    function processDataForChart(allEvents) {
        const dailyData = {};
        allEvents.forEach(event => {
            if (event.kind && !event.kind.toUpperCase().includes('NOT_CHARGED') && !event.kind.toUpperCase().includes('USER_API_KEY') && event.tokenUsage) {
                const date = new Date(parseInt(event.timestamp));
                const dateString = date.toLocaleDateString('en-CA');
                if (!dailyData[dateString]) { dailyData[dateString] = 0; }
                dailyData[dateString] += parseFloat(event.tokenUsage.totalCents || 0);
            }
        });
        const sortedLabels = Object.keys(dailyData).sort();
        const dataPoints = sortedLabels.map(label => dailyData[label] / 100);
        return { labels: sortedLabels, data: dataPoints };
    }

    // 繪製圖表
    function renderChart(chartData) {
        if (myCursorUsageChart) { myCursorUsageChart.destroy(); }
        const T = i18n[currentLang];
        const ctx = document.getElementById(`${PANEL_ID}-chart`).getContext('2d');
        myCursorUsageChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: T.chartLabel,
                    data: chartData.data,
                    backgroundColor: 'rgba(189, 147, 249, 0.2)',
                    borderColor: 'rgba(189, 147, 249, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: '#f8f8f2',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#f8f8f2', font: { size: 12 } } } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#f8f8f2', font: { size: 10 } }, grid: { color: 'rgba(248, 248, 242, 0.1)' } },
                    x: { ticks: { color: '#f8f8f2', font: { size: 10 } }, grid: { color: 'rgba(248, 248, 242, 0.1)' } }
                }
            }
        });
    }

    // 請求輔助函式
    function makeRequest(payload) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: API_URL,
                data: JSON.stringify(payload),
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Origin": "https://cursor.com",
                    "Referer": window.location.href
                },
                onload: (response) => resolve(response.responseText),
                onerror: (response) => reject(response)
            });
        });
    }

    // --- 3. 腳本初始化 ---
    async function init() {
        const savedLang = await GM_getValue('language', null);
        if (savedLang) {
            currentLang = savedLang;
        } else if (navigator.language.startsWith('zh')) {
            currentLang = 'zh';
        }
        createPanelShell();
        updatePanelContent();
    }

    window.addEventListener('load', init);
})();
