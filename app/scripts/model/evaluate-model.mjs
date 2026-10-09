// Scores the note reader and the built-in keyword method on a file of labelled notes.
//
//   npm run evaluate:model -- tests/corpus/real.json
//
// Use notes the head was NOT trained on (your own corrected notes are ideal): every set in
// tests/corpus/ is already in the training, so scoring one of those flatters the reader.
// See tests/model.eval.test.js for the file format.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const target = process.argv[2]
if (!target) {
  console.log('Give a file of labelled notes:  npm run evaluate:model -- tests/corpus/real.json')
  console.log('(a note is [text, feeling, topic]; "Copy them" on the You screen makes this format)')
  process.exit(1)
}
const file = resolve(process.cwd(), target)
if (!existsSync(file)) {
  console.error(`No such file: ${file}`)
  process.exit(1)
}

const vitest = join(root, 'node_modules', 'vitest', 'vitest.mjs')
const result = spawnSync(process.execPath, [vitest, 'run', 'tests/model.eval.test.js'], {
  cwd: root,
  env: { ...process.env, EVAL_FILE: file },
  stdio: ['ignore', 'ignore', 'inherit'],
})
const report = join(root, '.cache', 'last-model-eval.txt')
if (result.status !== 0 || !existsSync(report)) {
  console.error('The evaluation did not finish. Is the model downloaded? Try: npm run model')
  process.exit(result.status || 1)
}
console.log(readFileSync(report, 'utf8'))
