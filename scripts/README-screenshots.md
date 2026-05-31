# Autonomous App Store screenshots

`screenshot-driver.cjs` captures App Store screenshots with zero Mac/sim/taps.
It renders the live web app (glovebox.ecodia.au - pixel-identical to the
Capacitor webview) at exact Apple device dimensions, logs in, builds a real
trip, asks the AI guide a question, and captures each hero screen.

## Run
```
NODE_PATH=D:/.code/eos-laptop-agent/node_modules \
GB_EMAIL=apple@ecodia.au GB_PASSWORD=appleecodia \
node scripts/screenshot-driver.cjs
```
Output: `appstore-screenshots/<device>/<NN>-<screen>.png`
Sizes: iPhone 6.9 = 1290x2796 (Apple type APP_IPHONE_67), iPad 13 = 2064x2752
(APP_IPAD_PRO_3GEN_129). Uses system Chrome (GB_CHROME) - puppeteer's bundled
Chrome isn't installed.

## Upload to App Store Connect
`asc_upload_screenshots.py` runs ON SY094 (ASC .p8 key + PyJWT live there).
Transfer PNGs via SFTP to /tmp/gb-appstore/{iphone,ipad}/ then:
```
python3 asc_upload_screenshots.py --replace
```
Per-image flow: POST appScreenshots (reserve) -> PUT bytes to the pre-signed
URL WITHOUT the ASC bearer (no_auth=True, else 400) -> PATCH commit with md5.

## Why web-render not simulator
MacInCloud has sudo locked down, so idb (the headless sim tap tool) can't be
installed - simctl can screenshot but not tap, so it can't dismiss the location
dialog or navigate tabs. The web app is the same bundle, fully drivable, no taps.
