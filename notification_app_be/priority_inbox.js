const { Log } = require('../logging_middleware/logger');

const data = [
  { ID: "b044cdc4-df24-49be-8719-eaaa8c47fe33", Type: "Event", Message: "cult-fest", Timestamp: "2026-05-10 20:00:55" },
  { ID: "3936fe03-54c2-43ea-a4fd-c92e9399e612", Type: "Result", Message: "mid-sem", Timestamp: "2026-05-10 14:30:47" },
  { ID: "8b2b134d-b6fb-4277-936d-43ba1dd7ddf2", Type: "Result", Message: "internal", Timestamp: "2026-05-10 15:30:39" },
  { ID: "3517a9a9-8930-4c5c-a9bf-87a915362df1", Type: "Event", Message: "tech-fest", Timestamp: "2026-05-10 15:00:31" },
  { ID: "3ea2a3f8-3658-468e-843b-2800ae231db1", Type: "Result", Message: "end-sem", Timestamp: "2026-05-11 01:00:23" },
  { ID: "200818d7-345a-4608-a3b6-2ece1ae85114", Type: "Result", Message: "external", Timestamp: "2026-05-11 06:30:15" },
  { ID: "f1c59e7d-60c5-400b-a233-e33c577eb33a", Type: "Placement", Message: "Amazon.com Inc. hiring", Timestamp: "2026-05-11 01:00:07" },
  { ID: "1f7586ea-9d85-460f-abad-58465a6bdf3c", Type: "Result", Message: "project-review", Timestamp: "2026-05-10 07:29:59" },
  { ID: "8edbbce1-0f13-48b5-8409-014052f51d81", Type: "Placement", Message: "Amgen Inc. hiring", Timestamp: "2026-05-10 14:59:51" },
  { ID: "e5b36594-cafc-4a9b-b09c-16926ec22a4b", Type: "Event", Message: "tech-fest", Timestamp: "2026-05-10 17:29:43" },
  { ID: "34104185-e642-4513-bf57-04cd9c194f4c", Type: "Placement", Message: "Amazon.com Inc. hiring", Timestamp: "2026-05-10 23:29:35" },
  { ID: "46f2253e-bf79-45a1-8768-c8dd007f7010", Type: "Result", Message: "end-sem", Timestamp: "2026-05-10 18:59:27" },
  { ID: "554becdc-a800-4e6c-aceb-a82baa9c0904", Type: "Placement", Message: "Apple Inc. hiring", Timestamp: "2026-05-11 02:59:19" },
  { ID: "b77f2035-4c88-4f51-b60b-874403331f44", Type: "Result", Message: "external", Timestamp: "2026-05-10 19:29:11" },
  { ID: "9ab6ff31-f6d4-43c7-9685-6ac5251eb424", Type: "Result", Message: "project-review", Timestamp: "2026-05-10 11:29:03" },
  { ID: "66e8ce49-9dc4-4641-93e9-0c0f043b0361", Type: "Placement", Message: "Broadcom Inc. hiring", Timestamp: "2026-05-10 12:58:55" },
  { ID: "dc3168f3-7d78-4f13-8d61-93f535168731", Type: "Event", Message: "cult-fest", Timestamp: "2026-05-10 10:58:47" },
  { ID: "ba556d3e-9734-401d-9075-2f7d42f16ce6", Type: "Event", Message: "traditional-day", Timestamp: "2026-05-10 16:58:39" },
  { ID: "904ea8e3-6499-49d4-ac10-6c64bd598c41", Type: "Placement", Message: "Alphabet Inc. Class A hiring", Timestamp: "2026-05-10 12:28:31" },
  { ID: "8ac0cc4e-f89e-4e18-bb23-b2314d8c8f7c", Type: "Result", Message: "end-sem", Timestamp: "2026-05-11 06:58:23" }
];

const typeW = { 'Placement': 1.0, 'Result': 0.8, 'Event': 0.5 };

function getScore(n) {
  const w = typeW[n.Type] || 0.3;
  const elapsed = Date.now() - new Date(n.Timestamp).getTime();
  const hrs = elapsed / 3600000;
  const fresh = Math.max(0, 1 - (hrs / 168));
  return parseFloat(((w * 0.6) + (fresh * 0.4)).toFixed(4));
}

class PriorityQueue {
  constructor() { this.heap = []; }

  push(val) {
    this.heap.push(val);
    let idx = this.heap.length - 1;
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[parent].score >= this.heap[idx].score) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  pop() {
    if (!this.heap.length) return null;
    const top = this.heap[0];
    const tail = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = tail;
      let idx = 0;
      while (true) {
        let largest = idx;
        const left = 2 * idx + 1;
        const right = 2 * idx + 2;
        if (left < this.heap.length && this.heap[left].score > this.heap[largest].score) largest = left;
        if (right < this.heap.length && this.heap[right].score > this.heap[largest].score) largest = right;
        if (largest === idx) break;
        [this.heap[largest], this.heap[idx]] = [this.heap[idx], this.heap[largest]];
        idx = largest;
      }
    }
    return top;
  }

  get size() { return this.heap.length; }
}

function main() {
  const limit = 10;
  Log('backend', 'info', 'controller', 'Priority Inbox started');
  Log('backend', 'info', 'controller', `Processing ${data.length} notifications`);

  const pq = new PriorityQueue();
  for (const item of data) {
    const s = getScore(item);
    pq.push({
      id: item.ID, type: item.Type, msg: item.Message,
      time: item.Timestamp, score: s
    });
    Log('backend', 'debug', 'domain', `Scored: [${item.Type}] ${item.Message} => ${s}`);
  }

  Log('backend', 'info', 'controller', `Extracting top ${limit} from priority queue`);

  let pos = 1;
  while (pos <= limit && pq.size > 0) {
    const entry = pq.pop();
    Log('backend', 'info', 'domain', `#${pos} | ${entry.type} | ${entry.msg} | score: ${entry.score} | ${entry.time} | ${entry.id}`);
    pos++;
  }

  Log('backend', 'info', 'controller', `Done. Total notifications processed: ${data.length}`);
}

main();
