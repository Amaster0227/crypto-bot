import FetchAxios from '~/config/axios'
import { Pool } from '~/app/interface/GeckoTerminal'
import { DSPair } from '~/app/interface/DS'

const fetchAxios = new FetchAxios('https://api.geckoterminal.com/api/v2')
export default class GeckoTerminalService {
  private readonly api = fetchAxios.default

  public async getNewPools(network: string = 'solana'): Promise<Array<Pool>> {
    const response = await this.api.get(`/networks/${network}/new_pools`)
    return response.data.data
  }

  public async getPools(
    network: string = 'solana',
    addresses: Array<string>
  ): Promise<Array<Pool>> {
    const chunkSize = 30
    const addressChunks = []
    for (let i = 0; i < addresses.length; i += chunkSize) {
      addressChunks.push(addresses.slice(i, i + chunkSize))
    }

    return await addressChunks.reduce(
      async (accPromise, chunk) => {
        const acc = await accPromise
        const response = await this.api.get(
          `/networks/${network}/pools/multi/${chunk.join(',')}`
        )
        const chunkPairs = response.data.data
        return [...acc, ...chunkPairs]
      },
      Promise.resolve([] as Pool[])
    )
  }
}
