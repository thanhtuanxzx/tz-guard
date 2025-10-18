# GitHub Packages Configuration Guide

## 📦 Cấu hình .npmrc cho GitHub Packages

### 1. File .npmrc cho Development (Publishing)

```ini
# GitHub Packages Registry Configuration
@thanhtuanxzx:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

### 2. File .npmrc cho Users (Installing)

```ini
# For installing packages from GitHub Packages
@thanhtuanxzx:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## 🔑 GitHub Personal Access Token

### Permissions cần thiết:

**Cho Publishing:**
- `write:packages` - Upload packages
- `read:packages` - Download packages
- `repo` - Access repository (nếu package private)

**Cho Installing:**
- `read:packages` - Download packages

### Tạo Token:

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select required permissions
4. Copy token và lưu an toàn

## 🚀 Publishing Workflow

### Manual Publishing:

```bash
# 1. Set environment variable
export NPM_TOKEN=ghp_your_token_here

# 2. Build package
npm run build

# 3. Publish
npm publish
```

### Automated Publishing (GitHub Actions):

```bash
# 1. Create git tag
git tag v0.1.1

# 2. Push tag to trigger workflow
git push origin v0.1.1
```

## 📥 Installing Package

### For End Users:

```bash
# 1. Configure .npmrc
echo "@thanhtuanxzx:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> ~/.npmrc

# 2. Install package
npm install @thanhtuanxzx/tz-guard
npm install luxon  # peer dependency
```

### For CI/CD:

```yaml
# GitHub Actions example
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    registry-url: 'https://npm.pkg.github.com'
    scope: '@thanhtuanxzx'

- name: Install dependencies
  run: npm ci
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 🔧 Troubleshooting

### Common Issues:

1. **401 Unauthorized**: Check token permissions
2. **404 Not Found**: Verify package name and scope
3. **403 Forbidden**: Token doesn't have required permissions

### Debug Commands:

```bash
# Check npm configuration
npm config list

# Test authentication
npm whoami --registry=https://npm.pkg.github.com

# View package info
npm view @thanhtuanxzx/tz-guard --registry=https://npm.pkg.github.com
```

## 📋 Checklist

### Before Publishing:
- [ ] Token has `write:packages` permission
- [ ] `.npmrc` configured correctly
- [ ] Package version updated
- [ ] Tests passing
- [ ] Build successful

### For Users Installing:
- [ ] Token has `read:packages` permission
- [ ] `.npmrc` configured for GitHub Packages
- [ ] Package scope matches (`@thanhtuanxzx`)
