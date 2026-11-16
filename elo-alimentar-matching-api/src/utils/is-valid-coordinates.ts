export function isValidCoordinates(latitude: number, longitude: number) {
  return (
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
  )
}
