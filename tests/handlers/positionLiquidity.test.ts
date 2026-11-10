import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'
import { afterEach, assert, clearStore, describe, newTypedMockEventWithParams, test } from 'matchstick-as'

import { updatePositionLiquidity } from '../../src/mappings/positionLiquidity'
import { handleTransferHelper } from '../../src/mappings/transfer'
import { ModifyLiquidity } from '../../src/types/PoolManager/PoolManager'
import { Transfer } from '../../src/types/PositionManager/PositionManager'
import { USDC_WETH_POOL_ID } from './constants'

const manager = Address.fromString('0x48b02785c1218829f6c15aaa69b24698208ad776')
const owner = Address.fromString('0x0000000000000000000000000000000000000001')
const recipient = Address.fromString('0x0000000000000000000000000000000000000002')
const tokenId = BigInt.fromI32(258)
const salt = Bytes.fromHexString('0x0000000000000000000000000000000000000000000000000000000000000102')

function transfer(from: Address, to: Address, block: i32): void {
  const event = newTypedMockEventWithParams<Transfer>([
    new ethereum.EventParam('from', ethereum.Value.fromAddress(from)),
    new ethereum.EventParam('to', ethereum.Value.fromAddress(to)),
    new ethereum.EventParam('tokenId', ethereum.Value.fromUnsignedBigInt(tokenId)),
  ])
  event.block.number = BigInt.fromI32(block)
  event.logIndex = BigInt.fromI32(block)
  handleTransferHelper(event)
}

function modify(sender: Address, amount: i32, block: i32): void {
  const event = newTypedMockEventWithParams<ModifyLiquidity>([
    new ethereum.EventParam('id', ethereum.Value.fromFixedBytes(Bytes.fromHexString(USDC_WETH_POOL_ID))),
    new ethereum.EventParam('sender', ethereum.Value.fromAddress(sender)),
    new ethereum.EventParam('tickLower', ethereum.Value.fromI32(-600)),
    new ethereum.EventParam('tickUpper', ethereum.Value.fromI32(600)),
    new ethereum.EventParam('liquidityDelta', ethereum.Value.fromSignedBigInt(BigInt.fromI32(amount))),
    new ethereum.EventParam('salt', ethereum.Value.fromFixedBytes(salt)),
  ])
  event.block.number = BigInt.fromI32(block)
  updatePositionLiquidity(event, manager.toHexString())
}

describe('SodaFlow NFT liquidity', () => {
  afterEach(() => {
    clearStore()
  })

  test('tracks the salted NFT through partial removal and transfers', () => {
    transfer(Address.zero(), owner, 1)
    modify(manager, 100, 1)
    modify(recipient, 500, 2) // A different LP can use the same salt.
    assert.notInStore('PositionSnapshot', '258#2')

    modify(manager, 30, 2)
    modify(manager, -40, 2)
    assert.fieldEquals('Position', '258', 'pool', USDC_WETH_POOL_ID)
    assert.fieldEquals('Position', '258', 'tickLower', '-600')
    assert.fieldEquals('Position', '258', 'tickUpper', '600')
    assert.fieldEquals('Position', '258', 'liquidity', '90')
    assert.fieldEquals('PositionSnapshot', '258#1', 'liquidity', '100')
    assert.fieldEquals('PositionSnapshot', '258#2', 'liquidity', '90')

    transfer(owner, recipient, 3)
    assert.fieldEquals('PositionSnapshot', '258#2', 'owner', owner.toHexString())
    assert.fieldEquals('PositionSnapshot', '258#3', 'owner', recipient.toHexString())
    assert.fieldEquals('PositionSnapshot', '258#3', 'liquidity', '90')
  })

  test('keeps the final state when the burn transfer precedes the liquidity removal', () => {
    transfer(Address.zero(), owner, 1)
    modify(manager, 100, 1)

    transfer(owner, Address.zero(), 2)
    modify(manager, -100, 2)
    assert.fieldEquals('PositionSnapshot', '258#1', 'owner', owner.toHexString())
    assert.fieldEquals('PositionSnapshot', '258#2', 'owner', Address.zero().toHexString())
    assert.fieldEquals('PositionSnapshot', '258#2', 'liquidity', '0')
  })
})
