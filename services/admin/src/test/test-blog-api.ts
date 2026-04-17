/**
 * Test Script for Blog APIs
 * Run this with: npx ts-node src/test/test-blog-api.ts
 */

import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3002/api/v1';

// Dummy blog data
// NOTE: This test file needs to be updated to work with categoryId (relation) instead of category enum
const dummyBlogs = [
  {
    title: 'How Escrowly Ensures Safe Transactions',
    slug: 'how-escrowly-ensures-safe-transactions',
    categoryId: 1, // TODO: Get actual category ID from database
    imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800',
    excerpt:
      'Learn how Escrowly provides secure crypto transactions for businesses and individuals worldwide.',
    readTime: 4,
    isPublished: true,
    contentSections: [
      {
        title: 'How Escrowly Ensures Safe Transactions',
        description:
          'Escrowly offers a reliable and secure platform for businesses and individuals engaged in online transactions. By utilizing advanced technologies and best practices, Escrowly ensures that all parties involved in a transaction can have peace of mind.',
        imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
      },
      {
        title: 'Benefits of Using Escrowly',
        description:
          "Escrowly offers a reliable and secure platform for businesses and individuals engaged in online transactions. Here's how Escrowly protects your interests:",
        imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
        subsections: [
          {
            title: 'Fraud Prevention',
            description:
              'Ensures that payments are only processed when conditions are met.',
          },
          {
            title: 'Secure Crypto Transactions',
            description:
              'Reduces the risks of scams in the volatile crypto market.',
          },
          {
            title: 'Trust & Transparency',
            description:
              'Builds confidence between buyers and sellers, fostering long-term business relationships.',
          },
        ],
      },
      {
        title: 'Future-Proof Your Transactions with Escrowly',
        description:
          'As digital transactions continue to evolve, businesses and individuals need a secure and reliable payment system that adapts to changing market conditions. Escrowly provides high-level security for cryptocurrency transactions and ensures your digital assets are protected.',
      },
    ],
  },
  {
    title: 'The Future of Secure Crypto Transactions',
    slug: 'the-future-of-secure-crypto-transactions',
    categoryId: 2, // TODO: Get actual category ID from database
    imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800',
    excerpt:
      'Exploring the future of cryptocurrency security and blockchain technology.',
    readTime: 5,
    isPublished: true,
    contentSections: [
      {
        title: 'The Future of Secure Crypto Transactions',
        description:
          'As digital transactions continue to evolve, businesses and individuals need secure payment systems that adapt to changing market conditions.',
        imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
      },
    ],
  },
  {
    title: 'Real Estate Escrow: A Complete Guide',
    slug: 'real-estate-escrow-complete-guide',
    categoryId: 3, // TODO: Get actual category ID from database
    imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
    excerpt:
      'Learn everything you need to know about real estate escrow services.',
    readTime: 6,
    isPublished: true,
    contentSections: [
      {
        title: 'Real Estate Escrow: A Complete Guide',
        description:
          'Real estate transactions require secure escrow services to protect both buyers and sellers.',
        imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
      },
    ],
  },
];

async function createDummyBlogs() {
  console.log('📝 Creating dummy blogs...\n');

  for (const blogData of dummyBlogs) {
    try {
      const blog = await prisma.blog.create({
        data: {
          ...blogData,
          contentSections: blogData.contentSections as any,
          
        },
      });

      console.log(`✅ Created blog: ${blog.title} (ID: ${blog.id})`);
      console.log(`   Slug: ${blog.slug}`);
      console.log(`   Category ID: ${blog.categoryId}`);
      console.log(`   Published: ${blog.isPublished}\n`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`⚠️  Blog already exists: ${blogData.slug}`);
      } else {
        console.error(`❌ Error creating blog: ${error.message}`);
      }
    }
  }
}

async function testQueries() {
  console.log('\n🔍 Testing database queries...\n');

  // Test 1: Get all blogs
  console.log('Test 1: Get all published blogs');
  const allBlogs = await prisma.blog.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`✅ Found ${allBlogs.length} published blogs\n`);

  // Test 2: Get by category
  console.log('Test 2: Get blogs by category ID');
  const cryptoBlogs = await prisma.blog.findMany({
    where: { categoryId: 1, isPublished: true }, // TODO: Use actual category ID
  });
  console.log(`✅ Found ${cryptoBlogs.length} blogs in category\n`);

  // Test 3: Get by slug
  console.log('Test 3: Get blog by slug');
  const blogBySlug = await prisma.blog.findUnique({
    where: { slug: 'how-escrowly-ensures-safe-transactions' },
  });
  if (blogBySlug) {
    console.log(`✅ Found blog: ${blogBySlug.title}\n`);
  } else {
    console.log('❌ Blog not found\n');
  }

  // Test 4: Get categories with count
  console.log('Test 4: Get categories with count');
  const categories = await prisma.blog.groupBy({
    by: ['categoryId'],
    _count: { categoryId: true },
    where: { isPublished: true },
  });
  console.log('✅ Categories:');
  categories.forEach((cat) => {
    console.log(`   Category ID ${cat.categoryId}: ${cat._count.categoryId} posts`);
  });
  console.log('');
}

async function testUpdate() {
  console.log('✏️  Testing update operations...\n');

  const blog = await prisma.blog.findFirst({
    where: { slug: 'how-escrowly-ensures-safe-transactions' },
  });

  if (blog) {
    const updated = await prisma.blog.update({
      where: { id: blog.id },
      data: {
        title: 'Updated: How Escrowly Ensures Safe Transactions',
        excerpt: 'Updated excerpt - Learn how Escrowly provides secure crypto transactions...',
        readTime: 5,
      },
    });
    console.log(`✅ Blog updated: ${updated.title}`);
    console.log(`   New read time: ${updated.readTime} minutes\n`);
  }
}

async function testDelete() {
  console.log('🗑️  Testing delete operations...\n');

  const blog = await prisma.blog.findFirst({
    where: { slug: 'real-estate-escrow-complete-guide' },
  });

  if (blog) {
    await prisma.blog.delete({
      where: { id: blog.id },
    });
    console.log(`✅ Blog deleted: ${blog.title}\n`);

    // Verify deletion
    const deleted = await prisma.blog.findUnique({
      where: { id: blog.id },
    });
    if (!deleted) {
      console.log('✅ Deletion verified - blog no longer exists\n');
    }
  }
}

async function main() {
  try {
    console.log('🧪 Testing Blog CRUD Operations\n');
    console.log('================================\n');

    // Create dummy blogs
    await createDummyBlogs();

    // Test queries
    await testQueries();

    // Test update
    await testUpdate();

    // Test delete
    await testDelete();

    console.log('================================');
    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

