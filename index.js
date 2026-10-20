module.exports = loader
module.exports.testedVersions = ['1.8.8', '1.9.4', '1.10.2', '1.11.2', '1.12.2', '1.13.2', '1.14.4', '1.15.2', '1.16.4', '1.17.1', '1.18.1', 'bedrock_1.17.10', 'bedrock_1.18.0', '1.20']

const nbt = require('prismarine-nbt')
const mcData = require('minecraft-data')
const legacyPcBlocksByName = Object.entries(mcData.legacy.pc.blocks).reduce((obj, [idmeta, name]) => {
  const n = name.replace('minecraft:', '').split('[')[0]
  const s = name.split('[')[1]?.replace(']', '') ?? ''
  ;(obj[n] = obj[n] || {})[s] = idmeta
  return obj // array of { [name]: { [states string]: string(id:meta) } }
}, {})
const legacyPcBlocksByIdmeta = Object.entries(mcData.legacy.pc.blocks).reduce((obj, [idmeta, name]) => {
  const s = name.split('[')[1]?.replace(']', '')
  obj[idmeta] = s
    ? Object.fromEntries(s.split(',').map(s => {
      let [k, v] = s.split('=')
      if (!isNaN(parseInt(v))) v = parseInt(v)
      return [k, v]
    }))
    : {}
  return obj // array of { '255:0': { mode: 'save' }, }
}, {})

function loader (registryOrVersion) {
  const registry = typeof registryOrVersion === 'string' ? require('prismarine-registry')(registryOrVersion) : registryOrVersion
  const version = registry.version
  return provider(registry, { Biome: biomeLookup(registry), version })
}

// prismarine-biome's empty biome, for an id the registry has no biome for
const emptyBiome = {
  color: 0,
  height: null,
  name: '',
  rainfall: 0,
  temperature: 0
}

// A block's biome by its id in the registry's biomes as they are when the block is made: the server's own biome
// registry (its dimension codec, from 1.20.2 its registry_data) replaces the registry's biomes after the blocks are
// loaded, and the chunk data's biome ids are its ids. (prismarine-biome keeps the biomes it was loaded with, and was
// given the version, not the registry: every biome read as the empty one.)
function biomeLookup (registry) {
  return function Biome (id) {
    return registry.biomes?.[id] || { ...emptyBiome, id }
  }
}

function provider (registry, { Biome, version }) {
  const blockMethods = require('./blockEntity')(registry)
  const usesBlockStates = (version.type === 'pc' && registry.supportFeature('blockStateId')) || (version.type === 'bedrock')
  const shapes = registry.blockCollisionShapes
  if (shapes) {
    // Prepare block shapes
    for (const id in registry.blocks) {
      const block = registry.blocks[id]
      const shapesId = shapes.blocks[block.name]
      block.shapes = (shapesId instanceof Array) ? shapes.shapes[shapesId[0]] : shapes.shapes[shapesId]
      if (block.states || version.type === 'bedrock') { // post 1.13
        if (shapesId instanceof Array) {
          block.stateShapes = []
          for (const i in shapesId) {
            block.stateShapes.push(shapes.shapes[shapesId[i]])
          }
        }
      } else { // pre 1.13
        // the shape of each data value, whether or not the block has a variation for it (a trapdoor's, a ladder's)
        if (shapesId instanceof Array) block.stateShapes = shapesId.map(id => shapes.shapes[id])
        if ('variations' in block) {
          for (const i in block.variations) {
            const metadata = block.variations[i].metadata
            if (shapesId instanceof Array) {
              block.variations[i].shapes = shapes.shapes[shapesId[metadata]]
            } else {
              block.variations[i].shapes = shapes.shapes[shapesId]
            }
          }
        }
      }

      if (!block.shapes && version.type === 'bedrock') {
        // if no shapes are present for this block (for example, some chemistry stuff we don't have BBs for), assume it's stone
        block.shapes = shapes.shapes[shapes.blocks.stone[0]]
        block.stateShapes = block.shapes
      }
    }
  }

  function getEffectLevel (effectName, effects) {
    const effectDescriptor = registry.effectsByName[effectName]
    if (!effectDescriptor) {
      return 0
    }
    const effectInfo = effects[effectDescriptor.id]
    if (!effectInfo) {
      return 0
    }
    return effectInfo.amplifier + 1
  }

  function getEnchantmentLevel (enchantmentName, enchantments) {
    const enchantmentDescriptor = registry.enchantmentsByName[enchantmentName]
    if (!enchantmentDescriptor) {
      return 0
    }

    for (const enchInfo of enchantments) {
      if (typeof enchInfo.name === 'string') {
        if (enchInfo.name.includes(enchantmentName)) {
          return enchInfo.lvl
        }
      } else if (enchInfo.name === enchantmentDescriptor.name) {
        return enchInfo.lvl
      }
    }
    return 0
  }

  // Player.getDestroySpeed: 0.3F, 0.09F, 0.0027F, then 8.1E-4F; from 26.3 (float) Math.pow(0.3, level)
  function getMiningFatigueMultiplier (effectLevel) {
    if (effectLevel === 0) return 1.0
    if (registry.version['>=']('26.3')) return Math.fround(Math.pow(0.3, effectLevel))
    switch (effectLevel) {
      case 1: return Math.fround(0.3)
      case 2: return Math.fround(0.09)
      case 3: return Math.fround(0.0027)
      default: return Math.fround(8.1E-4)
    }
  }

  // The ticks the client holds attack until a block breaks: it adds the (float) progress each tick, from the tick it
  // starts, until the sum reaches 1 (MultiPlayerGameMode.continueDestroyBlock). Infinity when the sum stops growing.
  function breakTicks (delta) {
    let sum = 0
    let ticks = 0
    while (sum < 1) {
      const next = Math.fround(sum + delta)
      if (next === sum) return Infinity
      sum = next
      ticks++
    }
    return ticks
  }

  // BambooStalkBlock and BambooSaplingBlock.getDestroyProgress before 1.21.5 (then every sword's tool rule
  // sword_instantly_mines, in materials): held in the main hand, any sword breaks them at once
  const swordBreaksAtOnce = registry.version.type === 'pc' && registry.version['<']('1.21.5')
    ? new Set(['bamboo', 'bamboo_sapling'])
    : new Set()

  return class Block {
    constructor (type, biomeId, metadata, stateId) {
      this.type = type
      this.metadata = metadata ?? 0
      this.light = 0
      this.skyLight = 0
      this.biome = new Biome(biomeId)
      this.position = null
      this.stateId = stateId
      this.computedStates = {}

      if (stateId === undefined && type !== undefined) {
        const b = registry.blocks[type]
        // Make sure the block is actually valid and metadata is within valid bounds
        if (b !== undefined && b.minStateId === undefined && Array.isArray(b.states)) {
          // With a hashed-runtime registry (Bedrock 1.19.80+) minStateId/maxStateId are undefined, so pick the state
          // from the block's own states list.
          this.stateId = b.states[Math.min(this.metadata, b.states.length - 1)]
        } else {
          this.stateId = b === undefined ? null : Math.min(b.minStateId + metadata, b.maxStateId)
        }
      }

      const blockEnum = registry.blocksByStateId[this.stateId]
      if (blockEnum) {
        // With a hashed-runtime registry (Bedrock 1.19.80+) minStateId is undefined and stateId is a state hash, not a
        // contiguous index, so stateId - minStateId is NaN and every per-state lookup (shapes, properties) falls back to
        // state 0. Resolve the state's index within the block's own states list instead.
        if (blockEnum.minStateId === undefined && Array.isArray(blockEnum.states)) {
          const index = blockEnum.states.indexOf(this.stateId)
          this.metadata = index >= 0 ? index : 0
        } else {
          this.metadata = this.stateId - blockEnum.minStateId
        }
        this.type = blockEnum.id
        this.name = blockEnum.name
        this.hardness = blockEnum.hardness
        this.displayName = blockEnum.displayName
        this.shapes = blockEnum.shapes
        if (blockEnum.stateShapes) {
          if (blockEnum.stateShapes[this.metadata] !== undefined) {
            this.shapes = blockEnum.stateShapes[this.metadata]
          } else {
            // Default to shape 0
            this.shapes = blockEnum.stateShapes[0]
            this.missingStateShape = true
          }
        }
        if (blockEnum.variations) {
          const variations = blockEnum.variations
          for (const i in variations) {
            if (variations[i].metadata === metadata) {
              this.displayName = variations[i].displayName
              if (!blockEnum.stateShapes) this.shapes = variations[i].shapes
            }
          }
        }
        this.boundingBox = blockEnum.boundingBox
        this.transparent = blockEnum.transparent
        this.diggable = blockEnum.diggable
        this.material = blockEnum.material
        this.harvestTools = blockEnum.harvestTools
        this.drops = blockEnum.drops
      } else {
        this.name = ''
        this.displayName = ''
        this.shapes = []
        this.hardness = 0
        this.boundingBox = 'empty'
        this.transparent = true
        this.diggable = false
      }

      // Properties - this is set for all versions even those with metadata
      this._properties = {}
      if (version.type === 'pc') {
        if (usesBlockStates) {
          const blockEnum = registry.blocksByStateId[this.stateId]
          if (blockEnum && blockEnum.states) {
            let data = this.metadata
            for (let i = blockEnum.states.length - 1; i >= 0; i--) {
              const prop = blockEnum.states[i]
              this._properties[prop.name] = propValue(prop, data % prop.num_values)
              data = Math.floor(data / prop.num_values)
            }
          }
        } else {
          this._properties = legacyPcBlocksByIdmeta[this.type + ':' + this.metadata] || legacyPcBlocksByIdmeta[this.type + ':0']
          if (!this._properties) { // If no props, try different metadata for type match only
            for (let i = 0; i < 15; i++) {
              this._properties = legacyPcBlocksByIdmeta[this.type + ':' + i]
              if (this._properties) break
            }
          }
          this._properties ??= {}
        }
      } else if (version.type === 'bedrock') {
        // blockStates is a sequential array, so blockStates[stateId] only resolves while stateId is the array index. With a
        // hashed-runtime registry (Bedrock 1.19.80+) stateId is a state hash, so the array lookup misses and properties come
        // back empty. Prefer the stateId-keyed map (blockStatesByStateId) the registry provides for hashed versions.
        const states = (registry.blockStatesByStateId?.[this.stateId] || registry.blockStates?.[this.stateId])?.states || {}
        for (const state in states) {
          this._properties[state] = states[state].value
        }
      } else {
        throw new Error('Unknown registry type: ' + version.type)
      }
      this.isWaterlogged = this._properties.waterlogged

      // Extras - Inject helper methods based on the specific block type.
      if (this.name.includes('sign')) {
        mergeObject(this, blockMethods.sign)
      }

      if (blockEnum && registry.supportFeature('blockHashes')) {
        this.hash = Block.getHash(this.name, this._properties)
      }
    }

    static fromStateId (stateId, biomeId) {
      // 1.13+: metadata is completely removed and only block state IDs are used
      if (usesBlockStates) {
        return new Block(undefined, biomeId, 0, stateId)
      } else {
        return new Block(stateId >> 4, biomeId, stateId & 15, stateId)
      }
    }

    static fromProperties (typeId, properties, biomeId) {
      const block = typeof typeId === 'string' ? registry.blocksByName[typeId] : registry.blocks[typeId]

      if (!block) throw new Error('No matching block id found for ' + typeId + ' with properties ' + JSON.stringify(properties)) // This should not happen

      if (version.type === 'pc') {
        if (block.states) {
          let data = 0
          for (const [key, value] of Object.entries(properties)) {
            data += getStateValue(block.states, key, value)
          }
          return new Block(undefined, biomeId, 0, block.minStateId + data)
        } else {
          const states = legacyPcBlocksByName[block.name]
          for (const state in states) {
            let broke
            for (const [key, value] of Object.entries(properties)) {
              const s = key + '=' + value
              if (!state.includes(s)) {
                broke = true
                break
              }
            }
            if (!broke) {
              const [id, meta] = states[state].split(':').map(Number)
              return new Block(id, biomeId, meta)
            }
          }
          throw new Error('No matching block state found for ' + block.name + ' with properties ' + JSON.stringify(properties)) // This should not happen
        }
      } else if (version.type === 'bedrock') {
        // With a hashed-runtime registry (Bedrock 1.19.80+) minStateId/maxStateId are undefined, so walk the block's own
        // states list instead and look each state up by its stateId.
        const stateIds = block.minStateId === undefined && Array.isArray(block.states)
          ? block.states
          : Array.from({ length: block.maxStateId - block.minStateId + 1 }, (_, i) => block.minStateId + i)
        for (const stateId of stateIds) {
          const state = (registry.blockStatesByStateId?.[stateId] || registry.blockStates[stateId]).states
          if (Object.entries(properties).find(([prop, val]) => state[prop]?.value !== val)) continue
          return new Block(undefined, biomeId, 0, stateId)
        }
        return block
      }
    }

    static fromString (str, biomeId) {
      if (str.startsWith('minecraft:')) str = str.substring(10)
      const name = str.split('[', 1)[0]
      const propertiesStr = str.slice(name.length + 1, -1).split(',')
      if (!str.includes('["')) {
        // Example state: `minecraft:candle[lit=true]` -> candle, {lit: "true"}
        return Block.fromProperties(name, Object.fromEntries(propertiesStr.map(property => property.split('='))), biomeId)
      } else {
        // Kept for backwards compatibility
        // Example state: `minecraft:candle["lit":true]` -> candle, {lit: 1}
        return Block.fromProperties(name, Object.fromEntries(propertiesStr.map(property => {
          const [key, value] = property.split(':')
          return [key.slice(1, -1), value.startsWith('"') ? value.slice(1, -1) : { true: 1, false: 0 }[value] ?? parseInt(value)]
        })), biomeId)
      }
    }

    get blockEntity () {
      return this.entity ? nbt.simplify(this.entity) : undefined
    }

    getProperties () {
      return Object.assign(this._properties, this.computedStates)
    }

    static getHash (name, states) {
      if (registry.supportFeature('blockHashes')) {
        const sortedStates = {}
        for (const key of Object.keys(states).sort()) {
          sortedStates[key] = states[key]
        }
        const tag = nbt.comp({
          name: { type: 'string', value: name.includes(':') ? name : `minecraft:${name}` },
          states: nbt.comp(sortedStates)
        })
        const buf = nbt.writeUncompressed(tag, 'little')
        return computeFnv1a32Hash(buf)
      }
    }

    canHarvest (heldItemType) {
      if (!this.harvestTools) { return true }; // for blocks harvestable by hand
      return heldItemType && this.harvestTools && this.harvestTools[heldItemType]
    }

    // Vanilla's Player.getDestroySpeed and BlockBehaviour.getDestroyProgress, in floats as they are, and the ticks the
    // client takes adding that progress up (breakTicks): the time in ms, 0 when it breaks at once, Infinity never
    digTime (heldItemType, creative, inWater, notOnGround, enchantments = [], effects = {}) {
      if (creative) return 0
      const f = Math.fround

      const heldItem = heldItemType != null ? registry.items[heldItemType] : null
      if (swordBreaksAtOnce.has(this.name) && heldItem?.name.endsWith('_sword')) return 0

      const materialToolMultipliers = registry.materials[this.material]
      const isBestTool = heldItemType && materialToolMultipliers && materialToolMultipliers[heldItemType]

      // The held item's speed on this block
      let speed = isBestTool ? f(materialToolMultipliers[heldItemType]) : 1

      // Efficiency (from 1.21 the mining_efficiency attribute it gives) when the item is faster than a hand
      const efficiencyLevel = getEnchantmentLevel('efficiency', enchantments)
      if (efficiencyLevel > 0 && speed > 1.0) {
        speed = f(speed + f(efficiencyLevel * efficiencyLevel + 1))
      }

      // Haste or Conduit Power, the higher
      const hasteLevel = Math.max(
        getEffectLevel('Haste', effects),
        getEffectLevel('ConduitPower', effects))
      if (hasteLevel > 0) {
        speed = f(speed * f(1 + f(hasteLevel * f(0.2))))
      }

      const miningFatigueLevel = getEffectLevel('MiningFatigue', effects)
      if (miningFatigueLevel > 0) {
        speed = f(speed * getMiningFatigueMultiplier(miningFatigueLevel))
      }

      // Under water without Aqua Affinity: / 5 (from 1.21 x the submerged_mining_speed attribute, 0.2)
      if (inWater && getEnchantmentLevel('aqua_affinity', enchantments) === 0) {
        speed = registry.version.type === 'pc' && registry.version['>=']('1.21') ? f(speed * f(0.2)) : f(speed / 5)
      }

      // Off the ground: / 5
      if (notOnGround) {
        speed = f(speed / 5)
      }

      // getDestroyProgress: speed / hardness / (30 with the correct tool for drops, else 100)
      const blockHardness = this.hardness
      if (blockHardness === -1.0) return Infinity
      const matchingToolMultiplier = this.canHarvest(heldItemType) ? 30 : 100
      const blockBreakingDelta = f(f(speed / f(blockHardness)) / matchingToolMultiplier)
      if (blockBreakingDelta === 0) return Infinity
      if (blockBreakingDelta >= 1) return 0
      return breakTicks(blockBreakingDelta) * 50
    }
  }

  function parseValue (value, state) {
    if (state.type === 'enum' || state.values) {
      return state.values.indexOf(String(value))
    }
    if (state.type === 'bool') {
      if (value === true || value === 'true') return 0
      if (value === false || value === 'false') return 1
    }
    if (state.type === 'int') {
      return value
    }
    // Assume by-name mapping for unknown properties
    return state.values?.indexOf(value.toString()) ?? 0
  }

  function getStateValue (states, name, value) {
    let offset = 1
    for (let i = states.length - 1; i >= 0; i--) {
      const state = states[i]
      if (state.name === name) {
        return offset * parseValue(value, state)
      }
      offset *= state.num_values
    }
    return 0
  }

  function propValue (state, value) {
    if (state.type === 'enum' || state.values) return state.values[value]
    if (state.type === 'bool') return !value
    return value
  }
}

function mergeObject (to, from) {
  Object.defineProperties(to, Object.getOwnPropertyDescriptors(from))
}

function computeFnv1a32Hash (buf) {
  const FNV1_OFFSET_32 = 0x811c9dc5
  let h = FNV1_OFFSET_32
  for (let i = 0; i < buf.length; i++) {
    h ^= buf[i] & 0xff
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
  }
  return h & 0xffffffff
}
