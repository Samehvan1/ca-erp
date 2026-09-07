/**
 * One-off backfill for the "Template Document Fields" feature.
 * Populates the newly added nullable fields on EXISTING records so the
 * seed does not need to be re-run against a populated database.
 *
 * Non-nullable fields (Item.uom, Warehouse.country, Vendor.taxRate) already
 * carry their schema defaults, so only nullable fields are backfilled here.
 *
 * Run: npx tsx prisma/backfill-template-fields.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ---------- Warehouses: Egyptian address defaults ----------
  const warehouses = await prisma.warehouse.findMany({
    where: { OR: [{ address: null }, { city: null }] },
  });
  for (const w of warehouses) {
    await prisma.warehouse.update({
      where: { id: w.id },
      data: {
        address: w.address ?? "Head Office",
        city: w.city ?? "Cairo",
        country: w.country ?? "Egypt",
      },
    });
  }
  console.log(`Warehouses updated: ${warehouses.length}`);

  // ---------- Vendors: default tax type ----------
  const vendors = await prisma.vendor.findMany({ where: { taxType: null } });
  for (const v of vendors) {
    await prisma.vendor.update({
      where: { id: v.id },
      data: { taxType: "VAT", taxRate: v.taxRate ?? 14 },
    });
  }
  console.log(`Vendors updated: ${vendors.length}`);

  console.log("Backfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
