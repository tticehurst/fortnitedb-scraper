require("dotenv").config();

const puppeteer = require("puppeteer");
const axios = require("axios");

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

  const tableData = await page.evaluate((locations) => {
    const table = document.querySelector("table.summary-honorable.summary-wrapper:not([id])");
    if (!table) return ["error table not found"];

    const rows = table.querySelectorAll("tr");

    const data = Array.from(rows).map((row) => {
      const cells = row.querySelectorAll("td");

      return Array.from(cells).map((cell) => {
        let src;
        let mainText = cell.textContent.trim();

        if (mainText.length <= 0) src = cell.children[0].getAttribute("src");
        return (
          mainText ||
          src
            .substring(src.lastIndexOf("/") + 1, src.lastIndexOf("."))
            .split("-")
            .slice(2, 4)
            .join(" ")
        );
      });
    });

    return data;
  }, locations);

  if (tableData.length > 0) {
    tableData.forEach((row) => {
      row[0] = `## Location: ${locations[row[0]]}`;
      row[1] = `\- Mission type: ${row[1]}`;
      row[2] = `\- Power level: ${row[2]}`;
      row[3] = `\- Rewards: ${row[3].substring(0, 2)}`;

      let ntfyRow = row.map((r) => r.substring(2, r.length));
      let discordNotificationText = row.join("\n");
      let ntfyNotificationText = ntfyRow.join("\n");

      notifications.forEach(async (platform) => {
        if (platform.toLowerCase() === "discord") {
          await axios.post(process.env.DISCORD_WEBHOOK, {
            content: discordNotificationText,
          });
        }

        if (platform.toLowerCase() === "ntfy") {
          if (!process.env.NTFY_USERNAME || !process.env.NTFY_PASSWORD) {
            await axios.post(process.env.NTFY_URL, ntfyNotificationText);
          } else {
            await axios.post(process.env.NTFY_URL, ntfyNotificationText, {
              auth: {
                username: process.env.NTFY_USERNAME,
                password: process.env.NTFY_PASSWORD,
              },
            });
          }
        }
      });
    });
  }

  await browser.close();
})();
