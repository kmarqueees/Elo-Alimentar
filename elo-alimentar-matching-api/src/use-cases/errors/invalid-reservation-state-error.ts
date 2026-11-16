export class InvalidReservationStateError extends Error {
  constructor() {
    super('Reservation is not in a state that allows this action.')
  }
}
