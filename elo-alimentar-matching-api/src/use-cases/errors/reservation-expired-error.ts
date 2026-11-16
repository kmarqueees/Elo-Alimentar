export class ReservationExpiredError extends Error {
  constructor() {
    super('Reservation has expired.')
  }
}
