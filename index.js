require("dotenv").config();

const puppeteer = require("puppeteer");
const axios = require("axios");

const todayVbuckXPath = "/html/body/main/div[1]/div[1]/div[3]/div[2]/div[1]/div/div";
const locationXPath = "/html/body/main/div[1]/div[1]/div[2]/div[1]/div[2]/div/table/tbody/tr/td[1]/span";

const locations = {
  S: "Stonewood",
  P: "Plankerton",
  T: "Twine peaks",
  C: "Canny valley",
};

const notifications = process.env.NOTIFICATIONS.split(",");

notifications.forEach((platform) => {
  if (!["discord", "ntfy"].includes(platform.toLowerCase())) {
    throw new Error("Invalid platform. Only discord and ntfy are supported.");
  }

  if (platform.toLowerCase() === "ntfy") {
    if (!process.env.NTFY_URL) {
      throw new Error("NTFY_URL is required for ntfy platform.");
    }
  }

  if (platform.toLowerCase() === "discord") {
    if (!process.env.DISCORD_WEBHOOK) {
      throw new Error("DISCORD_WEBHOOK is required for discord platform.");
    }
  }
});

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36"
  );

  await page.goto("https://fortnitedb.com", {
    waitUntil: "load",
  });

  await page.waitForSelector(`::-p-xpath(${todayVbuckXPath})`);

  const dailyVbuck = await (await page.$(`::-p-xpath(${todayVbuckXPath})`)).evaluate((el) => el.textContent.trim());

  if (dailyVbuck > 0) {
    const locationRaw = await (await page.$(`::-p-xpath(${locationXPath})`)).evaluate((el) => el.textContent.trim());
    const locationActual = locations[locationRaw] ?? locationRaw;

    const notificationText = `Amount: ${dailyVbuck}\nLocation: ${locationActual}`;

    notifications.forEach(async (platform) => {
      if (platform.toLowerCase() === "discord") {
        await axios.post(process.env.DISCORD_WEBHOOK, {
          content: notificationText,
        });
      }

      if (platform.toLowerCase() === "ntfy") {
        if (!process.env.NTFY_USERNAME || !process.env.NTFY_PASSWORD) {
          await axios.post(process.env.NTFY_URL, notificationText);
        } else {
          await axios.post(process.env.NTFY_URL, notificationText, {
            auth: {
              username: process.env.NTFY_USERNAME,
              password: process.env.NTFY_PASSWORD,
            },
          });
        }
      }
    });
  }

  await browser.close();
})();
