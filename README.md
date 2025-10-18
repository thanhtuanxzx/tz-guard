# tz-guard

A tiny, sharp TypeScript toolkit to avoid timezone mistakes.

## Goals

- Treat UTC as the source of truth for storage & comparison
- Convert to/from IANA zones safely, detecting DST gaps & overlaps
- Provide helpers for: parsing local wall-times, choosing an offset in ambiguous moments, normalizing time ranges, recurring scheduling, and business-hours checks

## Tech

- Runtime: Node.js 18+ or modern browsers
- Libs: luxon@^3 (IANA timezones) — small, robust, tree-shakeable

## Install

### From GitHub Packages

```bash
# Install the package
npm install @thanhtuanxzx/tz-guard

# Install peer dependency
npm install luxon
```

### Configure .npmrc for GitHub Packages

Create a `.npmrc` file in your project root:

```ini
@thanhtuanxzx:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Or add to your global `.npmrc`:

```bash
echo "@thanhtuanxzx:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> ~/.npmrc
```

**Note**: You need a GitHub Personal Access Token with `read:packages` permission to install packages from GitHub Packages.

## Quick Start

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

## API Reference

### Zone Validation
- `assertZone(zone: string)`: Kiểm tra zone hợp lệ (IANA), ném lỗi nếu sai

### Parsing & Conversion
- `parseLocal(localISO: string, zone: string): DateTime` - Parse local wall-time theo zone
- `toUTCFromLocal(localISO: string, zone: string, opts?: { onAmbiguous?: 'earlier'|'later' }): Date` - Chuyển local → UTC
- `convertZone(instant: Date|string|number, zone: string): DateTime` - Chuyển UTC instant sang DateTime theo zone

### DST Detection
- `isInvalidLocalTime(localISO: string, zone: string): boolean` - Phát hiện giờ không tồn tại do DST
- `isAmbiguousLocalTime(localISO: string, zone: string): boolean` - Phát hiện giờ bị trùng
- `chooseOffset(localISO: string, zone: string, pref?: 'earlier'|'later'): DateTime` - Chốt mapping khi mơ hồ

### Range & Scheduling
- `rangeToUTC(startLocalISO: string, endLocalISO: string, zone: string, opts?: { ambiguous?: 'earlier'|'later' }): { startUTC: string; endUTC: string; interval: Interval }` - Chuẩn hoá khoảng thời gian
- `nextOccurrence(fromUTC: Date|string|number, zone: string, rule: Recurrence): Date` - Tính lần xảy ra kế tiếp

### Business Logic
- `isWithinBusinessHours(instantUTC: Date|string|number, zone: string, bh: BusinessHours): boolean` - Kiểm tra giờ làm việc
- `formatZoned(instantUTC: Date|string|number, zone: string, fmt?: string): string` - Định dạng hiển thị theo zone

## DST Edge Cases

- **Non-existent times (spring forward)**: some local clock times never occur
- **Ambiguous times (fall back)**: a local time happens twice; you must choose earlier/later offset
- Always validate user-entered local times before converting & persisting

## Publishing

### Prerequisites

1. **GitHub Personal Access Token** with `write:packages` permission
2. **Configure .npmrc** (see `.npmrc.example` file)

### Publish to GitHub Packages

```bash
# Set your GitHub token
export NPM_TOKEN=your_github_token_here

# Or use GitHub token directly
export GITHUB_TOKEN=your_github_token_here

# Build and publish
npm run build
npm publish
```

### Automated Publishing

The package includes GitHub Actions workflow (`.github/workflows/publish.yml`) that automatically publishes when you create a git tag:

```bash
# Create and push a tag to trigger publishing
git tag v0.1.1
git push origin v0.1.1
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
