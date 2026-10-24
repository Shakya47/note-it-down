// Runs the content-script watcher and the extension dev server together and
// stops both when either exits or on Ctrl+C (the old `a & b` script leaked the
// background watcher).
import { spawn } from 'node:child_process'

const commands = [
  ['vite', ['build', '--config', 'vite.content.config.ts', '--watch']],
  ['vite', []],
]

const children = commands.map(([cmd, args]) =>
  spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
)

let exiting = false
function shutdown(code) {
  if (exiting) return
  exiting = true
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
  process.exit(code)
}

for (const child of children) child.on('exit', (code) => shutdown(code ?? 0))
process.on('SIGINT', () => shutdown(130))
process.on('SIGTERM', () => shutdown(143))
