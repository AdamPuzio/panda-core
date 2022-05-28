
const utility = require('../src/utility')

const methodMapSource = { a: 'valA', b: 'valB', c: 'valC' }
const methodMapKeysArray = ['a', 'b', 'c']
const methodMapKeysObj = { a: 'a', b: '_b', c: 'see' }

test('methodMap using array', () => {
  const data = utility.pick(methodMapSource, methodMapKeysArray)
  expect(data).toEqual({ a: 'valA', b: 'valB', c: 'valC' })
})

test('methodMap using object', () => {
  const data = utility.pick(methodMapSource, methodMapKeysObj)
  expect(data).toEqual({ a: 'valA', _b: 'valB', see: 'valC' })
})

const pickObj = { a: 'valA', b: 'valB', c: 'valC' }
const pickKeysArray = ['a', 'c', 'd']
const pickKeysObj = { a: 'a', b: 'b2', d: 'd' }

test('pick using array', () => {
  const data = utility.pick(pickObj, pickKeysArray)
  expect(data).toEqual({ a: 'valA', c: 'valC' })
})

test('pick (no prune) using array', () => {
  const data = utility.pick(pickObj, pickKeysArray, false)
  expect(data).toEqual({ a: 'valA', c: 'valC' })
})

test('pick object', () => {
  const data = utility.pick(pickObj, pickKeysObj)
  expect(data).toEqual({ a: 'valA', b2: 'valB' })
})

test('pick (no prune) using object', () => {
  const data = utility.pick(pickObj, pickKeysObj, false)
  expect(data).toEqual({ a: 'valA', b2: 'valB', d2: undefined })
})
