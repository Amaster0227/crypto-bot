import * as console from 'console'
import { Pool } from '~/app/interface/GeckoTerminal'
import { isDifferenceLessThanHours } from '~/app/job/index'
import GeckoTerminalService from '~/app/service/provider/geckoTerminal.service'
import GoogleSheetService from '~/app/service/provider/gs.service'
import TelegramService from '~/app/service/provider/telegram.service'
import { redisService } from '~/config/redis'
import GmGnService from '~/app/service/provider/gmgn.service'
import JupiterService from '~/app/service/provider/jupiter.service'

const telegramService = new TelegramService()

export class GeckoTerminalJob {
  private readonly googleSheetService = new GoogleSheetService()
  private readonly geckoTerminalService = new GeckoTerminalService()
  private readonly gmGnService = new GmGnService()
  private readonly jupiterService = new JupiterService()

  public async updatePools() {
    const _oldPools = await redisService.get<Array<Pool>>('gt:pools')
    const oldPools = (
      _oldPools
        ? await this.geckoTerminalService.getPools(
            'solana',
            _oldPools.map((p) => p.attributes.address)
          )
        : ([] as Pool[])
    ).map((p) => {
      const oldPool = _oldPools
        ? _oldPools.find((op) => op.attributes.address === p.attributes.address)
        : null

      const currentPrice = Number(p.attributes.base_token_price_usd || 0)
      const initialPrice = oldPool?.initialPrice || currentPrice
      console.log(
        `Checking pool ${p.attributes.name}: Initial price: ${initialPrice}, Current price: ${currentPrice}`
      )

      let rate = 1.3
      if (initialPrice > 0.0009) {
        rate = 1.2
      }
      if (initialPrice * rate < currentPrice) {
        const baseToken = p.relationships.base_token.data.id.split('_')[1]
        this.gmGnService
          .getTokenBalance(baseToken)
          .then(async (amount) => {
            console.log(`Token balance for ${p.attributes.name}: ${amount}`)            
          })
          .catch((error) => {
            console.error(`Error selling ${p.attributes.name}:`, error)
          })
      }
      return {
        ...p,
        added_at: oldPool?.added_at,
        initialPrice: oldPool?.initialPrice,
      }
    })

    const tempPoolAddresses =
      (await redisService.get<Record<string, string>>(
        'gt:tempPoolAddresses'
      )) || {}
    Object.keys(tempPoolAddresses).forEach((address) => {
      if (
        !isDifferenceLessThanHours(
          tempPoolAddresses[address],
          new Date().toISOString(),
          1
        ) ||
        oldPools.find((op) => op.attributes.address === address)
      ) {
        delete tempPoolAddresses[address]
      }
    })
    const tempPools = await this.geckoTerminalService.getPools(
      'solana',
      Object.keys(tempPoolAddresses)
    )

    const newPools = await this.geckoTerminalService.getNewPools()
    newPools.forEach((p) => {
      tempPoolAddresses[p.attributes.address] =
        p.attributes.pool_created_at || new Date().toISOString()
    })
    await redisService.set('gt:tempPoolAddresses', tempPoolAddresses)

    const uniquePoolsMap: Map<string, Pool> = new Map()
    tempPools.forEach((pool) => {
      uniquePoolsMap.set(pool.attributes.address, pool)
    })
    newPools.forEach((pool) => {
      uniquePoolsMap.set(pool.attributes.address, pool)
    })

    const oldPoolAddresses = new Set(
      oldPools.map((pool) => pool.attributes.address)
    )
    const mergedPools = Array.from(uniquePoolsMap.values()).filter(
      (pool) => !oldPoolAddresses.has(pool.attributes.address)
    )

    const _filteredPools = mergedPools.filter(
      (pool) =>
        isDifferenceLessThanHours(
          new Date().toISOString(),
          pool.attributes.pool_created_at || new Date().toISOString()
        ) &&
        Number(pool.attributes.reserve_in_usd || 0) > 250000 &&
        pool.attributes.transactions.h1.buyers > 700
    )

    const filteredPools = _filteredPools.map((pool): Pool => {
      const baseToken = pool.relationships.base_token.data.id.split('_')[1]
      this.gmGnService.getTokenBalance(baseToken).then(async (amount) => {
        const buyHash = await this.gmGnService.swap(
          pool.relationships.quote_token.data.id.split('_')[1],
          baseToken,
          '30000000'
        )
        if (buyHash) {
          console.log(
            `Successfully bought ${pool.attributes.name}, tx: ${buyHash}`
          )

          telegramService.sendTradeAlert({
            type: 'Buy',
            name: pool.attributes.name,
            price: Number(pool.attributes.base_token_price_usd),
            amount: amount,
            volumeRatio:
              Number(pool.attributes.volume_usd.h24) /
              Number(pool.attributes.fdv_usd || 0),
            link: `https://solscan.io/tx/${buyHash}`,
          })
        } else {
          console.log(`Failed to buy ${pool.attributes.name}`)
        }
      })
      return {
        ...pool,
        initialPrice: Number(pool.attributes.base_token_price_usd),
        added_at: new Date().toISOString(),
      }
    })

    const pools = [...oldPools, ...filteredPools].sort(
      (a, b) =>
        new Date(a.added_at || new Date().toISOString()).getTime() -
        new Date(b.added_at || new Date().toISOString()).getTime()
    )
    await redisService.set('gt:pools', pools)

    const data = [
      [
        'Name',
        'Address',
        'Profile Link',
        'Price when added',
        'Price',
        'Price Change Percentage 24h',
        'Volume',
        'Market Cap',
        'Added At',
        'Removed At',
      ],
      ...pools.map((p) => {
        return [
          p.attributes.name,
          p.attributes.address,
          `https://dexscreener.com/solana/${p.attributes.address}`,
          p.initialPrice,
          Number(p.attributes.base_token_price_usd),
          Number(p.attributes.price_change_percentage.h24),
          Number(p.attributes.volume_usd.h24),
          Number(p.attributes.fdv_usd || 0),
          p.added_at,
          p.removed_at,
        ]
      }),
    ]

    await this.googleSheetService.update({
      range: 'DATA!A1',
      data,
    })

    filteredPools.forEach((pool) => {
      telegramService
        .sendCoinAlert({
          name: pool.attributes.name,
          price: Number(pool.attributes.base_token_price_usd),
          change24h: Number(pool.attributes.price_change_percentage.h24),
          totalVolume: Number(pool.attributes.volume_usd.h24),
          marketCap: Number(pool.attributes.fdv_usd || 0),
          link: `https://dexscreener.com/solana/${pool.attributes.address}`,
        })
        .catch((err) => console.error(err))
    })
  }
}
