/* eslint-env mocha */

const expect = require('expect').default

// https://minecraft.gamepedia.com/Breaking#Blocks_by_hardness
describe('Dig time', () => {
  describe('1.20.5', () => {
    const registry = require('prismarine-registry')('1.20.5')
    const Block = require('prismarine-block')(registry)
    it('dig dirt (shovel faster than hand)', () => {
      const dirt = Block.fromStateId(registry.blocksByName.dirt.defaultState, 0)
      const shovel = registry.itemsByName.iron_shovel
      const handTime = dirt.digTime(null, false, false, false)
      const shovelTime = dirt.digTime(shovel.id, false, false, false)
      expect(shovelTime < handTime).toBeTruthy()
    })

    it('mine stone (pickaxe faster than hand)', () => {
      const stone = Block.fromStateId(registry.blocksByName.stone.defaultState, 0)
      const pickaxe = registry.itemsByName.iron_pickaxe
      const handTime = stone.digTime(null, false, false, false)
      const pickaxeTime = stone.digTime(pickaxe.id, false, false, false)
      expect(pickaxeTime < handTime).toBeTruthy()
    })
  })

  describe('1.20.4', () => {
    const registry = require('prismarine-registry')('1.20.4')
    const Block = require('prismarine-block')(registry)
    it('dig dirt (shovel faster than hand)', () => {
      const dirt = Block.fromStateId(registry.blocksByName.dirt.defaultState, 0)
      const shovel = registry.itemsByName.iron_shovel
      const handTime = dirt.digTime(null, false, false, false)
      const shovelTime = dirt.digTime(shovel.id, false, false, false)
      expect(shovelTime < handTime).toBeTruthy()
    })

    it('mine stone (pickaxe faster than hand)', () => {
      const stone = Block.fromStateId(registry.blocksByName.stone.defaultState, 0)
      const pickaxe = registry.itemsByName.iron_pickaxe
      const handTime = stone.digTime(null, false, false, false)
      const pickaxeTime = stone.digTime(pickaxe.id, false, false, false)
      expect(pickaxeTime < handTime).toBeTruthy()
    })
  })

  describe('1.15.2', () => {
    const registry = require('prismarine-registry')('1.15.2')
    const Block = require('prismarine-block')(registry)
    it('dirt by hand', () => {
      const block = Block.fromStateId(registry.blocksByName.dirt.defaultState, 0)
      const time = block.digTime(null, false, false, false)
      expect(time).toBe(750)
    })
  })

  describe('bedrock 1.17.10', () => {
    const registry = require('prismarine-registry')('bedrock_1.17.10')
    const Block = require('prismarine-block')(registry)

    it('dirt by hand', () => {
      const block = Block.fromStateId(registry.blocksByName.dirt.defaultState, 0)
      const time = block.digTime(null, false, false, false)
      require('assert').ok(time)
    })
  })

  for (const version of ['1.17', 'bedrock_1.17.10', 'bedrock_1.18.0', '1.20']) {
    describe(version, () => {
      const registry = require('prismarine-registry')(version)
      const Block = require('prismarine-block')(registry)
      it('instant break stone', () => {
        const block = Block.fromStateId(registry.blocksByName.stone.defaultState, 0)
        const time = block.digTime(
          registry.itemsByName.diamond_pickaxe.id,
          false,
          false,
          false,
          [{ name: registry.enchantmentsByName.efficiency.name, lvl: 5 }],
          {
            [registry.effectsByName.Haste.id]: {
              amplifier: 1,
              duration: 60
            }
          }
        )
        expect(time).toBe(0)
      })

      it('instant break bedrock (creative)', () => {
        const block = Block.fromStateId(registry.blocksByName.bedrock.defaultState, 0)
        const time = block.digTime(null, true, false, false, [], {})
        expect(time).toBe(0)
      })
      describe('digging', () => {
        for (const blockName of ['sand', 'dirt', 'soul_sand']) {
          describe(`digging ${blockName}`, () => {
            it('using iron_shovel', () => {
              const tool = registry.itemsByName.iron_shovel
              const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
              const time = block.digTime(tool.id, false, false, false, [], {})
              expect(time).toBe(150)
            })
            it('using iron_shovel with efficiency 2', () => {
              const tool = registry.itemsByName.iron_shovel
              const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
              const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 2 }], {})
              expect(time).toBe(100)
            })
            it('using iron_shovel with efficiency 5 (instant break)', () => {
              const tool = registry.itemsByName.iron_shovel
              const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
              const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 5 }], {})
              expect(time).toBe(0)
            })
            it('using iron_shovel with haste 2', () => {
              const tool = registry.itemsByName.iron_shovel
              const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
              const time = block.digTime(tool.id, false, false, false, [], { [registry.effectsByName.Haste.id]: { amplifier: 1, lvl: 1 } })
              expect(time).toBe(100)
            })
            it('using iron_shovel with eff 2 + haste 2 (instant break)', () => {
              const tool = registry.itemsByName.iron_shovel
              const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
              const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 2 }], { [registry.effectsByName.Haste.id]: { amplifier: 1, lvl: 1 } })
              expect(time).toBe(0)
            })
          })
        }
      })

      describe('mining', () => {
        describe('mining stone', () => {
          const blockName = 'stone'
          const toolName = 'iron_pickaxe'
          it('using iron_shovel', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [], {})
            expect(time).toBe(400)
          })
          it('using iron_shovel with efficiency 2', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 2 }], {})
            expect(time).toBe(250)
          })
          it('using iron_shovel with efficiency 5 (instant break)', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 5 }], {})
            expect(time).toBe(100)
          })
          it('using iron_shovel with haste 2', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [], { [registry.effectsByName.Haste.id]: { amplifier: 1, lvl: 1 } })
            expect(time).toBe(300)
          })
          it('using iron_shovel with eff 2 + haste 2 (instant break)', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 2 }], { [registry.effectsByName.Haste.id]: { amplifier: 1, lvl: 1 } })
            expect(time).toBe(150)
          })
        })
        describe('mining iron_ore', () => {
          const blockName = 'iron_ore'
          const toolName = 'iron_pickaxe'
          it('using iron_shovel', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            console.log('Block', block)
            const time = block.digTime(tool.id, false, false, false, [], {})
            expect(time).toBe(750)
          })
          it('using iron_shovel with efficiency 2', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 2 }], {})
            expect(time).toBe(450)
          })
          it('using iron_shovel with efficiency 5 (instant break)', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 5 }], {})
            expect(time).toBe(150)
          })
          it('using iron_shovel with haste 2', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [], { [registry.effectsByName.Haste.id]: { amplifier: 1, lvl: 1 } })
            expect(time).toBe(550)
          })
          it('using iron_shovel with eff 2 + haste 2 (instant break)', () => {
            const tool = registry.itemsByName[toolName]
            const block = Block.fromStateId(registry.blocksByName[blockName].defaultState)
            const time = block.digTime(tool.id, false, false, false, [{ name: 'efficiency', lvl: 2 }], { [registry.effectsByName.Haste.id]: { amplifier: 1, lvl: 1 } })
            expect(time).toBe(300)
          })
        })
      })
    })
  }
})

describe('fromString', () => {
  const versions = {
    1.18: 'minecraft:candle[lit=true]',
    'pe_1.18.0': 'minecraft:candle["lit":true]',
    1.19: 'minecraft:candle["lit":true]',
    '1.20': 'minecraft:candle[lit=true]'
  }
  for (const [version, str] of Object.entries(versions)) {
    it(version, () => {
      const Block = require('prismarine-block')(version)
      const block = Block.fromString(str, 0)
      // console.log(block)
      expect(block.getProperties().lit).toBeTruthy()
    })
  }
})

describe('Block hash computation', () => {
  for (const version of ['bedrock_1.20.0']) {
    const Block = require('prismarine-block')(version)
    it('minecraft:soul_soil', function () {
      const block = Block.fromString('minecraft:soul_soil', 0)
      expect(block.hash).toBe(601701031)
    })
    it('minecraft:planks', function () {
      const block = Block.fromString('minecraft:planks', 0)
      expect(block.hash).toBe(1835335165)
    })
    it('minecraft:stone', function () {
      const block = Block.fromString('minecraft:stone', 0)
      expect(block.hash).toBe(-1177000405)
    })
  }
})

describe('hashed-runtime metadata (Bedrock 1.19.80+)', () => {
  // A hashed-runtime registry keys states by 32-bit hashes and leaves minStateId undefined, so stateId - minStateId is
  // NaN. The metadata must instead be the state's index within the block's own states list.
  const registry = require('prismarine-registry')('bedrock_1.17.10')
  const Block = require('prismarine-block')(registry)
  const hashes = [111111, 222222, 333333]
  const stateShapes = [[[0, 0, 0, 1, 0.5, 1]], [[0, 0.5, 0, 1, 1, 1]], [[0, 0, 0, 0.5, 1, 1]]]
  const enumBlock = { id: 9999, name: 'hashed_stairs', hardness: 1, minStateId: undefined, maxStateId: undefined, states: hashes, defaultState: hashes[0], shapes: stateShapes[0], stateShapes, boundingBox: 'block' }
  for (const h of hashes) registry.blocksByStateId[h] = enumBlock

  it('resolves metadata by state index and picks the matching per-state shape', () => {
    for (let i = 0; i < hashes.length; i++) {
      const block = Block.fromStateId(hashes[i], 0)
      expect(block.name).toBe('hashed_stairs')
      expect(Number.isNaN(block.metadata)).toBe(false)
      expect(block.metadata).toBe(i)
      expect(block.missingStateShape).toBeUndefined()
      expect(block.shapes).toEqual(stateShapes[i])
    }
  })

  it('resolves getProperties() for hashed stateIds via blockStatesByStateId', () => {
    // The registry provides a stateId-keyed map for hashed versions (indexing the blockStates array by a hash misses).
    const props = [{ weirdo_direction: { value: 0 } }, { weirdo_direction: { value: 1 } }, { weirdo_direction: { value: 2 } }]
    registry.blockStatesByStateId = {}
    for (let i = 0; i < hashes.length; i++) registry.blockStatesByStateId[hashes[i]] = { name: 'hashed_stairs', states: props[i] }
    for (let i = 0; i < hashes.length; i++) {
      const block = Block.fromStateId(hashes[i], 0)
      expect(block.getProperties()).toEqual({ weirdo_direction: i })
    }
  })

  it('resolves fromProperties() for hashed stateIds via the block states list', () => {
    const props = [{ weirdo_direction: { value: 0 } }, { weirdo_direction: { value: 1 } }, { weirdo_direction: { value: 2 } }]
    registry.blockStatesByStateId = {}
    for (let i = 0; i < hashes.length; i++) registry.blockStatesByStateId[hashes[i]] = { name: 'hashed_stairs', states: props[i] }
    registry.blocksByName = { ...registry.blocksByName, hashed_stairs: enumBlock }
    for (let i = 0; i < hashes.length; i++) {
      const block = Block.fromProperties('hashed_stairs', { weirdo_direction: i }, 0)
      expect(block.stateId).toBe(hashes[i])
    }
  })

  it('resolves the stateId from metadata for hashed blocks', () => {
    registry.blocks = { ...registry.blocks, [enumBlock.id]: enumBlock }
    for (let i = 0; i < hashes.length; i++) {
      const block = new Block(enumBlock.id, 0, i)
      expect(block.stateId).toBe(hashes[i])
      expect(block.name).toBe('hashed_stairs')
    }
    expect(new Block(enumBlock.id, 0, hashes.length).stateId).toBe(hashes[hashes.length - 1])
  })
})

// The vanilla jar's break progress (E:\gen packages/minecraft-data-oracle: Player.getDestroySpeed /
// getDestroyProgress of a real ServerPlayer) added up tick by tick as the client does
describe('Dig time as the vanilla client takes it', () => {
  function block (version, name) {
    const registry = require('prismarine-registry')(version)
    const Block = require('prismarine-block')(registry)
    return { registry, block: Block.fromStateId(registry.blocksByName[name].defaultState, 0) }
  }

  for (const version of ['1.16.5', '1.21.11', '26.3']) {
    it(`stone by hand: 151 ticks, the float progress 1/150 short of 1 after 150 (${version})`, () => {
      const { block: stone } = block(version, 'stone')
      expect(stone.digTime(null, false, false, false)).toBe(151 * 50)
    })
  }

  it('blue ice with an iron pickaxe: 15 ticks (1.21.11)', () => {
    const { registry, block: ice } = block('1.21.11', 'blue_ice')
    expect(ice.digTime(registry.itemsByName.iron_pickaxe.id, false, false, false)).toBe(15 * 50)
  })

  it('mining fatigue III is 0.3^3 from 26.3 (stone by hand: 5556 ticks), 0.0027 before (1.21.11: 55554)', () => {
    for (const [version, ticks] of [['26.3', 5556], ['1.21.11', 55554]]) {
      const { registry, block: stone } = block(version, 'stone')
      const effects = { [registry.effectsByName.MiningFatigue.id]: { amplifier: 2 } }
      expect(stone.digTime(null, false, false, false, [], effects)).toBe(ticks * 50)
    }
  })

  it('a sword breaks bamboo at once (BambooStalkBlock before 1.21.5, the sword_instantly_mines rule after)', () => {
    for (const version of ['1.16.5', '1.20.4', '1.21.4', '1.21.11']) {
      const { registry, block: bamboo } = block(version, 'bamboo')
      expect(bamboo.digTime(registry.itemsByName.iron_sword.id, false, false, false)).toBe(0)
    }
  })

  it('a float sum that grows slower than 1 / progress (reinforced deepslate under fatigue IV: 2081324, not 2037037)', () => {
    const { registry, block: rd } = block('1.19.4', 'reinforced_deepslate')
    const effects = { [registry.effectsByName.MiningFatigue.id]: { amplifier: 3 } }
    expect(rd.digTime(null, false, false, false, [], effects)).toBe(2081324 * 50)
  })
})
