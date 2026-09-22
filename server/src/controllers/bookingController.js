import Joi from 'joi';
import bcrypt from 'bcryptjs';
import { Booking } from '../models/Booking.js';

// TODO: write a validation schema for create/update per README.md section 2.
const createSchema = Joi.object({
  //name: Joi.string().min(2).max(60).required(),  
  roomNumber: Joi.string().min(1).max(10).required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required().greater(Joi.ref('startDate')),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().hex().length(24).optional()
});

const updateSchema = Joi.object({
  roomNumber: Joi.string().min(1).max(10),
  startDate: Joi.date(),
  endDate: Joi.date().required().greater(Joi.ref('startDate')),
  purpose: Joi.string(),
  bookedBy: Joi.string().hex().length(24)
});
// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.
function publicBooking(b) { 
  return {
    id: b._id.toString(),
    roomNumber: b.roomNumber,
    startDate: b.startDate,
    endDate: b.endDate,
    purpose: b.purpose,
    bookedBy: b.bookedBy
      ? (b.bookedBy._id ? publicBooking(b.bookedBy) : b.bookedBy.toString())
      : null,
    createdAt: b.createdAt
  };
}
// GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find().populate('bookedBy', 'name email');
    res.json({ bookings: bookings.map(publicBooking) });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate('bookedBy', 'name email');
    if (!booking) return res.status(404).json({message: 'Booking not found'});
    res.json({ user: publicBooking(booking)});
  } catch (err) { next(err); }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await Booking.findOne({
      roomNumber: req.body.roomNumber,
      startDate: { $lt: req.body.endDate },
      endDate: { $gt: req.body.startDate }
    });

    if (conflict) {
      return res.status(409).json({ error: 'Room is already booked for that time' });
    }
    const booking = await Booking.create(value);
    res.status(201).json({booking: publicBooking(booking) });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (value.roomNumber || value.startDate || value.endDate) {
      const roomNumber = value.roomNumber ?? booking.roomNumber;
      const startDate = value.startDate ?? booking.startDate;
      const endDate = value.endDate ?? booking.endDate;

      const conflict = await Booking.findOne({
        _id: { $ne: bookingId }, // exclude itself
        roomNumber,
        startDate: { $lt: endDate },
        endDate: { $gt: startDate }
      });

      if (conflict) {
        return res.status(409).json({ error: 'Room is already booked for that time' });
      }
    }

    Object.assign(booking, value);
    await booking.save();
    res.json(publicBooking(booking)); // <-- this was missing

  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
  try {
    const doc = await Booking.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'User not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
