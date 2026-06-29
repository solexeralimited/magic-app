import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed drivers
  const drivers = [
    { id: 'drv-001', name: 'John Smith', email: 'john@example.com', phone: '0412345678' },
    { id: 'drv-002', name: 'Jane Doe', email: 'jane@example.com', phone: '0498765432' },
  ];

  for (const d of drivers) {
    await prisma.driver.upsert({
      where: { name: d.name },
      create: d,
      update: {},
    });
  }

  // Seed sample jobs in the master job list
  const today = new Date();
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()];

  await prisma.job.upsert({
    where: { id: 'job-001' },
    create: {
      id: 'job-001',
      driverName: 'John Smith',
      jobOrder: 1,
      day: dayName,
      jobType: 'Rubbish Collection',
      customerName: 'Test Customer A',
      address: '123 Main Street, Suburb VIC 3000',
      phone: '0312345678',
      items: '2x 240L bins',
      notes: 'Gate code: 1234',
      frequency: 'Weekly',
      nextServiceDate: new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0],
      mapLink: 'https://maps.google.com/?q=123+Main+Street+Melbourne',
      callAhead: false,
      status: 'Pending',
      runType: 'Daily',
    },
    update: {},
  });

  await prisma.job.upsert({
    where: { id: 'job-002' },
    create: {
      id: 'job-002',
      driverName: 'John Smith',
      jobOrder: 2,
      day: dayName,
      jobType: 'Green Waste',
      customerName: 'Test Customer B',
      address: '456 Oak Avenue, Suburb VIC 3001',
      phone: '0387654321',
      items: '1x green waste bin',
      notes: 'Ring doorbell on arrival',
      frequency: 'Fortnightly',
      nextServiceDate: new Date(today.getTime() + 14 * 86400000).toISOString().split('T')[0],
      mapLink: 'https://maps.google.com/?q=456+Oak+Avenue+Melbourne',
      callAhead: true,
      status: 'Pending',
      runType: 'Daily',
    },
    update: {},
  });

  await prisma.job.upsert({
    where: { id: 'job-003' },
    create: {
      id: 'job-003',
      driverName: 'Jane Doe',
      jobOrder: 1,
      day: dayName,
      jobType: 'Recycling',
      customerName: 'Test Customer C',
      address: '789 Pine Road, Suburb VIC 3002',
      phone: '0411222333',
      items: '1x recycle bin',
      notes: '',
      frequency: 'Weekly',
      nextServiceDate: new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0],
      mapLink: 'https://maps.google.com/?q=789+Pine+Road+Melbourne',
      callAhead: false,
      status: 'Pending',
      runType: 'Daily',
    },
    update: {},
  });

  console.log('✅ Seed complete');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
