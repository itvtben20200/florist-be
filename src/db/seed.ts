import { PrismaClient, Role} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[seed] Starting...');

  // ── Superadmin ─────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@1234', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@floriststore.com' },
    update: {},
    create: {
      email: 'admin@floriststore.com',
      passwordHash: adminHash,
      name: 'Store Admin',
      role: Role.SUPERADMIN,
      isVerified: true,
    },
  });
  console.log(`[seed] Admin: ${admin.email}`);

  // ── Sample customer ────────────────────────────────────────────────────────
  const customerHash = await bcrypt.hash('Customer@1234', 12);
  await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      passwordHash: customerHash,
      name: 'Jane Doe',
      role: Role.CUSTOMER,
      isVerified: true,
    },
  });

  // ── Sample products ────────────────────────────────────────────────────────
  // ── Remove legacy/duplicate product slugs ──────────────────────────────────
  // 'Managed SOC' was previously seeded as 'Managed SOC (Security Operations Center)'
  // with one of these slugs. Delete any orphaned rows so the homepage doesn't show duplicates.
  const legacySocSlugs = [
    'soc-security-operations-center',
    'managed-soc-security-operations-center',
    'managed-soc-soc',
  ];
  await prisma.product.deleteMany({ where: { slug: { in: legacySocSlugs } } });
  console.log('[seed] Removed legacy SOC product slugs (if any).');

  // ── Upsert products (safe for repeated runs — always syncs slugs/prices/stock)
  console.log('[seed] Seeding products...');

  // Note: price uses Decimal — never Float — to match DECIMAL(12,2) in DB
  const products = [
    {
      name: 'Florist Core',
      slug: 'florist-core',
      price: new Decimal('299.00'),
      stock: 999,
      description: 'The complete operating system for your flower shop. Unified order management, real-time inventory, recurring subscriptions, built-in analytics, and team management — all in one platform.',
      images: ['https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80'],
    },
    {
      name: 'Daily Close Agent',
      slug: 'daily-close-agent',
      price: new Decimal('99.00'),
      stock: 999,
      description: 'Automated end-of-day reconciliation — finished before you lock up. Pulls data from POS, payment processors, and online orders to produce a clean daily close report automatically.',
      images: ['https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80'],
    },
    {
      name: 'Monthly Close Agent',
      slug: 'monthly-close-agent',
      price: new Decimal('149.00'),
      stock: 999,
      description: 'Month-end made effortless — close your books with confidence. Consolidates daily activity into a verified month-end package with P&L, variance detection, and review-ready reporting.',
      images: ['https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=600&q=80'],
    },
    {
      name: 'Quarterly Close Agent',
      slug: 'quarterly-close-agent',
      price: new Decimal('199.00'),
      stock: 999,
      description: 'Quarter-end reporting with controlled precision. KPI dashboards, YTD comparisons, compliance checkpoints, actuals vs budget tracking, and board-ready report packs.',
      images: ['https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80'],
    },
    {
      name: 'Yearly Close Agent',
      slug: 'yearly-close-agent',
      price: new Decimal('299.00'),
      stock: 999,
      description: 'Annual close done right — every year, without the chaos. Full-year financial summary, tax preparation package, statutory reporting, prior year comparatives, and year-end rollover.',
      images: ['https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&q=80'],
    },
    {
      name: 'Managed Secured Workplace',
      slug: 'managed-secured-workplace',
      price: new Decimal('249.00'),
      stock: 999,
      description: 'A protected, policy-driven workplace — managed for you end to end. Endpoint device management, identity & access control, data loss prevention, and security baseline hardening.',
      images: ['https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&q=80'],
    },
    {
      name: 'Managed SOC',
      slug: 'managed-soc',
      price: new Decimal('399.00'),
      stock: 999,
      description: '24/7 threat detection, triage, and response — without building your own team. Continuous monitoring, alert triage, rapid incident response, and monthly security reports.',
      images: ['https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&q=80'],
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: { name: p.name, price: p.price, description: p.description, images: p.images, stock: p.stock },
      create: p,
    });
    console.log(`[seed] Product: ${p.name} (€${p.price})`);
  }

  console.log('[seed] Done.');
}

main()
  .catch((err) => { console.error('[seed] Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
