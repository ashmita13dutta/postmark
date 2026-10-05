import { describe, expect, it } from 'vitest'
import emojiData from '../src/data/emoji.json'
import { feelings } from '../src/data/feelings.json'
import { topics } from '../src/data/topics.json'
import { ambiguousForms, contextAt, detectMood, inflections, tokenize } from '../src/engine/mood'

const noon = { hour: 12, month: 3 }
const mood = (text, ctx = noon) => detectMood({ text, ...ctx })
const at = (iso) => new Date(iso).getTime() // local time when there is no Z

describe('inflections/tokenize', () => {
  it('expands a keyword into the forms people write', () => {
    expect(inflections('rain')).toEqual(
      expect.arrayContaining(['rain', 'rains', 'rained', 'raining']),
    )
    expect(inflections('dance')).toEqual(expect.arrayContaining(['dances', 'danced', 'dancing']))
    expect(inflections('story')).toEqual(expect.arrayContaining(['stories', 'storied']))
    expect(inflections('wish')).toContain('wishes')
    expect(inflections('toy')).toContain('toys') // vowel + y keeps its y
  })

  it('never lets a short word be mistaken for a longer one', () => {
    // "notes" must not match plain "not", and "longing" must not match "long"
    expect(mood('not long').topic).not.toBe('exams')
    expect(mood("I'm not tired at all").topicWords).toEqual([])
    expect(mood('a long meeting').feelingWords).toEqual([])
  })

  it('drops apostrophes and punctuation, lowercases, and numbers the sentences', () => {
    expect(tokenize("Didn't LIKE it. Bristi, bristi!!")).toEqual([
      { word: 'didnt', sentence: 0 },
      { word: 'like', sentence: 0 },
      { word: 'it', sentence: 0 },
      { word: 'bristi', sentence: 1 },
      { word: 'bristi', sentence: 1 },
    ])
  })
})

describe('data stays unambiguous', () => {
  it('no two entries both claim the same inflection (an exact keyword always wins)', () => {
    expect(ambiguousForms).toEqual([])
  })
})

describe('emoji data', () => {
  it('only names real feelings and topics, and no emoji belongs to two entries', () => {
    const seen = new Map()
    for (const [kind, ids, list] of [
      ['feelings', feelings, emojiData.feelings],
      ['topics', topics, emojiData.topics],
    ]) {
      for (const [id, emojis] of Object.entries(list)) {
        expect(Object.keys(ids), `${kind}.${id}`).toContain(id)
        for (const e of emojis) {
          const c = e.replace(/️/g, '')
          expect(seen.has(c), `${e} is in both ${seen.get(c)} and ${kind}.${id}`).toBe(false)
          seen.set(c, `${kind}.${id}`)
        }
      }
    }
  })
})

describe('topics carry a usual mood', () => {
  it.each(Object.keys(topics))('%s has a valid defaultFeeling', (id) => {
    expect(Object.keys(feelings)).toContain(topics[id].defaultFeeling)
  })
})

describe('detectMood: the design sample', () => {
  it('Rain at Elgin crossing, taxi wouldn’t start. Jhalmuri in a shop doorway.', () => {
    const r = mood("Rain at Elgin crossing, taxi wouldn't start. Jhalmuri in a shop doorway.")
    // four topics are mentioned once each (rain, taxi, jhalmuri, shop); the first one named wins
    expect(r.topic).toBe('rain')
    expect(r.topicWords).toEqual(['rain'])
    expect(r.secondaryTopic).not.toBeNull()
    const top = r.scores.topics.map(([id]) => id)
    expect(top[0]).toBe('rain')
    for (const id of top) expect(['streetfood', 'transport', 'rain', 'shopping']).toContain(id)
    expect(r.source.feeling).toBe('topic') // no feeling words: rain's usual mood
    expect(r.feeling).toBe(topics.rain.defaultFeeling)
  })
})

describe('detectMood: realistic notes', () => {
  // [note, feeling, topic]. Each was checked by eye; they guard against regressions.
  it.each([
    [
      'Finally got my results. Passed everything! Mum cried, Baba made payesh. Best day.',
      'joyful',
      'family',
    ],
    [
      'Could not focus at all. Deadline on Friday and nothing is done. Panicking.',
      'anxious',
      'exams',
    ],
    [
      'Missed Dadu today. Found his old letters in the almirah and read them all night.',
      'nostalgic',
      'family',
    ],
    ['Nothing happened today. Woke up, ate, scrolled on my phone, slept.', 'bored', 'tech'],
    [
      'First snow of the year! Hot chocolate and a blanket, watching movies all day.',
      'peaceful',
      'snow',
    ],
    [
      'Cooked biryani for the first time and it actually turned out delicious!',
      'joyful',
      'cooking',
    ],
    [
      'The pasta at that new place was soggy and cold. Total waste of money.',
      'disappointed',
      'food',
    ],
    [
      'Bad day. Everything went wrong, missed my metro, spilled coffee, boss yelled.',
      'disappointed',
      'transport',
    ],
    ['Cleaned the whole house and did laundry, finally tidy.', 'content', 'chores'],
    ['My cat knocked over the plant again 😂', 'joyful', 'pets'],
    [
      'Went shopping for Pujo, bought a red saree and bangles. Feeling so festive 🎉',
      'joyful',
      'shopping',
    ],
    ['Date with Arjun at the cafe, he brought me flowers 😍', 'loving', 'dating'],
    ['Played football with the boys, won 3-2!!', 'proud', 'sports'],
    ['Late night walk on the terrace, stars everywhere, felt calm.', 'peaceful', 'night'],
    ['I am not okay. Cried in the washroom at work.', 'sad', 'work'],
    ['sooo bored in class, the lecture was so dull', 'bored', 'school'],
  ])('%s', (text, feeling, topic) => {
    const r = mood(text, { hour: 15, month: 10 })
    expect([r.feeling, r.topic]).toEqual([feeling, topic])
  })

  it('understands forms like panicking, running and stopped', () => {
    expect(mood('Panicking all day').feeling).toBe('anxious')
    expect(mood('Went running this morning').topic).toBe('fitness')
    expect(inflections('stop')).toContain('stopped')
    expect(inflections('panic')).toEqual(expect.arrayContaining(['panicked', 'panicking']))
  })
})

describe('detectMood: feelings', () => {
  it.each([
    ['I am so happy today, everything was wonderful', 'joyful'],
    ['Feeling really tired and sleepy, just want to rest', 'tired'],
    ['So stressed and anxious about tomorrow', 'anxious'],
    ['I cried a lot, feeling empty and lonely', 'sad'],
    ['Furious. We argued and he yelled at me', 'angry'],
    ['I got promoted! So proud, we celebrated', 'proud'],
    ['I love him so much, my heart is full', 'loving'],
    ['Looking at old photos, remembering my childhood', 'nostalgic'],
    ['So grateful and thankful for my friends, truly blessed', 'grateful'],
    ['Bored. Same routine, nothing happened, meh', 'bored'],
    ['Daydreaming all afternoon, everything felt dreamy and ethereal', 'dreamy'],
    ['Cannot wait! So excited, the adventure begins tomorrow', 'excited'],
    ['Feeling calm and peaceful, just breathing slowly', 'peaceful'],
    ['I had an idea and felt so inspired and motivated', 'inspired'],
    ['The meal was awful, bland and overpriced. Such a letdown', 'disappointed'],
  ])('%s -> %s', (text, expected) => {
    expect(mood(text).feeling).toBe(expected)
  })
})

describe('detectMood: topics', () => {
  it.each([
    ['Bought the cutest dress at the mall', 'shopping'],
    ['Revision for the exam, viva tomorrow', 'exams'],
    ['Finished the report, then a long meeting with the client', 'work'],
    ['Walked the dog in the park, the puppy loved it', 'pets'],
    ['Birthday cake and gifts, it was her birthday', 'birthday'],
    ['Took the metro and a cab to the airport', 'transport'],
    ['Phuchka and jhalmuri at the stall', 'streetfood'],
    ['Binged a series on netflix all evening', 'movies'],
    ['Practice for the cricket match, the team coach was strict', 'sports'],
    ['Fever and a headache, saw the doctor, took medicine', 'health'],
    ['Pujo pandal hopping, dhak and dhunuchi', 'festival'],
    ['Walked on the beach, the waves and sand', 'beach'],
    ['Sweater and a scarf, it was freezing, a blanket by the heater', 'winter'],
  ])('%s -> %s', (text, expected) => {
    expect(mood(text).topic).toBe(expected)
  })
})

describe('detectMood: combined days', () => {
  it('shopping on a happy day', () => {
    const r = mood('Bought the cutest dress at the mall, so happy!')
    expect([r.feeling, r.topic]).toEqual(['joyful', 'shopping'])
  })

  it('exams on a stressful day', () => {
    const r = mood("Exam tomorrow and I'm so stressed, couldn't study")
    expect([r.feeling, r.topic]).toEqual(['anxious', 'exams'])
  })

  it('a bad meal', () => {
    const r = mood('The biryani was cold and bland, such a letdown')
    expect([r.feeling, r.topic]).toEqual(['disappointed', 'food'])
  })

  it('a first date', () => {
    const r = mood('Our first date, he held my hand and I felt butterflies')
    expect([r.feeling, r.topic]).toEqual(['loving', 'dating'])
  })
})

describe('detectMood: negation', () => {
  it('"not happy" does not count as joyful, it leans disappointed', () => {
    const r = mood('I was not happy with how it went')
    expect(r.feeling).toBe('disappointed')
    expect(r.feelingWords).toEqual(['not happy'])
  })

  it('works with contractions ("didn\'t enjoy"-style) and "never"', () => {
    expect(mood("It wasn't fun at all").feeling).toBe('disappointed')
    expect(mood('Never been so excited').feeling).not.toBe('excited') // negated, so it is not counted
  })

  it('negating a bad feeling is ignored, not flipped', () => {
    const r = mood("I'm not tired at all")
    expect(r.feeling).not.toBe('tired')
    expect(r.source.feeling).toBe('default')
  })

  it('negating a topic ignores it ("no exams")', () => {
    expect(mood('No exams today, just a walk in the park').topic).not.toBe('exams')
  })

  it('negation does not leak across sentences', () => {
    expect(mood('I did not sleep. Happy though, so happy').feeling).toBe('joyful')
  })
})

describe('detectMood: how the note ends matters', () => {
  it('"but" shifts weight to what comes after', () => {
    expect(mood('Stressed and anxious all morning but in the end I was so happy').feeling).toBe(
      'joyful',
    )
    expect(mood('So happy this morning but then I got stressed and anxious').feeling).toBe(
      'anxious',
    )
  })

  it('a tie goes to what was said last', () => {
    expect(mood('Sad and happy').feeling).toBe('joyful')
    expect(mood('Happy and sad').feeling).toBe('sad')
  })

  it('intensifiers add weight', () => {
    const plain = mood('happy').scores.feelings[0][1]
    const intense = mood('so happy').scores.feelings[0][1]
    expect(intense).toBeGreaterThan(plain)
  })
})

describe('detectMood: phrases and emoji', () => {
  it('matches two-word phrases as one word', () => {
    expect(mood('We had ice cream by the river').topic).toBe('dessert')
    expect(mood('A road trip with friends').topicWords).toContain('road trip')
  })

  it('reads emoji', () => {
    expect(mood('Date night 😍😍').feeling).toBe('loving')
    expect(mood('So done 😴').feeling).toBe('tired')
    expect(mood('Finally home 🎉🥳').topic).toBe('party')
    expect(mood('Slept all day 🤒').topic).toBe('health')
  })

  it('ignores emoji variation selectors', () => {
    expect(mood('rainy ❄️').topic).toBeDefined()
    expect(mood('pure ❄️❄️').topic).toBe('snow')
  })
})

describe('detectMood: fallbacks', () => {
  it('empty or meaningless notes get a default feeling and a time/season topic', () => {
    for (const text of ['', '   ', 'zzz qqq', '12345']) {
      const r = mood(text)
      expect(r.feeling).toBe('content')
      expect(r.source).toEqual({ feeling: 'default', topic: 'season' })
      expect(r.confidence).toEqual({ feeling: 'none', topic: 'none' })
    }
  })

  it('falls back to night in the small hours, otherwise to the month', () => {
    expect(mood('', { hour: 2, month: 3 })).toMatchObject({
      topic: 'night',
      source: { topic: 'time' },
    })
    expect(mood('', { hour: 12, month: 1 }).topic).toBe('winter')
    expect(mood('', { hour: 12, month: 9, profile: 'kolkata' }).topic).toBe('rain')
    expect(mood('', { hour: 12, month: 9 }).topic).toBe('autumn')
  })

  it('an unknown profile uses the active one', () => {
    expect(mood('', { hour: 12, month: 1, profile: 'nowhere' }).topic).toBe('winter')
  })

  it('a topic with no feeling words borrows its usual mood', () => {
    const r = mood('Long meeting and a lot of email')
    expect(r.topic).toBe('work')
    expect(r.source.feeling).toBe('topic')
    expect(r.feeling).toBe(topics.work.defaultFeeling)
  })

  it('a night topic wins a tie in the small hours, but never beats a clear winner', () => {
    // one hit each: "moon" (night) and "sandwich" (food)
    expect(mood('moon and a sandwich', { hour: 23, month: 3 }).topic).toBe('night')
    // two food words against one night word: food wins at any hour
    expect(mood('moon, a sandwich and a pizza', { hour: 23, month: 3 }).topic).toBe('food')
  })

  it('on a topic tie, the topic mentioned first wins', () => {
    expect(mood('a cake and a restaurant').topic).toBe('birthday')
    expect(mood('a restaurant and a cake').topic).toBe('food')
  })
})

describe('detectMood: shape and safety', () => {
  it('always returns a real feeling and topic', () => {
    const texts = [
      '',
      'a',
      '!!!',
      'rain rain rain',
      '😍😍😍😍😍😍😍😍',
      'x '.repeat(5000),
      'NOT NOT NOT happy',
    ]
    for (const text of texts) {
      const r = mood(text)
      expect(Object.keys(feelings)).toContain(r.feeling)
      expect(Object.keys(topics)).toContain(r.topic)
    }
  })

  it('is deterministic', () => {
    const t = 'Rain, chai, and a book. Not stressed, just peaceful.'
    expect(mood(t)).toEqual(mood(t))
  })

  it('repeating a word helps but with diminishing returns', () => {
    const once = mood('happy').scores.feelings[0][1]
    const thrice = mood('happy happy happy').scores.feelings[0][1]
    expect(thrice).toBeGreaterThan(once)
    expect(thrice).toBeLessThan(once * 3)
  })

  it('reports confidence', () => {
    expect(mood('so happy and wonderful, an amazing fantastic day').confidence.feeling).toBe('high')
    expect(mood('happy').confidence.feeling).toBe('low')
  })
})

describe('contextAt', () => {
  it('gives the local hour and month', () => {
    expect(contextAt(at('2026-10-01T09:30'))).toEqual({ hour: 9, month: 10 })
    expect(contextAt(at('2026-12-31T23:59'))).toEqual({ hour: 23, month: 12 })
  })
})

describe('detectMood: energy', () => {
  it('an emphatic happy note is vivid, a mild one is soft', () => {
    expect(mood('Went shopping, so happy!').energy).toBe('vivid')
    expect(mood('so happy and wonderful').energy).toBe('vivid')
    expect(mood('It was a nice quiet day. Happy.').energy).toBe('soft')
  })

  it('quiet feelings are always soft, however emphatic', () => {
    expect(mood('So tired!!! Completely exhausted!').energy).toBe('soft')
    expect(mood('So sad. So lonely!').energy).toBe('soft')
    expect(mood('Calm and peaceful, so relaxed!').energy).toBe('soft')
  })

  it('loud feelings can be vivid too', () => {
    expect(mood('We won the match!').energy).toBe('vivid')
    expect(mood("I'm furious, so angry!").energy).toBe('vivid')
  })

  it('no words, no energy', () => {
    expect(mood('').energy).toBe('soft')
  })
})

describe('detectMood: real notes from a phone', () => {
  it('"peaceful yet tiring": the turn at "yet" shifts the day to tired', () => {
    const r = mood(
      'Today college classes were over early in the day and got to feel the hot summer loo on my way home. It was peaceful yet tiring',
      { hour: 17, month: 5 },
    )
    expect(r.feeling).toBe('tired')
    expect(r.topic).toBe('school')
    expect(r.secondaryTopic).toBe('heat') // "loo" is the hot summer wind
  })

  it('a coffee that was the best, and rain on the way back', () => {
    const r = mood('I had the best coffee the other day. It rained on the way back')
    expect([r.feeling, r.topic]).toEqual(['joyful', 'drinks'])
    expect(r.secondaryTopic).toBe('rain')
  })

  it('"fatigue and confused" under heavy work is not "content"', () => {
    const r = mood('I have tons of project dues and loads of work Feeling fatigue and confused')
    expect(r.topic).toBe('work')
    expect(['anxious', 'tired']).toContain(r.feeling)
    expect(r.source.feeling).toBe('words')
  })
})

describe('detectMood: everyday vocabulary', () => {
  it.each([
    ['I feel so overwhelmed and confused about everything', 'anxious'],
    ['Totally drained, such an exhausting day', 'tired'],
    ['Feeling miserable and upset all evening', 'sad'],
    ['He was so rude, I was livid and cranky', 'angry'],
    ['Absolutely fabulous day, I enjoyed every minute', 'joyful'],
    ['Finally relieved, everything is sorted and manageable', 'content'],
    ['Feeling refreshed and rejuvenated after the nap', 'peaceful'],
    ['Cannot wait for tomorrow, looking forward to it', 'excited'],
    ['A real accomplishment, I smashed my goals', 'proud'],
    ['It felt bittersweet, such a flashback', 'nostalgic'],
    ['That movie was a disaster, so unimpressed and it sucked', 'disappointed'],
    ['Pointless dull day, everything is so monotonous', 'bored'],
    ['Lost in an epiphany, full of creativity and imagination', 'inspired'],
  ])('%s -> %s', (text, expected) => {
    expect(mood(text).feeling).toBe(expected)
  })
})
