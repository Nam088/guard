#!/usr/bin/env node
/**
 * @fileoverview Automated Release Script for guard@claude plugin.
 * Handles semantic version bumping across package.json, plugin.json, and marketplace.json,
 * executes QA validation gates, creates git commits and tags, and pushes to remote.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(__dirname, '..')

function run(command, options = {}) {
  console.log(`[EXEC] ${command}`)
  return execSync(command, { cwd: ROOT_DIR, stdio: 'inherit', ...options })
}

function runCapture(command) {
  return execSync(command, { cwd: ROOT_DIR, encoding: 'utf8' }).trim()
}

function bumpVersion(currentVersion, bumpType) {
  const parts = currentVersion.split('.').map((p) => parseInt(p, 10))
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid semver version: ${currentVersion}`)
  }

  let [major, minor, patch] = parts

  switch (bumpType) {
    case 'major':
      major += 1
      minor = 0
      patch = 0
      break
    case 'minor':
      minor += 1
      patch = 0
      break
    case 'patch':
    default:
      patch += 1
      break
  }

  return `${major}.${minor}.${patch}`
}

async function main() {
  const args = process.argv.slice(2)
  const argTarget = args[0] || 'patch'
  const isNoPush = args.includes('--no-push')

  // 1. Read current version from package.json
  const pkgPath = resolve(ROOT_DIR, 'package.json')
  const pluginManifestPath = resolve(ROOT_DIR, '.claude-plugin/plugin.json')
  const marketplaceManifestPath = resolve(ROOT_DIR, '.claude-plugin/marketplace.json')

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const pluginManifest = JSON.parse(readFileSync(pluginManifestPath, 'utf8'))
  const marketplaceManifest = JSON.parse(readFileSync(marketplaceManifestPath, 'utf8'))

  const currentVersion = pkg.version || '1.0.0'
  let newVersion = ''

  if (['patch', 'minor', 'major'].includes(argTarget)) {
    newVersion = bumpVersion(currentVersion, argTarget)
  } else if (/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(argTarget)) {
    newVersion = argTarget
  } else {
    console.error(`Invalid version or bump type: "${argTarget}". Use "patch", "minor", "major", or explicit x.y.z.`)
    process.exit(1)
  }

  console.log(`\n=== Guard@Claude Plugin Release Automation ===`)
  console.log(`Current version : ${currentVersion}`)
  console.log(`Target version  : ${newVersion}`)
  console.log(`==============================================\n`)

  // 2. Synchronize version in all 3 manifest files
  pkg.version = newVersion
  pluginManifest.version = newVersion

  if (Array.isArray(marketplaceManifest.plugins)) {
    for (const p of marketplaceManifest.plugins) {
      if (p.name === 'guard') {
        p.version = newVersion
      }
    }
  }

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  writeFileSync(pluginManifestPath, JSON.stringify(pluginManifest, null, 2) + '\n', 'utf8')
  writeFileSync(marketplaceManifestPath, JSON.stringify(marketplaceManifest, null, 2) + '\n', 'utf8')
  console.log(`[OK] Updated package.json, plugin.json, and marketplace.json to ${newVersion}`)

  // 3. Execute Quality and Validation Gates
  try {
    console.log(`\n[STEP 1/4] Running Quality Check Suite (typecheck, validate, test, build)...`)
    run('npm run check')
  } catch (err) {
    console.error(`\n[ERROR] Quality check failed. Aborting release.`)
    process.exit(1)
  }

  // 4. Package distribution tarball
  console.log(`\n[STEP 2/4] Packaging distribution tarball...`)
  run('rm -f *.tgz && npm run release:pack')

  // 5. Git Commit & Tags
  console.log(`\n[STEP 3/4] Staging changes and creating release tags...`)
  run(`git add package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json`)
  run(`git commit -m "chore(release): bump version to ${newVersion}"`)
  run(`git tag -a v${newVersion} -m "Release v${newVersion}: guard@claude plugin for Claude Code"`)
  run(`claude plugin tag ${ROOT_DIR}`)

  // 6. Push to remote
  if (!isNoPush) {
    console.log(`\n[STEP 4/4] Pushing commits and tags to GitHub...`)
    run(`git push origin main --tags`)
    console.log(`\n[SUCCESS] Released guard@claude v${newVersion} to GitHub!`)
    console.log(`GitHub Actions will automatically build, package, and publish the release.`)
    console.log(`View releases at: https://github.com/Nam088/guard/releases`)
  } else {
    console.log(`\n[INFO] --no-push flag supplied. Local commit and tags created successfully.`)
  }
}

main().catch((err) => {
  console.error(`\n[FATAL ERROR]:`, err)
  process.exit(1)
})
