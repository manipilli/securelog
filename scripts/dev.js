import { spawn } from 'node:child_process'

const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('Run this script through npm run dev.')

let stopping = false
const children = [
  spawn(process.execPath, [npmCli, 'run', 'dev', '--workspace', 'backend'], { stdio: 'inherit' }),
  spawn(process.execPath, [npmCli, 'run', 'dev', '--workspace', 'frontend', '--', '--host', '127.0.0.1'], { stdio: 'inherit' }),
]

function stop(code) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}

for (const child of children) child.on('exit', code => stop(code ?? 1))
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))