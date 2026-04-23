import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browsers = process.argv[2] ? [process.argv[2]] : ['chrome', 'firefox'];

const srcDir = path.join(__dirname, '../src/manifests');
const destDir = path.join(__dirname, '..');

for (const browser of browsers) {
  const srcManifest = path.join(srcDir, `manifest.${browser}.json`);
  const destManifest = path.join(destDir, 'manifest.json');

  if (!fs.existsSync(srcManifest)) {
    console.error(`❌ Manifest not found: ${srcManifest}`);
    process.exit(1);
  }

  fs.copyFileSync(srcManifest, destManifest);
  console.log(`✓ Using manifest.${browser}.json`);

  execSync('vite build', { stdio: 'inherit', cwd: destDir });

  // Move dist to browser-specific dir
  const distDir = path.join(destDir, 'dist');
  const outDir = path.join(destDir, `dist-${browser}`);
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });
  fs.renameSync(distDir, outDir);
  console.log(`✓ Built ${browser} → dist-${browser}/`);
}
