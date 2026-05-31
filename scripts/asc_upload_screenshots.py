#!/usr/bin/env python3
"""
Upload App Store screenshots to the Glovebox 1.0 App Store Version (en-AU).
Runs ON SY094 (ASC .p8 key + PyJWT live there).

Flow per display type (iPhone 6.9, iPad 13):
  1. find/create the appScreenshotSet for the localization + screenshotDisplayType
  2. (optional) delete existing screenshots in that set for a clean replace
  3. for each png: POST appScreenshots (reserves an upload operation),
     PUT the bytes to the returned URL, PATCH commit with the md5 checksum.

Screenshots dir layout on SY094:
  /tmp/gb-appstore/iphone/*.png   -> APP_IPHONE_6_9
  /tmp/gb-appstore/ipad/*.png     -> APP_IPAD_PRO_3GEN_13  (13-inch iPad)

Usage: python3 asc_upload_screenshots.py [--replace]
"""

import hashlib
import json
import os
import sys
import time
import urllib.request
import urllib.error

import jwt as pyjwt

REPLACE = "--replace" in sys.argv
SPEC = json.load(open(os.path.expanduser("~/asc-scripts/apps/roam.json")))
KEY_ID = SPEC["asc_api_key_id"]
ISS = SPEC["asc_api_issuer_id"]
APP = SPEC["asc_app_id"]
MARKETING = "1.0"  # the live ASV is 1.0 (roam.json spec says 1.1.1 but no such ASV)
P8 = SPEC["asc_api_p8_path"].replace("~", os.path.expanduser("~"))
KEY = open(P8).read()
BASE = "https://api.appstoreconnect.apple.com"

SETS = [
    # 1290x2796 lands in Apple's 6.7" display type (covers 6.7"/6.9").
    ("/tmp/gb-appstore/iphone", "APP_IPHONE_67"),
    # 2064x2752 lands in the 12.9" iPad Pro 3rd-gen display type.
    ("/tmp/gb-appstore/ipad", "APP_IPAD_PRO_3GEN_129"),
]


def tok():
    return pyjwt.encode(
        {"iss": ISS, "exp": int(time.time()) + 1100, "aud": "appstoreconnect-v1"},
        KEY,
        algorithm="ES256",
        headers={"kid": KEY_ID, "typ": "JWT"},
    )


def req(method, path_or_url, body=None, raw=None, headers=None, no_auth=False):
    url = path_or_url if path_or_url.startswith("http") else BASE + path_or_url
    # The screenshot byte-upload goes to a pre-signed Apple storage URL that
    # rejects the ASC bearer token - send ONLY the headers Apple specifies.
    h = {} if no_auth else {"Authorization": "Bearer " + tok()}
    if headers:
        h.update(headers)
    data = None
    if raw is not None:
        data = raw
    elif body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r) as x:
            b = x.read()
            return x.status, (json.loads(b) if b and b[:1] in (b"{", b"[") else {})
    except urllib.error.HTTPError as e:
        b = e.read()
        try:
            return e.code, json.loads(b)
        except Exception:
            return e.code, {"raw": b.decode(errors="replace")[:500]}


def errs(d):
    return (
        "; ".join(
            f"{e.get('title', '?')}: {e.get('detail', '')}"[:160]
            for e in d.get("errors", [])
        )
        or json.dumps(d)[:300]
    )


def get_localization():
    # Find the en-AU appStoreVersionLocalization for the marketing ASV.
    s, d = req("GET", f"/v1/apps/{APP}/appStoreVersions?limit=20")
    asv = None
    for v in d.get("data", []):
        if v["attributes"]["versionString"] == MARKETING:
            asv = v["id"]
            break
    if not asv:
        print("RESULT: FAIL no-asv", MARKETING)
        sys.exit(1)
    s, d = req(
        "GET", f"/v1/appStoreVersions/{asv}/appStoreVersionLocalizations?limit=20"
    )
    loc = None
    for l in d.get("data", []):
        if l["attributes"]["locale"] in ("en-AU", "en-US"):
            loc = l["id"]
            if l["attributes"]["locale"] == "en-AU":
                break
    if not loc:
        print("RESULT: FAIL no-localization")
        sys.exit(1)
    print(f"RESULT: ASV {asv} LOC {loc}")
    return loc


def get_or_create_set(loc, display_type):
    s, d = req(
        "GET", f"/v1/appStoreVersionLocalizations/{loc}/appScreenshotSets?limit=50"
    )
    for st in d.get("data", []):
        if st["attributes"]["screenshotDisplayType"] == display_type:
            return st["id"]
    # create
    s, d = req(
        "POST",
        "/v1/appScreenshotSets",
        {
            "data": {
                "type": "appScreenshotSets",
                "attributes": {"screenshotDisplayType": display_type},
                "relationships": {
                    "appStoreVersionLocalization": {
                        "data": {"type": "appStoreVersionLocalizations", "id": loc}
                    }
                },
            }
        },
    )
    if s not in (200, 201):
        print(f"RESULT: FAIL create-set {display_type}", errs(d))
        return None
    return d["data"]["id"]


def clear_set(set_id):
    s, d = req("GET", f"/v1/appScreenshotSets/{set_id}/appScreenshots?limit=50")
    for sc in d.get("data", []):
        req("DELETE", f"/v1/appScreenshots/{sc['id']}")
    print(f"  cleared {len(d.get('data', []))} existing")


def upload_one(set_id, png_path):
    name = os.path.basename(png_path)
    data = open(png_path, "rb").read()
    size = len(data)
    # 1. reserve
    s, d = req(
        "POST",
        "/v1/appScreenshots",
        {
            "data": {
                "type": "appScreenshots",
                "attributes": {"fileName": name, "fileSize": size},
                "relationships": {
                    "appScreenshotSet": {
                        "data": {"type": "appScreenshotSets", "id": set_id}
                    }
                },
            }
        },
    )
    if s not in (200, 201):
        print(f"  FAIL reserve {name}:", errs(d))
        return False
    sc_id = d["data"]["id"]
    ops = d["data"]["attributes"]["uploadOperations"]
    # 2. PUT bytes per operation (usually a single op)
    for op in ops:
        url = op["url"]
        off = op["offset"]
        length = op["length"]
        chunk = data[off : off + length]
        hdrs = {h["name"]: h["value"] for h in op.get("requestHeaders", [])}
        s2, _ = req(op["method"], url, raw=chunk, headers=hdrs, no_auth=True)
        if s2 not in (200, 201, 204):
            print(f"  FAIL put {name} op:", s2)
            return False
    # 3. commit with md5
    md5 = hashlib.md5(data).hexdigest()
    s3, d3 = req(
        "PATCH",
        f"/v1/appScreenshots/{sc_id}",
        {
            "data": {
                "type": "appScreenshots",
                "id": sc_id,
                "attributes": {"uploaded": True, "sourceFileChecksum": md5},
            }
        },
    )
    if s3 not in (200, 201):
        print(f"  FAIL commit {name}:", errs(d3))
        return False
    print(f"  OK {name} ({size} bytes)")
    return True


def main():
    loc = get_localization()
    total_ok = 0
    for folder, display in SETS:
        if not os.path.isdir(folder):
            print(f"RESULT: SKIP {display} (no folder {folder})")
            continue
        set_id = get_or_create_set(loc, display)
        if not set_id:
            continue
        print(f"RESULT: SET {display} -> {set_id}")
        if REPLACE:
            clear_set(set_id)
        for f in sorted(os.listdir(folder)):
            if f.endswith(".png"):
                if upload_one(set_id, os.path.join(folder, f)):
                    total_ok += 1
                time.sleep(0.5)
    print(f"RESULT: DONE uploaded={total_ok}")


if __name__ == "__main__":
    main()
