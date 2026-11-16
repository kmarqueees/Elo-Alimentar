type Flag = 'hc' | 'reduce-motion'

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

export const getFlag = (flag: Flag) => read(`elo.${flag}`) === '1'

export function setFlag(flag: Flag, on: boolean) {
  write(`elo.${flag}`, on ? '1' : '0')
  document.documentElement.classList.toggle(flag, on)
}

export const getFontScale = () => Number(read('elo.font')) || 100

export function setFontScale(percent: number) {
  const value = Math.min(150, Math.max(80, percent))

  write('elo.font', String(value))
  document.documentElement.style.fontSize = `${value}%`

  return value
}

export function applyPrefs() {
  setFlag('hc', getFlag('hc'))
  setFlag('reduce-motion', getFlag('reduce-motion'))
  setFontScale(getFontScale())
}
