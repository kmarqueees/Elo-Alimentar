import { InvalidCoordinatesError } from './errors/invalid-coordinates-error'

export interface GeoPoint {
  latitude: number
  longitude: number
}

/** Value Object: imutável, comparado por valor e sempre válido. */
export class Coordinates implements GeoPoint {
  private constructor(
    readonly latitude: number,
    readonly longitude: number,
  ) {
    Object.freeze(this)
  }

  static create(latitude: number, longitude: number) {
    const valid =
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180

    if (!valid) {
      throw new InvalidCoordinatesError()
    }

    return new Coordinates(latitude, longitude)
  }

  /** Distância em km pela fórmula do cosseno esférico. */
  static distanceKm(from: GeoPoint, to: GeoPoint) {
    if (from.latitude === to.latitude && from.longitude === to.longitude) {
      return 0
    }

    const fromRadian = (Math.PI * from.latitude) / 180
    const toRadian = (Math.PI * to.latitude) / 180

    const theta = from.longitude - to.longitude
    const radTheta = (Math.PI * theta) / 180

    let dist =
      Math.sin(fromRadian) * Math.sin(toRadian) +
      Math.cos(fromRadian) * Math.cos(toRadian) * Math.cos(radTheta)

    if (dist > 1) {
      dist = 1
    }

    dist = Math.acos(dist)
    dist = (dist * 180) / Math.PI
    dist = dist * 60 * 1.1515
    dist = dist * 1.609344

    return dist
  }

  distanceTo(other: GeoPoint) {
    return Coordinates.distanceKm(this, other)
  }

  equals(other: GeoPoint) {
    return this.latitude === other.latitude && this.longitude === other.longitude
  }
}
