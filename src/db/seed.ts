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
  // Clear old products before re-seeding so removed slugs don't linger
  await prisma.product.deleteMany({});
  console.log('[seed] Cleared existing products.');

  // Note: price uses Decimal — never Float — to match DECIMAL(12,2) in DB
  const products = [
    {
      name: 'Florist CRM Suite',
      slug: 'florist-crm-suite',
      price: new Decimal('299.00'),
      stock: 999,
      description: 'All-in-one CRM platform for small businesses. Manage leads, deals, and customer communication in one place. Includes email sync, pipeline tracking, and reporting dashboards.',
      images: ['https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80'],
    },
    {
      name: 'Analytics Pro',
      slug: 'analytics-pro',
      price: new Decimal('199.00'),
      stock: 999,
      description: 'Business intelligence platform with real-time dashboards, KPI tracking, and automated reports. Connect your data sources and get actionable insights instantly.',
      images: ['https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80'],
    },
    {
      name: 'TeamFlow — Project Manager',
      slug: 'teamflow-project-manager',
      price: new Decimal('149.00'),
      stock: 999,
      description: 'Collaborative project and task management for teams. Kanban boards, Gantt charts, time tracking, and integrations with Slack, GitHub, and Microsoft Teams.',
      images: ['https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=600&q=80'],
    },
    {
      name: 'AutoBill — Invoicing & Billing',
      slug: 'autobill-invoicing',
      price: new Decimal('99.00'),
      stock: 999,
      description: 'Automated invoicing, recurring billing, and payment collection. Send professional invoices, accept online payments, and track overdue accounts effortlessly.',
      images: ['https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80'],
    },
    {
      name: 'HR Sync — Employee Management',
      slug: 'hr-sync',
      price: new Decimal('249.00'),
      stock: 999,
      description: 'Complete HR software for SMBs. Onboarding workflows, leave management, performance reviews, payroll integration, and org chart builder — all in one solution.',
      images: ['https://t3.ftcdn.net/jpg/18/17/50/10/240_F_1817501075_2FdGGix5liE919tLtXmPZLTbpq3rrlli.jpg'],
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
