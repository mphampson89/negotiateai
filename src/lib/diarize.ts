// Diarization helpers. Deepgram (with diarize=true) tags each word with an integer
// `speaker` index but never tells us WHO that speaker is — so we only separate and
// colour voices here, we don't try to decide which one is the user.

export interface DeepgramWord {
  word?: string
  punctuated_word?: string
  speaker?: number
}

export interface SpeakerSegment {
  speaker: number
  text: string
}

// Group a final result's words into consecutive same-speaker runs.
export function segmentBySpeaker(words: DeepgramWord[]): SpeakerSegment[] {
  const segments: SpeakerSegment[] = []
  for (const w of words) {
    const token = (w.punctuated_word ?? w.word ?? '').trim()
    if (!token) continue
    const speaker = w.speaker ?? 0
    const last = segments[segments.length - 1]
    if (last && last.speaker === speaker) {
      last.text += ' ' + token
    } else {
      segments.push({ speaker, text: token })
    }
  }
  return segments
}

// Distinct colour per speaker; wraps for >6 speakers (a room never realistically hits that).
const SPEAKER_COLORS = ['#60a5fa', '#fbbf24', '#34d399', '#f472b6', '#a78bfa', '#fb923c']

export function speakerColor(speaker: number): string {
  return SPEAKER_COLORS[speaker % SPEAKER_COLORS.length]
}

export function speakerLabel(speaker: number): string {
  return `S${speaker + 1}`
}
