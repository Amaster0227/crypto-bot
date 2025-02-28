import * as console from 'console'
import { DSDetails, DSPair } from '~/app/interface/DS'
import { isDifferenceLessThanHours } from '~/app/job/index'
import DexScreenerService from '~/app/service/provider/ds.service'
import GoogleSheetService from '~/app/service/provider/gs.service'
import TelegramService from '~/app/service/provider/telegram.service'
import { redisService } from '~/config/redis'

const telegramService = new TelegramService()

export class DSJob {
  private readonly googleSheetService = new GoogleSheetService()
  private readonly dsService = new DexScreenerService()

  public async updateTokenList() {
    const _oldTokenDetails =
      await redisService.get<Array<DSDetails>>('ds:tokenList')
    const oldPairs: Array<DSPair> =
      _oldTokenDetails && _oldTokenDetails.length
        ? await this.dsService.getTokensPair(
            'solana',
            _oldTokenDetails.map((t) => t.address)
          )
        : []
    const oldTokenDetails =
      _oldTokenDetails?.map((td) => {
        const oldPair = oldPairs.find(
          (op) => op.baseToken.address === td.address
        )
        return {
          ...td,
          price: Number(oldPair?.priceUsd) || 0,
          priceChange24h: oldPair?.priceChange.h24 || 0,
          volume24h: oldPair?.volume.h24,
          marketCap: oldPair?.marketCap,
        }
      }) || []

    const tempTokens =
      (await redisService.get<Record<string, string>>('ds:tempTokens')) || {}
    const newTokens = await this.dsService.getMergedUniqueTokens()
    newTokens.forEach((t) => {
      tempTokens[t.tokenAddress] = new Date().toISOString()
    })
    Object.keys(tempTokens).forEach((address) => {
      if (
        !isDifferenceLessThanHours(
          tempTokens[address],
          new Date().toISOString(),
          48
        )
      ) {
        delete tempTokens[address]
      }
    })
    await redisService.set('ds:tempTokens', tempTokens)

    const newPairs = await this.dsService.getTokensPair(
      'solana',
      Object.keys(tempTokens).filter(
        (address) =>
          !_oldTokenDetails?.some((oldToken) => oldToken.address === address)
      )
    )
    const newTokenDetails = newPairs
      .filter(
        (p) =>
          isDifferenceLessThanHours(
            new Date().toISOString(),
            p.pairCreatedAt
          ) &&
          p.liquidity?.usd !== undefined &&
          p.liquidity?.usd > 250000 &&
          p.txns.h24.buys > 700
      )
      .map((p): DSDetails => {
        return {
          name: p.baseToken.name,
          symbol: p.baseToken.symbol,
          address: p.baseToken.address,
          profileLink: p.url,
          initialPrice: Number(p.priceUsd),
          price: Number(p.priceUsd),
          priceChange24h: p.priceChange.h24 || 0,
          volume24h: p.volume.h24,
          marketCap: p.marketCap,
          addedAt: new Date().toISOString(),
          removedAt: undefined,
        }
      })

    const tokenDetails = [...oldTokenDetails, ...newTokenDetails].sort(
      (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
    )
    await redisService.set('ds:tokenList', tokenDetails)

    const data = [
      [
        'Name',
        'Symbol',
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
      ...tokenDetails.map((td) => [
        td.name,
        td.symbol,
        td.address,
        td.profileLink || '',
        td.initialPrice,
        td.price,
        td.priceChange24h,
        td.volume24h || '',
        td.marketCap || '',
        td.addedAt,
        td.removedAt || '',
      ]),
    ]

    await this.googleSheetService.update({
      range: 'DATA!A1',
      data,
    })

    newTokenDetails.forEach((data) => {
      telegramService
        .sendCoinAlert({
          name: data.name,
          // symbol: data.symbol,
          price: data.price,
          change24h: data.priceChange24h,
          totalVolume: data.volume24h,
          marketCap: data.marketCap,
          link: data.profileLink,
        })
        .catch((err) => console.error(err))
    })
  }
}
