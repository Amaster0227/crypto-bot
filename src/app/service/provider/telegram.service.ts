import * as console from 'console'
import TelegramBot from 'node-telegram-bot-api'
import { env } from '~/config/env'

export default class TelegramService {
  private readonly bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, {
    polling: false,
  })

  async sendMessage(message: string) {
    try {
      await this.bot.sendMessage(env.TELEGRAM_CHAT_ID, message, {
        parse_mode: 'HTML',
      })
    } catch (error) {
      console.error('Error sending Telegram message:', error)
    }
  }

  async sendDirectMessage(chatId: string, message: string) {
    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
      })
    } catch (error) {
      console.error(`Error sending DM to ${chatId}:`, error)
    }
  }

  async sendCoinAlert(coinData: {
    totalVolume: number
    marketCap: number | null
    price: number
    name: string
    link: string | undefined
    change24h: number
  }) {
    const changeEmoji = (coinData.change24h ?? 0) >= 0 ? '🟢' : '🔴'
    const message = [
      `<b>🪙 ${coinData.name}</b>`,
      '',
      `💵 <b>Price:</b> $${coinData.price}`,
      `${changeEmoji} <b>24h Change:</b> ${coinData.change24h?.toFixed(2)}%`,
      `📊 <b>Total Volume:</b> ${coinData.totalVolume}`,
      `💰 <b>Market Cap:</b> ${coinData.marketCap}`,
      `🔗 <b>Profile link:</b> ${coinData.link}`,
      '',
      `<i>🕒 Updated: ${new Date().toLocaleString()}</i>`,
    ].join('\n')

    await this.sendMessage(message)
  }

  async sendErrorAlert(error: string) {
    const message = [
      `⚠️ <b>Error Alert</b>`,
      '',
      `${error}`,
      '',
      `<i>🕒 ${new Date().toLocaleString()}</i>`,
    ].join('\n')

    await this.sendDirectMessage(env.TELEGRAM_CHAT_ID, message)
  }

  async sendSystemAlert(title: string, details: string) {
    const message = [
      `🔔 <b>${title}</b>`,
      '',
      details,
      '',
      `<i>🕒 ${new Date().toLocaleString()}</i>`,
    ].join('\n')

    await this.sendDirectMessage(env.TELEGRAM_CHAT_ID, message)
  }

  async sendTradeAlert(alert: {
    type: string
    name: string
    price: string | number
    amount: string | number
    volumeRatio: number
    link: string
  }) {
    const message = `
🤖 Trade Alert: ${alert.type}
${alert.name}
💰 Price: ${alert.price}
📝 Amount: ${alert.amount}
📊 Volume/MCap Ratio: ${alert.volumeRatio.toFixed(2)}%
🔗 ${alert.link}
    `.trim()

    await this.sendDirectMessage(env.TELEGRAM_CHAT_ID, message)
  }
}
