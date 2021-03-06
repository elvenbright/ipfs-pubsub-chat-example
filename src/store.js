'use strict'

const TOPIC = 'chat'

function createChatStore () {
  return function chatStore (state, emitter) {
    state.id = null
    state.name = window.localStorage.getItem('name') || 'anonymous coward'
    state.text = ''
    state.messages = []
    state.posting = false
    state.subscribed = false
    state.error = null

    const onMessage = (msg) => {
      msg = Object.assign({}, msg)

      const exists = state.messages.some(m => m.seqno.equals(Buffer.from(msg.seqno)))
      if (exists) return

      try {
        msg.seqno = Buffer.from(msg.seqno)
        msg.data = JSON.parse(msg.data)
      } catch (err) {
        return console.warn('Invalid message data', err)
      }

      state.messages = [msg].concat(state.messages).slice(0, 1000)
      emitter.emit('render')
    }

    emitter.on('DOMContentLoaded', async () => {
      if (window.ipfs) {
        try {
          await window.ipfs.pubsub.subscribe(TOPIC, onMessage)
          state.subscribed = true
        } catch (err) {
          console.error('Failed to subscribe', err)
          state.subscribed = false
          state.error = err
        }

        try {
          state.id = await window.ipfs.id()
        } catch (err) {
          console.error('Failed to get node ID', err)
        }
      } else {
        state.subscribed = false
        state.error = new Error('window.ipfs is not available, install IPFS Companion!')
      }

      emitter.emit('render')
    })

    emitter.on('nameChange', (name) => {
      window.localStorage.setItem('name', name)
      state.name = name
      emitter.emit('render')
    })

    emitter.on('textChange', (text) => {
      state.text = text
      emitter.emit('render')
    })

    emitter.on('postMessage', async () => {
      if (!state.subscribed || !state.text) return

      state.posting = true
      emitter.emit('render')

      try {
        const { name, text } = state
        await window.ipfs.pubsub.publish(TOPIC, Buffer.from(JSON.stringify({ name, text })))
        state.text = ''
      } catch (err) {
        console.error('Failed to publish', err)
        state.error = err
      }

      state.posting = false
      emitter.emit('render')
    })

    window.addEventListener('unload', () => window.ipfs.pubsub.unsubscribe(TOPIC, onMessage))
  }
}

module.exports = createChatStore
