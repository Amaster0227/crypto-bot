import { Redis, type RedisOptions } from 'ioredis'
import { ms } from 'expresso-core'
import { env } from './env'

interface RedisSetOptions {
  expiryMode?: string | any[]
  timeout?: string | number
}

export class RedisProvider {
  private readonly _client: Redis

  constructor(options: RedisOptions) {
    this._client = new Redis(options)
  }

  public client(): Redis {
    return this._client
  }

  /**
   * Ping
   * @returns
   */
  public async ping() {
    const client = this.client()

    return client.ping((err, result) => {
      if (err) return 'Failed'
      return result
    })
  }

  /**
   *
   * @param key
   * @param data
   * @param options
   */
  public async set(
    key: string,
    data: any,
    options?: RedisSetOptions
  ): Promise<void> {
    const client = this.client()

    const defaultTimeout = options?.timeout ?? ms('1d') / 1000

    await client.setex(key, defaultTimeout, JSON.stringify(data))
  }

  /**
   *
   * @param key
   * @returns
   */
  public async get<T>(key: string): Promise<T | null> {
    const client = this.client()

    const data = await client.get(key)

    if (!data) {
      return null
    }

    return JSON.parse(data) as T
  }

  /**
   *
   * @param key
   */
  public async delete(key: string): Promise<void> {
    const client = this.client()

    await client.del(key)
  }

  /**
   *
   * @param prefix
   */
  public async deleteByPrefix(prefix: string): Promise<void> {
    const client = this.client()

    const keys = await client.keys(`${prefix}:*`)
    const pipeline = client.pipeline()

    keys.forEach((key) => {
      pipeline.del(key)
    })

    await pipeline.exec()
  }
}

/**
 * Initialize Redis Service Config
 */
export const redisService = new RedisProvider({
  // Redis Host
  host: env.REDIS_HOST,
  // Redis Port
  port: env.REDIS_PORT,
  // Redis Password
  password: env.REDIS_PASSWORD,
})
