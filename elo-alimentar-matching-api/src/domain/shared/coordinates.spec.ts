import { describe, expect, it } from 'vitest'
import { Coordinates } from './coordinates'
import { InvalidCoordinatesError } from './errors/invalid-coordinates-error'

describe('Coordinates (value object)', () => {
  it('aceita os limites e rejeita valores fora deles ou NaN', () => {
    expect(() => Coordinates.create(90, 180)).not.toThrow()
    expect(() => Coordinates.create(-90, -180)).not.toThrow()
    expect(() => Coordinates.create(90.1, 0)).toThrow(InvalidCoordinatesError)
    expect(() => Coordinates.create(0, -180.1)).toThrow(InvalidCoordinatesError)
    expect(() => Coordinates.create(Number.NaN, 0)).toThrow(InvalidCoordinatesError)
  })

  it('é imutável e comparado por valor', () => {
    const a = Coordinates.create(-3.1, -60)

    expect(a.equals(Coordinates.create(-3.1, -60))).toBe(true)
    expect(Object.isFrozen(a)).toBe(true)
  })

  it('calcula a distância em km (0,009° de latitude ≈ 1 km)', () => {
    const origin = Coordinates.create(-3.1, -60)

    expect(origin.distanceTo(origin)).toBe(0)
    expect(origin.distanceTo({ latitude: -3.1 + 0.009, longitude: -60 })).toBeCloseTo(1, 1)
  })
})
