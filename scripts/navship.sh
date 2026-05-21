#!/bin/bash
# scripts/navship.sh - canonical Nav iOS ship pipeline (run on SY094 / macOS).
#
# WHY THIS EXISTS: build 35 shipped a permanent black screen because the ad-hoc
# navship*.sh scripts archived Xcode DIRECTLY without rebuilding/copying the web
# bundle, and the web bundle that happened to be on disk had been built from a
# fresh clone with NO .env.production - so VITE_SUPABASE_URL baked in EMPTY and
# createClient("") threw at module-eval before React mounted (black screen).
#
# This script makes that class of failure impossible:
#   1. requires .env.production with a real VITE_SUPABASE_URL (fail fast),
#   2. ALWAYS rebuilds the web bundle (with env) and copies it into iOS,
#   3. GUARDS: aborts before archiving if the built bundle has no supabase.co URL,
#   4. then bumps build, wires the widgets extension, archives, exports, uploads.
#
# Env required in the shell: KCPW (login keychain password, == the SY094 login
# password). Pass it in; never commit it.
#
# Usage:  KCPW=... bash scripts/navship.sh [branch]
set -euo pipefail

# Non-interactive SSH shells do not load nvm, so node/npm are absent from PATH.
# Source nvm if present. The Capacitor CLI v8 hard-requires NodeJS >=22, so
# ensure a >=22 runtime (install on demand) before building/copying.
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
if command -v nvm >/dev/null 2>&1; then
  nvm install 22 >/dev/null 2>&1 || true
  nvm use 22 >/dev/null 2>&1 || nvm use node >/dev/null 2>&1 || true
fi
command -v node >/dev/null 2>&1 || export PATH="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1):$PATH"
command -v node >/dev/null 2>&1 || { echo "FATAL: node not found on PATH. Aborting."; exit 1; }
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 22 ] || { echo "FATAL: node >=22 required for Capacitor CLI 8, have $(node -v). Aborting."; exit 1; }
echo "node $(node -v) / npm $(npm -v)"

REPO=~/workspaces/nav-frontend
BRANCH="${1:-feat/nav-rebrand-and-widgets}"
cd "$REPO"

echo "=== sync origin/$BRANCH (clean) ==="
git fetch --depth 1 origin "$BRANCH"
git reset --hard FETCH_HEAD

echo "=== preflight: env present? ==="
[ -f .env.production ] || { echo "FATAL: .env.production missing -> empty Supabase config -> black screen. Aborting."; exit 2; }
grep -qE '^VITE_SUPABASE_URL=https://[a-z0-9]+\.supabase\.co' .env.production \
  || { echo "FATAL: VITE_SUPABASE_URL missing/invalid in .env.production. Aborting."; exit 2; }
grep -qE '^VITE_SUPABASE_ANON_KEY=.{40}' .env.production \
  || { echo "FATAL: VITE_SUPABASE_ANON_KEY missing/short in .env.production. Aborting."; exit 2; }

echo "=== install deps ==="
npm install --no-audit --no-fund

echo "=== build web bundle (with env) ==="
npm run build:static

echo "=== GUARD: built web bundle MUST contain a real Supabase URL ==="
grep -rqE 'https://[a-z0-9]+\.supabase\.co' out/assets/ \
  || { echo "FATAL: built bundle has NO supabase.co URL - env did not load. Aborting before ship."; exit 3; }
echo "  out/ bundle OK"

echo "=== copy web into iOS ==="
npx cap copy ios
grep -rqE 'https://[a-z0-9]+\.supabase\.co' ios/App/App/public/assets/ \
  || { echo "FATAL: ios public bundle has NO supabase URL after cap copy. Aborting."; exit 3; }
echo "  ios public bundle OK"

echo "=== set build number (monotonic epoch) ==="
# Use the Unix epoch as CFBundleVersion. Rationale: `git reset --hard` (above)
# discards any working-tree bump, and `git fetch --depth 1` makes commit-count
# schemes useless, so an increment-the-committed-value scheme silently produces
# the SAME build number every run (this shipped build 32 AFTER build 35 -> the
# fixed build looked OLDER than the broken one in TestFlight). The epoch is
# always strictly greater than any prior build, needs no committed state, and
# fits a 32-bit int until 2038.
PROJ=ios/App/App.xcodeproj/project.pbxproj
NEW=$(date +%s)
sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*;/CURRENT_PROJECT_VERSION = $NEW;/g" "$PROJ"
echo "  build = $NEW"

echo "=== wire widgets extension (idempotent) ==="
ruby scripts/wire-widgets-pbxproj.rb >/dev/null

echo "=== app group entitlement (must be present, NOT stripped) ==="
plutil -p ios/App/App/App.entitlements | grep -A1 application-groups \
  || { echo "FATAL: App Group missing from App.entitlements. Aborting."; exit 4; }

SPEC=~/asc-scripts/apps/roam.json
KEYID=$(jq -r .asc_api_key_id "$SPEC")
ISS=$(jq -r .asc_api_issuer_id "$SPEC")
P8=$(eval echo "$(jq -r .asc_api_p8_path "$SPEC")")

security unlock-keychain -p "$KCPW" ~/Library/Keychains/login.keychain-db >/dev/null
security set-keychain-settings -lut 7200 ~/Library/Keychains/login.keychain-db
rm -rf /tmp/nav.xcarchive /tmp/nav-export

echo "=== archive (build $NEW, with app group) ==="
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release \
  -archivePath /tmp/nav.xcarchive -destination "generic/platform=iOS" archive \
  -allowProvisioningUpdates -authenticationKeyPath "$P8" -authenticationKeyID "$KEYID" \
  -authenticationKeyIssuerID "$ISS" DEVELOPMENT_TEAM=86PUY7393S CODE_SIGN_STYLE=Automatic \
  > /tmp/navship_archive.log 2>&1 \
  || { echo "ARCHIVE FAILED"; grep -E 'error:|Provisioning' /tmp/navship_archive.log | tail -15; exit 5; }
echo "  archive ok"

echo "=== export ==="
xcodebuild -exportArchive -archivePath /tmp/nav.xcarchive -exportPath /tmp/nav-export \
  -exportOptionsPlist ios/App/ExportOptions.plist -allowProvisioningUpdates \
  -authenticationKeyPath "$P8" -authenticationKeyID "$KEYID" -authenticationKeyIssuerID "$ISS" \
  > /tmp/navship_export.log 2>&1 \
  || { echo "EXPORT FAILED"; grep -E 'error:' /tmp/navship_export.log | tail -10; exit 6; }
echo "  export ok"

echo "=== upload to App Store Connect ==="
set +e
xcrun altool --upload-app -f /tmp/nav-export/App.ipa -t ios --apiKey "$KEYID" --apiIssuer "$ISS" \
  > /tmp/navship_upload.log 2>&1
UE=$?
set -e
tail -5 /tmp/navship_upload.log
echo "SHIP_DONE build=$NEW upload_exit=$UE"
