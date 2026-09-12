import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { appointmentApiErrorMessage } from '../appointment-api-error.js'

describe('appointment API error mapping', () => {
  it('surfaces slot conflicts instead of a generic Failed', () => {
    assert.equal(
      appointmentApiErrorMessage(409, { success: false, message: 'Dr. already has an appointment at 10:00 AM' }),
      'Dr. already has an appointment at 10:00 AM',
    )
    assert.equal(
      appointmentApiErrorMessage(409, { error: 'This slot is already booked. Choose another time.' }),
      'This slot is already booked. Choose another time.',
    )
    assert.equal(
      appointmentApiErrorMessage(409, {}),
      'This slot is already booked. Choose another time.',
    )
  })

  it('maps auth and missing-patient failures', () => {
    assert.match(appointmentApiErrorMessage(401, {}), /not signed in/i)
    assert.match(appointmentApiErrorMessage(404, { error: 'Not found' }), /Not found/)
    assert.match(appointmentApiErrorMessage(500, {}), /Server error/)
  })
})
