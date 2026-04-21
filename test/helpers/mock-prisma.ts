export type MockPrismaService = ReturnType<typeof createMockPrismaService>;

export function createMockPrismaService() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    message: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    signalLog: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };

  // Default: $transaction supports both array and callback forms
  prisma.$transaction.mockImplementation(
    (arg: unknown[] | ((tx: unknown) => Promise<unknown>)) =>
      typeof arg === 'function'
        ? arg(prisma)
        : Promise.all(arg as Promise<unknown>[]),
  );

  // Default: message.findMany returns [] so onModuleInit is a no-op
  prisma.message.findMany.mockResolvedValue([]);

  return prisma;
}
