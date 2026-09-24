// Lets `node` run the app's own TypeScript (lib/**/*.ts) directly from a
// script, with no extra dependency: Node 24 strips TypeScript types
// natively, and this resolve hook fills in the two things it can't do on
// its own -- the tsconfig "@/..." path alias, and extensionless relative
// imports ("./foo" -> "./foo.ts"). Usage: node --import ./scripts/lib/register-ts-paths.mjs <script>.ts
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function withTsExtension(absPath) {
  for (const candidate of [absPath, `${absPath}.ts`, `${absPath}.tsx`, path.join(absPath, 'index.ts')]) {
    if (existsSync(candidate) && !candidate.endsWith(path.sep)) return candidate
  }
  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = null
    if (specifier.startsWith('@/')) {
      target = withTsExtension(path.join(ROOT, specifier.slice(2)))
    } else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL))
      const abs = path.resolve(parentDir, specifier)
      if (!path.extname(abs)) target = withTsExtension(abs)
    }
    return target ? nextResolve(pathToFileURL(target).href, context) : nextResolve(specifier, context)
  },
})
