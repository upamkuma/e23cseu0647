const { Log } = require('../logging_middleware/logger');

const depots = [
  { ID: 1, MechanicHours: 60 },
  { ID: 2, MechanicHours: 135 },
  { ID: 3, MechanicHours: 188 },
  { ID: 4, MechanicHours: 97 },
  { ID: 5, MechanicHours: 164 }
];

const tasks = [
  { TaskID: "24247c2a-f582-4c1c-bd97-6263754d21b9", Duration: 1, Impact: 8 },
  { TaskID: "4eb79737-2fca-4cae-beda-d9cdcc7ee917", Duration: 8, Impact: 10 },
  { TaskID: "c6ac6330-23f5-4ad5-8a32-f9ab5d7b9b9b", Duration: 6, Impact: 4 },
  { TaskID: "a38ab8d9-8666-494f-8907-86f008a2e103", Duration: 7, Impact: 3 },
  { TaskID: "d8c83112-5bea-4c02-8211-4d761412e968", Duration: 5, Impact: 2 },
  { TaskID: "1b945968-c74f-4af8-8754-09fe745192c7", Duration: 8, Impact: 2 },
  { TaskID: "53396759-1fa4-4091-8836-a20662152be0", Duration: 5, Impact: 2 },
  { TaskID: "60b6f32d-abd7-4653-b625-adafb21c1cdf", Duration: 2, Impact: 4 },
  { TaskID: "f2e48ff1-4bfe-428f-be25-7cec3214a5cf", Duration: 6, Impact: 7 },
  { TaskID: "86449124-4385-4883-92c7-da857091df44", Duration: 5, Impact: 3 },
  { TaskID: "63d1ab3c-b0a0-489c-ac42-d696398011ca", Duration: 6, Impact: 6 },
  { TaskID: "578e24f0-c7aa-4d2d-bef1-9b6fe8d3de51", Duration: 8, Impact: 2 },
  { TaskID: "edc90d14-82d0-433d-982f-8aee0ef1fbdc", Duration: 5, Impact: 3 },
  { TaskID: "be6f1d24-baac-4e59-82c0-e8e86ebd3322", Duration: 5, Impact: 8 },
  { TaskID: "2453b834-52af-46b5-9307-0ca1b0703118", Duration: 3, Impact: 9 },
  { TaskID: "1a2f1e4d-34d2-41ce-93f5-b7d348bd63f1", Duration: 4, Impact: 8 },
  { TaskID: "fe2a4a98-1a59-4c2d-a88a-2b315bc4ca7d", Duration: 5, Impact: 10 },
  { TaskID: "c149aa73-4cc1-41e6-b5bc-07bf3089c802", Duration: 4, Impact: 7 },
  { TaskID: "e06747ef-70e6-4dc3-8fba-73174e60b035", Duration: 6, Impact: 9 },
  { TaskID: "3b56c201-2a9f-4448-9dcd-155b6a17057f", Duration: 7, Impact: 1 },
  { TaskID: "1ff05df1-5a84-4e81-a0e3-ca7480c2f6aa", Duration: 8, Impact: 5 },
  { TaskID: "337f0045-4f55-4eff-a12c-ed1b0190afe5", Duration: 6, Impact: 7 },
  { TaskID: "0543271b-be0c-451e-945a-708ff841e978", Duration: 1, Impact: 10 },
  { TaskID: "0ff8b25e-a5ab-45b5-b75f-8e2ea2fbe5bc", Duration: 8, Impact: 7 },
  { TaskID: "0984f3b9-534c-4bb4-bae9-e601b397538c", Duration: 1, Impact: 6 },
  { TaskID: "3be623d8-61d7-409f-ab09-5a78fd3686d3", Duration: 1, Impact: 5 },
  { TaskID: "cdbd852f-ebd9-4daf-a633-4f9bf3ecc7d6", Duration: 8, Impact: 10 },
  { TaskID: "a7131c8e-c63f-432d-a964-36243150b1d3", Duration: 4, Impact: 8 },
  { TaskID: "2bd660e7-f700-491c-abe8-98154453bc7b", Duration: 5, Impact: 8 },
  { TaskID: "d75739d4-3d78-4e90-abca-fe54cc346e75", Duration: 8, Impact: 3 },
  { TaskID: "4a853cdb-67c5-4951-b66c-27e09e52fc55", Duration: 3, Impact: 6 },
  { TaskID: "e704f5ad-3ee9-4bde-ada0-a1dae4f44043", Duration: 1, Impact: 3 },
  { TaskID: "9cbb2cf2-484e-4c80-b2ed-6f92c74ed261", Duration: 2, Impact: 4 }
];

function solve(items, budget) {
  const n = items.length;
  const cap = Math.floor(budget);
  const dp = new Array(cap + 1).fill(0);
  const chosen = Array.from({ length: cap + 1 }, () => []);

  for (let i = 0; i < n; i++) {
    const d = items[i].Duration;
    const s = items[i].Impact;
    for (let w = cap; w >= d; w--) {
      if (dp[w - d] + s > dp[w]) {
        dp[w] = dp[w - d] + s;
        chosen[w] = [...chosen[w - d], i];
      }
    }
  }
  return { best: dp[cap], picks: chosen[cap] };
}

function run() {
  Log('backend', 'info', 'controller', 'Vehicle Maintenance Scheduler started');
  Log('backend', 'info', 'controller', `Found ${depots.length} depots and ${tasks.length} tasks`);

  for (const d of depots) {
    Log('backend', 'info', 'domain', `Processing Depot ${d.ID} with budget ${d.MechanicHours} hours`);
    const { best, picks } = solve(tasks, d.MechanicHours);

    Log('backend', 'info', 'domain', `Depot ${d.ID} | Max Impact: ${best} | Selected: ${picks.length} tasks`);

    let used = 0;
    picks.forEach(idx => {
      const t = tasks[idx];
      Log('backend', 'debug', 'domain', `  ${t.TaskID} | ${t.Duration}h | impact: ${t.Impact}`);
      used += t.Duration;
    });

    Log('backend', 'info', 'domain', `Depot ${d.ID} | Hours used: ${used} / ${d.MechanicHours}`);
  }

  Log('backend', 'info', 'controller', 'Scheduler finished successfully');
}

run();
