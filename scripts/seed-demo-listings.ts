import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
config()

interface DemoAmenity {
  name: string
}

interface DemoRoomType {
  name: string
  description: string
  basePrice: number
  compareAtPrice?: number
  maxOccupancy: number
  bedConfiguration: string
  sizeSqft: number
  rooms: string[]
}

interface DemoProperty {
  slug: string
  name: string
  propertyType: 'hotel' | 'resort'
  tier: 'budget' | 'standard' | 'premium' | 'flagship'
  starRating?: number
  city: string
  area: string
  streetAddress: string
  postcode?: string
  location?: [number, number]
  description: string[]
  amenities: string[]
  trustBadges: string[]
  isFeatured?: boolean
  featuredPriority?: number
  avgRating: number
  reviewCount: number
  images: string[]
  roomTypes: DemoRoomType[]
}

const AMENITIES: DemoAmenity[] = [
  { name: 'Free WiFi' },
  { name: 'Swimming Pool' },
  { name: 'Beachfront' },
  { name: 'Free Breakfast' },
  { name: 'Spa & Wellness' },
  { name: 'Fitness Center' },
  { name: 'Restaurant' },
  { name: 'Air Conditioning' },
  { name: 'Free Parking' },
  { name: 'Room Service' },
  { name: 'Sea View' },
  { name: 'Airport Shuttle' },
]

const IMAGE_DIR = resolve('scripts/seed-images')

const DEMO_PROPERTIES: DemoProperty[] = [
  {
    slug: 'azure-wave-beach-resort-coxs-bazar',
    name: 'Azure Wave Beach Resort & Spa',
    propertyType: 'resort',
    tier: 'flagship',
    starRating: 5,
    city: "Cox's Bazar",
    area: 'Marine Drive, Inani',
    streetAddress: 'Marine Drive Road, Inani Beach',
    postcode: '4730',
    location: [91.9498, 21.3136],
    description: [
      'Set on a private stretch of Inani Beach, Azure Wave blends barefoot luxury with warm Bangladeshi hospitality. Wake to the Bay of Bengal from your sea-facing balcony, then drift down to the infinity pool that seems to spill into the ocean.',
      'Evenings bring sunset barbecues on the sand, live acoustic sessions, and the signature spa built around natural sea salt therapies.',
    ],
    amenities: ['Free WiFi', 'Swimming Pool', 'Beachfront', 'Spa & Wellness', 'Restaurant', 'Sea View', 'Free Breakfast', 'Air Conditioning'],
    trustBadges: ['platform_serviced', 'free_cancellation', 'breakfast_included'],
    isFeatured: true,
    featuredPriority: 100,
    avgRating: 4.8,
    reviewCount: 214,
    images: ['resort-island.jpg', 'resort-pool.jpg', 'room-deluxe.jpg'],
    roomTypes: [
      {
        name: 'Deluxe Sea View Room',
        description: 'King bed, private balcony facing the Bay of Bengal, rain shower and morning tea service.',
        basePrice: 14500,
        compareAtPrice: 18900,
        maxOccupancy: 2,
        bedConfiguration: '1 King Bed',
        sizeSqft: 420,
        rooms: ['301', '302', '303', '304'],
      },
      {
        name: 'Beachfront Family Suite',
        description: 'Two bedrooms with a shared lounge, direct beach access and a soaking tub for four.',
        basePrice: 26500,
        compareAtPrice: 32000,
        maxOccupancy: 4,
        bedConfiguration: '1 King + 2 Twin Beds',
        sizeSqft: 780,
        rooms: ['401', '402'],
      },
      {
        name: 'Garden View Room',
        description: 'Cozy retreat overlooking the coconut grove, ideal for short seaside escapes.',
        basePrice: 9800,
        maxOccupancy: 2,
        bedConfiguration: '1 Queen Bed',
        sizeSqft: 340,
        rooms: ['201', '202', '203'],
      },
    ],
  },
  {
    slug: 'long-beach-hotel-coxs-bazar',
    name: 'Long Beach Hotel',
    propertyType: 'hotel',
    tier: 'premium',
    starRating: 4,
    city: "Cox's Bazar",
    area: 'Kolatoli',
    streetAddress: 'Kolatoli Road, Beach Side',
    postcode: '4700',
    location: [91.9668, 21.4272],
    description: [
      'A landmark on Kolatoli Point, Long Beach Hotel puts you steps from the surf and minutes from the busiest stretch of the world\'s longest natural sea beach.',
      'Rooftop dining, a heated pool and spacious sea-facing rooms make it a favourite for families and weekend travellers alike.',
    ],
    amenities: ['Free WiFi', 'Swimming Pool', 'Restaurant', 'Room Service', 'Free Parking', 'Air Conditioning'],
    trustBadges: ['platform_serviced', 'free_cancellation'],
    featuredPriority: 60,
    avgRating: 4.4,
    reviewCount: 389,
    images: ['hotel-room.jpg', 'resort-pool2.jpg'],
    roomTypes: [
      {
        name: 'Superior Double Room',
        description: 'Bright double room with partial sea views and a work desk.',
        basePrice: 7200,
        compareAtPrice: 9100,
        maxOccupancy: 2,
        bedConfiguration: '1 Queen Bed',
        sizeSqft: 320,
        rooms: ['501', '502', '503', '504', '505'],
      },
      {
        name: 'Executive Sea View Twin',
        description: 'Twin beds, balcony over Kolatoli Point, complimentary minibar.',
        basePrice: 9600,
        maxOccupancy: 3,
        bedConfiguration: '2 Twin Beds',
        sizeSqft: 380,
        rooms: ['601', '602', '603'],
      },
    ],
  },
  {
    slug: 'coral-sand-retreat-saint-martin',
    name: 'Coral Sand Retreat',
    propertyType: 'resort',
    tier: 'premium',
    starRating: 4,
    city: "Saint Martin's Island",
    area: 'West Beach',
    streetAddress: 'West Beach Path, Saint Martin',
    location: [92.3182, 20.6271],
    description: [
      'Caribbean-blue water, coral shallows and palm-shaded bungalows — Coral Sand Retreat is the island\'s quiet luxury hideaway.',
      'Solar-powered rooms, fresh seafood caught each morning, and stargazing decks away from the main jetty.',
    ],
    amenities: ['Free WiFi', 'Beachfront', 'Sea View', 'Restaurant', 'Free Breakfast'],
    trustBadges: ['platform_serviced', 'breakfast_included'],
    featuredPriority: 40,
    avgRating: 4.6,
    reviewCount: 96,
    images: ['resort-bungalow.jpg', 'beach-water.jpg'],
    roomTypes: [
      {
        name: 'Ocean Bungalow',
        description: 'Thatched-roof bungalow ten steps from the water with hammock veranda.',
        basePrice: 11200,
        compareAtPrice: 14000,
        maxOccupancy: 2,
        bedConfiguration: '1 Queen Bed',
        sizeSqft: 300,
        rooms: ['B1', 'B2', 'B3', 'B4'],
      },
      {
        name: 'Coral Twin Cottage',
        description: 'Airy cottage with two twin beds, perfect for dive buddies.',
        basePrice: 8400,
        maxOccupancy: 2,
        bedConfiguration: '2 Twin Beds',
        sizeSqft: 260,
        rooms: ['C1', 'C2', 'C3'],
      },
    ],
  },
  {
    slug: 'tea-valley-resort-sylhet',
    name: 'Tea Valley Resort',
    propertyType: 'resort',
    tier: 'premium',
    starRating: 4,
    city: 'Sylhet',
    area: 'Srimangal',
    streetAddress: 'Moulvibazar Road, Srimangal Tea Estates',
    location: [91.7296, 24.3065],
    description: [
      'Wrapped by emerald tea gardens, Tea Valley Resort offers misty mornings, seven-layer tea tastings and guided walks through Ratargul\'s swamp forest.',
      'The hilltop infinity pool looks over endless rows of tea bushes.',
    ],
    amenities: ['Free WiFi', 'Swimming Pool', 'Spa & Wellness', 'Restaurant', 'Free Parking', 'Free Breakfast'],
    trustBadges: ['platform_serviced', 'free_cancellation'],
    isFeatured: true,
    featuredPriority: 80,
    avgRating: 4.7,
    reviewCount: 158,
    images: ['resort-tea.jpg', 'resort-hill.jpg', 'room-bed.jpg'],
    roomTypes: [
      {
        name: 'Tea Garden Villa',
        description: 'Standalone villa with panoramic garden views and fireplace lounge.',
        basePrice: 12800,
        compareAtPrice: 15500,
        maxOccupancy: 3,
        bedConfiguration: '1 King Bed',
        sizeSqft: 520,
        rooms: ['V1', 'V2', 'V3'],
      },
      {
        name: 'Hillside Deluxe Room',
        description: 'Warm timber interiors overlooking the estate trails.',
        basePrice: 8900,
        maxOccupancy: 2,
        bedConfiguration: '1 Queen Bed',
        sizeSqft: 360,
        rooms: ['201', '202', '203', '204'],
      },
    ],
  },
  {
    slug: 'grand-sylhet-hotel',
    name: 'Grand Sylhet Hotel',
    propertyType: 'hotel',
    tier: 'premium',
    starRating: 4,
    city: 'Sylhet',
    area: 'Zindabazar',
    streetAddress: 'Kumarpara Road, Zindabazar',
    location: [91.8686, 24.899],
    description: [
      'The city\'s trusted business address — Grand Sylhet pairs club-floor comforts with instant access to Zindabazar\'s food streets.',
      'Expect a proper executive lounge, express laundry and the best khichuri buffet in town.',
    ],
    amenities: ['Free WiFi', 'Fitness Center', 'Restaurant', 'Room Service', 'Airport Shuttle', 'Air Conditioning'],
    trustBadges: ['platform_serviced'],
    featuredPriority: 50,
    avgRating: 4.3,
    reviewCount: 241,
    images: ['hotel-lobby.jpg', 'hotel-room.jpg'],
    roomTypes: [
      {
        name: 'Business King Room',
        description: 'Ergonomic workstation, blackout curtains and lounge access.',
        basePrice: 6500,
        compareAtPrice: 8200,
        maxOccupancy: 2,
        bedConfiguration: '1 King Bed',
        sizeSqft: 340,
        rooms: ['801', '802', '803', '804'],
      },
      {
        name: 'Club Twin Room',
        description: 'Two twin beds with evening canapés in the club lounge.',
        basePrice: 7900,
        maxOccupancy: 2,
        bedConfiguration: '2 Twin Beds',
        sizeSqft: 360,
        rooms: ['901', '902'],
      },
    ],
  },
  {
    slug: 'hillcrest-cloud-resort-bandarban',
    name: 'Hillcrest Cloud Resort',
    propertyType: 'resort',
    tier: 'standard',
    starRating: 3,
    city: 'Bandarban',
    area: 'Chimbuk Hill',
    streetAddress: 'Chimbuk Hill Road, Bandarban',
    location: [92.2187, 22.4676],
    description: [
      'Perched 2,000 feet above the plains, Hillcrest lives up to its name — clouds drift past your balcony before breakfast.',
      'Bamboo cottages, Marma-inspired cuisine and bonfire evenings under hill skies.',
    ],
    amenities: ['Free WiFi', 'Restaurant', 'Sea View', 'Free Parking'],
    trustBadges: ['new_listing', 'free_cancellation'],
    featuredPriority: 30,
    avgRating: 4.5,
    reviewCount: 67,
    images: ['resort-hill.jpg', 'resort-tea.jpg'],
    roomTypes: [
      {
        name: 'Cloud View Cottage',
        description: 'Bamboo cottage with a wall-facing glass gable over the valley.',
        basePrice: 5600,
        compareAtPrice: 7200,
        maxOccupancy: 2,
        bedConfiguration: '1 Queen Bed',
        sizeSqft: 280,
        rooms: ['H1', 'H2', 'H3', 'H4'],
      },
      {
        name: 'Family Hill Cottage',
        description: 'Two-room cottage with a shared veranda over the clouds.',
        basePrice: 8200,
        maxOccupancy: 4,
        bedConfiguration: '1 Queen + 2 Twin Beds',
        sizeSqft: 460,
        rooms: ['F1', 'F2'],
      },
    ],
  },
  {
    slug: 'dhaka-regency-hotel',
    name: 'Dhaka Regency Hotel',
    propertyType: 'hotel',
    tier: 'flagship',
    starRating: 5,
    city: 'Dhaka',
    area: 'Gulshan 2',
    streetAddress: 'Road 41, Gulshan 2',
    postcode: '1212',
    location: [90.4156, 23.7925],
    description: [
      'Dhaka\'s polished flagship in the diplomatic zone — a five-star stay with rooftop pool, award-winning steakhouse and seamless airport transfers.',
      'Ideal for business travellers who want Gulshan\'s dining scene at the doorstep.',
    ],
    amenities: ['Free WiFi', 'Swimming Pool', 'Fitness Center', 'Restaurant', 'Room Service', 'Airport Shuttle', 'Air Conditioning'],
    trustBadges: ['platform_serviced', 'free_cancellation', 'breakfast_included'],
    isFeatured: true,
    featuredPriority: 70,
    avgRating: 4.6,
    reviewCount: 512,
    images: ['hotel-lobby.jpg', 'room-deluxe.jpg', 'resort-pool2.jpg'],
    roomTypes: [
      {
        name: 'Deluxe King Room',
        description: 'Silk-lined walls, marble bath and Gulshan skyline views.',
        basePrice: 15500,
        compareAtPrice: 19500,
        maxOccupancy: 2,
        bedConfiguration: '1 King Bed',
        sizeSqft: 440,
        rooms: ['1201', '1202', '1203', '1204', '1205'],
      },
      {
        name: 'Premier Suite',
        description: 'Separate living room, butler service and skyline jacuzzi.',
        basePrice: 28500,
        maxOccupancy: 3,
        bedConfiguration: '1 King Bed',
        sizeSqft: 820,
        rooms: ['1501', '1502'],
      },
      {
        name: 'Classic Twin Room',
        description: 'Reliable comfort with two twin beds and a roomy desk.',
        basePrice: 11500,
        maxOccupancy: 2,
        bedConfiguration: '2 Twin Beds',
        sizeSqft: 380,
        rooms: ['1101', '1102', '1103'],
      },
    ],
  },
  {
    slug: 'nomad-backpackers-dhaka',
    name: 'Nomad Backpackers Dhaka',
    propertyType: 'hotel',
    tier: 'budget',
    starRating: 2,
    city: 'Dhaka',
    area: 'Banani',
    streetAddress: 'Road 11, Banani',
    postcode: '1213',
    location: [90.4016, 23.7887],
    description: [
      'Clean pods, strong coffee and a traveller\'s noticeboard — Nomad is the budget basecamp for exploring Old Dhaka by day.',
      'Private twin pods and shared dorms with lockers, hot showers and fast WiFi.',
    ],
    amenities: ['Free WiFi', 'Air Conditioning', 'Room Service'],
    trustBadges: ['new_listing'],
    avgRating: 4.1,
    reviewCount: 88,
    images: ['room-bed.jpg'],
    roomTypes: [
      {
        name: 'Private Twin Pod',
        description: 'Lockable private pod with twin beds and reading lights.',
        basePrice: 2400,
        compareAtPrice: 3100,
        maxOccupancy: 2,
        bedConfiguration: '2 Single Beds',
        sizeSqft: 160,
        rooms: ['P1', 'P2', 'P3', 'P4'],
      },
      {
        name: 'Shared Dorm Bed',
        description: 'One bed in a six-bed female or mixed dorm.',
        basePrice: 900,
        maxOccupancy: 1,
        bedConfiguration: '1 Single Bed',
        sizeSqft: 40,
        rooms: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'],
      },
    ],
  },
  {
    slug: 'sunset-point-resort-coxs-bazar',
    name: 'Sunset Point Resort',
    propertyType: 'resort',
    tier: 'standard',
    starRating: 3,
    city: "Cox's Bazar",
    area: 'Himchari',
    streetAddress: 'Himchari Marine Drive',
    postcode: '4720',
    location: [91.9221, 21.4742],
    description: [
      'Halfway between Himchari\'s waterfalls and the sunset point, this laid-back resort trades polish for front-row ocean sunsets.',
      'Colourful cabanas, a beach volleyball court and fresh grills every evening.',
    ],
    amenities: ['Free WiFi', 'Beachfront', 'Restaurant', 'Free Parking', 'Sea View'],
    trustBadges: ['platform_serviced'],
    avgRating: 4.2,
    reviewCount: 132,
    images: ['coxsbazar-beach.jpg', 'beach-water.jpg'],
    roomTypes: [
      {
        name: 'Sunset Cabana',
        description: 'Colourful freestanding cabana with a west-facing deck.',
        basePrice: 6800,
        compareAtPrice: 8500,
        maxOccupancy: 2,
        bedConfiguration: '1 Queen Bed',
        sizeSqft: 300,
        rooms: ['C1', 'C2', 'C3', 'C4', 'C5'],
      },
      {
        name: 'Ocean Twin Room',
        description: 'Simple twin room steps from the sand.',
        basePrice: 4900,
        maxOccupancy: 2,
        bedConfiguration: '2 Twin Beds',
        sizeSqft: 260,
        rooms: ['101', '102', '103'],
      },
    ],
  },
  {
    slug: 'metro-inn-dhaka',
    name: 'Metro Inn Dhaka',
    propertyType: 'hotel',
    tier: 'standard',
    starRating: 3,
    city: 'Dhaka',
    area: 'Farmgate',
    streetAddress: 'Tejgaon Link Road, Farmgate',
    postcode: '1205',
    location: [90.3995, 23.7603],
    description: [
      'A dependable mid-ranger beside the Tejgaon business corridor — quick highway access, honest pricing and a legendary beef tehari next door.',
    ],
    amenities: ['Free WiFi', 'Restaurant', 'Room Service', 'Air Conditioning', 'Free Parking'],
    trustBadges: [],
    avgRating: 3.9,
    reviewCount: 176,
    images: ['hotel-room.jpg'],
    roomTypes: [
      {
        name: 'Standard Double Room',
        description: 'Compact double with city views and a proper desk.',
        basePrice: 4200,
        compareAtPrice: 5300,
        maxOccupancy: 2,
        bedConfiguration: '1 Queen Bed',
        sizeSqft: 260,
        rooms: ['301', '302', '303', '304', '305'],
      },
    ],
  },
  {
    slug: 'seagull-sky-hotel-coxs-bazar',
    name: 'Seagull Sky Hotel',
    propertyType: 'hotel',
    tier: 'premium',
    starRating: 4,
    city: "Cox's Bazar",
    area: 'Sugandha Point',
    streetAddress: 'Sugandha Beach Road',
    postcode: '4700',
    location: [91.9721, 21.4361],
    description: [
      'High-rise views over Sugandha Point with one of the best rooftop breakfasts on the beach strip.',
      'Sea-facing corners in every room, a business centre for hybrid workers and quick rickshaw links to Laboni.',
    ],
    amenities: ['Free WiFi', 'Swimming Pool', 'Restaurant', 'Sea View', 'Room Service', 'Air Conditioning'],
    trustBadges: ['platform_serviced', 'free_cancellation'],
    featuredPriority: 45,
    avgRating: 4.3,
    reviewCount: 267,
    images: ['resort-pool2.jpg', 'hotel-room.jpg'],
    roomTypes: [
      {
        name: 'Skyline Double Room',
        description: 'Floor-to-ceiling windows framing the Bay of Bengal.',
        basePrice: 7800,
        compareAtPrice: 9700,
        maxOccupancy: 2,
        bedConfiguration: '1 King Bed',
        sizeSqft: 340,
        rooms: ['701', '702', '703', '704'],
      },
      {
        name: 'Family Quadruple Room',
        description: 'Two queen beds, sofa nook and extra luggage space.',
        basePrice: 11400,
        maxOccupancy: 4,
        bedConfiguration: '2 Queen Beds',
        sizeSqft: 480,
        rooms: ['801', '802', '803'],
      },
    ],
  },
  {
    slug: 'pearl-beach-inn-coxs-bazar',
    name: 'Pearl Beach Inn',
    propertyType: 'hotel',
    tier: 'budget',
    starRating: 2,
    city: "Cox's Bazar",
    area: 'Laboni Point',
    streetAddress: 'Laboni Beach Road',
    postcode: '4700',
    location: [91.9762, 21.4472],
    description: [
      'Simple, spotless rooms fifty steps from Laboni Point — the practical pick for budget beach days.',
      'Friendly desk staff arrange para-sailing, speedboat trips and the morning Burmese market run.',
    ],
    amenities: ['Free WiFi', 'Air Conditioning', 'Room Service'],
    trustBadges: ['new_listing'],
    avgRating: 4.0,
    reviewCount: 143,
    images: ['room-bed.jpg'],
    roomTypes: [
      {
        name: 'Budget Double Room',
        description: 'Neat double with fan-cooled veranda option.',
        basePrice: 2800,
        compareAtPrice: 3600,
        maxOccupancy: 2,
        bedConfiguration: '1 Queen Bed',
        sizeSqft: 200,
        rooms: ['101', '102', '103', '104', '105', '106'],
      },
      {
        name: 'Twin Economy Room',
        description: 'Two singles for friends splitting the fare.',
        basePrice: 2200,
        maxOccupancy: 2,
        bedConfiguration: '2 Single Beds',
        sizeSqft: 180,
        rooms: ['201', '202', '203'],
      },
    ],
  },
  {
    slug: 'wavecrest-holiday-hotel-coxs-bazar',
    name: 'Wavecrest Holiday Hotel',
    propertyType: 'hotel',
    tier: 'standard',
    starRating: 3,
    city: "Cox's Bazar",
    area: 'Kolatoli',
    streetAddress: 'Golden Beach Lane, Kolatoli',
    postcode: '4700',
    location: [91.9645, 21.4298],
    description: [
      'A cheerful mid-range favourite behind Kolatoli square — big pools, bigger breakfasts and rooms that sleep the whole family.',
    ],
    amenities: ['Free WiFi', 'Swimming Pool', 'Free Breakfast', 'Restaurant', 'Free Parking', 'Air Conditioning'],
    trustBadges: ['platform_serviced', 'breakfast_included'],
    avgRating: 4.1,
    reviewCount: 198,
    images: ['resort-pool.jpg', 'room-deluxe.jpg'],
    roomTypes: [
      {
        name: 'Poolside Double Room',
        description: 'Ground-floor room opening straight onto the pool deck.',
        basePrice: 5400,
        compareAtPrice: 6800,
        maxOccupancy: 2,
        bedConfiguration: '1 Queen Bed',
        sizeSqft: 280,
        rooms: ['G1', 'G2', 'G3', 'G4'],
      },
      {
        name: 'Family Pool View Room',
        description: 'Queen bed plus bunks, overlooking the shallow kids\' pool.',
        basePrice: 7600,
        maxOccupancy: 4,
        bedConfiguration: '1 Queen + 2 Bunk Beds',
        sizeSqft: 420,
        rooms: ['F1', 'F2', 'F3'],
      },
    ],
  },
  {
    slug: 'jaflong-river-resort-sylhet',
    name: 'Jaflong River Resort',
    propertyType: 'resort',
    tier: 'standard',
    starRating: 3,
    city: 'Sylhet',
    area: 'Jaflong',
    streetAddress: 'Piain River Road, Jaflong',
    location: [92.0793, 25.1667],
    description: [
      'Wake to the Piain river and Khasi hills on the far bank — stone-collection boats drift by as you eat breakfast on the water terrace.',
    ],
    amenities: ['Free WiFi', 'Restaurant', 'Sea View', 'Free Parking', 'Free Breakfast'],
    trustBadges: ['new_listing', 'breakfast_included'],
    avgRating: 4.4,
    reviewCount: 74,
    images: ['resort-tea.jpg', 'room-bed.jpg'],
    roomTypes: [
      {
        name: 'River View Room',
        description: 'Balcony over the Piain with morning boat views.',
        basePrice: 4900,
        compareAtPrice: 6200,
        maxOccupancy: 2,
        bedConfiguration: '1 Queen Bed',
        sizeSqft: 280,
        rooms: ['101', '102', '103', '104'],
      },
    ],
  },
  {
    slug: 'island-cove-hotel-saint-martin',
    name: 'Island Cove Hotel',
    propertyType: 'hotel',
    tier: 'standard',
    starRating: 3,
    city: "Saint Martin's Island",
    area: 'Jetty Area',
    streetAddress: 'Jetty Road, Saint Martin',
    location: [92.3236, 20.6285],
    description: [
      'Two minutes from the jetty yet a world away — Island Cove keeps things simple with breezy rooms and a legendary rooftop grill.',
    ],
    amenities: ['Free WiFi', 'Restaurant', 'Sea View'],
    trustBadges: [],
    avgRating: 4.0,
    reviewCount: 58,
    images: ['beach-water.jpg'],
    roomTypes: [
      {
        name: 'Cove Double Room',
        description: 'Breezy double with lagoon-side seating.',
        basePrice: 5200,
        compareAtPrice: 6600,
        maxOccupancy: 2,
        bedConfiguration: '1 Queen Bed',
        sizeSqft: 240,
        rooms: ['201', '202', '203'],
      },
    ],
  },
]

function lexicalFromParagraphs(paragraphs: string[]) {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        children: [
          {
            type: 'text',
            mode: 'normal',
            style: '',
            detail: 0,
            format: 0,
            version: 1,
            text,
          },
        ],
        direction: 'ltr',
      })),
      direction: 'ltr',
    },
  }
}

async function ensureDemoPartner(payload: Awaited<ReturnType<typeof import('payload').getPayload>>) {
  const email = 'demo-partner@staybd.test'
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) return Number(docs[0].id)
  const user = await payload.create({
    collection: 'users',
    data: {
      email,
      password: 'demo-partner-2026',
      name: 'Demo Partner',
      role: 'partner',
    },
    overrideAccess: true,
  })
  return Number(user.id)
}

async function main() {
  const { getPayload } = await import('payload')
  const payloadConfig = (await import('../src/payload.config.js')).default
  const payload = await getPayload({ config: payloadConfig })

  const partnerId = await ensureDemoPartner(payload)

  const { docs: existingProperties } = await payload.find({
    collection: 'properties',
    where: { slug: { in: DEMO_PROPERTIES.map((p) => p.slug) } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
    select: { slug: true },
  })
  const existingSlugs = new Set(existingProperties.map((p) => p.slug))
  const pending = DEMO_PROPERTIES.filter((p) => !existingSlugs.has(p.slug))

  if (pending.length === 0) {
    console.log(`Skipping — all ${existingSlugs.size} demo properties already exist.`)
    return
  }
  console.log(`${existingSlugs.size} exist, seeding ${pending.length} new properties.`)

  const amenityByName = new Map<string, number>()
  for (const amenity of AMENITIES) {
    const { docs } = await payload.find({
      collection: 'amenities',
      where: { name: { equals: amenity.name } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    amenityByName.set(
      amenity.name,
      docs[0]
        ? Number(docs[0].id)
        : Number(
            (
              await payload.create({
                collection: 'amenities',
                data: { name: amenity.name },
                overrideAccess: true,
              })
            ).id,
          ),
    )
  }
  console.log(`Amenities ready: ${amenityByName.size}`)

  const mediaByFile = new Map<string, number>()
  for (const property of pending) {
    for (const file of property.images) {
      if (mediaByFile.has(file)) continue
      const filePath = resolve(IMAGE_DIR, file)
      if (!existsSync(filePath)) {
        console.warn(`  ! missing image file: ${filePath}`)
        continue
      }
      const media = await payload.create({
        collection: 'media',
        data: {
          alt: `${property.name} — ${file.replace('.jpg', '').replaceAll('-', ' ')}`,
          purpose: ['property_photo'],
        },
        filePath,
        overrideAccess: true,
      })
      mediaByFile.set(file, Number(media.id))
    }
  }
  console.log(`Media uploaded: ${mediaByFile.size}`)

  let roomTypeCount = 0
  let roomCount = 0

  for (const demo of pending) {
    const heroFile = demo.images[0]
    const heroImageId = mediaByFile.get(heroFile)

    const property = await payload.create({
      collection: 'properties',
      data: {
        name: demo.name,
        slug: demo.slug,
        partner: partnerId,
        description: lexicalFromParagraphs(demo.description) as never,
        status: 'approved',
        propertyType: demo.propertyType,
        tier: demo.tier,
        ...(demo.starRating ? { starRating: demo.starRating } : {}),
        amenities: demo.amenities
          .map((name) => amenityByName.get(name))
          .filter((id): id is number => id != null),
        ...(heroImageId ? { heroImage: heroImageId } : {}),
        images: demo.images
          .slice(1)
          .map((file) => mediaByFile.get(file))
          .filter((id): id is number => id != null)
          .map((image) => ({ image })),
        address: {
          streetAddress: demo.streetAddress,
          area: demo.area,
          city: demo.city,
          ...(demo.postcode ? { postcode: demo.postcode } : {}),
          country: 'Bangladesh',
        },
        ...(demo.location ? { location: demo.location } : {}),
        policies: {
          checkInTime: '14:00',
          checkOutTime: '12:00',
          cancellationPolicy:
            'Free cancellation up to 48 hours before check-in. Cancellations within 48 hours are charged one night.',
        },
        trustBadges: demo.trustBadges as never,
        ...(demo.isFeatured ? { isFeatured: true } : {}),
        featuredPriority: demo.featuredPriority ?? 0,
        avgRating: demo.avgRating,
        reviewCount: demo.reviewCount,
      },
      overrideAccess: true,
      context: { skipHooks: false },
    })
    console.log(`✓ ${demo.name} (#${property.id})`)

    for (const roomType of demo.roomTypes) {
      const createdRoomType = await payload.create({
        collection: 'room-types',
        data: {
          property: Number(property.id),
          name: roomType.name,
          description: roomType.description,
          basePrice: roomType.basePrice,
          ...(roomType.compareAtPrice ? { compareAtPrice: roomType.compareAtPrice } : {}),
          maxOccupancy: roomType.maxOccupancy,
          bedConfiguration: roomType.bedConfiguration,
          sizeSqft: roomType.sizeSqft,
          isActive: true,
        },
        overrideAccess: true,
        context: { skipHooks: true },
      })
      roomTypeCount++

      for (const roomNumber of roomType.rooms) {
        await payload.create({
          collection: 'rooms',
          data: {
            property: Number(property.id),
            roomType: Number(createdRoomType.id),
            roomNumber,
            isActive: true,
          },
          overrideAccess: true,
          context: { skipHooks: true },
        })
        roomCount++
      }
    }
  }

  console.log(`\nSeed complete: ${pending.length} properties, ${roomTypeCount} room types, ${roomCount} rooms.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
