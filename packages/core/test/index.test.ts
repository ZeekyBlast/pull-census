import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as core from '@pull-census/core'

test('the package entry exposes the public API through the workspace link', () => {
  for (const name of [
    'parseHoyoPage',
    'parseUigf',
    'loadRules',
    'deriveStreaks',
    'runRelease',
    'statusText',
    'simulate',
  ]) {
    assert.equal(typeof (core as Record<string, unknown>)[name], 'function', name)
  }
  assert.equal(core.METHOD_VERSION, 'methods-v1')
})
