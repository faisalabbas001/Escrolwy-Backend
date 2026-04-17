# Frontend WebSocket Real-Time Chat Implementation

## ✅ Your Code Supports TRUE Real-Time Chat via WebSocket

Your backend has **TWO ways** to send messages:

1. **WebSocket `send_message` event** ← **USE THIS for real-time chat** (no HTTP latency)
2. **HTTP POST `/api/v1/inquiries/:id/messages`** ← Only for testing/fallback (adds HTTP latency)

---

## Frontend Implementation (TypeScript/JavaScript)

### Step 1: Connect to WebSocket

```typescript
import { io, Socket } from 'socket.io-client';

const WS_URL = 'http://localhost:3003/inquiry'; // or your production URL
const socket: Socket = io(WS_URL, {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Connected to inquiry WebSocket:', socket.id);
});
```

### Step 2: Join Inquiry Room

```typescript
function joinInquiryRoom(inquiryId: string, userId: string, userRole: 'buyer' | 'seller' | 'admin') {
  socket.emit('join_inquiry', {
    inquiry_id: inquiryId,
    user_id: userId,
    user_role: userRole
  }, (ack) => {
    if (ack.success) {
      console.log('Joined room! Participants:', ack.participants);
    }
  });
}
```

### Step 3: Send Message via WebSocket (REAL-TIME, NO HTTP LATENCY)

```typescript
function sendMessage(
  inquiryId: string,
  senderId: string,
  senderRole: 'buyer' | 'seller' | 'admin',
  message: string
) {
  socket.emit('send_message', {
    inquiry_id: inquiryId,
    sender_id: senderId,
    sender_role: senderRole,
    message: message
  }, (ack) => {
    if (ack.success) {
      console.log('Message sent successfully:', ack.message);
      // Message is already broadcast to all room participants
      // You'll receive it via 'message_received' event below
    } else {
      console.error('Failed to send message');
    }
  });
}
```

### Step 4: Listen for Real-Time Messages

```typescript
socket.on('message_received', (payload: MessageReceivedPayload) => {
  console.log('New message received:', payload);
  // Update your UI with the new message
  // payload contains: id, inquiry_id, sender_id, sender_role, message, created_at
});

socket.on('attachment_uploaded', (payload: AttachmentUploadedPayload) => {
  console.log('New attachment:', payload);
  // Update UI to show attachment
});

socket.on('inquiry_updated', (payload: InquiryUpdatedPayload) => {
  console.log('Inquiry updated:', payload);
  // Handle status changes, admin assignments, etc.
});

socket.on('user_joined', (payload: UserPresencePayload) => {
  console.log('User joined:', payload);
  // Update participant list
});

socket.on('user_left', (payload: UserPresencePayload) => {
  console.log('User left:', payload);
  // Update participant list
});
```

---

## Complete Example (React Hook)

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  inquiry_id: string;
  sender_id: string;
  sender_role: 'buyer' | 'seller' | 'admin';
  message: string;
  created_at: string;
}

export function useInquiryChat(
  inquiryId: string,
  userId: string,
  userRole: 'buyer' | 'seller' | 'admin'
) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = io('http://localhost:3003/inquiry', {
      transports: ['websocket', 'polling']
    });

    ws.on('connect', () => {
      console.log('Connected');
      setIsConnected(true);
      
      // Join the inquiry room
      ws.emit('join_inquiry', {
        inquiry_id: inquiryId,
        user_id: userId,
        user_role: userRole
      });
    });

    ws.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for new messages
    ws.on('message_received', (payload: MessageReceivedPayload) => {
      setMessages(prev => [...prev, payload]);
    });

    setSocket(ws);

    return () => {
      ws.disconnect();
    };
  }, [inquiryId, userId, userRole]);

  const sendMessage = (message: string) => {
    if (!socket || !isConnected) return;

    socket.emit('send_message', {
      inquiry_id: inquiryId,
      sender_id: userId,
      sender_role: userRole,
      message: message
    }, (ack) => {
      if (!ack.success) {
        console.error('Failed to send message');
      }
      // Note: You'll receive the message via 'message_received' event
      // Don't add it to state here - wait for the event
    });
  };

  return {
    socket,
    messages,
    isConnected,
    sendMessage
  };
}
```

---

## Performance Comparison

| Method | Latency | Use Case |
|--------|---------|----------|
| **WebSocket `send_message`** | ~10-50ms | ✅ **Real-time chat (production)** |
| HTTP POST + WebSocket broadcast | ~100-300ms | ⚠️ Testing/fallback only |

---

## Important Notes

1. **Always use WebSocket `send_message` for chat** - it's instant
2. **HTTP endpoint is just for testing** - don't use it in production chat
3. **Messages are broadcast to ALL room participants** automatically
4. **You'll receive your own message** via `message_received` event (don't add it to UI twice)
5. **Typing indicators** are also available via `typing_start` / `typing_stop` events

---

## Event Names (from your DTO)

```typescript
// Client → Server
'join_inquiry'
'leave_inquiry'
'send_message'        // ← USE THIS for sending messages
'typing_start'
'typing_stop'

// Server → Client
'message_received'   // ← Listen for this
'attachment_uploaded'
'user_joined'
'user_left'
'user_typing'
'inquiry_updated'
'error'
```

