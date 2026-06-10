// Converts mic float32 frames to 16-bit PCM and posts them to the main thread,
// batched to ~4096 samples (~256ms at 16kHz) per message for the Deepgram socket.
class PcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = []
    this.length = 0
  }

  process(inputs) {
    const channel = inputs[0]?.[0]
    if (!channel) return true
    this.buffer.push(new Float32Array(channel))
    this.length += channel.length
    if (this.length >= 4096) {
      const pcm = new Int16Array(this.length)
      let offset = 0
      for (const chunk of this.buffer) {
        for (let i = 0; i < chunk.length; i++) {
          const s = Math.max(-1, Math.min(1, chunk[i]))
          pcm[offset++] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer])
      this.buffer = []
      this.length = 0
    }
    return true
  }
}

registerProcessor('pcm-worklet', PcmWorklet)
