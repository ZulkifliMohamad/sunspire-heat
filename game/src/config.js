// Sunspire Heat — every tuning number and colour in one place.
// The city is a grid of streets; all distances are metres, all times seconds.
export const STEP = 1 / 60;
export const SAVE_KEY = 'sunspire-heat.save.v1';

// City grid: streets run at these coordinates on both axes (metres from centre).
export const CITY = {
  streets: [-154, -110, -66, -22, 22, 66, 110, 154],
  spacing: 44,
  roadHalf: 5.5,
  lane: 2.75,
  bound: 190,
  blockInset: 9,
};

export const PALETTE = {
  skyTop: 0x3f8fd2,
  skyHorizon: 0xffd9a0,
  sun: 0xffe3b3,
  ground: 0x8a7f6a,
  road: 0x2e2e33,
  roadLine: 0xf5d76e,
  sidewalk: 0xb8ab90,
  building: [0xe8b48a, 0xd98f6a, 0xc97b5e, 0x9db8c4, 0xe0cfa8, 0xb98a6e, 0x7fa3b0, 0xd9a441],
  glass: 0x2b4a5e,
  park: 0x6f9e5a,
  water: 0x2f7fa8,
  car: [0xd23b2e, 0x2e6fd2, 0xe8c832, 0x3aa655, 0xe8e4da, 0x222226, 0x7a4fd0, 0xd2691e],
  police: 0x1c2733,
  player: 0x2e6fd2,
  marker: 0xffc21c,
  text: '#f5efe2',
  muted: '#c9bfa8',
  danger: '#ff5a4e',
  cash: '#ffd24d',
};

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 11,
  accel: 40,
  jumpSpeed: 8.5,
  gravity: 24,
  radius: 0.6,
  maxHealth: 100,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 9,
  maxSpeed: 38,
  maxReverse: 10,
  drag: 0.55,
  steer: 1.9,
  handbrakeTurn: 3.2,
  handbrakeDrag: 1.6,
};

export const TRAFFIC = { cars: 14, peds: 26, carSpeed: 9, pedSpeed: 1.6 };

export const POLICE = {
  maxCars: 5,
  accel: 19,
  maxSpeed: 40,
  ramRange: 3.2,
  bustRange: 3.0,
  bustTime: 2.2,
  heatDecay: 0.06,
  spawnDelay: 2.5,
};

export const COMBAT = {
  range: 60,
  damage: 34,
  cooldown: 0.28,
  enemyHealth: 100,
  enemyDamage: 8,
  enemyRange: 34,
  enemyShotDelay: 1.1,
};

export const WANTED = { steal: 1, shoot: 1, hitPed: 1, max: 5 };

export const MISSIONS = [
  {
    name: 'First Wheels',
    brief: 'Dario needs wheels. Borrow a parked car and bring it to the marina marker.',
    payout: 500,
    kind: 'steal-drive',
  },
  {
    name: 'Sunset Courier',
    brief: 'A package, three drops, ninety seconds. Drive through every glowing ring in order.',
    payout: 800,
    kind: 'checkpoints',
  },
  {
    name: 'Strip Showdown',
    brief: 'Rivals hold the plaza. Get out on foot and clear all four of them.',
    payout: 1200,
    kind: 'shootout',
  },
  {
    name: 'The Big Score',
    brief: 'Hit the bank, grab the cash, then lose a four-star heat and reach the safehouse.',
    payout: 2500,
    kind: 'heist',
  },
];

export const STORY = {
  hero: 'Rook',
  fixer: 'Dario',
  city: 'Sunspire',
  intro:
    'Rook came back to Sunspire with empty pockets and a name nobody remembers. Dario has work, if Rook has nerve.',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
