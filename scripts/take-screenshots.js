// scripts/take-screenshots.js
// Launches Chromium, intercepts all /api/* calls with fixture data,
// navigates each page, and saves 1440x900 viewport screenshots to screenshots/

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { getFixture } = require("./demo-fixtures.js");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR  = path.join(__dirname, "..", "screenshots");

const PAGES = [
  { route: "/",              file: "dashboard.png",      label: "Dashboard"        },
  { route: "/transactions",  file: "transactions.png",   label: "Transactions"     },
  { route: "/cash-flow",     file: "cash-flow.png",      label: "Cash Flow"        },
  { route: "/points",        file: "points.png",         label: "Points & Rewards" },
  { route: "/optimize",      file: "optimize.png",       label: "Card Optimizer"   },
  { route: "/net-worth",     file: "net-worth.png",      label: "Net Worth"        },
  { route: "/anomalies",     file: "anomalies.png",      label: "Anomalies"        },
  { route: "/subscriptions", file: "subscriptions.png",  label: "Subscriptions"    },
  { route: "/goals",         file: "goals.png",          label: "Goals"            },
  { route: "/reports",       file: "reports.png",        label: "Reports"          },
  { route: "/merchants",     file: "merchants.png",      label: "Merchants"        },
  { route: "/chat",          file: "chat.png",           label: "AI Chat"          },
];

async function handleApiRoute(route) {
  const url = new URL(route.request().url());
  const fixture = getFixture(url.pathname, url.searchParams);
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(fixture ?? {}),
  });
}

async function installRoutes(page) {
  // Intercept API calls regardless of whether they go through the Next.js dev
  // server, nginx, or directly to the FastAPI backend — this ensures no real
  // personal data leaks into the screenshots.
  await page.route("**/api/**", handleApiRoute);
  await page.route("http://127.0.0.1:8000/**", handleApiRoute);
  await page.route("http://localhost:8000/**", handleApiRoute);
}

async function screenshotPage(page, route, file, label) {
  console.log(`  → ${label} (${route})`);
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });

  // Wait for main content to settle (network idle may hang on polling)
  await page.waitForTimeout(1800);

  const outPath = path.join(OUT_DIR, file);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`    ✓ saved ${file}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    deviceScaleFactor: 2, // retina — crisp on modern displays
  });

  const page = await context.newPage();
  await installRoutes(page);

  // Suppress console errors from the app so they don't clutter output
  page.on("console", msg => {
    if (msg.type() === "error") return;
  });

  console.log(`\nHive Demo Screenshots → ${OUT_DIR}\n`);

  for (const { route, file, label } of PAGES) {
    await screenshotPage(page, route, file, label);
  }

  await browser.close();
  console.log(`\nDone. ${PAGES.length} screenshots saved to screenshots/\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
