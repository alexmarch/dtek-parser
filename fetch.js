import { chromium } from "playwright";
import fs from "fs";

const STREET = "вул. Крістерів Родини";
const BUILDING = "20";

(async () => {
    const browser = await chromium.launch({
        headless: true, // Set to false if you want to see the browser actions
    });
    const page = await browser.newPage();

    await page.goto("https://www.dtek-kem.com.ua/ua/shutdowns", {
        waitUntil: "networkidle"
    });

    // adjust selectors if needed
    // waiting for selector class="modal__close m-attention__close"
    await page.waitForSelector('.modal__close.m-attention__close');
    // cickon it button to close modal if exists
    await page.click('button[class="modal__close m-attention__close"]');

    await page.fill('input[name="street"]', STREET);
    await page.click('div[id="streetautocomplete-list"]');

    await page.fill('input[name="house_num"]', BUILDING);
    await page.click('div[id="house_numautocomplete-list"]>div');


    await page.waitForSelector("table");

    // Function to parse the schedule table
    async function parseScheduleTable() {
        const tableSelector = 'table';
        const table = await page.$(tableSelector);

        // Parse header to get time ranges
        const headerCells = await table.$$('thead tr th');
        const timeRanges = [];

        for (const cell of headerCells) {
            const text = await cell.evaluate(node => node.innerText.trim());
            if (text && text.includes('-')) {
                timeRanges.push(text);
            }
        }

        // Parse body rows
        const rows = await table.$$('tbody tr');
        const schedule = [];

        for (const row of rows) {
            const cells = await row.$$('td');
            const daySchedule = [];

            let cellIndex = 0;
            for (const cell of cells) {
                const cellClass = await cell.evaluate(node => node.className);
                const colspan = await cell.evaluate(node => node.getAttribute('colspan'));

                // Skip the first cell(s) with colspan (date column)
                if (colspan) {
                    cellIndex++;
                    continue;
                }

                // Map class to status
                let status = 'unknown';
                if (cellClass.includes('cell-scheduled')) {
                    status = 'scheduled'; // Power off
                } else if (cellClass.includes('cell-non-scheduled')) {
                    status = 'non-scheduled'; // Power on
                } else if (cellClass.includes('cell-first-half')) {
                    status = 'first-half-off'; // First 30 min off
                } else if (cellClass.includes('cell-second-half')) {
                    status = 'second-half-off'; // Second 30 min off
                }

                const timeIndex = cellIndex - 1;
                if (timeIndex >= 0 && timeIndex < timeRanges.length) {
                    daySchedule.push({
                        time: timeRanges[timeIndex],
                        status: status,
                        class: cellClass
                    });
                }

                cellIndex++;
            }

            if (daySchedule.length > 0) {
                schedule.push(daySchedule);
            }
        }

        return { timeRanges, schedule };
    }

    // Call the function and log the result
    const scheduleData = await parseScheduleTable();
    console.log(JSON.stringify(scheduleData, null, 2));

    await browser.close();

    fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync(
        "data/schedule.json",
        JSON.stringify({
            updated: new Date().toISOString(),
            street: STREET,
            building: BUILDING,
            schedule: scheduleData
        }, null, 2)
    );
})();