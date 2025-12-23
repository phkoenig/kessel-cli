#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'

const file = 'dist/cli.mjs'
const content = readFileSync(file, 'utf8')

if (!content.startsWith('#!/usr/bin/env node')) {
  writeFileSync(file, '#!/usr/bin/env node\n' + content)
  console.log('✓ Shebang hinzugefügt')
} else {
  console.log('✓ Shebang bereits vorhanden')
}


