/* eslint-env mocha */
// A block's biome is the registry's biome of its id, from the registry's biomes as they are when the block is made:
// the server's own biome registry (registry_data, from 1.20.5 one packet per registry) replaces them after the blocks
// are loaded, and the chunk data's biome ids are its ids.

const assert = require('assert')
const nbt = require('prismarine-nbt')

for (const version of ['1.8.8', '1.12.2', '1.16.4', '1.18.1', '1.20', '1.20.5', '1.21.11', '26.3']) {
  describe('block biome ' + version, () => {
    const registry = require('prismarine-registry')(version)
    const Block = require('prismarine-block')(registry)
    const stone = registry.blocksByName.stone

    function stoneIn (biomeId) {
      return registry.supportFeature('blockStateId')
        ? Block.fromStateId(stone.defaultState, biomeId)
        : new Block(stone.id, biomeId, 0)
    }

    it('names the biome of its id, with its fields', () => {
      const plains = registry.biomesByName.plains
      const biome = stoneIn(plains.id).biome
      assert.strictEqual(biome.id, plains.id)
      assert.strictEqual(biome.name, 'plains')
      assert.strictEqual(biome.temperature, plains.temperature)
    })

    it('reads the empty biome for an id the registry has none for', () => {
      const biome = stoneIn(9999).biome
      assert.deepStrictEqual(biome, { color: 0, height: null, name: '', rainfall: 0, temperature: 0, id: 9999 })
    })

    if (registry.version['>=']('1.20.5')) {
      it('names the biomes of the server\'s registry, sent after the blocks were loaded', () => {
        registry.loadDimensionCodec({
          id: 'minecraft:worldgen/biome',
          entries: ['desert', 'plains'].map(name => ({
            key: 'minecraft:' + name,
            value: nbt.comp({ temperature: nbt.float(name === 'desert' ? 2 : 0.8), downfall: nbt.float(0) })
          }))
        })
        assert.strictEqual(stoneIn(0).biome.name, 'desert')
        assert.strictEqual(stoneIn(1).biome.name, 'plains')
        assert.strictEqual(stoneIn(1).biome.id, 1)
        assert.strictEqual(stoneIn(2).biome.name, '')
      })
    }
  })
}
