// App Store 用のスクリーンショット（README_launch.md 2章）を、design_handoff の
// `App Store Screenshots.dc.html`（s1〜s7、430×932想定）から書き出す。
// 6.9インチ用は 3倍（1290×2796）でそのまま撮り、6.5インチ用は 1284×2778 にリサイズする。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../../design_handoff_plate 2/App Store Screenshots.dc.html');
const OUT_DIR = path.resolve(__dirname, '../store/screenshots');
const FRAME_IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
const SCALE = 3; // 430×932 × 3 = 1290×2796（6.9インチ）

async function main() {
  mkdirSync(path.join(OUT_DIR, '6.9'), { recursive: true });
  mkdirSync(path.join(OUT_DIR, '6.5'), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: SCALE });
  await page.goto(`file://${SRC}`);
  // <x-dc> のカスタム要素がテンプレートを描き終えるまで待つ
  await page.waitForSelector('#s1');
  await page.waitForFunction(() => {
    const el = document.querySelector('#s7');
    return !!el && el.getBoundingClientRect().width > 0;
  });

  for (const id of FRAME_IDS) {
    const el = await page.$(`#${id}`);
    if (!el) throw new Error(`frame #${id} が見つかりません`);
    const file69 = path.join(OUT_DIR, '6.9', `${id}.png`);
    await el.screenshot({ path: file69 });
    await sharp(file69).resize(1284, 2778, { fit: 'fill' }).toFile(path.join(OUT_DIR, '6.5', `${id}.png`));
    console.log(`書き出し: ${id}`);
  }

  await browser.close();
  console.log(`完了: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
