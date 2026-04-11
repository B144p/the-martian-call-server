import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CONTINENTS = [
  {
    id: 'na',
    display_name: 'North America',
    pusher_channel: 'private-region-na',
    map_center_lat: 40.0,
    map_center_lng: -100.0,
  },
  {
    id: 'sa',
    display_name: 'South America',
    pusher_channel: 'private-region-sa',
    map_center_lat: -15.0,
    map_center_lng: -60.0,
  },
  {
    id: 'eu',
    display_name: 'Europe',
    pusher_channel: 'private-region-eu',
    map_center_lat: 50.0,
    map_center_lng: 15.0,
  },
  {
    id: 'af',
    display_name: 'Africa',
    pusher_channel: 'private-region-af',
    map_center_lat: 5.0,
    map_center_lng: 25.0,
  },
  {
    id: 'as',
    display_name: 'Asia',
    pusher_channel: 'private-region-as',
    map_center_lat: 40.0,
    map_center_lng: 90.0,
  },
  {
    id: 'oc',
    display_name: 'Oceania',
    pusher_channel: 'private-region-oc',
    map_center_lat: -25.0,
    map_center_lng: 135.0,
  },
];

async function main() {
  for (const continent of CONTINENTS) {
    await prisma.continent.upsert({
      where: { id: continent.id },
      update: {},
      create: continent,
    });
  }
  console.log('Seed complete: 6 continents upserted.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
