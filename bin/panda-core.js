#!/usr/bin/env node

const packageJson = require('../package.json')
const { Command } = require('../src/wasp')
const program = new Command()

program
  .description('Panda Development Framework Core CLI')
  .version(packageJson.version, '-v, --version')
  /* +++ core commands +++ */ // do not remove
  /* +++ internal commands +++ */ // do not remove
  /* +++ shortcut commands +++ */ // do not remove
  .parse(process.argv)
