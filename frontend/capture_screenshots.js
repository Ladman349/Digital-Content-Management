import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const outDir = 'C:\\Users\\Might\\.gemini\\antigravity\\brain\\f734d7d7-a935-4a47-bf21-ebddea3cee0a\\screenshots';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const routes = [
  { name: 'dashboard', path: '/' },
  { name: 'devices', path: '/devices' },
  { name: 'media', path: '/media' },
  { name: 'playlists', path: '/playlists' },
  { name: 'schedule', path: '/schedule' }
];

(async () => {
  console.log("Starting screenshot capture with full rendering wait...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // 1. Desktop Screenshots (1440x900)
  const desktopPage = await browser.newPage();
  await desktopPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  for (const r of routes) {
    try {
      console.log(`Capturing Desktop: ${r.name}...`);
      await desktopPage.goto(`http://localhost:5173${r.path}`, { waitUntil: 'networkidle2' }).catch(() => {});
      await new Promise(res => setTimeout(res, 5000));
      await desktopPage.screenshot({ path: path.join(outDir, `desktop_${r.name}.png`), fullPage: false });
    } catch (e) {
      console.error(`Error on desktop ${r.name}:`, e.message);
    }
  }

  // 2. Mobile Screenshots (390x844 iPhone 14/15)
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  for (const r of routes) {
    try {
      console.log(`Capturing Mobile: ${r.name}...`);
      await mobilePage.goto(`http://localhost:5173${r.path}`, { waitUntil: 'networkidle2' }).catch(() => {});
      await new Promise(res => setTimeout(res, 5000));
      await mobilePage.screenshot({ path: path.join(outDir, `mobile_${r.name}.png`), fullPage: false });
    } catch (e) {
      console.error(`Error on mobile ${r.name}:`, e.message);
    }
  }

  // 3. Mobile Navigation Drawer Open
  try {
    console.log(`Capturing Mobile Drawer Open...`);
    await mobilePage.goto(`http://localhost:5173/`, { waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise(res => setTimeout(res, 2000));
    const menuButtons = await mobilePage.$$('header button, [aria-label*="menu"], [aria-label*="drawer"], [aria-label*="open drawer"]');
    if (menuButtons.length > 0) {
      await menuButtons[0].click();
      await new Promise(res => setTimeout(res, 1000));
      await mobilePage.screenshot({ path: path.join(outDir, `mobile_drawer_open.png`), fullPage: false });
    }
  } catch (e) {
    console.error(`Error on mobile drawer:`, e.message);
  }

  // 4. Desktop Dialogs
  try {
    console.log(`Capturing Desktop Dialogs...`);
    await desktopPage.goto(`http://localhost:5173/devices`, { waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise(res => setTimeout(res, 3000));
    const addBtn = await desktopPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && (b.textContent.includes('Add Device') || b.textContent.includes('Register Device')));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (addBtn) {
      await new Promise(res => setTimeout(res, 1000));
      await desktopPage.screenshot({ path: path.join(outDir, `desktop_devices_dialog.png`), fullPage: false });
    }
  } catch (e) {
    console.error(`Error on desktop dialog:`, e.message);
  }

  await browser.close();
  console.log("All screenshots refreshed successfully in:", outDir);
})();
