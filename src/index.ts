import { Context, Random, Schema } from 'koishi'

import zhCNLocale from './locales/zh-CN.yml'

export const name = 'sayo-roll'
export const inject = []

export interface Config {
  blockWords: string[]
}

// prettier-ignore
const defaultBlockWords = [
  '打胶', '傻逼', '做爱', 'sb', '打炮', '打飞机', '打枪', '自慰', '鸡巴', '鸡吧', '鸡把',
  '鸡鸡', '自杀', '去世', '紫砂', '屌', '破处', '处女',
]
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    blockWords: Schema.array(Schema.string()).default(defaultBlockWords),
  }),
]).i18n({
  'zh-CN': zhCNLocale._config,
  zh: zhCNLocale._config,
})

export function matchRegExps<
  T,
  R extends RegExp = RegExp,
  F extends (r: RegExpExecArray) => T = (r: RegExpExecArray) => T,
>(str: string, regexps: (readonly [R, F])[]): T | void {
  for (const [r, f] of regexps) {
    const m = r.exec(str)
    if (!m) continue
    return f(m)
  }
}

export const leftQuotes = [`"`, `'`, `“`, `‘`]
export const rightQuotes = [`"`, `'`, `”`, `’`]

export function parseArgs(text: string): string[] {
  const args: string[] = []

  let arg = ''
  let currentRight: string | null = null
  for (const char of text) {
    if (char === '\\') {
      arg += char
    } else if (arg.slice(-1) === '\\') {
      arg = arg.slice(0, -1) + char
    } else if (!currentRight && leftQuotes.includes(char)) {
      currentRight = rightQuotes[leftQuotes.indexOf(char)]
    } else if (char === currentRight || (!currentRight && char.match(/\s/))) {
      currentRight = null
      if (arg) {
        args.push(arg)
        arg = ''
      }
    } else {
      arg += char
    }
  }
  if (currentRight) throw new TypeError('unmatched quote')
  if (arg) args.push(arg)

  return args
}

export function replaceMy(text: string): string {
  return text.replace('我', '你')
}

export function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh-CN', zhCNLocale)
  ctx.i18n.define('zh', zhCNLocale)

  ctx.command(`${name} <args:text>`).action(({ session }, arg) => {
    if (!session) return

    if (!arg) {
      return session.text('.roll-integer', [Random.int(1, 100)])
    }

    for (const word of config.blockWords) {
      if (arg.includes(word)) return session.text('.block-word')
    }

    const res = matchRegExps<string>(arg, [
      [
        /^(?<int>\d+)$/,
        (match) => {
          const max = parseInt(match.groups!.int)
          if (max <= 1) return session.text('.number-too-small')
          return session.text('.roll-integer', [Random.int(1, max + 1)])
        },
      ],
      [
        // 我是不是耳聋 => { prefix: '我', word: '是', type: '不', suffix: '耳聋' }
        // 我今天吃没吃 => { prefix: '我今天', word: '吃', type: '没', suffix: '' }
        /^(?<prefix>.*)(?<word>.+)(?<type>不|没)(\k<word>)(?<suffix>.*)([呀呢啊])?([？\?！!]*)?$/,
        (match) => {
          const prefix = replaceMy(match.groups!.prefix)
          const suffix = replaceMy(match.groups!.suffix)
          const { word, type } = match.groups!
          const result = Random.bool(0.5)
          return session.text('.i-think', [
            type === '不'
              ? // 我是不是耳聋 => 你是耳聋 / 你不是耳聋
                `${prefix}${result ? '' : '不'}${word}${suffix}`
              : // 我今天吃没吃 => 你今天吃了 / 你今天没吃
                `${prefix}${result ? '' : '没'}${word}${result ? '了' : ''}${suffix}`,
          ])
        },
      ],
      [
        /^(?<prefix>.*)还是(?<suffix>.*)([呀呢啊])?([？\?]*)?$/,
        (match) =>
          session.text('.surely', [
            Random.pick([
              replaceMy(match.groups!.prefix),
              replaceMy(match.groups!.suffix),
            ]),
          ]),
      ],
      [
        /^(?<name>.+?)的?概率([是|为])?([？\?]*)?$/,
        (match) =>
          session.text('.probability', [
            replaceMy(match.groups!.name),
            (Math.random() * 100).toFixed(2),
          ]),
      ],
    ])
    if (res) return res

    let args: string[]
    try {
      args = parseArgs(arg).map(replaceMy)
    } catch (e) {
      ctx.logger.debug(e)
      return session.text('.invalid-arg')
    }
    // ctx.logger.debug(args)

    if (args.length < 2) {
      return session.text('.invalid-arg')
    }
    return Random.pick(args)
  })
}
