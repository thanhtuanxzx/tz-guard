# 🕒 tz-guard

> A tiny, sharp TypeScript toolkit to avoid timezone mistakes — built on [Luxon](https://moment.github.io/luxon/).

---

## 🚀 Features

✅ Safe timezone handling with [IANA zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
✅ Detects DST gaps & overlaps (e.g., spring-forward, fall-back)
✅ Provides helpers for:

* Local & UTC conversions
* DST ambiguity resolution
* Normalizing time ranges
* Recurrence scheduling
* Business hour checks

---

## ⚙️ Installation

### From **npmjs.org**

```bash
npm install tz-guard
```


### From **GitHub Packages** (optional)

If you want to install directly from GitHub Packages:

```bash
# ~/.npmrc
@thanhtuanxzx:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}

# then
npm install @thanhtuanxzx/tz-guard
```

---

## 🧠 Quick Start

```ts
import {
  toUTCFromLocal,
  convertZone,
  formatZoned,
} from "tz-guard";

// Parse giờ tường của người dùng ở HCM và lưu UTC vào DB
const utc = toUTCFromLocal("2025-10-18T09:00:00", "Asia/Ho_Chi_Minh");

// Render cho user ở New York (server hoặc client)
const view = formatZoned(utc, "America/New_York", "yyyy-LL-dd HH:mm ZZZZ");
```

---

## 📘 API Overview

### 🏷 Zone Validation

```ts
assertZone(zone: string): void
```

Throws error if invalid IANA timezone.

---

### 📅 Parsing & Conversion

```ts
parseLocal(localISO: string, zone: string): DateTime
toUTCFromLocal(localISO: string, zone: string, opts?): Date
convertZone(instant: Date|string|number, zone: string): DateTime
```

---

### 🌐 DST Detection

```ts
isInvalidLocalTime(localISO: string, zone: string): boolean
isAmbiguousLocalTime(localISO: string, zone: string): boolean
chooseOffset(localISO: string, zone: string, pref?: 'earlier'|'later'): DateTime
```

---

### ⏱ Range & Scheduling

```ts
rangeToUTC(startLocal: string, endLocal: string, zone: string)
nextOccurrence(fromUTC: Date|string|number, zone: string, rule: Recurrence)
```

---

### 💼 Business Logic

```ts
isWithinBusinessHours(instantUTC: Date|string|number, zone: string, bh: BusinessHours): boolean
formatZoned(instantUTC: Date|string|number, zone: string, fmt?: string): string
```

---

## ⚡ DST Edge Cases

| Case           | Description                               |
| -------------- | ----------------------------------------- |
| Spring forward | Some local times never occur              |
| Fall back      | A local time happens twice                |
| Tip            | Always validate local times before saving |

---

## 🧩 Development

```bash
npm install
npm run build
npm test
```

Run tests (Jest + ts-jest ESM):

```bash
npm run test
```

---

## 🚢 Publishing

### Manual (CLI)

```bash
export NODE_AUTH_TOKEN=your_npm_token
npm run build
npm publish --access public
```

### Automated (GitHub Actions)

Publishing triggers automatically when you push a tag:

```bash
npm version patch
git push && git push --tags
```

The workflow file `.github/workflows/publish.yml` will:

* Publish to **npmjs.org**
* Publish to **GitHub Packages** (for visibility under your profile)

---

## 📄 License

MIT © [Thanh Tuan](https://github.com/thanhtuanxzx)
