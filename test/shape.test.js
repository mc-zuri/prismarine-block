/* eslint-env mocha */

const testedVersions = require('..').testedVersions
const assert = require('assert')

testedVersions.forEach(version => {
  describe(version, () => {
    const registry = require('prismarine-registry')(version)
    const blockArray = registry.blocksArray
    const Block = require('prismarine-block')(registry)
    blockArray.forEach(block => {
      it('shape ' + block.name, () => {
        const blockV = new Block(block.id, 0, 0, block.defaultState)
        assert.ok(blockV.shapes !== undefined)
        if (blockV.missingStateShape !== undefined) {
          console.log(`state shape of ${block.name} is missing`)
        }
      })
    })
  })
})

// Before 1.13 each data value has its own shape, whether or not minecraft-data lists a variation for it
describe('shapes of the data values before 1.13', () => {
  const cases = [
    // [version, block, data value, shapes, why]
    ['1.8.8', 'trapdoor', 8, [[0, 0.8125, 0, 1, 1, 1]], 'a closed trapdoor on the top half'],
    ['1.8.8', 'trapdoor', 4, [[0, 0, 0.8125, 1, 1, 1]], 'an open trapdoor facing north'],
    ['1.9.4', 'ladder', 4, [[0.8125, 0, 0, 1, 1, 1]], 'a ladder facing west'],
    ['1.11.2', 'snow_layer', 3, [[0, 0, 0, 1, 0.375, 1]], 'four snow layers'],
    ['1.12.2', 'snow_layer', 7, [[0, 0, 0, 1, 0.875, 1]], 'eight snow layers']
  ]
  for (const [version, name, metadata, shapes, why] of cases) {
    it(`${version} ${name} ${metadata}: ${why}`, () => {
      const registry = require('prismarine-registry')(version)
      const Block = require('prismarine-block')(registry)
      const id = registry.blocksByName[name].id
      assert.deepStrictEqual(Block.fromStateId(id << 4 | metadata, 0).shapes, shapes)
      assert.deepStrictEqual(new Block(id, 0, metadata).shapes, shapes)
    })
  }

  it('1.8.8 planks 2 keeps its variation\'s name', () => {
    const registry = require('prismarine-registry')('1.8.8')
    const Block = require('prismarine-block')(registry)
    assert.strictEqual(Block.fromStateId(registry.blocksByName.planks.id << 4 | 2, 0).displayName, 'Birch Wood Planks')
  })
})
