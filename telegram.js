import { sleep, wait, rand, base58 } from './lib.js'

const connect = async (telegram_token, refresh = 1000) => {
  const instance_id = base58(rand(Math.pow(58, 5) - 1))

  const token_chat_id = new Map()
  const chat_id_token = new Map()

  const setMyCommands = async () => {
    const res = await (await fetch(`https://api.telegram.org/bot${telegram_token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { command: 'sub', description: 'Subscribe to a topic' },
        { command: 'unsub', description: 'Unsubscribe from a topic' },
        { command: 'list', description: 'List subscribed topics' }
      ])
    })).json()
    if (!res.ok) console.error(instance_id, result.description)
  }
  await setMyCommands()

  const getLatestUpdateId = async () => {
    while (true) {
      const updates = await (await fetch(`https://api.telegram.org/bot${telegram_token}/getUpdates?offset=-20`)).json()
      if (updates.ok) return updates.result[updates.result.length - 1].update_id
      throw 'Waiting for correct response from telegram'
    }
  }

  const getLatestUpdates = async () =>
    await (await fetch(`https://api.telegram.org/bot${telegram_token}/getUpdates?offset=-20`)).json()

  const subscribe = (token, chat_id) => {
    if (!token_chat_id.has(token))
      token_chat_id.set(token, new Set())
    token_chat_id.get(token).add(chat_id)
    if (!chat_id_token.has(chat_id))
      chat_id_token.set(chat_id, new Set())
    chat_id_token.get(chat_id).add(token)
  }
  const unsubscribe = (token, chat_id) => {
    if (token_chat_id.has(token))
      token_chat_id.get(token).delete(chat_id)
    if (chat_id_token.has(chat_id))
      chat_id_token.get(chat_id).delete(token)
  }
  const unsubscribeall = chat_id => {
    if (!chat_id_token.has(chat_id)) return
    for (const token of chat_id_token.get(chat_id).values())
      token_chat_id.get(token).delete(chat_id)
    chat_id_token.delete(chat_id)
  }
  const list = chat_id =>
    chat_id_token.has(chat_id)
    ? Array.from(chat_id_token.get(chat_id).values())
    : []

  const md_escape = str => str.replace(/[\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!\']/g, '\\$&')

  const sendMessage = async (chat_id, message_id, msg, notify = true, excape = true) => {
    const res = await fetch(`https://api.telegram.org/bot${telegram_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id,
        text: excape ? md_escape(msg) : msg,
        reply_to_message_id: message_id ? message_id : null,
        parse_mode: 'MarkdownV2',
        disable_notification: !notify
      })
    })
    return await res.json()
  }

  const execCommands = async (chat_id, message_id, commands) => {
    for (const command of commands) {
      if (command.match(/^\/sub ([a-zA-Z0-9\.\*]+)$/i)) {
        const id = command.split(' ')[1]
        subscribe(id, chat_id)
      }
      else if (command.match(/^\/unsub ([a-zA-Z0-9\.\*]+)$/i)) {
        const id = command.split(' ')[1]
        unsubscribe(id, chat_id)
      }
      else if (command.match(/^\/unsuball$/i)) {
        unsubscribeall(chat_id)
      }
      else if (command.match(/^\/list$/i)) {
        const id = command.split(' ')[1]
        const subscriptions = list(chat_id)
        const message = subscriptions.length > 0
          ? `\`${instance_id}\`\n${md_escape(subscriptions.join('\n'))}`
          : `\`${instance_id}\`\n_No subscriptions_`
        try {
          const msg = await sendMessage(chat_id, message_id, message, false, false)
          if (!msg.ok) console.error(msg.description)
        }
        catch (e) {
          console.error(instance_id, e)
        }
      }
    }
  }

  const publish = async (topics, message, notify = true) => {
    const chat_ids = new Set()
    for (const topic of topics) {
      if (!token_chat_id.has(topic)) continue
      for (const chat_id of token_chat_id.get(topic).values())
        chat_ids.add(chat_id)
    }
    for (const chat_id of chat_ids.values())
      await sendMessage(chat_id, null, message, notify)
  }

  let last_seen_update_id = await wait(getLatestUpdateId, refresh)
  let keepgoing = true
  ;(async () => {
    while (true) {
      if (!keepgoing) break
      try {
        const updates = await wait(getLatestUpdates, refresh)
        if (!updates.ok) throw 'Updates unavailable'
        for (const update of updates.result) {
          if (last_seen_update_id >= update.update_id) continue
          last_seen_update_id = update.update_id
          await execCommands(
            update.message.chat.id,
            update.message.message_id,
            update.message.text.split('\n'))
        }
      }
      catch(e) {
        console.error(instance_id, e)
      }
      await sleep(refresh)
    }
  })()

  const close = () => keepgoing = false

  return {
    publish,
    close,
    token: telegram_token
  }
}

export default connect
