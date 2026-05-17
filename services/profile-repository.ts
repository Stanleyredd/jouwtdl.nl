import "server-only";

import { compare, hash } from "bcryptjs";
import { Prisma, type Profile } from "@prisma/client";

import { getPrismaClient } from "@/lib/prisma";
import type { JournalPreset, UserProfile } from "@/types";
import {
  DEFAULT_JOURNAL_SECTION_IDS,
  mapProfileRecord,
  normalizeProfileInput,
  type SaveProfileInput,
} from "@/services/profile-service";

interface AuthUserRecord {
  id: string;
  email: string | null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toSafeEmailIdentifier(email: string | null | undefined) {
  if (!email) {
    return "unknown";
  }

  const normalized = normalizeEmail(email);
  const [localPart, domain = ""] = normalized.split("@");
  const visibleLocal = localPart.slice(0, Math.min(localPart.length, 2));
  const maskedLocal = `${visibleLocal}${"*".repeat(Math.max(localPart.length - visibleLocal.length, 0))}`;

  return domain ? `${maskedLocal}@${domain}` : maskedLocal;
}

function serializeError(error: unknown) {
  if (!(error instanceof Error) && (typeof error !== "object" || error === null)) {
    return {
      message: String(error),
    };
  }

  const candidate = error as Error & {
    code?: string;
    details?: string;
    hint?: string;
    name?: string;
    status?: number;
  };

  return {
    name: candidate.name,
    message: candidate.message,
    code: candidate.code,
    details: candidate.details,
    hint: candidate.hint,
    status: candidate.status,
    keys: Object.keys(candidate),
  };
}

function logProfileEvent(
  event: string,
  payload: Record<string, unknown>,
  options?: { always?: boolean; level?: "info" | "warn" | "error" },
) {
  if (!options?.always && process.env.NODE_ENV !== "development") {
    return;
  }

  const logger =
    options?.level === "error"
      ? console.error
      : options?.level === "warn"
        ? console.warn
        : console.info;

  logger("[profile-repository]", event, payload);
  logger(
    "[profile-repository]",
    `${event}:details`,
    JSON.stringify(payload, null, 2),
  );
}

function mapPrismaProfile(profile: Profile): UserProfile {
  return mapProfileRecord({
    id: profile.id,
    email: profile.email,
    language: profile.language,
    theme: profile.theme,
    showTomorrow: profile.showTomorrow,
    journalSectionsEnabled: profile.journalSectionsEnabled,
    onboardingCompleted: profile.onboardingCompleted,
    journalPreset: profile.journalPreset,
    journalConfig: profile.journalConfig,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  });
}

function buildDefaultProfileData(
  user: AuthUserRecord,
  passwordHash?: string,
): Prisma.ProfileCreateInput {
  const data: Prisma.ProfileCreateInput = {
    id: user.id,
    email: normalizeEmail(user.email ?? ""),
    language: "nl",
    theme: "light",
    showTomorrow: true,
    journalSectionsEnabled: DEFAULT_JOURNAL_SECTION_IDS,
    onboardingCompleted: false,
    journalPreset: null as JournalPreset | null,
    journalConfig: Prisma.JsonNull,
  };

  if (passwordHash) {
    data.passwordHash = passwordHash;
  };

  return data;
}

export async function getProfileForUser(userId: string) {
  const prisma = getPrismaClient();
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
  });

  return profile ? mapPrismaProfile(profile) : null;
}

export async function ensureProfileForUser(user: AuthUserRecord) {
  const prisma = getPrismaClient();

  logProfileEvent("profile-load-started", {
    userId: user.id,
    email: toSafeEmailIdentifier(user.email),
  });

  const existingProfile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  logProfileEvent("profile-load-result", {
    userId: user.id,
    found: Boolean(existingProfile),
  });

  if (existingProfile) {
    const mapped = mapPrismaProfile(existingProfile);
    logProfileEvent("final-profile-state", {
      userId: user.id,
      onboardingCompleted: mapped.onboardingCompleted,
      journalPreset: mapped.journalPreset,
      hasJournalConfig: Boolean(mapped.journalConfig),
    });
    return mapped;
  }

  logProfileEvent("profile-missing", {
    userId: user.id,
  });

  try {
    logProfileEvent("profile-create-started", {
      userId: user.id,
    });

    const createdProfile = await prisma.profile.create({
      data: buildDefaultProfileData(user),
    });

    logProfileEvent("profile-create-succeeded", {
      userId: user.id,
    });

    return mapPrismaProfile(createdProfile);
  } catch (error) {
    logProfileEvent(
      "profile-create-failed",
      {
        userId: user.id,
        email: toSafeEmailIdentifier(user.email),
        error: serializeError(error),
      },
      { always: true, level: "error" },
    );
    throw new Error("Your profile could not be loaded right now.");
  }
}

export async function saveProfileForUser(user: AuthUserRecord, input: SaveProfileInput) {
  const prisma = getPrismaClient();
  const normalizedInput = normalizeProfileInput(input);
  const email = normalizeEmail(user.email ?? "");

  const createData = buildDefaultProfileData(user);
  const updateData: Prisma.ProfileUpdateInput = {
    email,
  };

  if (normalizedInput.onboardingCompleted !== undefined) {
    createData.onboardingCompleted = normalizedInput.onboardingCompleted;
    updateData.onboardingCompleted = normalizedInput.onboardingCompleted;
  }

  if (normalizedInput.journalPreset !== undefined) {
    createData.journalPreset = normalizedInput.journalPreset;
    updateData.journalPreset = normalizedInput.journalPreset;
  }

  if (normalizedInput.journalConfig !== undefined) {
    createData.journalConfig =
      normalizedInput.journalConfig === null
        ? Prisma.JsonNull
        : (normalizedInput.journalConfig as unknown as Prisma.InputJsonValue);
    updateData.journalConfig =
      normalizedInput.journalConfig === null
        ? Prisma.JsonNull
        : (normalizedInput.journalConfig as unknown as Prisma.InputJsonValue);
    createData.journalSectionsEnabled =
      normalizedInput.journalConfig?.sections
        .filter((section) => section.enabled)
        .map((section) => section.id) ?? DEFAULT_JOURNAL_SECTION_IDS;
    updateData.journalSectionsEnabled = createData.journalSectionsEnabled;
  }

  logProfileEvent("profile-save-started", {
    userId: user.id,
    email: toSafeEmailIdentifier(user.email),
    payloadKeys: Object.keys(updateData),
  });

  try {
    const savedProfile = await prisma.profile.upsert({
      where: { id: user.id },
      create: createData,
      update: updateData,
    });

    const mapped = mapPrismaProfile(savedProfile);

    logProfileEvent("profile-save-succeeded", {
      userId: user.id,
      onboardingCompleted: mapped.onboardingCompleted,
      journalPreset: mapped.journalPreset,
      hasJournalConfig: Boolean(mapped.journalConfig),
    });

    return mapped;
  } catch (error) {
    logProfileEvent(
      "profile-save-failed",
      {
        userId: user.id,
        email: toSafeEmailIdentifier(user.email),
        payloadKeys: Object.keys(updateData),
        error: serializeError(error),
      },
      { always: true, level: "error" },
    );

    throw new Error("Your profile could not be saved right now.");
  }
}

export async function createUserWithPassword(input: {
  email: string;
  password: string;
}) {
  const prisma = getPrismaClient();
  const email = normalizeEmail(input.email);
  const safeEmail = toSafeEmailIdentifier(email);

  logProfileEvent("signup-started", {
    action: "signup",
    email: safeEmail,
  });

  const existingUser = await prisma.profile.findFirst({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    logProfileEvent(
      "signup-failed",
      {
        action: "signup",
        email: safeEmail,
        message: "An account with this email already exists.",
      },
      { always: true, level: "warn" },
    );
    throw new Error("An account with this email already exists.");
  }

  try {
    const passwordHash = await hash(input.password, 12);
    const createdUser = await prisma.profile.create({
      data: buildDefaultProfileData(
        {
          id: crypto.randomUUID(),
          email,
        },
        passwordHash,
      ),
    });

    logProfileEvent("signup-succeeded", {
      action: "signup",
      email: safeEmail,
      userId: createdUser.id,
    });

    return {
      id: createdUser.id,
      email: createdUser.email,
    };
  } catch (error) {
    logProfileEvent(
      "signup-failed",
      {
        action: "signup",
        email: safeEmail,
        error: serializeError(error),
      },
      { always: true, level: "error" },
    );
    throw new Error("Your account could not be created right now.");
  }
}

export async function verifyUserCredentials(input: {
  email: string;
  password: string;
}) {
  const prisma = getPrismaClient();
  const email = normalizeEmail(input.email);
  const safeEmail = toSafeEmailIdentifier(email);

  try {
    const user = await prisma.profile.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash) {
      logProfileEvent(
        "login-denied",
        {
          action: "login",
          email: safeEmail,
          message: "Invalid email or password.",
        },
        { always: true, level: "warn" },
      );
      return null;
    }

    const passwordMatches = await compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      logProfileEvent(
        "login-denied",
        {
          action: "login",
          email: safeEmail,
          message: "Invalid email or password.",
        },
        { always: true, level: "warn" },
      );
      return null;
    }

    logProfileEvent("login-succeeded", {
      action: "login",
      email: safeEmail,
      userId: user.id,
    });

    return {
      id: user.id,
      email: user.email,
    };
  } catch (error) {
    logProfileEvent(
      "login-failed",
      {
        action: "login",
        email: safeEmail,
        error: serializeError(error),
      },
      { always: true, level: "error" },
    );
    throw new Error("Invalid email or password.");
  }
}
