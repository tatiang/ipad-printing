import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium, webkit } = await import(
  modulePath ? pathToFileURL(modulePath).href : "playwright"
);
const base = process.env.TEST_URL || "http://localhost:8000";
await mkdir("test-results", { recursive: true });

// WebKit's simulated offline mode can fail before a service worker handles navigation.
// Stop an actual isolated server instead, proving the shell loads with no server available.
async function verifyOfflineShell(browser) {
  const files = [
    "index.html",
    "style_v1.00.css",
    "app_v1.00.js",
    "images_v1.00.js",
    "geometry_v1.00.mjs",
    "manifest.webmanifest",
    "service-worker.js",
    "icons/icon.svg",
    "icons/icon-192.png",
    "icons/icon-512.png",
  ];
  const assets = new Map(
    await Promise.all(
      files.map(async (file) => [
        "/" + file,
        await readFile(new URL("../" + file, import.meta.url)),
      ]),
    ),
  );
  assets.set("/", assets.get("/index.html"));
  const server = createServer((request, response) => {
    const asset = assets.get(request.url);
    if (!asset) {
      response.writeHead(404);
      response.end();
      return;
    }
    const path = request.url === "/" ? "/index.html" : request.url;
    const type = path.endsWith(".html")
      ? "text/html"
      : /\.(js|mjs)$/.test(path)
        ? "text/javascript"
        : path.endsWith(".css")
          ? "text/css"
          : path.endsWith(".svg")
            ? "image/svg+xml"
            : path.endsWith(".png")
              ? "image/png"
              : "application/manifest+json";
    response.setHeader("Content-Type", type);
    response.end(asset);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await page.reload();
    await page.locator(".layout-option").first().waitFor();
    assert.equal(await page.locator("#empty").isVisible(), true);
    assert.equal(await page.locator(".layout-option").count(), 5);
    assert.deepEqual(errors, []);
  } finally {
    server.close();
    await context.close();
  }
}

for (const [engine, browserType] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await browserType.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 1366 },
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    await context.addInitScript(() => {
      window.testURLs = new Set();
      const create = URL.createObjectURL.bind(URL);
      const revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        const url = create(blob);
        window.testURLs.add(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        window.testURLs.delete(url);
        revoke(url);
      };
      window.printCalls = 0;
      window.print = () => {
        window.printCalls++;
      };
    });
    const page = await context.newPage();
    const errors = [];
    const external = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/^https?:/.test(request.url()) && !request.url().startsWith(base))
        external.push(request.url());
    });
    await page.goto(base);
    await page.locator(".layout-option").first().waitFor();
    assert.equal(await page.locator(".layout-option").count(), 5);
    assert.equal(await page.locator("#print").isDisabled(), true);
    await page.screenshot({
      path: `test-results/${engine}-empty.png`,
      fullPage: true,
    });
    const makeFile = async (width, height, color, name) => ({
      name,
      mimeType: "image/png",
      buffer: Buffer.from(
        await page.evaluate(
          ({ width, height, color }) => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const c = canvas.getContext("2d");
            c.fillStyle = color;
            c.fillRect(0, 0, width, height);
            c.fillStyle = "#fff";
            c.fillRect(width * 0.1, height * 0.1, width * 0.2, height * 0.2);
            c.fillStyle = "#183d33";
            c.font = `bold ${width / 10}px sans-serif`;
            c.fillText("TOP ↑", width * 0.35, height * 0.2);
            c.fillStyle = "#eeae53";
            c.fillRect(width * 0.65, height * 0.6, width * 0.25, height * 0.3);
            return canvas.toDataURL("image/png").split(",")[1];
          },
          { width, height, color },
        ),
        "base64",
      ),
    });
    const portrait = await makeFile(900, 1200, "#a0bfb0", "portrait.png");
    const landscape = await makeFile(1200, 800, "#b3acce", "landscape.png");
    const files = Array.from({ length: 14 }, (_, i) => ({
      ...(i % 2 ? landscape : portrait),
      name: `photo-${i + 1}.png`,
    }));
    const importFiles = async (list) => {
      await page.locator("#photo-input").setInputFiles(list);
      await page.waitForFunction(
        () => !document.getElementById("choose").disabled,
      );
      if (list.length && (await page.locator("#pages img").count()))
        await page.waitForFunction(
          () => !document.getElementById("print").disabled,
        );
    };
    const reset = async () => {
      await page.locator("#reset").click();
      await page.locator("#confirm-reset").click();
      await page.waitForFunction(
        () => document.querySelectorAll("#pages img").length === 0,
      );
      assert.equal(await page.evaluate(() => window.testURLs.size), 0);
    };
    // Insert a real EXIF orientation=6 APP1 tag into a landscape JPEG.
    const jpeg = Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 120;
        canvas.height = 80;
        const c = canvas.getContext("2d");
        c.fillStyle = "red";
        c.fillRect(0, 0, 60, 80);
        c.fillStyle = "blue";
        c.fillRect(60, 0, 60, 80);
        return canvas.toDataURL("image/jpeg").split(",")[1];
      }),
      "base64",
    );
    const exif = Buffer.from(
      "ffe1002245786966000049492a0008000000010012010300010000000600000000000000",
      "hex",
    );
    await importFiles([
      {
        name: "oriented.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]),
      },
    ]);
    const oriented = await page.locator("#pages img").evaluate((img) => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return {
        w: img.naturalWidth,
        h: img.naturalHeight,
        top: [...ctx.getImageData(40, 10, 1, 1).data],
      };
    });
    assert.equal(oriented.w, 80);
    assert.equal(oriented.h, 120);
    assert.ok(
      oriented.top[0] > 200 && oriented.top[2] < 30,
      "EXIF rotated red half to top",
    );
    await reset();
    console.log(`${engine}: EXIF orientation normalization passed`);
    const verifyPrint = async (expected) => {
      await page.emulateMedia({ media: "print" });
      const result = await page.evaluate(() => ({
        pages: [...document.querySelectorAll(".sheet")].map((el) => ({
          w: el.getBoundingClientRect().width,
          h: el.getBoundingClientRect().height,
        })),
        controls: [...document.querySelectorAll(".screen-only,dialog")].every(
          (el) => getComputedStyle(el).display === "none",
        ),
        lastBreak: getComputedStyle(
          document.querySelector(".sheet-wrapper:last-child"),
        ).breakAfter,
      }));
      assert.equal(result.pages.length, expected);
      for (const p of result.pages) {
        assert.ok(Math.abs(p.w - 816) < 0.1);
        assert.ok(Math.abs(p.h - 1056) < 0.1);
      }
      assert.equal(result.controls, true);
      assert.equal(result.lastBreak, "auto");
      if (engine === "chromium") {
        const pdf = await page.pdf({
          preferCSSPageSize: true,
          printBackground: true,
        });
        await writeFile(
          `test-results/${expected}-pages-${await page.locator("#pages img").count()}-photos.pdf`,
          pdf,
        );
        const text = pdf.toString("latin1");
        assert.equal(
          (text.match(/\/Type\s*\/Page\b/g) || []).length,
          expected,
          "PDF page count",
        );
        assert.match(
          text,
          /\/MediaBox\s*\[0 0 612 792\]/,
          "Letter PDF dimensions",
        );
      }
      await page.emulateMedia({ media: "screen" });
    };
    for (const [count, perPage, expected] of [
      [1, 1, 1],
      [2, 2, 1],
      [4, 4, 1],
      [6, 6, 1],
      [9, 9, 1],
      [14, 9, 2],
      [10, 4, 3],
    ]) {
      await importFiles(
        count === 2 ? [landscape, landscape] : files.slice(0, count),
      );
      await page.locator(`[data-count="${perPage}"]`).click();
      assert.equal(await page.locator(".sheet").count(), expected);
      assert.equal(await page.locator("#pages img").count(), count);
      await verifyPrint(expected);
      await reset();
    }
    console.log(
      `${engine}: all 7 layout/page-count cases and print media passed`,
    );
    await importFiles(files.slice(0, 10));
    const firstId = await page
      .locator(".photo-frame")
      .first()
      .getAttribute("data-photo-id");
    await page.locator(".photo-frame").first().click();
    await page.locator("#rotate").click();
    assert.match(
      await page.locator("#edit-frame img").getAttribute("style"),
      /rotate\(90deg\)/,
    );
    await page.locator("#rotate").click();
    assert.match(
      await page.locator("#edit-frame img").getAttribute("style"),
      /rotate\(180deg\)/,
    );
    await page.locator("#zoom").fill("2");
    await page.locator("#zoom").dispatchEvent("input");
    assert.equal(await page.locator("#zoom-value").textContent(), "200%");
    const before = await page.locator("#edit-frame img").getAttribute("style");
    await page.locator('[aria-label="Move photo right"]').click();
    assert.notEqual(
      await page.locator("#edit-frame img").getAttribute("style"),
      before,
    );
    const rect = await page.locator("#edit-frame").boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      rect.x + rect.width * 0.65,
      rect.y + rect.height * 0.6,
      { steps: 6 },
    );
    await page.mouse.up();
    await page.locator("#edit-frame").focus();
    await page.keyboard.press("ArrowLeft");
    if (engine === "chromium") {
      const cdp = await context.newCDPSession(page);
      const x = rect.x + rect.width / 2,
        y = rect.y + rect.height / 2;
      const startZoom = Number(await page.locator("#zoom").inputValue());
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: x - 25, y, id: 1 },
          { x: x + 25, y, id: 2 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: x - 50, y, id: 1 },
          { x: x + 50, y, id: 2 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      assert.ok(
        Number(await page.locator("#zoom").inputValue()) > startZoom,
        "two-finger pinch increases zoom",
      );
      await cdp.detach();
    }
    // Live editor and print frame use exactly the same transform, even before closing the dialog.
    assert.equal(
      await page.locator("#edit-frame img").getAttribute("style"),
      await page
        .locator(`[data-photo-id="${firstId}"] img`)
        .getAttribute("style"),
    );
    await page.screenshot({ path: `test-results/${engine}-editor.png` });
    await page.locator("#later").click();
    assert.equal(
      await page
        .locator("#pages .photo-frame")
        .nth(1)
        .getAttribute("data-photo-id"),
      firstId,
    );
    // Cross a page boundary using the accessible order buttons.
    for (let i = 0; i < 3; i++) await page.locator("#later").click();
    assert.equal(
      await page
        .locator("#pages .photo-frame")
        .nth(4)
        .getAttribute("data-photo-id"),
      firstId,
    );
    await page.locator("#earlier").click();
    assert.equal(
      await page
        .locator("#pages .photo-frame")
        .nth(3)
        .getAttribute("data-photo-id"),
      firstId,
    );
    await page.locator("#done").click();
    await page.waitForFunction(() => !document.getElementById("editor").open);
    await page.waitForFunction(
      (id) => document.activeElement.dataset.photoId === id,
      firstId,
    );
    await page.locator("#pages .photo-frame").nth(4).click();
    await page.locator("#remove").click();
    await page.waitForFunction(
      () => document.querySelectorAll("#pages img").length === 9,
    );
    assert.equal(await page.evaluate(() => window.testURLs.size), 9);
    await page.locator("#cut-guides").check();
    assert.ok((await page.locator(".cut-guide").count()) > 0);
    await page.screenshot({
      path: `test-results/${engine}-sheets.png`,
      fullPage: true,
    });
    await verifyPrint(3);
    await page.locator("#print").click();
    assert.equal(await page.evaluate(() => window.printCalls), 1);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1366, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        "no horizontal page overflow",
      );
      const box = await page.locator(".sheet").first().boundingBox();
      assert.ok(Math.abs(box.width / box.height - 8.5 / 11) < 0.001);
      await page.screenshot({
        path: `test-results/${engine}-${viewport.width}.png`,
        fullPage: true,
      });
    }
    await page.locator("#reset").click();
    await page.locator("#cancel-reset").click();
    assert.equal(await page.locator("#pages img").count(), 9);
    await reset();
    assert.equal(
      await page.locator('[data-count="4"]').getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(await page.locator("#cut-guides").isChecked(), false);
    await importFiles([
      {
        name: "broken.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("invalid"),
      },
    ]);
    assert.match(
      await page.locator("#status").textContent(),
      /couldn’t be opened/,
    );
    assert.equal(await page.evaluate(() => window.testURLs.size), 0);
    await importFiles([portrait]);
    await page.locator("#pages .photo-frame").click();
    await page.locator("#remove").click();
    await page.waitForFunction(
      () => document.querySelectorAll("#pages img").length === 0,
    );
    assert.equal(await page.locator("#empty").isVisible(), true);
    assert.equal(await page.evaluate(() => window.testURLs.size), 0);
    console.log(
      `${engine}: editing, pan/buttons, order, delete, reset, errors, responsive UI and URL cleanup passed`,
    );
    const large = await makeFile(2600, 1800, "#8fb9ba", "large.png");
    await importFiles([large]);
    await importFiles(
      Array.from({ length: 29 }, (_, i) => ({
        ...large,
        name: `large-${i}.png`,
      })),
    );
    assert.equal(await page.locator("#pages img").count(), 30);
    const pixels = await page.evaluate(() =>
      [...document.querySelectorAll("#pages img")].reduce(
        (sum, img) => sum + img.naturalWidth * img.naturalHeight,
        0,
      ),
    );
    assert.ok(pixels <= 48_000_000, `pixel budget: ${pixels}`);
    await importFiles([portrait]);
    assert.match(await page.locator("#status").textContent(), /30 photos/);
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: false }),
      ),
    );
    assert.equal(await page.evaluate(() => window.testURLs.size), 0);
    await page.reload();
    assert.equal(await page.locator("#pages img").count(), 0);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      return (
        await Promise.all(
          keys.map(async (key) =>
            (await (await caches.open(key)).keys()).map((r) => r.url),
          ),
        )
      ).flat();
    });
    assert.equal(cached.length, 10);
    assert.equal(
      cached.some((url) => url.startsWith("blob:")),
      false,
    );
    await verifyOfflineShell(browser);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(
      `${engine}: 30-photo memory budget, reload cleanup, offline shell and no external requests passed`,
    );
    await context.close();
  } finally {
    await browser.close();
  }
}
console.log(
  "All browser checks passed. Physical iPad/AirPrint QA is still required.",
);
