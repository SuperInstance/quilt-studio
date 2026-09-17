// The room-as-cell tenant — RFC 0001 (SuperInstance/quilt) takes a tile on
// the floor. The Tap is a cell: presence is Z_in, the air is Z_out, the tide
// is the vibe, the gossip is the murmur, the budget is double-entry, and the
// floor gives it an address — a position that IS the room, at a coarser
// resolution.

import { addressOf } from './address.mjs';

export function hostRoom(kernel, { name = 'room.tap', seat = 0 } = {}) {
  const address = addressOf(seat);
  kernel.bind(name, {
    kind: 'room',
    presence: [],        // Z_in: who is here
    air: [],             // Z_out: the broadcast
    tide: 0,             // vibe: -1 ebbing … +1 flowing
    weather: 'calm',
    budget: { gamma: 0, eta: 0 },   // double-entry: paid vs consumed
    next_predicted_visitor: null,   // JEPA
  }, {
    address,                       // the room's tile on the floor
    primitives: ['Z_in', 'Z_out', 'JEPA', 'DoubleEntry', 'Vibe', 'GC', 'Murmur', 'Graph'],
  });
  return { name, address };
}

// Presence and vibe degrade, never throw: admitting a patron to a room
// that was never hosted (or was unbound) returns false — rooms come and go.
export function admit(kernel, name, patron) {
  const room = kernel.view(name);
  if (!room) return false;
  room.presence.push(patron);
  kernel.bind(name, room);
  return true;
}

export function setTide(kernel, name, tide) {
  const room = kernel.view(name);
  if (!room) return false;
  room.tide = Math.max(-1, Math.min(1, tide));
  kernel.bind(name, room);
  return true;
}
