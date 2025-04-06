import { defineConfig } from 'bumpp'

export default defineConfig({
  tag: true,
  push: true,
  commit: true,
  
  confirm: false,
  
  files: [
    'package.json',
    'CHANGELOG.md',
    'README.md',
  ],
})