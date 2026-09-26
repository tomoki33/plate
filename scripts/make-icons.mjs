// assets/brand/*.svg から PNG を書き出す。使い方: node scripts/make-icons.mjs（sharp が必要）
import sharp from 'sharp';
const out = (svg, file, size) => sharp(`assets/brand/${svg}`, { density: 384 }).resize(size, size).png().toFile(`assets/${file}`);
await out('app-icon.svg', 'icon.png', 1024);
await out('app-icon-foreground.svg', 'android-icon-foreground.png', 1024);
await out('app-icon.svg', 'favicon.png', 96);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#1F1712' } }).png().toFile('assets/android-icon-background.png');
await sharp('assets/brand/app-icon-foreground.svg', { density: 384 }).resize(1024, 1024).greyscale().png().toFile('assets/android-icon-monochrome.png');
await sharp('assets/brand/app-icon-foreground.svg', { density: 384 }).resize(512, 512).png().toFile('assets/splash-icon.png');
console.log('done');
