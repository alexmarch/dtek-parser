import { chromium } from "playwright";
import fs from "fs";

const STREET = "вул. Крістерів Родини";
const BUILDING = "20";

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto("https://www.dtek-kem.com.ua/ua/shutdowns", {
        waitUntil: "networkidle"
    });

    // adjust selectors if needed
    await page.fill('input[name="street"]', STREET);
   
    await page.waitForTimeout(1000); // wait for any dynamic loading
    await page.fill('input[name="house_num"]', BUILDING);

    await page.waitForSelector("table");

    const rows = await page.evaluate(() => {
        const result = [];
        document.querySelectorAll("table tbody tr").forEach(tr => {
            const time = tr.querySelector("td[colspan='2']")?.innerText;
            const cell = tr.querySelector("td[class]");
            if (!time || !cell) return;
            result.push({
                time,
                class: cell.className
            });
        });
        return result;
    });

    await browser.close();

    fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync(
        "data/schedule.json",
        JSON.stringify({
            updated: new Date().toISOString(),
            street: STREET,
            building: BUILDING,
            schedule: rows
        }, null, 2)
    );
})();