// assets/brand/*.svg から PNG を書き出す。使い方: node scripts/make-icons.mjs（sharp が必要）
import sharp from 'sharp';
const out = (svg, file, size) => sharp(`assets/brand/${svg}`, { density: 384 }).resize(size, size).png().toFile(`assets/${file}`);
await out('app-icon.svg', 'icon.png', 1024);
await out('app-icon-foreground.svg', 'android-icon-foreground.png', 1024);
await out('app-icon.svg', 'favicon.png', 96);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#1F1712' } }).png().toFile('assets/android-icon-background.png');
await sharp('assets/brand/app-icon-foreground.svg', { density: 384 }).resize(1024, 1024).greyscale().png().toFile('assets/android-icon-monochrome.png');
await sharp('assets/brand/app-icon-foreground.svg', { density: 384 }).resize(512, 512).png().toFile('assets/splash-icon.png');
// 起動画面（ログイン画面の上の部分と同じ位置に、丸と横線）。393x852pt の @3x。
// 丸：直径250・上端92、横線：高さ18・上端208（src/app/login.tsx と同じ数値）
const W = 393, H = 852;
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 3}" height="${H * 3}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#1F1712"/><circle cx="${W / 2}" cy="${92 + 125}" r="125" fill="#E85C31"/><rect x="0" y="208" width="${W}" height="18" fill="#FBF7F3"/></svg>`;
await sharp(Buffer.from(splash)).png().toFile('assets/splash-login.png');
console.log('done');
