// ==UserScript==
// @name         Cursor Usage Stats (v8.1 - 樣式載入修正)
// @namespace    http://tampermonkey.net/
// @version      8.1
// @description  在 Cursor 儀表板上提供一個可操作的浮動面板，支援自訂日期、自動翻頁、每日圖表與記憶功能。
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

    const PANEL_ID = 'usage-stats-panel-v8';
    const API_URL = 'https://cursor.com/api/dashboard/get-filtered-usage-events';
    const PAGE_SIZE = 100;
    let myCursorUsageChart = null;
    let flatpickrStart, flatpickrEnd;

    // 建立面板 UI
    function createPanel() {
        if (document.getElementById(PANEL_ID)) return;

        // *** 關鍵修正：使用 GM_addStyle 和 GM_getResourceText 來載入 CSS ***
        const flatpickrCss = GM_getResourceText("flatpickr_css");
        GM_addStyle(flatpickrCss);
        GM_addStyle(`
            /* 主面板樣式 */
            #${PANEL_ID} { position: fixed; bottom: 20px; left: 20px; width: 380px; background-color: #282a36; border: 1px solid #44475a; border-radius: 8px; z-index: 9999; color: #f8f82f; font-family: monospace, sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-size: 13px; }
            #${PANEL_ID}-header { padding: 10px; cursor: move; background-color: #44475a; border-bottom: 1px solid #6272a4; border-top-left-radius: 8px; border-top-right-radius: 8px; font-weight: bold; text-align: center; color: #f8f8f2; font-size: 14px; }

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
        panel.innerHTML = `
            <div id="${PANEL_ID}-header">📊 Cursor 用量統計 (v8.1)</div>
            <div id="${PANEL_ID}-controls">
                <div class="control-row">
                    <button data-days="1">今天</button>
                    <button data-days="7">7 天</button>
                    <button data-days="30">30 天</button>
                </div>
                <div class="control-row">
                    <input type="text" id="start-date-picker" placeholder="開始日期">
                    <input type="text" id="end-date-picker" placeholder="結束日期">
                    <button class="query-btn">查詢</button>
                </div>
            </div>
            <div id="${PANEL_ID}-content">請選擇查詢範圍</div>
            <div id="${PANEL_ID}-chart-container">
                <canvas id="${PANEL_ID}-chart"></canvas>
            </div>
        `;
        document.body.appendChild(panel);
        makeDraggable(panel);

        // 初始化日期選擇器
        flatpickrStart = flatpickr("#start-date-picker", { dateFormat: "Y-m-d" });
        flatpickrEnd = flatpickr("#end-date-picker", { dateFormat: "Y-m-d" });

        // 載入儲存的日期
        loadSavedDates();

        // 綁定事件
        panel.querySelector(`#${PANEL_ID}-controls`).addEventListener('click', handleControlClick);
    }

    // 處理所有控制按鈕的點擊事件
    async function handleControlClick(e) {
        const target = e.target;
        if (target.tagName !== 'BUTTON') return;

        const allQuickButtons = document.querySelectorAll(`#${PANEL_ID}-controls button[data-days]`);
        allQuickButtons.forEach(btn => btn.classList.remove('active-button'));

        let startDate, endDate = new Date(); // 結束日期預設為今天

        if (target.dataset.days) { // 如果是快速按鈕
            target.classList.add('active-button');
            const days = parseInt(target.dataset.days, 10);
            startDate = new Date();
            // 以 UTC 為基準設定開始時間
            startDate.setUTCHours(0, 0, 0, 0);
            startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

            // 更新 datepicker 的值
            flatpickrStart.setDate(startDate, false);
            flatpickrEnd.setDate(endDate, false);

        } else if (target.classList.contains('query-btn')) { // 如果是查詢按鈕
             if (flatpickrStart.selectedDates[0] && flatpickrEnd.selectedDates[0]) {
                startDate = flatpickrStart.selectedDates[0];
                endDate = flatpickrEnd.selectedDates[0];
                // 將結束時間設為當天的 23:59:59
                endDate.setHours(23, 59, 59, 999);
             } else {
                alert("請選擇開始和結束日期！");
                return;
             }
        }

        if (startDate && endDate) {
            await GM_setValue('saved_start_date', startDate.getTime());
            await GM_setValue('saved_end_date', endDate.getTime());
            fetchAllUsageData(startDate.getTime(), endDate.getTime());
        }
    }

    // 讀取並設定上次儲存的日期
    async function loadSavedDates() {
        const savedStart = await GM_getValue('saved_start_date', null);
        const savedEnd = await GM_getValue('saved_end_date', null);

        if (savedStart && savedEnd) {
            flatpickrStart.setDate(new Date(savedStart), false);
            flatpickrEnd.setDate(new Date(savedEnd), false);
        } else {
            // 如果沒有儲存的日期，預設選取最近7天
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 6);
            flatpickrStart.setDate(startDate, false);
            flatpickrEnd.setDate(endDate, false);
        }
    }

    // 負責循環獲取所有分頁的資料
    async function fetchAllUsageData(startDateTimestamp, endDateTimestamp) {
        const contentDiv = document.getElementById(`${PANEL_ID}-content`);
        const buttons = document.querySelectorAll(`#${PANEL_ID}-controls button`);
        buttons.forEach(b => b.disabled = true);
        contentDiv.innerHTML = '查詢中 (第 1 頁)...';
        if (myCursorUsageChart) { myCursorUsageChart.destroy(); }

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
                contentDiv.innerHTML = `查詢中...<br>已獲取 ${allEvents.length} / ${totalEventsCount} 筆`;
                currentPage++;
            } while (allEvents.length < totalEventsCount && totalEventsCount > 0);
            processAndDisplayData(allEvents);
        } catch (error) {
            console.error('[Cursor腳本] 獲取資料時發生錯誤:', error);
            contentDiv.innerHTML = `錯誤: ${error.message || '請求失敗'}`;
        } finally {
            buttons.forEach(b => b.disabled = false);
        }
    }

    // 處理並顯示最終資料
    function processAndDisplayData(allEvents) {
        // ... 此函數與 v7.4 版本完全相同 ...
        const contentDiv = document.getElementById(`${PANEL_ID}-content`);
        if (allEvents.length === 0) { contentDiv.innerHTML = '此期間內沒有用量紀錄。'; if (myCursorUsageChart) { myCursorUsageChart.destroy(); } return; }
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
                <tr><td>請求次數:</td><td>${totalRequests.toLocaleString()}</td></tr>
                <tr><td>輸入 Tokens:</td><td>${totalInputTokens.toLocaleString()}</td></tr>
                <tr><td>輸出 Tokens:</td><td>${totalOutputTokens.toLocaleString()}</td></tr>
                <tr><td>快取讀取:</td><td>${totalCacheReadTokens.toLocaleString()}</td></tr>
                <tr><td>快取寫入:</td><td>${totalCacheWriteTokens.toLocaleString()}</td></tr>
                <tr><td>總Tokens:</td><td>${totalTokens.toLocaleString()}</td></tr>
                <tr><td>總花費:</td><td><b>$${totalCostDollars.toFixed(4)}</b></td></tr>
            </table>
        `;
        const chartData = processDataForChart(allEvents);
        renderChart(chartData);
    }

    // 將事件列表處理成圖表所需的格式
    function processDataForChart(allEvents) {
        // ... 此函數與 v7.4 版本完全相同 ...
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

    // 使用 Chart.js 繪製圖表
    function renderChart(chartData) {
        // ... 此函數與 v7.4 版本完全相同 ...
        if (myCursorUsageChart) { myCursorUsageChart.destroy(); }
        const ctx = document.getElementById(`${PANEL_ID}-chart`).getContext('2d');
        myCursorUsageChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: '每日花費 ($)',
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

    // 其他輔助函式
    function makeRequest(payload) { return new Promise((resolve, reject) => { GM_xmlhttpRequest({ method: "POST", url: API_URL, data: JSON.stringify(payload), headers: { "Content-Type": "application/json", "Accept": "application/json", "Origin": "https://cursor.com", "Referer": window.location.href }, onload: (response) => resolve(response.responseText), onerror: (response) => reject(response) }); }); }
    function makeDraggable(element) { let isDragging = false, offsetX, offsetY; const header = element.querySelector(`#${PANEL_ID}-header`); header.addEventListener('mousedown', (e) => { isDragging = true; offsetX = e.clientX - element.getBoundingClientRect().left; offsetY = e.clientY - element.getBoundingClientRect().top; document.body.style.userSelect = 'none'; }); document.addEventListener('mousemove', (e) => { if (isDragging) { element.style.left = `${e.clientX - offsetX}px`; element.style.top = `${e.clientY - offsetY}px`; } }); document.addEventListener('mouseup', () => { isDragging = false; document.body.style.userSelect = ''; }); }

    window.addEventListener('load', createPanel);
})();
