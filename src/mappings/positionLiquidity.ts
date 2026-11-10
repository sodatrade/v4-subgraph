import { BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts'

import { ModifyLiquidity } from '../types/PoolManager/PoolManager'
import { Position, PositionSnapshot } from '../types/schema'
import { positionId } from '../utils/id'

export function updatePositionLiquidity(event: ModifyLiquidity, positionManager: string): void {
  if (event.params.sender.toHexString() != positionManager) {
    return
  }

  // SodaFlow encodes its NFT token ID as an unsigned, big-endian bytes32 salt.
  const tokenId = BigInt.fromUnsignedBytes(Bytes.fromUint8Array(event.params.salt.slice().reverse()))
  const id = positionId(tokenId)
  const position = Position.load(id)
  if (position === null) {
    log.critical('Missing SodaFlow position {} for liquidity event in {}', [id, event.transaction.hash.toHexString()])
    return
  }

  const pool = event.params.id.toHexString()
  const lower = BigInt.fromI32(event.params.tickLower)
  const upper = BigInt.fromI32(event.params.tickUpper)
  const previousPool = position.pool
  const previousLiquidity = position.liquidity
  if (previousPool !== null) {
    const previousLower = position.tickLower!
    const previousUpper = position.tickUpper!
    if (previousPool != pool || !previousLower.equals(lower) || !previousUpper.equals(upper)) {
      log.critical('SodaFlow position {} changed pool or tick range in {}', [id, event.transaction.hash.toHexString()])
      return
    }
  }

  const liquidity = (previousLiquidity === null ? BigInt.zero() : previousLiquidity).plus(event.params.liquidityDelta)
  if (liquidity.lt(BigInt.zero())) {
    log.critical('SodaFlow position {} has negative liquidity in {}', [id, event.transaction.hash.toHexString()])
    return
  }

  position.pool = pool
  position.tickLower = lower
  position.tickUpper = upper
  position.liquidity = liquidity
  position.save()
  savePositionSnapshot(position, event.block)
}

export function savePositionSnapshot(position: Position, block: ethereum.Block): void {
  const pool = position.pool
  const lower = position.tickLower
  const upper = position.tickUpper
  const liquidity = position.liquidity
  if (pool === null || lower === null || upper === null || liquidity === null) {
    return
  }

  // Transfers and liquidity changes can share a block. Keep its final state.
  const snapshot = new PositionSnapshot(position.id + '#' + block.number.toString())
  snapshot.position = position.id
  snapshot.pool = pool
  snapshot.owner = position.owner
  snapshot.tickLower = lower
  snapshot.tickUpper = upper
  snapshot.liquidity = liquidity
  snapshot.blockNumber = block.number
  snapshot.timestamp = block.timestamp
  snapshot.save()
}
