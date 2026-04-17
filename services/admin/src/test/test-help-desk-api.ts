/**
 * Help Desk API Test Script
 * Tests all CRUD operations for Help Desk Categories and Questions
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002/api/v1';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  order: number;
  isActive: boolean;
  questionCount: number;
}

interface Question {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

// Helper function to make API requests
async function apiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any,
): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.message || 'Unknown error'}`);
    }

    return data;
  } catch (error) {
    console.error(`Error ${method} ${endpoint}:`, error);
    throw error;
  }
}

// Test data
const testCategories = [
  {
    name: 'Getting Started',
    slug: 'getting-started',
    description: 'Learn how to get started with Escrowly',
    order: 1,
  },
  {
    name: 'Manage Escrow',
    slug: 'manage-escrow',
    description: 'How to manage your escrow transactions',
    order: 2,
  },
  {
    name: 'Payments & Fees',
    slug: 'payments-fees',
    description: 'Information about payments and fees',
    order: 3,
  },
  {
    name: 'Security',
    slug: 'security',
    description: 'Security features and best practices',
    order: 4,
  },
];

const testQuestions = [
  {
    question: 'How does Escrowly work for buyers and sellers?',
    answer:
      'Escrowly acts as a secure intermediary between buyers and sellers. When a transaction is initiated, the buyer sends payment to Escrowly, which holds the funds securely until the seller delivers the goods or services. Once both parties confirm satisfaction, Escrowly releases the funds to the seller. This eliminates fraud and ensures a safe transaction for both parties.',
    order: 1,
  },
  {
    question: 'How do I open an Escrowly account?',
    answer:
      'To open an Escrowly account, simply visit our website and click on "Sign Up". You will need to provide your email address, create a password, and verify your email. After verification, you can complete your profile by adding your personal information and verifying your identity through our KYC (Know Your Customer) process.',
    order: 2,
  },
  {
    question: 'How do I verify my email address?',
    answer:
      'After signing up, you will receive a verification email at the address you provided. Click on the verification link in the email to verify your account. If you did not receive the email, check your spam folder or request a new verification email from your account settings.',
    order: 3,
  },
  {
    question: 'How do I start my first transaction?',
    answer:
      'To start your first transaction, log in to your Escrowly account and click on "Create Transaction". Enter the transaction details, including the amount, description, and the other party\'s email address. Once created, you can share the transaction link with the other party to complete the setup.',
    order: 4,
  },
];

// Test functions
async function testCreateCategory(categoryData: any): Promise<Category> {
  console.log(`\n📝 Creating category: ${categoryData.name}`);
  const category = await apiRequest('/help-desk/categories', 'POST', categoryData);
  console.log(`✅ Category created:`, category);
  return category;
}

async function testGetAllCategories(): Promise<Category[]> {
  console.log(`\n📋 Getting all categories`);
  const categories = await apiRequest('/help-desk/categories');
  console.log(`✅ Found ${categories.length} categories`);
  categories.forEach((cat: Category) => {
    console.log(`   - ${cat.name} (${cat.slug}) - ${cat.questionCount} questions`);
  });
  return categories;
}

async function testGetCategoryById(id: string): Promise<Category> {
  console.log(`\n🔍 Getting category by ID: ${id}`);
  const category = await apiRequest(`/help-desk/categories/${id}`);
  console.log(`✅ Category found:`, category.name);
  return category;
}

async function testGetCategoryBySlug(slug: string): Promise<any> {
  console.log(`\n🔍 Getting category by slug: ${slug}`);
  const category = await apiRequest(`/help-desk/categories/slug/${slug}`);
  console.log(`✅ Category found: ${category.name} with ${category.questions.length} questions`);
  return category;
}

async function testUpdateCategory(id: string, updates: any): Promise<Category> {
  console.log(`\n✏️  Updating category: ${id}`);
  const category = await apiRequest(`/help-desk/categories/${id}`, 'PATCH', updates);
  console.log(`✅ Category updated:`, category.name);
  return category;
}

async function testCreateQuestion(
  categoryId: string,
  questionData: any,
): Promise<Question> {
  console.log(`\n📝 Creating question in category: ${categoryId}`);
  const question = await apiRequest('/help-desk/questions', 'POST', {
    ...questionData,
    categoryId,
  });
  console.log(`✅ Question created:`, question.question.substring(0, 50) + '...');
  return question;
}

async function testGetAllQuestions(categoryId?: string): Promise<Question[]> {
  console.log(`\n📋 Getting all questions${categoryId ? ` for category: ${categoryId}` : ''}`);
  const endpoint = categoryId
    ? `/help-desk/questions?categoryId=${categoryId}`
    : '/help-desk/questions';
  const questions = await apiRequest(endpoint);
  console.log(`✅ Found ${questions.length} questions`);
  return questions;
}

async function testGetQuestionById(id: string): Promise<Question> {
  console.log(`\n🔍 Getting question by ID: ${id}`);
  const question = await apiRequest(`/help-desk/questions/${id}`);
  console.log(`✅ Question found:`, question.question.substring(0, 50) + '...');
  console.log(`   Views: ${question.viewCount}, Helpful: ${question.helpfulCount}`);
  return question;
}

async function testUpdateQuestion(id: string, updates: any): Promise<Question> {
  console.log(`\n✏️  Updating question: ${id}`);
  const question = await apiRequest(`/help-desk/questions/${id}`, 'PATCH', updates);
  console.log(`✅ Question updated`);
  return question;
}

async function testMarkHelpful(id: string): Promise<Question> {
  console.log(`\n👍 Marking question as helpful: ${id}`);
  const question = await apiRequest(`/help-desk/questions/${id}/helpful`, 'POST');
  console.log(`✅ Helpful count: ${question.helpfulCount}`);
  return question;
}

async function testMarkNotHelpful(id: string): Promise<Question> {
  console.log(`\n👎 Marking question as not helpful: ${id}`);
  const question = await apiRequest(`/help-desk/questions/${id}/not-helpful`, 'POST');
  console.log(`✅ Not helpful count: ${question.notHelpfulCount}`);
  return question;
}

async function testDeleteQuestion(id: string): Promise<void> {
  console.log(`\n🗑️  Deleting question: ${id}`);
  await apiRequest(`/help-desk/questions/${id}`, 'DELETE');
  console.log(`✅ Question deleted`);
}

async function testDeleteCategory(id: string): Promise<void> {
  console.log(`\n🗑️  Deleting category: ${id}`);
  try {
    await apiRequest(`/help-desk/categories/${id}`, 'DELETE');
    console.log(`✅ Category deleted`);
  } catch (error: any) {
    console.log(`⚠️  Cannot delete category (may have questions): ${error.message}`);
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Help Desk API Tests\n');
  console.log('='.repeat(60));

  const createdCategories: Category[] = [];
  const createdQuestions: Question[] = [];

  try {
    // ====================================
    // Category Tests
    // ====================================
    console.log('\n📁 CATEGORY TESTS');
    console.log('='.repeat(60));

    // Create categories
    for (const categoryData of testCategories) {
      const category = await testCreateCategory(categoryData);
      createdCategories.push(category);
      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
    }

    // Get all categories
    await testGetAllCategories();

    // Get category by ID
    if (createdCategories.length > 0) {
      await testGetCategoryById(createdCategories[0].id);
    }

    // Get category by slug
    if (createdCategories.length > 0) {
      await testGetCategoryBySlug(createdCategories[0].slug);
    }

    // Update category
    if (createdCategories.length > 0) {
      await testUpdateCategory(createdCategories[0].id, {
        description: 'Updated description for Getting Started',
      });
    }

    // ====================================
    // Question Tests
    // ====================================
    console.log('\n\n❓ QUESTION TESTS');
    console.log('='.repeat(60));

    // Create questions for first category
    if (createdCategories.length > 0) {
      const firstCategory = createdCategories[0];
      for (const questionData of testQuestions) {
        const question = await testCreateQuestion(firstCategory.id, questionData);
        createdQuestions.push(question);
        await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
      }
    }

    // Get all questions
    await testGetAllQuestions();

    // Get questions by category
    if (createdCategories.length > 0) {
      await testGetAllQuestions(createdCategories[0].id);
    }

    // Get question by ID (increments view count)
    if (createdQuestions.length > 0) {
      await testGetQuestionById(createdQuestions[0].id);
      // Get again to see view count increment
      await testGetQuestionById(createdQuestions[0].id);
    }

    // Update question
    if (createdQuestions.length > 0) {
      await testUpdateQuestion(createdQuestions[0].id, {
        answer: 'Updated answer for testing purposes.',
      });
    }

    // Test feedback
    if (createdQuestions.length > 0) {
      await testMarkHelpful(createdQuestions[0].id);
      await testMarkNotHelpful(createdQuestions[0].id);
    }

    // ====================================
    // Cleanup Tests
    // ====================================
    console.log('\n\n🧹 CLEANUP TESTS');
    console.log('='.repeat(60));

    // Delete questions (in reverse order)
    for (let i = createdQuestions.length - 1; i >= 0; i--) {
      await testDeleteQuestion(createdQuestions[i].id);
      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
    }

    // Delete categories (in reverse order)
    for (let i = createdCategories.length - 1; i >= 0; i--) {
      await testDeleteCategory(createdCategories[i].id);
      await new Promise((resolve) => setTimeout(resolve, 100)); // small delay
    }

    console.log('\n\n✅ All tests completed successfully!');
    console.log('='.repeat(60));
  } catch (error: any) {
    console.error('\n\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

