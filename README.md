<h1 align="center">
<img src="https://raw.githubusercontent.com/govi218/rabbithole/main/packages/shared/src/assets/rabbithole-logo-stars-white.svg" alt="Rabbithole logo" title="Rabbithole logo" width="200">
<br>
rabbithole
</h1>
<p align="center" style="font-size: 1.2rem;">An extension to track your internet rabbitholes</p>

<hr />

## Install

- From the `Releases` section on the right, go to the latest release
- Download and unzip `rabbithole.zip`; this will create a `dist` folder
- Navigate to `chrome://extensions` (should resolve on all chromium)
- Turn on the `Developer Mode` switch
- Click the `Load Unpacked` button and then select the `dist` folder

![Example](https://wd.imgix.net/image/BhuKGJaIeLNPW9ehns59NfwqKxF2/vOu7iPbaapkALed96rzN.png?auto=format&w=571)

## Build

```bash
# build files to `/dist` directory
pnpm build
```

## Development

```bash
# install dependencies
pnpm i

# build files to `/dist` directory
# HMR for extension pages and content scripts
pnpm run dev
```
