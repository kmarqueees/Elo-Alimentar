import 'dotenv/config'
import { spawnSync } from 'node:child_process'

const url = process.env.TEST_DATABASE_URL

if (!url) {
  console.error('Defina TEST_DATABASE_URL no .env (veja .env.example).')
  process.exit(1)
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, DATABASE_URL: url },
})

process.exit(result.status ?? 1)
