import * as console from 'console'
import { Wallet } from '@project-serum/anchor'
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js'
import FetchAxios from '~/config/axios'
import { env } from '~/config/env'

const fetchAxios = new FetchAxios('https://gmgn.ai')

export interface Router {
  quote: {
    inputMint: string
    inAmount: string
    outputMint: string
    outAmount: string
    otherAmountThreshold: string
    swapMode: 'ExactIn'
    slippageBps: number
    platformFee: null | string
    priceImpactPct: string
    routePlan: any[]
    contextSlot: number
    timeTaken: number
  }
  raw_tx: {
    swapTransaction: string
    lastValidBlockHeight: number
    prioritizationFeeLamports: number
    recentBlockhash: string
  }
}

export default class GmGnService {
  private readonly api = fetchAxios.default
  private readonly connection = new Connection(
    clusterApiUrl('mainnet-beta'),
    'confirmed'
  )
  private readonly wallet = new Wallet(
    Keypair.fromSecretKey(new Uint8Array(JSON.parse(env.WALLET_PRIVATE_KEY)))
  )

  public async queryRouter(
    tokenInAddress: string,
    tokenOutAddress: string,
    inAmount: string
  ): Promise<Router> {
    const response = await this.api.get(
      `/defi/router/v1/sol/tx/get_swap_route`,
      {
        params: {
          token_in_address: tokenInAddress,
          token_out_address: tokenOutAddress,
          in_amount: inAmount,
          from_address: this.wallet.publicKey.toString(),
          is_anti_mev: true,
        },
      }
    )
    return response.data.data
  }

  public async submitTransaction(
    rawSwapTransaction: string
  ): Promise<{ hash: string }> {
    const swapTransactionBuf = Buffer.from(rawSwapTransaction, 'base64')
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf)
    transaction.sign([this.wallet.payer])
    const signedTx = Buffer.from(transaction.serialize()).toString('base64')
    const response = await this.api.post(
      `/defi/router/v1/sol/tx/submit_signed_transaction`,
      {
        signed_tx: signedTx,
      }
    )
    return response.data.data
  }

  public async submitTransactionAntiMEV(
    rawSwapTransaction: string
  ): Promise<{ hash: string }> {
    const swapTransactionBuf = Buffer.from(rawSwapTransaction, 'base64')
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf)
    transaction.sign([this.wallet.payer])
    const signedTx = Buffer.from(transaction.serialize()).toString('base64')
    const response = await this.api.post(
      `/defi/router/v1/sol/tx/submit_signed_bundle_transaction`,
      {
        signed_tx: signedTx,
        from_address: this.wallet.publicKey.toString(),
      }
    )
    return response.data.data
  }

  public async getTransactionStatus(
    hash: string,
    lastValidHeight: number
  ): Promise<{ success: boolean; expired: boolean }> {
    const response = await this.api.get(
      `/defi/router/v1/sol/tx/get_transaction_status`,
      {
        params: {
          hash,
          last_valid_height: lastValidHeight,
        },
      }
    )
    return response.data.data
  }

  public async getTokenBalance(tokenMintAddress: string): Promise<string> {
    try {
      const tokenMint = new PublicKey(tokenMintAddress)

      const tokenAccountInfo =
        await this.connection.getParsedTokenAccountsByOwner(
          this.wallet.publicKey,
          {
            mint: tokenMint,
          }
        )

      if (tokenAccountInfo.value.length === 0) {
        return '0'
      }

      return tokenAccountInfo.value[0].account.data['parsed']['info'][
        'tokenAmount'
      ]['amount']
    } catch (error) {
      console.error('Error fetching token balance:', error)
      throw new Error('Failed to fetch token balance')
    }
  }

  public async swap(
    tokenInAddress: string,
    tokenOutAddress: string,
    inAmount: string
  ): Promise<string | null> {
    try {
      const router = await this.queryRouter(
        tokenInAddress,
        tokenOutAddress,
        inAmount
      )
      const { swapTransaction } = router.raw_tx
      const { hash } = await this.submitTransaction(swapTransaction)

      return hash
    } catch (e) {
      console.log('Error submitting transaction:', e)
      return null
    }
  }
}
