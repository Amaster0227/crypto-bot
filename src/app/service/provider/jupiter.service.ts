import * as console from 'console';
import { Wallet } from '@project-serum/anchor';
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';
import FetchAxios from '~/config/axios';
import { env } from '~/config/env';

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap';

const fetchAxios = new FetchAxios(JUPITER_QUOTE_API);

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn';
  slippageBps: number;
  platformFee: null | string;
  priceImpactPct: string;
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
  recentBlockhash: string;
}

export default class JupiterService {
  private readonly api = fetchAxios.default;
  private readonly connection = new Connection(
    clusterApiUrl('mainnet-beta'),
    'confirmed'
  );
  private readonly wallet = new Wallet(
    Keypair.fromSecretKey(new Uint8Array(JSON.parse(env.WALLET_PRIVATE_KEY)))
  );

  public async getQuote(
    inputMint: string, 
    outputMint: string,
    amount: string
  ): Promise<JupiterQuoteResponse> {
    const response = await this.api.get('/', {
      params: {
        inputMint,
        outputMint,
        amount,
        slippageBps: 50,
        swapMode: 'ExactIn',
      },
    });
    return response.data.data;
  }

  public async executeSwap(
    quote: JupiterQuoteResponse
  ): Promise<{ hash: string }> {
    const swapResponse = await this.api.post(JUPITER_SWAP_API, {
      quoteResponse: quote,
      userPublicKey: this.wallet.publicKey.toString(),
      wrapUnwrapSOL: false,      
    });

    const { swapTransaction, lastValidBlockHeight, recentBlockhash } = swapResponse.data.data;

    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    transaction.sign([this.wallet.payer]);

    const signature = await this.connection.sendTransaction(transaction);
    return { hash: signature };
  }

  public async getTokenPrice(
    inputMint: string,
    outputMint: string
  ): Promise<number> {
    const quote = await this.getQuote(inputMint, outputMint, '1');
    return Number(quote.outAmount) / 1e9;
  }

  public async setupTriggerSale(
    tokenMint: string,
    outputMint: string,
    targetPrice: number,
    amountToSell: string
  ): Promise<void> {    
    const checkPriceInterval = setInterval(async () => {
      try {
        const currentPrice = await this.getTokenPrice(tokenMint, outputMint);
        console.log(`Current price of token: ${currentPrice} SOL`);

        if (currentPrice >= targetPrice) {
          console.log('Price reached target, executing sell...');
          const quote = await this.getQuote(tokenMint, outputMint, amountToSell);
          const { hash } = await this.executeSwap(quote);
          console.log(`Swap executed with hash: ${hash}`);
          clearInterval(checkPriceInterval);
        }
      } catch (error) {
        console.error('Error checking price or executing swap:', error);
      }
    }, 1000);
  }

  public async getTokenBalance(tokenMintAddress: string): Promise<string> {
    try {
      const tokenMint = new PublicKey(tokenMintAddress);
      const tokenAccountInfo = await this.connection.getParsedTokenAccountsByOwner(
        this.wallet.publicKey,
        {
          mint: tokenMint,
        }
      );

      if (tokenAccountInfo.value.length === 0) {
        return '0';
      }

      return tokenAccountInfo.value[0].account.data['parsed']['info']['tokenAmount']['amount'];
    } catch (error) {
      console.error('Error fetching token balance:', error);
      throw new Error('Failed to fetch token balance');
    }
  }

  public async sellTokenAtTarget(
    tokenMint: string,
    outputMint: string,
    amount: string,
    targetPrice: number
  ): Promise<string | null> {    
    const checkPriceInterval = setInterval(async () => {
      try {
        const currentPrice = await this.getTokenPrice(tokenMint, outputMint);
        console.log(`Current price of token: ${currentPrice} SOL`);

        if (currentPrice >= targetPrice) {
          console.log('Price reached target, executing sell...');
          const quote = await this.getQuote(tokenMint, outputMint, amount);
          const { hash } = await this.executeSwap(quote);
          console.log(`Swap executed with hash: ${hash}`);
          return hash;
          clearInterval(checkPriceInterval);
        }
      } catch (error) {
        console.error('Error checking price or executing swap:', error);
        return null
      }
    }, 1000);
  }
}