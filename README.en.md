# Cursor Usage Stats Panel

This is a [Tampermonkey](https://www.tampermonkey.net/) userscript designed for [Cursor](https://cursor.com). It adds a powerful, floating statistics panel to your dashboard page (`/dashboard`), allowing you to deeply analyze your AI model usage, costs, and trends.

![Script Interface Screenshot](https://github.com/max0821/Cursor-Usage/blob/main/cursor_usage_demo.jpg?raw=true)

---

## ✨ Features

This script addresses the official dashboard's lack of detailed statistics and trend analysis by providing the following core features:

- **📊 Interactive Floating Panel**:
  - The interface can be freely dragged and positioned anywhere on the screen.
  - All data is presented in a single, easy-to-read panel.

- **📈 Detailed Data Statistics**:
  - **Request Count**: Counts all successfully billed requests.
  - **Token Analysis**: Precisely calculates the total amount of Input, Output, Cache Read, and Cache Write tokens.
  - **Total Cost**: Sums up all costs, providing an accurate total in USD, precise to four decimal places.

- **📅 Flexible Date Queries**:
  - **Quick Buttons**: Provides one-click access to common time ranges like "Today," "7 Days," and "30 Days."
  - **Custom Date Picker**: Features an interactive calendar, allowing you to select any custom date range for analysis.
  - **Smart Memory**: Automatically saves your last selected date range and loads it the next time you open the page.

- **📉 Visualized Trend Chart**:
  - Includes a built-in daily cost line chart powered by [Chart.js](https://www.chartjs.org/).
  - Visualizes your total costs on a day-by-day basis, helping you easily identify usage peaks and troughs.

- **🚀 Robust and Reliable Data Fetching**:
  - **Automatic Pagination**: When usage records exceed one page, the script automatically fetches all subsequent pages in the background and merges the data, ensuring 100% complete statistics.
  - **Smart Filtering**: Automatically excludes all non-billed, errored, or user-API-key-generated requests to ensure the purity of the statistical scope.
  - **Timezone Synchronization**: All date calculations are based on the **UTC+0** standard, perfectly aligning with Cursor's official backend logic to eliminate data discrepancies caused by time differences.

---

## 🔧 Installation Guide

1.  **Install a Userscript Manager (Required)**
    - You first need to install a userscript manager in your browser. The most recommended is [**Tampermonkey**](https://www.tampermonkey.net/), which supports major browsers like Chrome, Firefox, Edge, and Safari.

2.  **Install the Script**
    - [**➡️ Click here to install the script directly**](https://raw.githubusercontent.com/max0821/Cursor-Usage/main/cursor_usage.userscript.js)
    - After clicking the link above, Tampermonkey will automatically open a new tab displaying the script's source code and information.
    - Click the "Install" button on that page to complete the installation.

---

## 📖 How to Use

1.  After installing and enabling the script, open or refresh your [Cursor Dashboard page](https://cursor.com/cn/dashboard).
2.  The script's floating panel will automatically appear in the bottom-left corner of the screen.
3.  **Quick Query**:
    - Click the "Today," "7 Days," or "30 Days" buttons to instantly query and display data for the corresponding time range. The selected button will be highlighted.
4.  **Custom Query**:
    - Click the two date input fields below to open the calendar.
    - Select your desired "Start Date" and "End Date."
    - Click the "Query" button on the right to analyze your custom time range.
5.  **View Results**:
    - The table at the top of the panel will show detailed aggregate statistics.
    - The chart at the bottom will display the daily cost trend.
6.  **Move the Panel**:
    - Press and hold the top title bar of the panel to drag it to any position on the screen.

---

## 📄 License

This script is licensed under the [MIT License](https://opensource.org/licenses/MIT).
