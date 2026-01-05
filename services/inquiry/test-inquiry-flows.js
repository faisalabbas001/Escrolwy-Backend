// Simple test runner for Inquiry Service flows
// Usage:
//   node test-inquiry-flows.js flow1
//   node test-inquiry-flows.js flow2
//
// Flow 1:
//   - Super admin, buyer, and seller join the inquiry room
//   - They exchange messages
//   - An attachment record is created
//   - Super admin resolves the inquiry
//
// Flow 2:
//   - Same as above, but super admin assigns the inquiry to another admin
//   - Assigned admin joins the room, sends messages, and resolves the inquiry

/* eslint-disable @typescript-eslint/no-var-requires */
const axios = require("axios");
const { io } = require("socket.io-client");

const BASE_HTTP = "http://localhost:3003/api/v1";
const WS_URL = "http://localhost:3003/inquiry";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createClient(name, userId, userRole, inquiryId) {
  const socket = io(WS_URL, {
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log(`[${name}] connected: ${socket.id}`);
    socket.emit(
      "join_inquiry",
      {
        inquiry_id: inquiryId,
        user_id: userId,
        user_role: userRole,
      },
      (ack) => {
        console.log(`[${name}] join_inquiry ack:`, ack);
      },
    );
  });

  socket.on("disconnect", () => {
    console.log(`[${name}] disconnected`);
  });

  socket.on("message_received", (payload) => {
    console.log(`[${name}] WS message_received:`, payload);
  });

  socket.on("attachment_uploaded", (payload) => {
    console.log(`[${name}] WS attachment_uploaded:`, payload);
  });

  socket.on("inquiry_updated", (payload) => {
    console.log(`[${name}] WS inquiry_updated:`, payload);
  });

  socket.on("user_joined", (payload) => {
    console.log(`[${name}] WS user_joined:`, payload);
  });

  socket.on("user_left", (payload) => {
    console.log(`[${name}] WS user_left:`, payload);
  });

  socket.on("error", (payload) => {
    console.log(`[${name}] WS error:`, payload);
  });

  return socket;
}

async function createInquiry(escrowId, createdBy) {
  const res = await axios.post(`${BASE_HTTP}/inquiries`, {
    escrow_id: escrowId,
    created_by: createdBy,
    initial_message: "Initial inquiry message from test script",
  });
  return res.data;
}

// Method 1: HTTP POST (adds HTTP latency - NOT for real-time chat)
async function postMessageHTTP(inquiryId, senderId, senderRole, message) {
  const res = await axios.post(`${BASE_HTTP}/inquiries/${inquiryId}/messages`, {
    sender_id: senderId,
    sender_role: senderRole,
    message,
  });
  return res.data;
}

// Method 2: WebSocket send_message (TRUE real-time - USE THIS for production chat)
function sendMessageWebSocket(socket, inquiryId, senderId, senderRole, message) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    socket.emit(
      "send_message",
      {
        inquiry_id: inquiryId,
        sender_id: senderId,
        sender_role: senderRole,
        message: message,
      },
      (ack) => {
        const latency = Date.now() - startTime;
        if (ack && ack.success) {
          console.log(`  ⚡ WebSocket latency: ${latency}ms (REAL-TIME)`);
          resolve(ack.message);
        } else {
          reject(new Error("WebSocket send_message failed"));
        }
      },
    );
  });
}

// Keep old function name for backward compatibility (uses HTTP)
async function postMessage(inquiryId, senderId, senderRole, message) {
  return postMessageHTTP(inquiryId, senderId, senderRole, message);
}

async function addAttachment(inquiryId, messageId) {
  const res = await axios.post(
    `${BASE_HTTP}/inquiries/${inquiryId}/attachments`,
    {
      message_id: messageId,
      file_url: "https://example.com/test-doc.pdf",
      file_type: "pdf",
    },
  );
  return res.data;
}

async function resolveInquiry(inquiryId) {
  const res = await axios.post(
    `${BASE_HTTP}/inquiries/admin/inquiries/${inquiryId}/resolve`,
    {
      status: "Refund to Buyer",
      resolution_note: "Test resolution by script",
    },
  );
  return res.data;
}

async function assignInquiry(inquiryId, adminId) {
  const res = await axios.post(
    `${BASE_HTTP}/inquiries/admin/inquiries/${inquiryId}/assign`,
    {
      admin_id: adminId,
    },
  );
  return res.data;
}

async function runFlow1() {
  console.log("=== Running Flow 1: super admin, buyer, seller chat + attachment + resolve ===");

  // Use deterministic UUIDs that satisfy validation
  const buyerId = "550e8400-e29b-41d4-a716-446655440000";
  const sellerId = "550e8400-e29b-41d4-a716-446655440001";
  const superAdminId = "550e8400-e29b-41d4-a716-446655440002";

  const escrowId = `escrow-test-${Date.now()}`;

  console.log("Creating inquiry via HTTP...");
  const inquiry = await createInquiry(escrowId, buyerId);
  console.log("Created inquiry:", inquiry);

  const inquiryId = inquiry.id;

  console.log("Connecting WebSocket clients (buyer, seller, super admin)...");
  const buyerSocket = createClient("buyer", buyerId, "buyer", inquiryId);
  const sellerSocket = createClient("seller", sellerId, "seller", inquiryId);
  const superAdminSocket = createClient("super-admin", superAdminId, "admin", inquiryId);

  // Wait for joins and presence events
  await delay(2000);

  console.log("\n=== Sending messages via WebSocket (REAL-TIME - Production Method) ===");
  console.log("This is how your frontend should send messages for instant delivery.\n");
  
  const m1 = await sendMessageWebSocket(
    buyerSocket,
    inquiryId,
    buyerId,
    "buyer",
    "Hello, I have an issue with this escrow.",
  );
  await delay(500);
  const m2 = await sendMessageWebSocket(
    sellerSocket,
    inquiryId,
    sellerId,
    "seller",
    "Hi, can you explain the issue?",
  );
  await delay(500);
  const m3 = await sendMessageWebSocket(
    superAdminSocket,
    inquiryId,
    superAdminId,
    "admin",
    "Super admin joined. Please share relevant documents.",
  );

  console.log("\n✅ Messages sent via WebSocket (real-time):", { m1, m2, m3 });

  console.log("\n=== Comparison: HTTP method (slower, adds latency) ===");
  console.log("This is what the test script used before - NOT for production chat.\n");
  const httpStart = Date.now();
  const m4 = await postMessageHTTP(
    inquiryId,
    buyerId,
    "buyer",
    "[HTTP] This message used HTTP POST - slower!",
  );
  const httpLatency = Date.now() - httpStart;
  console.log(`  🐌 HTTP latency: ${httpLatency}ms (slower due to HTTP roundtrip)`);
  console.log("  ⚠️  Use WebSocket send_message for production chat!\n");

  // Give WebSocket some time to broadcast the messages
  await delay(2000);

  console.log("Adding attachment linked to super admin message...");
  const attachment = await addAttachment(inquiryId, m3.id);
  console.log("Created attachment:", attachment);

  // Give WebSocket some time to broadcast the attachment
  await delay(2000);

  console.log("Resolving inquiry via admin endpoint...");
  const resolved = await resolveInquiry(inquiryId);
  console.log("Resolved inquiry:", resolved);

  // Wait for inquiry_updated broadcast
  await delay(2000);

  console.log("Closing sockets...");
  buyerSocket.disconnect();
  sellerSocket.disconnect();
  superAdminSocket.disconnect();

  console.log("=== Flow 1 completed ===");
}

async function runFlow2() {
  console.log("=== Running Flow 2: assign to another admin who resolves ===");

  const buyerId = "550e8400-e29b-41d4-a716-446655440000";
  const sellerId = "550e8400-e29b-41d4-a716-446655440001";
  const superAdminId = "550e8400-e29b-41d4-a716-446655440002";
  const assignedAdminId = "550e8400-e29b-41d4-a716-446655440003";

  const escrowId = `escrow-test-${Date.now()}`;

  console.log("Creating inquiry via HTTP...");
  const inquiry = await createInquiry(escrowId, buyerId);
  console.log("Created inquiry:", inquiry);

  const inquiryId = inquiry.id;

  console.log("Connecting WebSocket clients (buyer, seller, super admin)...");
  const buyerSocket = createClient("buyer", buyerId, "buyer", inquiryId);
  const sellerSocket = createClient("seller", sellerId, "seller", inquiryId);
  const superAdminSocket = createClient("super-admin", superAdminId, "admin", inquiryId);

  await delay(2000);

  console.log("Super admin assigning inquiry to another admin...");
  const assigned = await assignInquiry(inquiryId, assignedAdminId);
  console.log("Assigned inquiry:", assigned);

  // Wait for inquiry_updated broadcast
  await delay(2000);

  console.log("Connecting assigned admin WebSocket client...");
  const assignedAdminSocket = createClient(
    "assigned-admin",
    assignedAdminId,
    "admin",
    inquiryId,
  );

  await delay(2000);

  console.log("\n=== Assigned admin sending message via WebSocket (REAL-TIME) ===");
  console.log("This demonstrates that assigned admins can also use WebSocket for instant messaging.\n");
  const mAdmin = await sendMessageWebSocket(
    assignedAdminSocket,
    inquiryId,
    assignedAdminId,
    "admin",
    "Assigned admin here, I will handle this inquiry. (Sent via WebSocket for real-time chat)",
  );

  console.log("✅ Admin message sent via WebSocket (real-time):", mAdmin);

  await delay(2000);

  console.log("Assigned admin resolving inquiry via admin endpoint...");
  const resolved = await resolveInquiry(inquiryId);
  console.log("Resolved inquiry:", resolved);

  await delay(2000);

  console.log("Closing sockets...");
  buyerSocket.disconnect();
  sellerSocket.disconnect();
  superAdminSocket.disconnect();
  assignedAdminSocket.disconnect();

  console.log("=== Flow 2 completed ===");
}

async function main() {
  const flow = process.argv[2];
  if (!flow) {
    console.error("Please provide a flow to run: flow1 or flow2");
    process.exit(1);
  }

  try {
    if (flow === "flow1") {
      await runFlow1();
    } else if (flow === "flow2") {
      await runFlow2();
    } else {
      console.error(`Unknown flow: ${flow}. Use flow1 or flow2.`);
      process.exit(1);
    }
  } catch (err) {
    console.error("Error while running flow:", err.response?.data || err.message || err);
    process.exit(1);
  }
}

main();


