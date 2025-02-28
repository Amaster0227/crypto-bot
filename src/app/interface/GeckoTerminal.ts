interface ID {
  data: {
    id: string
    type: 'token' | 'dex' | 'pool'
  }
}

interface Count {
  buys: number
  sells: number
  buyers: number
  sellers: number
}

export interface Pool {
  id: string
  type: 'pool'
  attributes: {
    name: string
    address: string
    base_token_price_usd: string | null
    quote_token_price_usd: string | null
    base_token_price_native_currency: string | null
    quote_token_price_native_currency: string | null
    base_token_price_quote_token: string | null
    quote_token_price_base_token: string | null
    pool_created_at: string | null
    reserve_in_usd: string | null
    fdv_usd: string | null
    market_cap_usd: string | null
    price_change_percentage: {
      m5: string
      h1: string
      h6: string
      h24: string
    }
    volume_usd: {
      m5: string
      h1: string
      h6: string
      h24: string
    }
    transactions: {
      m5: Count
      m15: Count
      m30: Count
      h1: Count
      h24: Count
    }
  }
  relationships: {
    base_token: ID
    quote_token: ID
    dex: ID
  }

  // Additional fields for tracking and monitoring
  initialPrice?: number
  added_at?: string
  removed_at?: string
}
