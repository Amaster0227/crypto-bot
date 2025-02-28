import { setIntervalAsync } from 'set-interval-async'
import { UploadJob } from './upload.job'
import { GeckoTerminalJob } from '~/app/job/geckoTerminal.job'

export function isDifferenceLessThanHours(
  date1: number | string,
  date2: number | string,
  hours: number = 1
): boolean {
  // Convert ISO strings to Date objects
  const dateObj1 = new Date(date1)
  const dateObj2 = new Date(date2)

  // Calculate the absolute difference in milliseconds
  const differenceInMs = Math.abs(dateObj1.getTime() - dateObj2.getTime())

  // Convert milliseconds to hours
  const differenceInHours = differenceInMs / (1000 * 60 * 60)

  // Return true if the difference is more than 1 hour, otherwise false
  return differenceInHours <= hours
}

export class Jobs {
  /**
   * Initialize Jobs
   */
  public static initialize(): void {
    // run upload task
    // this._uploadTask()
    // run token list update task
    void this._updateTokenList()
  }

  /**
   * Upload Task
   */
  private static _uploadTask(): void {
    // Upload Job
    const getTask = UploadJob.getTask()
    getTask.start()
  }

  private static async _updateTokenList(): Promise<void> {
    const geckoTerminalJob = new GeckoTerminalJob()

    // Then run every 30 seconds
    setIntervalAsync(() => {
      void geckoTerminalJob.updatePools()
    }, 30000) // 30000 milliseconds = 30 seconds
  }
}
