export type GoalStatus = "not_started" | "in_progress" | "completed" | "paused";
export type TaskPriority = "low" | "medium" | "high";
export type JournalPreset = "trading" | "business" | "personal" | "custom";
export type AppTheme = "light" | "dark";
export type InsightType =
  | "today"
  | "weekly"
  | "monthly"
  | "blocker"
  | "balance"
  | "coaching";
export type JournalSentiment = "low" | "steady" | "uplifted";
export type WeeklyState =
  | "On Track"
  | "Slightly Overloaded"
  | "Needs Reset"
  | "Recovering Well"
  | "Gaining Momentum"
  | "Mixed Week";
export type JournalFieldInputType = "textarea" | "text" | "scale";

export interface MonthlyGoal {
  id: string;
  title: string;
  description: string;
  month: number;
  year: number;
  lifeArea: string;
  status: GoalStatus;
  progress: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyGoal {
  id: string;
  monthlyGoalId: string | null;
  title: string;
  description: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  lifeArea: string;
  status: GoalStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyTask {
  id: string;
  weeklyGoalId: string | null;
  title: string;
  note: string;
  date: string;
  priority: TaskPriority;
  lifeArea: string;
  completed: boolean;
  carryOverCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyFocus {
  id: string;
  date: string;
  mainFocus: string;
  secondaryFocuses: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TomorrowSetup {
  mainFocus: string;
  topTasks: string[];
  watchOutFor: string;
  intention: string;
}

export interface JournalConfigSection {
  id: string;
  title: string;
  description: string;
  placeholder: string;
  rows: number;
  enabled: boolean;
  order: number;
}

export interface JournalConfig {
  sections: JournalConfigSection[];
  tomorrowSetupEnabled: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  language: "nl" | "en";
  theme: AppTheme;
  showTomorrow: boolean;
  journalSectionsEnabled: string[];
  onboardingCompleted: boolean;
  journalPreset: JournalPreset | null;
  journalConfig: JournalConfig | null;
  createdAt: string;
  updatedAt: string;
}

export type JournalFieldValues = Record<string, string>;
export type JournalSections = Record<string, JournalFieldValues>;

export interface JournalEntry {
  id: string;
  date: string;
  sections: JournalSections;
  rawTranscript: string;
  editedTranscript: string;
  aiSummary: string;
  aiSummaryError: string | null;
  aiSummaryUpdatedAt?: string;
  sentiment: JournalSentiment;
  moodScore: number;
  powerLevel: number;
  lifeAreasMentioned: string[];
  blockersDetected: string[];
  oneSentenceDaySummary: string;
  tomorrowSetup: TomorrowSetup;
  createdAt: string;
  updatedAt: string;
}

export interface DateRange {
  label: string;
  start: string;
  end: string;
}

export interface AiInsight {
  id: string;
  type: InsightType;
  dateRange: DateRange;
  title: string;
  summary: string;
  suggestions: string[];
  detectedPatterns: string[];
  recurringBlockers: string[];
  stateOfWeek?: WeeklyState;
  priorityAreas: string[];
  createdAt: string;
}

export interface MonthlyPatternProfile {
  id: string;
  month: number;
  year: number;
  strongestPatterns: string[];
  blockers: string[];
  productiveConditions: string[];
  weakerPatterns: string[];
  lifeAreaDistribution: Record<string, number>;
  monthlyAdvice: string[];
  createdAt: string;
}

export interface JournalTemplateField {
  id: string;
  label: string;
  helperText: string;
  placeholder: string;
  inputType?: JournalFieldInputType;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface JournalTemplateSection {
  id: string;
  title: string;
  description: string;
  fields: JournalTemplateField[];
}

export interface JournalActionSuggestion {
  id: string;
  text: string;
  context: string;
}

export interface CorrelationSnapshot {
  summary: string;
  highPowerCompletionRate: number;
  lowPowerCompletionRate: number;
  trend: string;
}

export interface LifeAreaBalanceSnapshot {
  dominant: string[];
  neglected: string[];
  summary: string;
  distribution: Record<string, number>;
}

export interface StreakSnapshot {
  reflectionStreak: number;
  focusStreak: number;
  planningConsistencyStreak: number;
  supportiveCopy: string[];
}

export interface WeeklyReviewSnapshot {
  weekLabel: string;
  completedTasks: DailyTask[];
  incompleteTasks: DailyTask[];
  carryOverTasks: DailyTask[];
  journalEntries: JournalEntry[];
  blockerThemes: string[];
  suggestions: string[];
  stateOfWeek: WeeklyState;
  suggestedFocus: string;
}

export interface TodaySuggestion {
  title: string;
  summary: string;
  suggestions: string[];
}

export interface AppState {
  version: number;
  initializedAt: string;
  lifeAreas: string[];
  monthlyGoals: MonthlyGoal[];
  weeklyGoals: WeeklyGoal[];
  dailyTasks: DailyTask[];
  dailyFocuses: DailyFocus[];
  journalEntries: JournalEntry[];
}

export interface MonthlyGoalInput {
  title: string;
  description: string;
  month: number;
  year: number;
  lifeArea: string;
  status?: GoalStatus;
  dueDate?: string;
}

export interface WeeklyGoalInput {
  monthlyGoalId: string | null;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  lifeArea: string;
  status?: GoalStatus;
}

export interface DailyTaskInput {
  weeklyGoalId: string | null;
  title: string;
  note: string;
  date: string;
  priority: TaskPriority;
  lifeArea: string;
}

export interface DailyFocusInput {
  date: string;
  mainFocus: string;
  secondaryFocuses: string[];
}

export interface JournalEntryInput {
  date: string;
  sections: JournalSections;
  rawTranscript: string;
  editedTranscript: string;
  tomorrowSetup: TomorrowSetup;
}
