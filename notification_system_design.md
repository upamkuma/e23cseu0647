# Notification System Design

## Stage 1

### What we're building

So basically we need a notification system for a college campus. Students should be able to see updates about placements, events and results. The frontend guys need proper APIs to work with, and we also want real-time stuff so they dont have to keep refreshing.

### Main operations needed

- Get a student's notifications (with filters like type, read/unread)
- Mark one as read
- Create new notification (admin/HR triggers this)
- Get unread count for showing on the bell icon
- Push notifications in real time using websockets

### API Design

#### 1. Fetch notifications

```
GET /api/notifications?studentId=1042&page=1&limit=20&type=Placement&isRead=false
```

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (200):**
```json
{
  "success": true,
  "notifications": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "type": "Placement",
      "message": "TCS visiting campus on May 20 for placements",
      "isRead": false,
      "timestamp": "2026-05-10T09:30:00Z",
      "studentId": 1042
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "type": "Event",
      "message": "Hackathon registrations close tomorrow",
      "isRead": false,
      "timestamp": "2026-05-09T14:15:00Z",
      "studentId": 1042
    }
  ],
  "page": 1,
  "limit": 20,
  "totalCount": 47,
  "totalPages": 3
}
```

#### 2. Mark as read

```
PATCH /api/notifications/:notificationId/read
```

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "studentId": 1042
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "notificationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "readAt": "2026-05-11T10:22:00Z"
}
```

#### 3. Create notification

```
POST /api/notifications
```

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "studentIds": [1042, 1043, 1044],
  "type": "Result",
  "message": "Sem 6 results published on portal"
}
```

For broadcasting to everyone:
```json
{
  "broadcast": true,
  "type": "Event",
  "message": "Annual tech fest starts next week"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Notification queued",
  "recipientCount": 3,
  "notificationId": "c3d4e5f6-a7b8-9012-cdef-123456789012"
}
```

#### 4. Unread count

```
GET /api/notifications/unread-count?studentId=1042
```

**Response (200):**
```json
{
  "success": true,
  "unreadCount": 14
}
```

#### 5. Mark all read

```
PATCH /api/notifications/mark-all-read
```

**Body:**
```json
{
  "studentId": 1042
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "All marked as read",
  "updatedCount": 14
}
```

### Real-time part (WebSocket)

Im using Socket.IO for this. When student opens the app, client connects to websocket server and joins a room based on their id.

**How it works:**
```
Client connects to ws://server/notifications
Sends jwt token for auth
Server puts them in room: student_1042
```

When new notif is created via POST endpoint, after db save we emit to the students room:

```javascript
io.to(`student_${studentId}`).emit('new_notification', {
  id: savedNotif.id,
  type: savedNotif.type,
  message: savedNotif.message,
  timestamp: savedNotif.timestamp
});
```

No polling needed. Client also listens for `unread_count_update` event for the badge.

### Error format

Every error follows same structure:
```json
{
  "success": false,
  "error": {
    "code": "STUDENT_NOT_FOUND",
    "message": "No student with id 9999"
  }
}
```

Status codes: 400 (bad input), 401 (not authorized), 404 (not found), 500 (server issue).

---

## Stage 2

### Why PostgreSQL

Went with Postgres for this. The data is relational — students, notifications, read status etc. We need consistency here, like if a student marks something read it should reflect immediately. Postgres handles concurrent reads and writes pretty well.

Thought about MongoDB but once you start filtering by type, sorting by time and doing aggregations like unread count, a relational db with proper indexes is way more predictable and efficient.

### Tables

```sql
CREATE TABLE students (
    student_id    INT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    branch        VARCHAR(50),
    year          SMALLINT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id        INT NOT NULL REFERENCES students(student_id),
    notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('Event', 'Result', 'Placement')),
    message           TEXT NOT NULL,
    is_read           BOOLEAN DEFAULT false,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    read_at           TIMESTAMPTZ
);
```

### Indexes

Created these based on the query patterns from stage 1:

```sql
CREATE INDEX idx_notif_student_time ON notifications(student_id, created_at DESC);

CREATE INDEX idx_notif_unread ON notifications(student_id, created_at DESC)
    WHERE is_read = false;

CREATE INDEX idx_notif_type ON notifications(student_id, notification_type, created_at DESC);
```

The partial index on `is_read = false` is kinda important. Most notifications get read eventually so this index stays small and covers the most common query pattern.

### Queries

**Get paginated notifications:**
```sql
SELECT id, notification_type, message, is_read, created_at
FROM notifications
WHERE student_id = 1042
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
```

**Unread count:**
```sql
SELECT COUNT(*) AS unread_count
FROM notifications
WHERE student_id = 1042 AND is_read = false;
```

**Mark read:**
```sql
UPDATE notifications
SET is_read = true, read_at = NOW()
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND student_id = 1042;
```

**New notification:**
```sql
INSERT INTO notifications (student_id, notification_type, message)
VALUES (1042, 'Placement', 'Infosys shortlist out - check portal');
```

### When data grows

Old notifications can be archived. We can partition the table by `created_at` (monthly maybe), so postgres skips old partitions for recent queries. Also read replicas help for scaling read heavy loads.

---

## Stage 3

### Why is this query slow

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

With 50k students and 5 million notifications this is gonna be painful. Without proper index postgres does a full table scan on 5M rows, filters by student, then by read status, then sorts by time. Thats way too much work.

### What id change

First thing - dont use `SELECT *`. Frontend probably only needs id, type, message and timestamp. Fetching everything wastes IO.

Second - add a composite index that matches exactly what this query needs:
```sql
CREATE INDEX idx_student_unread ON notifications(student_id, created_at DESC)
    WHERE is_read = false;
```

This partial index handles the WHERE and ORDER BY in one go. Postgres can satisfy the query directly from the index without even touching the main table.

### Is indexing every column a good idea?

No thats actually bad advice. Heres why:

- Each index slows down writes. Every INSERT and UPDATE has to update all indexes too. With 5M rows and frequent new notifications coming in, write performance tanks
- Indexes take disk space. Indexing every column on a 5M row table wastes GBs for nothing
- Most of those indexes will never get used. If no query filters by message text, that index is useless but still costing you on every write

You should only index columns that appear in WHERE, ORDER BY or JOIN of queries that actually run frequently.

### Finding placement notifications from last 7 days

```sql
SELECT id, student_id, message, created_at
FROM notifications
WHERE notification_type = 'Placement'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

Index for this:
```sql
CREATE INDEX idx_type_recent ON notifications(notification_type, created_at DESC);
```

---

## Stage 4

### Whats happening

Every page load fetches notifications from the db. With 50k students thats potentially thousands of queries per second just for notifications. DB gets overwhelmed and everything becomes slow.

### How to fix it

**1. Redis caching**

This is the biggest win. Instead of hitting postgres everytime, cache stuff in Redis:

- Store unread count as simple key: `unread:1042 → 14` with 60-90 sec TTL
- Cache first page of notifications in a sorted set
- When new notification comes in: INCR the counter, add to sorted set
- On mark-as-read: DECR counter, update set
- Bulk operations: just delete the key, let it refill on next request

This removes like 80-90% of db reads because most students check notifications within few minutes and cache stays warm.

**2. Proper pagination**

Never load everything at once. Use cursor based pagination:
```
GET /api/notifications?studentId=1042&cursor=2026-05-10T09:30:00Z&limit=20
```

Cursor is timestamp of last item on current page. Better than OFFSET because:
- Doesnt get slower on deeper pages
- Results stay consistent even if new notifications arrive between loads

**3. WebSocket instead of polling**

If frontend polls every 5 seconds thats 10 requests/min per user. 50k users = 500k requests/min hitting the db for basically nothing since most polls return empty.

Use websocket push (like in stage 1). Server only sends data when something actually changes.

**4. Database level stuff**

- Connection pooling with PgBouncer (avoids creating new connection per request)
- Read replicas for GET endpoints
- Partial indexes so queries scan minimum data

### Tradeoffs

| Approach | Good part | Bad part |
|----------|-----------|----------|
| Redis cache | Massively reduces db reads | Data can be slightly stale, invalidation is tricky |
| Cursor pagination | Fast regardless of page depth | Cant jump to page N directly |
| WebSocket | Zero polling overhead | More infra to manage, connection handling |
| Read replicas | Scales reads horizontally | Small replication lag |

Honestly just Redis + WebSocket probably fixes 95% of the problem without changing anything in the db.

---

## Stage 5

### Whats wrong with the current code

```
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)
        save_to_db(student_id, message)
        push_realtime(student_id, message)
```

This has bunch of problems:

1. **Its doing everything one by one.** 50k students, if each email takes 200ms, thats 50000 × 0.2 = roughly 2.7 hours for just emails. HR is sitting there waiting the whole time.

2. **No error handling at all.** If email fails for student 201, the loop might just crash. Students 202 to 50000 never get anything. And the 200 who already got emails cant be undone.

3. **Everything is coupled together.** DB save and email send happen in same loop. If email service goes down we stop saving to db too even though they have nothing to do with each other.

4. **No retries.** Those 200 failed emails are just gone. Nobody knows which failed, no way to try again.

5. **If server crashes midway** we have no idea where it stopped. Some students got it, some didnt, no record of who.

### Should db save and email happen together?

No way. They should be separate. Saving to db is fast and on our own infra. Email depends on external service which can be slow, rate limited or temporarily down. Coupling them means a flaky email API blocks the db write too.

### Better design

```
function notify_all(student_ids: array, message: string):
    notification_ids = bulk_insert_notifications(student_ids, message)
    
    for each (student_id, notif_id) in zip(student_ids, notification_ids):
        queue.publish("notification_jobs", {
            student_id: student_id,
            notif_id: notif_id,
            message: message,
            channels: ["email", "realtime"],
            attempt: 1
        })
    
    return { status: "queued", total: student_ids.length }


function process_notification_job(job):
    try:
        if "email" in job.channels:
            send_email(job.student_id, job.message)
            log_delivery(job.notif_id, "email", "sent")
        
        if "realtime" in job.channels:
            push_realtime(job.student_id, job.message)
            log_delivery(job.notif_id, "realtime", "sent")
    
    catch error:
        if job.attempt < 5:
            delay = 2^job.attempt seconds + random jitter
            queue.publish_with_delay("notification_jobs", {
                ...job,
                attempt: job.attempt + 1
            }, delay)
            log_delivery(job.notif_id, "email", "retry_scheduled", error)
        else:
            queue.publish("failed_notifications", job)
            log_delivery(job.notif_id, "email", "failed_permanently", error)
```

### Why this is better

- **DB write comes first**, in bulk. Even if everything else breaks, notifications are in the database and students see them when they open the app.
- **Message queue (like Kafka or RabbitMQ)** handles the sending separately. Multiple workers can consume from queue in parallel. 10 workers = 10x faster than one loop.
- **Exponential backoff for retries.** Failed emails get retried at 2s, 4s, 8s, 16s, 32s gaps. Random jitter added so all retries dont hit the email service at same time.
- **Dead letter queue** for permanently failed ones. Admin can see these on a dashboard and retry or investigate manually.
- **Idempotency built in.** Each job has unique notif_id. Worker checks if already sent before sending (handles queue redelivery scenarios).
- **HR gets instant response.** API returns right after queueing. Progress tracker shows "45231 / 50000 sent" via websocket.

---

## Stage 6

### How priority inbox works

Instead of just showing notifications by time, we want to show the most important ones first. Like a placement notification from 2 hours ago should rank higher than a random event reminder from 10 minutes ago.

### Scoring

```
priority_score = (type_weight × 0.6) + (recency × 0.4)
```

**Type weights:**
| Type | Weight |
|------|--------|
| Placement | 1.0 |
| Result | 0.8 |
| Event | 0.5 |

**Recency:** goes from 1.0 (just now) to 0 (7 days old).

```
recency = max(0, 1 - (hours_old / 168))
```

Example - Placement from 3 hours ago:
```
(1.0 × 0.6) + (0.98 × 0.4) = 0.6 + 0.392 = 0.992
```

Event from 1 hour ago:
```
(0.5 × 0.6) + (0.99 × 0.4) = 0.3 + 0.396 = 0.696
```

Placement still ranks higher even tho its older. Thats the behaviour we want.

### Using a max-heap

I built a max-heap to keep the top N notifications efficiently. Push everything in with their scores, extract top N. Heap gives O(log n) insert and O(log n) extract which is good enough.

The actual code is in `notification_app_be/priority_inbox.js`.

What it does:
1. Takes notifications from the API
2. Calculates score for each one
3. Pushes into max-heap
4. Extracts top 10 ranked by priority

### Why heap and not just sort?

For one time ranking, sorting works fine honestly. But in a real system where notifications keep coming in, a heap lets you maintain running top-N without resorting the whole list every time something new arrives. Insert is O(log n) compared to O(n log n) for full resort.

In production id use a Redis sorted set. ZADD with priority score, ZREVRANGE for top N. Same complexity but distributed and persistent across restarts.
