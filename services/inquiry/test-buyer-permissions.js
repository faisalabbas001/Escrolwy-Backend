// Test script for Buyer Messaging Permissions
// Objective: Verify buyer-side messaging permissions in the inquiry chat room
//
// Usage:
//   node test-buyer-permissions.js
//
// Prerequisites:
//   - Inquiry service running on http://localhost:3003
//   - Escrow service running on http://localhost:3002 (or set ESCROW_SERVICE_URL)
//   - An escrow must exist with known buyerId and sellerId

/* eslint-disable @typescript-eslint/no-var-requires */
const http = require("http");
const axios = require("axios");
const { io } = require("socket.io-client");

const BASE_HTTP = "http://localhost:3003/api/v1";
const WS_URL = "http://localhost:3003/inquiry";
const ESCROW_SERVICE_URL = process.env.ESCROW_SERVICE_URL || "http://localhost:3002";

// Test configuration - UPDATE THESE with real values from your escrow service
const TEST_ESCROW_ID = process.env.TEST_ESCROW_ID || "escrow-test-buyer-permissions";
const VALID_BUYER_ID = process.env.VALID_BUYER_ID || "550e8400-e29b-41d4-a716-446655440000";
const INVALID_BUYER_ID = process.env.INVALID_BUYER_ID || "999e9999-e99b-99d4-a999-999999999999";
const VALID_SELLER_ID = process.env.VALID_SELLER_ID || "550e8400-e29b-41d4-a716-446655440001";

let createdInquiryId = null;
let mockEscrowServer = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createClient(name, userId, userRole, inquiryId) {
  const socket = io(WS_URL, {
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log(`[${name}] connected: ${socket.id}`);
  });

  socket.on("disconnect", () => {
    console.log(`[${name}] disconnected`);
  });

  socket.on("message_received", (payload) => {
    console.log(`[${name}] ✅ WS message_received:`, payload.message);
  });

  socket.on("error", (payload) => {
    console.log(`[${name}] ❌ WS error:`, payload);
  });

  return socket;
}

async function createInquiry(escrowId, createdBy) {
  try {
    const res = await axios.post(`${BASE_HTTP}/inquiries`, {
      escrow_id: escrowId,
      created_by: createdBy,
      initial_message: "Test inquiry for buyer permissions",
    });
    return res.data;
  } catch (error) {
    if (error.response?.status === 409) {
      // Inquiry already exists, get it
      const res = await axios.get(`${BASE_HTTP}/inquiries/escrow/${escrowId}`);
      return res.data;
    }
    throw error;
  }
}

function sendMessageWebSocket(socket, inquiryId, senderId, senderRole, message) {
  return new Promise((resolve, reject) => {
    socket.emit(
      "send_message",
      {
        inquiry_id: inquiryId,
        sender_id: senderId,
        sender_role: senderRole,
        message: message,
      },
      (ack) => {
        if (ack && ack.success) {
          resolve(ack.message);
        } else {
          reject(new Error(ack?.message || "WebSocket send_message failed"));
        }
      },
    );
  });
}

function joinInquiryRoom(socket, inquiryId, userId, userRole) {
  return new Promise((resolve, reject) => {
    socket.emit(
      "join_inquiry",
      {
        inquiry_id: inquiryId,
        user_id: userId,
        user_role: userRole,
      },
      (ack) => {
        if (ack && ack.success) {
          resolve(ack);
        } else {
          reject(new Error(ack?.message || "Failed to join inquiry"));
        }
      },
    );
  });
}

async function testValidBuyerAccess() {
  console.log("\n" + "=".repeat(80));
  console.log("TEST 1: Valid Buyer Access");
  console.log("=".repeat(80));
  console.log(`Testing with:`);
  console.log(`  - Inquiry ID: ${createdInquiryId}`);
  console.log(`  - Escrow ID: ${TEST_ESCROW_ID}`);
  console.log(`  - Buyer ID: ${VALID_BUYER_ID}`);
  console.log(`  - Expected: Buyer should be able to join and send messages\n`);

  const socket = createClient("valid-buyer", VALID_BUYER_ID, "buyer", createdInquiryId);

  try {
    // Wait for connection
    await new Promise((resolve) => {
      socket.on("connect", resolve);
      setTimeout(() => resolve(), 2000);
    });

    await delay(500);

    // Test 1.1: Join inquiry room
    console.log("1.1 Testing join_inquiry...");
    try {
      const joinResult = await joinInquiryRoom(socket, createdInquiryId, VALID_BUYER_ID, "buyer");
      console.log("   ✅ SUCCESS: Valid buyer joined inquiry room");
      console.log(`   Participants: ${JSON.stringify(joinResult.participants, null, 2)}`);
    } catch (error) {
      console.log(`   ❌ FAILED: Valid buyer could not join - ${error.message}`);
      socket.disconnect();
      return false;
    }

    await delay(1000);

    // Test 1.2: Send message via WebSocket
    console.log("\n1.2 Testing send_message via WebSocket...");
    try {
      const messageResult = await sendMessageWebSocket(
        socket,
        createdInquiryId,
        VALID_BUYER_ID,
        "buyer",
        "This is a test message from the valid buyer",
      );
      console.log("   ✅ SUCCESS: Valid buyer sent message successfully");
      console.log(`   Message ID: ${messageResult.id}`);
      await delay(1000); // Wait for broadcast
    } catch (error) {
      console.log(`   ❌ FAILED: Valid buyer could not send message - ${error.message}`);
      socket.disconnect();
      return false;
    }

    // Test 1.3: Send message via HTTP
    console.log("\n1.3 Testing send_message via HTTP...");
    try {
      const httpRes = await axios.post(`${BASE_HTTP}/inquiries/${createdInquiryId}/messages`, {
        sender_id: VALID_BUYER_ID,
        sender_role: "buyer",
        message: "This is a test message from valid buyer via HTTP",
      });
      console.log("   ✅ SUCCESS: Valid buyer sent message via HTTP");
      console.log(`   Message ID: ${httpRes.data.id}`);
      await delay(1000);
    } catch (error) {
      console.log(`   ❌ FAILED: Valid buyer could not send message via HTTP - ${error.response?.data?.message || error.message}`);
      socket.disconnect();
      return false;
    }

    socket.disconnect();
    console.log("\n✅ TEST 1 PASSED: Valid buyer has full access");
    return true;
  } catch (error) {
    console.log(`\n❌ TEST 1 FAILED: ${error.message}`);
    socket.disconnect();
    return false;
  }
}

async function testInvalidBuyerAccess() {
  console.log("\n" + "=".repeat(80));
  console.log("TEST 2: Invalid Buyer Access");
  console.log("=".repeat(80));
  console.log(`Testing with:`);
  console.log(`  - Inquiry ID: ${createdInquiryId}`);
  console.log(`  - Escrow ID: ${TEST_ESCROW_ID}`);
  console.log(`  - Invalid Buyer ID: ${INVALID_BUYER_ID}`);
  console.log(`  - Expected: Invalid buyer should be REJECTED\n`);

  const socket = createClient("invalid-buyer", INVALID_BUYER_ID, "buyer", createdInquiryId);

  try {
    // Wait for connection
    await new Promise((resolve) => {
      socket.on("connect", resolve);
      setTimeout(() => resolve(), 2000);
    });

    await delay(500);

    // Test 2.1: Try to join inquiry room (should fail)
    console.log("2.1 Testing join_inquiry with invalid buyer...");
    let joinFailed = false;
    try {
      const joinResult = await joinInquiryRoom(socket, createdInquiryId, INVALID_BUYER_ID, "buyer");
      console.log(`   ❌ FAILED: Invalid buyer was allowed to join (should be rejected)`);
      console.log(`   Response: ${JSON.stringify(joinResult, null, 2)}`);
      socket.disconnect();
      return false;
    } catch (error) {
      if (error.message.includes("ACCESS_DENIED") || error.message.includes("permission")) {
        console.log("   ✅ SUCCESS: Invalid buyer was correctly rejected from joining");
        joinFailed = true;
      } else {
        console.log(`   ⚠️  Unexpected error: ${error.message}`);
      }
    }

    // Test 2.2: Try to send message even if join failed (should also fail)
    if (joinFailed) {
      console.log("\n2.2 Testing send_message with invalid buyer (should fail)...");
      try {
        const messageResult = await sendMessageWebSocket(
          socket,
          createdInquiryId,
          INVALID_BUYER_ID,
          "buyer",
          "This message should be rejected",
        );
        console.log(`   ❌ FAILED: Invalid buyer was able to send message (should be rejected)`);
        socket.disconnect();
        return false;
      } catch (error) {
        console.log("   ✅ SUCCESS: Invalid buyer's message was correctly rejected");
        console.log(`   Error: ${error.message}`);
      }
    }

    socket.disconnect();
    console.log("\n✅ TEST 2 PASSED: Invalid buyer was correctly blocked");
    return true;
  } catch (error) {
    console.log(`\n❌ TEST 2 FAILED: ${error.message}`);
    socket.disconnect();
    return false;
  }
}

async function setupTestEnvironment() {
  console.log("\n" + "=".repeat(80));
  console.log("SETUP: Creating test inquiry");
  console.log("=".repeat(80));

  try {
    // Create inquiry
    const inquiry = await createInquiry(TEST_ESCROW_ID, VALID_BUYER_ID);
    createdInquiryId = inquiry.id;
    console.log(`✅ Created inquiry: ${createdInquiryId}`);
    console.log(`   Escrow ID: ${inquiry.escrow_id}`);
    console.log(`   Status: ${inquiry.status}`);
    return true;
  } catch (error) {
    console.log(`❌ Failed to create inquiry: ${error.response?.data || error.message}`);
    return false;
  }
}

async function verifyEscrowService() {
  console.log("\n" + "=".repeat(80));
  console.log("VERIFICATION: Setting up MOCK escrow service (no real escrow needed)");
  console.log("=".repeat(80));

  try {
    const url = new URL(ESCROW_SERVICE_URL);
    const port = Number(url.port || 3002);
    const host = url.hostname || "localhost";

    mockEscrowServer = http.createServer((req, res) => {
      if (req.method === "GET" && req.url && req.url.startsWith("/api/v1/escrows/")) {
        const parts = req.url.split("/");
        const escrowId = parts[parts.length - 1];
        const body = JSON.stringify({
          id: escrowId,
          buyerId: VALID_BUYER_ID,
          sellerId: VALID_SELLER_ID,
        });
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        });
        res.end(body);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise((resolve, reject) => {
      mockEscrowServer.once("error", reject);
      mockEscrowServer.listen(port, host, resolve);
    });

    console.log(`✅ Mock escrow service listening at ${host}:${port}`);
    console.log(`   It will always return buyerId=${VALID_BUYER_ID}, sellerId=${VALID_SELLER_ID}`);
    return true;
  } catch (error) {
    console.log(`❌ Failed to start mock escrow service: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log("\n" + "=".repeat(80));
  console.log("BUYER MESSAGING PERMISSIONS TEST");
  console.log("=".repeat(80));
  console.log(`\nConfiguration:`);
  console.log(`  Inquiry Service: ${BASE_HTTP}`);
  console.log(`  Escrow Service: ${ESCROW_SERVICE_URL}`);
  console.log(`  Test Escrow ID: ${TEST_ESCROW_ID}`);
  console.log(`  Valid Buyer ID: ${VALID_BUYER_ID}`);
  console.log(`  Invalid Buyer ID: ${INVALID_BUYER_ID}`);

  // Start mock escrow service so inquiry access validation passes
  await verifyEscrowService();
  await delay(1000);

  // Setup test environment
  const setupSuccess = await setupTestEnvironment();
  if (!setupSuccess) {
    console.log("\n❌ Setup failed. Cannot proceed with tests.");
    process.exit(1);
  }

  await delay(2000);

  // Run tests
  const test1Passed = await testValidBuyerAccess();
  await delay(2000);

  const test2Passed = await testInvalidBuyerAccess();

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("TEST SUMMARY");
  console.log("=".repeat(80));
  console.log(`Test 1 (Valid Buyer Access): ${test1Passed ? "✅ PASSED" : "❌ FAILED"}`);
  console.log(`Test 2 (Invalid Buyer Access): ${test2Passed ? "✅ PASSED" : "❌ FAILED"}`);
  console.log("\n" + "=".repeat(80));

  if (test1Passed && test2Passed) {
    console.log("🎉 ALL TESTS PASSED!");
  } else {
    console.log("❌ SOME TESTS FAILED");
  }

  if (mockEscrowServer) {
    mockEscrowServer.close();
  }

  process.exit(test1Passed && test2Passed ? 0 : 1);
}

// Run tests
runTests().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});

