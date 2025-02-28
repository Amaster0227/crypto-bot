import axios, { AxiosError } from 'axios'
import { GoogleAuth } from 'google-auth-library'
import { ms } from 'expresso-core'
import { env } from '~/config/env'
import { logger } from '~/config/pino'

export default class GoogleSheetService {
  private readonly api = axios.create({
    baseURL: 'https://sheets.googleapis.com/v4',
    timeout: ms(env.AXIOS_TIMEOUT),
  })
  private googleAuth: GoogleAuth

  constructor() {
    this.googleAuth = new GoogleAuth({
      keyFile: env.GOOGLE_AUTH_CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token might be expired, let's refresh it
          try {
            const newToken = await this.refreshToken()

            if (error.config) {
              // Update the original request with the new token
              error.config.headers['Authorization'] = `Bearer ${newToken}`

              // Retry the original request with the new token
              return this.api.request(error.config)
            }
          } catch (refreshError) {
            logger.error('Error refreshing token:', refreshError)
            return Promise.reject(error)
          }
        }

        return Promise.reject(error)
      }
    )
  }

  private async refreshToken(): Promise<string> {
    const client = await this.googleAuth.getClient()
    const { token } = await client.getAccessToken()

    if (!token) {
      throw new Error('Failed to obtain new access token')
    }

    // Update the default headers with the new token
    this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`

    return token
  }

  update = async (
    {
      range = 'Sheet1!A1',
      data = [],
    }: {
      range?: string
      data?: Array<Array<string | number | undefined>>
    } = { range: 'Sheet1!A1', data: [] }
  ) => {
    try {
      return await this.api.put(
        `/spreadsheets/${env.SPREADSHEET_ID}/values/${range}?valueInputOption=RAW`,
        {
          values: data,
        }
      )
    } catch (error) {
      logger.error('Error writing data to sheet:', error)
    }
  }

  append = async ({
    range = 'Sheet1!A1',
    data = [],
  }: {
    range?: string
    data?: Array<Array<string | number>>
  } = {}) => {
    try {
      return await this.api.post(
        `/spreadsheets/${env.SPREADSHEET_ID}/values/${range}:append?valueInputOption=RAW`,
        {
          values: data,
        }
      )
    } catch (error) {
      logger.error('Error appending data to sheet:', error)
    }
  }

  read = async ({
    range = 'Sheet1!A1',
  }: {
    range?: string
  } = {}) => {
    try {
      const response = await this.api.get(
        `/spreadsheets/${env.SPREADSHEET_ID}/values/${range}`
      )
      return response.data.values || []
    } catch (error) {
      logger.error('Error reading data from sheet:', error)
    }
  }

  readAll = async ({
    sheetName = 'Sheet1',
  }: {
    sheetName?: string
  } = {}) => {
    try {
      const response = await this.api.get(
        `/spreadsheets/${env.SPREADSHEET_ID}/values/${sheetName}`
      )
      return response.data.values || []
    } catch (error) {
      logger.error('Error reading data from sheet:', error)
    }
  }
}
