import { describe, it, expect } from 'vitest'
import { segmentBySpeaker, speakerColor, speakerLabel } from './diarize'

describe('segmentBySpeaker', () => {
  it('returns [] for no words', () => {
    expect(segmentBySpeaker([])).toEqual([])
  })

  it('joins consecutive words from one speaker into a single segment', () => {
    const segs = segmentBySpeaker([
      { word: 'hold', speaker: 0 },
      { word: 'your', speaker: 0 },
      { word: 'number', speaker: 0 },
    ])
    expect(segs).toEqual([{ speaker: 0, text: 'hold your number' }])
  })

  it('splits when the speaker changes', () => {
    const segs = segmentBySpeaker([
      { word: 'take', speaker: 0 },
      { word: 'it', speaker: 0 },
      { word: 'no', speaker: 1 },
      { word: 'deal', speaker: 1 },
    ])
    expect(segs).toEqual([
      { speaker: 0, text: 'take it' },
      { speaker: 1, text: 'no deal' },
    ])
  })

  it('starts a new segment when a speaker returns', () => {
    const segs = segmentBySpeaker([
      { word: 'a', speaker: 0 },
      { word: 'b', speaker: 1 },
      { word: 'c', speaker: 0 },
    ])
    expect(segs.map((s) => s.speaker)).toEqual([0, 1, 0])
  })

  it('prefers punctuated_word over word', () => {
    const segs = segmentBySpeaker([
      { word: 'okay', punctuated_word: 'Okay,', speaker: 0 },
      { word: 'fine', punctuated_word: 'fine.', speaker: 0 },
    ])
    expect(segs).toEqual([{ speaker: 0, text: 'Okay, fine.' }])
  })

  it('defaults a missing speaker to 0', () => {
    expect(segmentBySpeaker([{ word: 'hi' }])).toEqual([{ speaker: 0, text: 'hi' }])
  })

  it('skips empty/whitespace tokens', () => {
    const segs = segmentBySpeaker([
      { word: 'real', speaker: 0 },
      { word: '   ', speaker: 0 },
      { word: '', speaker: 0 },
      { word: 'words', speaker: 0 },
    ])
    expect(segs).toEqual([{ speaker: 0, text: 'real words' }])
  })
})

describe('speakerColor / speakerLabel', () => {
  it('labels are 1-based', () => {
    expect(speakerLabel(0)).toBe('S1')
    expect(speakerLabel(1)).toBe('S2')
  })

  it('colors are stable and wrap', () => {
    expect(speakerColor(0)).toBe(speakerColor(6))
    expect(speakerColor(0)).not.toBe(speakerColor(1))
  })
})
