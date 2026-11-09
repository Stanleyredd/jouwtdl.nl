#!/usr/bin/env node
/**
 * Reproducible two-user tenant-isolation test for JouwTDL.
 *
 * Creates two real accounts (User A, User B) through the actual signup +
 * NextAuth credentials login flow, gives each one a daily task, weekly goal,
 * monthly goal, dream, journal entry, and idea, then verifies:
 *
 *   - each user's list endpoints show only their own data;
 *   - unauthenticated requests to protected APIs get 401;
 *   - User B cannot read/update/delete any of User A's records by id
 *     (daily task, weekly goal, monthly goal, dream, journal finalize);
 *   - User B cannot link a new daily task to User A's weekly/monthly goal.
 *   - both users can manage their own ideas, but not each other's by ID.
 *
 * Run against a disposable local app + database only -- never point
 * BASE_URL at a production deployment. See prisma/migrations for schema.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 node scripts/multi-user-isolation-test.mjs
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const RUN_ID = Date.now();

let passCount = 0;
let failCount = 0;
const failures = [];

function ok(condition, label) {
  if (condition) {
    passCount += 1;
    console.log(`  ok   ${label}`);
  } else {
    failCount += 1;
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

function extractSetCookies(response) {
  // Node's fetch exposes multiple Set-Cookie headers via getSetCookie().
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeCookies(jar, setCookieHeaders) {
  for (const header of setCookieHeaders) {
    const [pair] = header.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    jar.set(name, value);
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function signup(email, password) {
  const response = await fetch(`${BASE_URL}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function login(email, password) {
  const jar = new Map();

  const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
  mergeCookies(jar, extractSetCookies(csrfResponse));
  const { csrfToken } = await csrfResponse.json();

  const form = new URLSearchParams({
    email,
    password,
    csrfToken,
    json: "true",
  });

  const loginResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
    },
    body: form.toString(),
    redirect: "manual",
  });
  mergeCookies(jar, extractSetCookies(loginResponse));

  const hasSessionCookie = [...jar.keys()].some((name) =>
    name.includes("session-token"),
  );

  return { jar, ok: hasSessionCookie, status: loginResponse.status };
}

function client(jar) {
  return async function request(path, init = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        Cookie: cookieHeader(jar),
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, body: json, raw: text };
  };
}

async function seedUserData(request, tag) {
  const dailyTask = await request("/api/daily-tasks", {
    method: "POST",
    body: JSON.stringify({
      title: `${tag} daily task`,
      note: "",
      date: "2026-09-17",
      priority: "medium",
      lifeArea: "",
      completed: false,
      carryOverCount: 0,
    }),
  });

  const monthlyGoal = await request("/api/monthly-goals", {
    method: "POST",
    body: JSON.stringify({
      title: `${tag} monthly goal`,
      description: "",
      month: 9,
      year: 2026,
      lifeArea: "",
      status: "not_started",
      progressMode: "linked_items",
      progress: 0,
    }),
  });

  const weeklyGoal = await request("/api/weekly-goals", {
    method: "POST",
    body: JSON.stringify({
      title: `${tag} weekly goal`,
      description: "",
      startDate: "2026-09-14",
      endDate: "2026-09-20",
      lifeArea: "",
      status: "not_started",
      progressMode: "linked_items",
      progress: 0,
      monthlyGoalId: monthlyGoal.body?.monthlyGoal?.id ?? null,
    }),
  });

  const dream = await request("/api/dreams", {
    method: "POST",
    body: JSON.stringify({
      title: `${tag} dream`,
      content: `${tag} dream content`,
      dreamDate: "2026-09-17",
      source: "text",
    }),
  });

  const journalEntry = await request("/api/journal-entries", {
    method: "POST",
    body: JSON.stringify({
      date: "2026-09-17",
      sections: {},
      rawTranscript: `${tag} raw transcript`,
      editedTranscript: `${tag} edited transcript`,
      tomorrowSetup: { mainFocus: "", topTasks: [], watchOutFor: "", intention: "" },
      language: "nl",
      lifeAreas: [],
    }),
  });

  return {
    dailyTaskId: dailyTask.body?.dailyTask?.id,
    weeklyGoalId: weeklyGoal.body?.weeklyGoal?.id,
    monthlyGoalId: monthlyGoal.body?.monthlyGoal?.id,
    dreamId: dream.body?.dream?.id,
    journalEntryDate: journalEntry.body?.journalEntry?.date,
    raw: { dailyTask: dailyTask.body, weeklyGoal: weeklyGoal.body, monthlyGoal: monthlyGoal.body, dream: dream.body, journalEntry: journalEntry.body },
  };
}

async function checkIdeas(requestA, requestB, userIdB) {
  console.log("\n== Ideas: validation, persistence, and ownership ==");
  const anonymous = client(new Map());
  ok((await anonymous("/api/ideas")).status === 401, "Ideas collection requires a session");

  for (const [tag, request] of [["A", requestA], ["B", requestB]]) {
    const list = await request("/api/ideas");
    ok(list.status === 200 && list.body?.ideas?.length === 0, `User ${tag} starts with no ideas`);
  }

  for (const payload of [
    { title: " ", content: "Valid content" },
    { title: "Valid title", content: 123 },
    { title: "Valid title", content: "Valid content", category: "unknown" },
    { title: "a".repeat(161), content: "Valid content" },
    { title: "Valid title", content: "a".repeat(20001) },
  ]) {
    const invalid = await requestA("/api/ideas", { method: "POST", body: JSON.stringify(payload) });
    ok(invalid.status === 400, "Rejects invalid idea fields");
  }
  const textPost = await requestA("/api/ideas", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ title: "Plain-text request", content: "Not application/json" }),
  });
  ok(textPost.status === 400, "Rejects a plain-text write request");

  const createA = await requestA("/api/ideas", {
    method: "POST",
    body: JSON.stringify({ title: "  Idea A  ", content: "  Content A  ", userId: userIdB, status: "completed" }),
  });
  const createB = await requestB("/api/ideas", {
    method: "POST",
    body: JSON.stringify({ title: "Idea B", content: "Content B", category: "trading", priority: "high" }),
  });
  const a = createA.body?.idea;
  const b = createB.body?.idea;
  ok(createA.status === 201 && a?.title === "Idea A" && a.content === "Content A" &&
    a.category === "other" && a.priority === "normal" && a.status === "unprocessed",
  "Create trims text and applies defaults; browser cannot override initial status");
  ok(createB.status === 201 && b?.category === "trading" && b.priority === "high", "Create persists selected category and priority");
  if (!a?.id || !b?.id) return;

  const aPath = `/api/ideas/${a.id}`;
  const bPath = `/api/ideas/${b.id}`;
  const methods = [
    { method: "GET" },
    { method: "PATCH", body: JSON.stringify({ title: "Attempted overwrite" }) },
    { method: "DELETE" },
  ];
  for (const [actor, request, path, ownId] of [
    ["A", requestA, bPath, a.id],
    ["B", requestB, aPath, b.id],
  ]) {
    const list = await request("/api/ideas");
    ok(list.body?.ideas?.length === 1 && list.body.ideas[0].id === ownId, `User ${actor} lists only their own idea`);
    for (const init of methods) {
      const result = await request(path, init);
      ok(result.status === 404, `User ${actor} cannot ${init.method} the other user's idea by ID`);
    }
  }
  for (const init of methods) {
    ok((await anonymous(aPath, init)).status === 401, `Anonymous ${init.method} is denied`);
  }

  const ownerRead = await requestA(aPath);
  ok(ownerRead.status === 200 && ownerRead.body?.idea?.title === a.title, "Owner can still read the unchanged idea");
  const invalidPatch = await requestA(aPath, { method: "PATCH", body: JSON.stringify({ status: "invalid" }) });
  ok(invalidPatch.status === 400, "Rejects an invalid status update");
  const changes = { title: "Updated A", content: "Updated content", category: "business", status: "completed", priority: "low" };
  const update = await requestA(aPath, {
    method: "PATCH",
    body: JSON.stringify({ ...changes, userId: userIdB }),
  });
  ok(update.status === 200, "Owner can edit their idea");
  const refreshed = await requestA("/api/ideas");
  const persisted = refreshed.body?.ideas?.find((idea) => idea.id === a.id);
  ok(persisted && Object.entries(changes).every(([key, value]) => persisted[key] === value) &&
    persisted.createdAt === a.createdAt && persisted.updatedAt > a.updatedAt,
  "Updated fields and completed status persist on reload; creation time is unchanged");
  ok((await requestB(aPath)).status === 404, "PATCH cannot transfer ownership");
  ok((await requestA(aPath, { method: "DELETE" })).status === 204, "Owner can manually delete their idea");
  ok((await requestA(aPath)).status === 404, "Deleted idea is gone");
  ok((await requestB(bPath)).status === 200, "User B's idea is unaffected");
}

async function main() {
  const emailA = `test-user-a-${RUN_ID}@example.test`;
  const emailB = `test-user-b-${RUN_ID}@example.test`;
  const password = "correct horse battery staple 1";

  console.log(`\n== 1. Signup ==`);
  const signupA = await signup(emailA, password);
  ok(signupA.status === 201, `signup User A -> 201 (got ${signupA.status})`);
  const signupB = await signup(emailB, password);
  ok(signupB.status === 201, `signup User B -> 201 (got ${signupB.status})`);

  const duplicateSignupA = await signup(emailA, password);
  ok(duplicateSignupA.status === 409, `duplicate signup for User A's email -> 409 (got ${duplicateSignupA.status})`);

  console.log(`\n== 2. Login ==`);
  const sessionA = await login(emailA, password);
  ok(sessionA.ok, "User A can log in and receives a session cookie");
  const sessionB = await login(emailB, password);
  ok(sessionB.ok, "User B can log in and receives a session cookie");

  const requestA = client(sessionA.jar);
  const requestB = client(sessionB.jar);
  const bSession = await requestB("/api/auth/session");
  ok(Boolean(bSession.body?.user?.id), "User B has a server-side profile ID for spoofing tests");
  await checkIdeas(requestA, requestB, bSession.body?.user?.id);

  console.log(`\n== 3. Unauthenticated access ==`);
  const noAuthDailyTasks = await fetch(`${BASE_URL}/api/daily-tasks`);
  ok(noAuthDailyTasks.status === 401, `GET /api/daily-tasks with no session -> 401 (got ${noAuthDailyTasks.status})`);

  console.log(`\n== 4. Seed data for both users ==`);
  const dataA = await seedUserData(requestA, "A");
  const dataB = await seedUserData(requestB, "B");

  ok(Boolean(dataA.dailyTaskId), "User A daily task created");
  ok(Boolean(dataA.weeklyGoalId), "User A weekly goal created");
  ok(Boolean(dataA.monthlyGoalId), "User A monthly goal created");
  ok(Boolean(dataA.dreamId), "User A dream created");
  ok(Boolean(dataA.journalEntryDate), "User A journal entry created");
  ok(Boolean(dataB.dailyTaskId), "User B daily task created");
  ok(Boolean(dataB.weeklyGoalId), "User B weekly goal created");
  ok(Boolean(dataB.monthlyGoalId), "User B monthly goal created");
  ok(Boolean(dataB.dreamId), "User B dream created");
  ok(Boolean(dataB.journalEntryDate), "User B journal entry created");

  console.log(`\n== 5. Each user sees only their own data ==`);
  const listA = await requestA("/api/daily-tasks");
  const listB = await requestB("/api/daily-tasks");
  ok(
    listA.body.dailyTasks.length === 1 && listA.body.dailyTasks[0].id === dataA.dailyTaskId,
    "User A daily-tasks list contains exactly A's task, nothing from B",
  );
  ok(
    listB.body.dailyTasks.length === 1 && listB.body.dailyTasks[0].id === dataB.dailyTaskId,
    "User B daily-tasks list contains exactly B's task, nothing from A",
  );

  const weeklyListA = await requestA("/api/weekly-goals");
  const weeklyListB = await requestB("/api/weekly-goals");
  ok(
    weeklyListA.body.weeklyGoals.length === 1 && weeklyListA.body.weeklyGoals[0].id === dataA.weeklyGoalId,
    "User A weekly-goals list contains exactly A's goal",
  );
  ok(
    weeklyListB.body.weeklyGoals.length === 1 && weeklyListB.body.weeklyGoals[0].id === dataB.weeklyGoalId,
    "User B weekly-goals list contains exactly B's goal",
  );

  const monthlyListA = await requestA("/api/monthly-goals");
  const monthlyListB = await requestB("/api/monthly-goals");
  ok(
    monthlyListA.body.monthlyGoals.length === 1 && monthlyListA.body.monthlyGoals[0].id === dataA.monthlyGoalId,
    "User A monthly-goals list contains exactly A's goal",
  );
  ok(
    monthlyListB.body.monthlyGoals.length === 1 && monthlyListB.body.monthlyGoals[0].id === dataB.monthlyGoalId,
    "User B monthly-goals list contains exactly B's goal",
  );

  const dreamsA = await requestA("/api/dreams");
  const dreamsB = await requestB("/api/dreams");
  ok(
    dreamsA.body.dreams.length === 1 && dreamsA.body.dreams[0].id === dataA.dreamId,
    "User A dreams list contains exactly A's dream",
  );
  ok(
    dreamsB.body.dreams.length === 1 && dreamsB.body.dreams[0].id === dataB.dreamId,
    "User B dreams list contains exactly B's dream",
  );

  const journalListA = await requestA("/api/journal-entries");
  const journalListB = await requestB("/api/journal-entries");
  ok(
    journalListA.body.journalEntries.length === 1,
    "User A journal-entries list contains exactly one entry (A's own)",
  );
  ok(
    journalListB.body.journalEntries.length === 1,
    "User B journal-entries list contains exactly one entry (B's own)",
  );
  ok(
    journalListA.body.journalEntries[0].rawTranscript.startsWith("A "),
    "User A's journal entry content belongs to A, not B",
  );
  ok(
    journalListB.body.journalEntries[0].rawTranscript.startsWith("B "),
    "User B's journal entry content belongs to B, not A",
  );

  console.log(`\n== 6. Cross-user attacks: User B targeting User A's records ==`);

  const attackDailyTaskPatch = await requestB(`/api/daily-tasks/${dataA.dailyTaskId}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "HACKED BY B" }),
  });
  ok(
    attackDailyTaskPatch.status === 404,
    `B PATCH /api/daily-tasks/<A's id> -> 404 (got ${attackDailyTaskPatch.status})`,
  );

  const attackDailyTaskDelete = await requestB(`/api/daily-tasks/${dataA.dailyTaskId}`, {
    method: "DELETE",
  });
  ok(
    attackDailyTaskDelete.status === 404,
    `B DELETE /api/daily-tasks/<A's id> -> 404 (got ${attackDailyTaskDelete.status})`,
  );

  const attackWeeklyGoalPatch = await requestB(`/api/weekly-goals/${dataA.weeklyGoalId}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "HACKED BY B" }),
  });
  ok(
    attackWeeklyGoalPatch.status === 404,
    `B PATCH /api/weekly-goals/<A's id> -> 404 (got ${attackWeeklyGoalPatch.status})`,
  );

  const attackWeeklyGoalDelete = await requestB(`/api/weekly-goals/${dataA.weeklyGoalId}`, {
    method: "DELETE",
  });
  ok(
    attackWeeklyGoalDelete.status === 404,
    `B DELETE /api/weekly-goals/<A's id> -> 404 (got ${attackWeeklyGoalDelete.status})`,
  );

  const attackMonthlyGoalPatch = await requestB(`/api/monthly-goals/${dataA.monthlyGoalId}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "HACKED BY B" }),
  });
  ok(
    attackMonthlyGoalPatch.status === 404,
    `B PATCH /api/monthly-goals/<A's id> -> 404 (got ${attackMonthlyGoalPatch.status})`,
  );

  const attackMonthlyGoalDelete = await requestB(`/api/monthly-goals/${dataA.monthlyGoalId}`, {
    method: "DELETE",
  });
  ok(
    attackMonthlyGoalDelete.status === 404,
    `B DELETE /api/monthly-goals/<A's id> -> 404 (got ${attackMonthlyGoalDelete.status})`,
  );

  const attackDreamGet = await requestB(`/api/dreams/${dataA.dreamId}`);
  ok(attackDreamGet.status === 404, `B GET /api/dreams/<A's id> -> 404 (got ${attackDreamGet.status})`);

  const attackDreamPatch = await requestB(`/api/dreams/${dataA.dreamId}`, {
    method: "PATCH",
    body: JSON.stringify({ content: "HACKED BY B" }),
  });
  ok(attackDreamPatch.status === 404, `B PATCH /api/dreams/<A's id> -> 404 (got ${attackDreamPatch.status})`);

  const attackDreamDelete = await requestB(`/api/dreams/${dataA.dreamId}`, {
    method: "DELETE",
  });
  ok(attackDreamDelete.status === 404, `B DELETE /api/dreams/<A's id> -> 404 (got ${attackDreamDelete.status})`);

  // B tries to finalize/read A's journal entry by guessing the shared date.
  const attackJournalSection = await requestB(
    `/api/journal-entries/${dataA.journalEntryDate}/sections/morning`,
    {
      method: "PATCH",
      body: JSON.stringify({ content: "HACKED BY B", rawTranscript: "", editedTranscript: "", language: "nl", lifeAreas: [] }),
    },
  );
  const bJournalAfterSectionAttack = await requestB("/api/journal-entries");
  ok(
    attackJournalSection.status === 200,
    `B PATCH /api/journal-entries/<A's date>/sections/morning -> 200 (writes into B's OWN entry for that date, not A's)`,
  );
  ok(
    bJournalAfterSectionAttack.body.journalEntries.length === 1,
    "B still has exactly one journal entry after the attack (their own for that date, unaffected by A's)",
  );

  const journalAAfterAttack = await requestA("/api/journal-entries");
  const entryAAfter = journalAAfterAttack.body.journalEntries.find(
    (entry) => entry.date === dataA.journalEntryDate,
  );
  ok(
    entryAAfter && entryAAfter.rawTranscript.startsWith("A "),
    "User A's own journal entry for that date is completely unaffected by B's attempt",
  );
  ok(
    !JSON.stringify(entryAAfter?.sections ?? {}).includes("HACKED BY B"),
    "User A's journal sections do not contain B's injected content",
  );

  console.log(`\n== 7. Cross-user linking is refused (goal ids from another user) ==`);

  const linkAttackDailyTask = await requestB("/api/daily-tasks", {
    method: "POST",
    body: JSON.stringify({
      title: "B task linked to A's weekly goal",
      note: "",
      date: "2026-09-17",
      priority: "medium",
      lifeArea: "",
      completed: false,
      carryOverCount: 0,
      weeklyGoalId: dataA.weeklyGoalId,
    }),
  });
  ok(
    linkAttackDailyTask.status === 404,
    `B creating a daily task linked to A's weeklyGoalId -> 404 (got ${linkAttackDailyTask.status})`,
  );

  const linkAttackDailyTaskMonthly = await requestB("/api/daily-tasks", {
    method: "POST",
    body: JSON.stringify({
      title: "B task linked to A's monthly goal",
      note: "",
      date: "2026-09-17",
      priority: "medium",
      lifeArea: "",
      completed: false,
      carryOverCount: 0,
      monthlyGoalId: dataA.monthlyGoalId,
    }),
  });
  ok(
    linkAttackDailyTaskMonthly.status === 404,
    `B creating a daily task linked to A's monthlyGoalId -> 404 (got ${linkAttackDailyTaskMonthly.status})`,
  );

  const linkAttackWeeklyGoal = await requestB("/api/weekly-goals", {
    method: "POST",
    body: JSON.stringify({
      title: "B weekly goal linked to A's monthly goal",
      description: "",
      startDate: "2026-09-14",
      endDate: "2026-09-20",
      lifeArea: "",
      status: "not_started",
      progressMode: "linked_items",
      progress: 0,
      monthlyGoalId: dataA.monthlyGoalId,
    }),
  });
  ok(
    linkAttackWeeklyGoal.status === 404,
    `B creating a weekly goal linked to A's monthlyGoalId -> 404 (got ${linkAttackWeeklyGoal.status})`,
  );

  const linkAttackUpdate = await requestB("/api/daily-tasks", {
    method: "POST",
    body: JSON.stringify({
      title: "B task, no link",
      note: "",
      date: "2026-09-17",
      priority: "medium",
      lifeArea: "",
      completed: false,
      carryOverCount: 0,
    }),
  });
  const bTaskId = linkAttackUpdate.body?.dailyTask?.id;
  const relinkAttack = await requestB(`/api/daily-tasks/${bTaskId}`, {
    method: "PATCH",
    body: JSON.stringify({ weeklyGoalId: dataA.weeklyGoalId }),
  });
  ok(
    relinkAttack.status === 404,
    `B re-linking their OWN task to A's weeklyGoalId via PATCH -> 404 (got ${relinkAttack.status})`,
  );

  console.log(`\n== 8. A's data is untouched after all attacks ==`);
  const finalDailyTaskA = await requestA(`/api/daily-tasks`);
  const finalTaskA = finalDailyTaskA.body.dailyTasks.find((t) => t.id === dataA.dailyTaskId);
  ok(finalTaskA && finalTaskA.title === "A daily task", "A's daily task title is unchanged");

  const finalWeeklyA = await requestA(`/api/weekly-goals`);
  const finalWeeklyGoalA = finalWeeklyA.body.weeklyGoals.find((g) => g.id === dataA.weeklyGoalId);
  ok(finalWeeklyGoalA && finalWeeklyGoalA.title === "A weekly goal", "A's weekly goal title is unchanged");

  const finalMonthlyA = await requestA(`/api/monthly-goals`);
  const finalMonthlyGoalA = finalMonthlyA.body.monthlyGoals.find((g) => g.id === dataA.monthlyGoalId);
  ok(finalMonthlyGoalA && finalMonthlyGoalA.title === "A monthly goal", "A's monthly goal title is unchanged");

  const finalDreamsA = await requestA(`/api/dreams`);
  const finalDreamA = finalDreamsA.body.dreams.find((d) => d.id === dataA.dreamId);
  ok(finalDreamA && finalDreamA.content === "A dream content", "A's dream content is unchanged");

  console.log(`\n== Summary ==`);
  console.log(`  ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) {
    console.log(`\nFailed checks:`);
    for (const label of failures) {
      console.log(`  - ${label}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Test script crashed:", error);
  process.exitCode = 1;
});
