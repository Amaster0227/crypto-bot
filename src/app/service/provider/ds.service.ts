import FetchAxios from '~/config/axios'
import { DSPair, DSToken } from '~/app/interface/DS'

const fetchAxios = new FetchAxios('https://api.dexscreener.com')
export default class DexScreenerService {
  private readonly api = fetchAxios.default

  public async getMergedUniqueTokens(
    chainId: string = 'solana'
  ): Promise<Array<DSToken>> {
    const [latestTokens, latestBoostedTokens, topBoostedTokens] =
      await Promise.all([
        this.getLatestTokens(chainId),
        this.getLatestBoostedTokens(chainId),
        this.getBoostsTopTokens(chainId),
      ])

    const uniqueTokens = new Map<string, DSToken>()

    const mergeTokens = (tokens: Array<DSToken>) => {
      for (const token of tokens) {
        if (!uniqueTokens.has(token.tokenAddress)) {
          uniqueTokens.set(token.tokenAddress, token)
        }
      }
    }

    mergeTokens(latestTokens)
    mergeTokens(latestBoostedTokens)
    mergeTokens(topBoostedTokens)

    return Array.from(uniqueTokens.values())
  }

  public async getLatestTokens(
    chainId: string = 'solana'
  ): Promise<Array<DSToken>> {
    const response = await this.api.get(`/token-profiles/latest/v1`)
    const latestTokens: Array<DSToken> = response.data
    return latestTokens.filter((token) => token.chainId === chainId)
  }

  public async getLatestBoostedTokens(
    chainId: string = 'solana'
  ): Promise<Array<DSToken>> {
    const response = await this.api.get(`/token-boosts/latest/v1`)
    const latestBoostedTokens: Array<DSToken> = response.data
    return latestBoostedTokens.filter((token) => token.chainId === chainId)
  }

  public async getBoostsTopTokens(
    chainId: string = 'solana'
  ): Promise<Array<DSToken>> {
    const response = await this.api.get(`/token-boosts/top/v1`)
    const latestBoostedTokens: Array<DSToken> = response.data
    return latestBoostedTokens.filter((token) => token.chainId === chainId)
  }

  public async getTokensPair(
    chainId: string = 'solana',
    addresses: string[]
  ): Promise<Array<DSPair>> {
    const chunkSize = 30
    const addressChunks = []
    for (let i = 0; i < addresses.length; i += chunkSize) {
      addressChunks.push(addresses.slice(i, i + chunkSize))
    }

    return await addressChunks.reduce(
      async (accPromise, chunk) => {
        const acc = await accPromise
        const response = await this.api.get(
          `/tokens/v1/${chainId}/${chunk.join(',')}`
        )
        const chunkPairs = response.data
        return [...acc, ...chunkPairs]
      },
      Promise.resolve([] as DSPair[])
    )
  }
}
