import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browsers = process.argv[2] ? [process.argv[2]] : ["chrome", "firefox"];
const pkgDir = path.join(__dirname, "..");

for (const browser of browsers) {
  execSync(`BROWSER=${browser} vite build`, { stdio: "inherit", cwd: pkgDir });
  console.log(`Built ${browser} → dist-${browser}/`);
}
