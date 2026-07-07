import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      console.log('PAGE NAVIGATED TO:', frame.url());
    }
  });

  try {
    await page.goto('http://localhost:5174/schedule', { waitUntil: 'networkidle0' });

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && b.textContent.includes('Create Schedule'));
      if (btn) btn.click();
    });

    await page.waitForSelector('.MuiDialog-paper', { visible: true });
    await new Promise(r => setTimeout(r, 500));

    // Click Save
    await page.evaluate(() => {
      const dialog = document.querySelector('.MuiDialogActions-root');
      if (dialog) {
        const buttons = dialog.querySelectorAll('button');
        if (buttons.length > 1) buttons[1].click();
      }
    });

    await new Promise(r => setTimeout(r, 2000));
    console.log("Done.");
  } catch (err) {
    console.error("Puppeteer Error:", err);
  } finally {
    await browser.close();
  }
})();
